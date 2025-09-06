import { OnModuleInit, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatsGateway implements OnModuleInit {
	private readonly logger = new Logger(ChatsGateway.name);
	private userSockets = new Map<number, Set<string>>(); // userId -> socketIds
	// Дедублікація RTM повідомлень (messageId -> timestamp)
	private processedMessageIds = new Map<number, number>();
	private readonly MESSAGE_DEDUP_TTL_MS = 30_000; // 30 секунд
	// Дедублікація email (emailId -> timestamp)
	private processedEmailIds = new Map<number, number>();

	@WebSocketServer()
	server!: Server;

	constructor(
		private readonly jwt: JwtService,
		private readonly rtmService: TalkyTimesRTMService
	) {}

	onModuleInit(): void {
		this.logger.log('🔌 WebSocket Gateway initialized');
	}

	// Обробка RTM подій
	@OnEvent('rtm.message.sent')
	handleRTMMessage(data: any) {
		this.logger.log(`📨 RTM Message: ${data.idUserFrom} -> ${data.idUserTo}`);
		
		// Створюємо dialogId для повідомлення
		const dialogId = `${data.idUserFrom}-${data.idUserTo}`;
		const reverseDialogId = `${data.idUserTo}-${data.idUserFrom}`;
		
		// Відправляємо повідомлення в обидві кімнати діалогу
		this.server.to(`dlg:${dialogId}`).emit('message', {
			id: Date.now(), // Тимчасовий ID
			idUserFrom: data.idUserFrom,
			idUserTo: data.idUserTo,
			content: data.content,
			type: data.type,
			dateCreated: data.dateCreated
		});
		
		this.server.to(`dlg:${reverseDialogId}`).emit('message', {
			id: Date.now(),
			idUserFrom: data.idUserFrom,
			idUserTo: data.idUserTo,
			content: data.content,
			type: data.type,
			dateCreated: data.dateCreated
		});
	}



	@OnEvent('rtm.message.new')
	handleRTMNewMessage(data: any) {
		this.logger.log(`🍞 RTM New Message Toast: ${data.idUserFrom} -> ${data.idUserTo}`);
		this.logger.log('🍞 RTM New Message data:', JSON.stringify(data, null, 2));

		// Дедублікація за messageId з коротким TTL
		const messageId = Number(data.messageId);
		const now = Date.now();
		if (!isNaN(messageId)) {
			// Очистка застарілих записів
			for (const [mid, ts] of this.processedMessageIds) {
				if (now - ts > this.MESSAGE_DEDUP_TTL_MS) {
					this.processedMessageIds.delete(mid);
				}
			}

			const lastTs = this.processedMessageIds.get(messageId);
			if (lastTs && (now - lastTs) <= this.MESSAGE_DEDUP_TTL_MS) {
				this.logger.log(`🧹 DEDUP: Skipping duplicate messageId=${messageId}`);
				return;
			}
			this.processedMessageIds.set(messageId, now);
		}

		// 1) Тост усім (як і було)
		// Формат dialogId у фронті: `${idProfile}-${idRegularUser}`
		// ВАЖЛИВО: завжди ставимо НАШ профіль (data.profileId) першим
		const profileId = Number(data.profileId);
		const interlocutorId = data.idUserFrom === profileId ? data.idUserTo : data.idUserFrom;
		const dialogId = `${profileId}-${interlocutorId}`;
		const toastPayload = {
			messageId: data.messageId,
			idUserFrom: data.idUserFrom,
			idUserTo: data.idUserTo,
			dateCreated: data.dateCreated,
			type: 'new_message',
			dialogId
		};
		this.server.emit('message_toast', toastPayload);

		// 2) Якщо у кімнаті діалогу є клієнти — відправляємо реальне повідомлення в кімнату
		const room = `dlg:${dialogId}`;
		const roomSize = this.server.sockets?.adapter?.rooms?.get(room)?.size || 0;
		if (roomSize > 0) {
			this.logger.log(`💬 Emitting message to active dialog room ${room} (clients: ${roomSize})`);
			const content = data.content || {};
			const fullMessage = data.message || {};
			const msgType: string = data.type || (fullMessage as any).type || (content as any).type || 'message';

			const plainText = (content as any).message ?? (content as any).text ?? '';
			this.server.to(room).emit('message', {
				id: data.messageId,
				idUserFrom: data.idUserFrom,
				idUserTo: data.idUserTo,
				type: msgType,
				content: (fullMessage as any).content || content,
				message: plainText,
				dateCreated: data.dateCreated
			});
		}
	}

	// Нові листи: емісія тосту та службового айтема у список діалогів
	@OnEvent('rtm.email.new')
	handleRTMEmailNew(data: any) {
		this.logger.log(`✉️ RTM New Email: ${data.idUserFrom} -> ${data.idUserTo}`);

		// Дедублікація за emailId
		const emailId = Number(data.emailId);
		const now = Date.now();
		if (!isNaN(emailId)) {
			for (const [eid, ts] of this.processedEmailIds) {
				if (now - ts > this.MESSAGE_DEDUP_TTL_MS) this.processedEmailIds.delete(eid);
			}
			const last = this.processedEmailIds.get(emailId);
			if (last && now - last <= this.MESSAGE_DEDUP_TTL_MS) {
				this.logger.log(`🧹 DEDUP EMAIL: Skipping duplicate emailId=${emailId}`);
				return;
			}
			this.processedEmailIds.set(emailId, now);
		}

		// Формуємо dialogId у форматі `${profileId}-${interlocutorId}`
		const profileId = Number(data.profileId);
		const interlocutorId = data.idUserFrom === profileId ? data.idUserTo : data.idUserFrom;
		const dialogId = `${profileId}-${interlocutorId}`;

		// 1) Тост про новий лист
		this.server.emit('message_toast', {
			messageId: data.emailId,
			idUserFrom: data.idUserFrom,
			idUserTo: data.idUserTo,
			dateCreated: data.dateCreated,
			type: 'new_email',
			dialogId,
			correspondenceId: data.correspondenceId,
			title: data.title
		});

		// 2) В кімнату діалогу не шлемо вміст листа; відображення відбудеться у списку
	}

	@OnEvent('rtm.message.read')
	handleRTMMessageRead(data: any) {
		this.logger.log(`👁️ RTM Message Read: ${data.messageId} by ${data.idInterlocutor}`);
		
		// Відправляємо статус прочитання всім підключеним клієнтам
		this.server.emit('message_read', {
			messageId: data.messageId,
			idInterlocutor: data.idInterlocutor
		});
	}

	@OnEvent('rtm.dialog.limit.changed')
	handleRTMDialogLimitChanged(data: any) {
		this.logger.log(`📊 RTM Dialog Limit: User ${data.idUser}, limit ${data.limitLeft}`);
		
		// Створюємо dialogId для оновлення лімітів
		const dialogId = `${data.idUser}-${data.idInterlocutor}`;
		
		// Відправляємо оновлення лімітів в кімнату діалогу
		this.server.to(`dlg:${dialogId}`).emit('dialog_limit_changed', {
			idUser: data.idUser,
			idInterlocutor: data.idInterlocutor,
			limitLeft: data.limitLeft
		});
	}

	// Сповіщення фронтенду про завершення зміни (миттєвий редірект оператора)
	@OnEvent('shift.ended')
	handleShiftEnded(data: { operatorId: string }) {
		this.logger.log(`🛑 Shift ended for operator ${data.operatorId}, broadcasting event`);
		this.server.emit('shift_ended', { operatorId: data.operatorId });
	}

	emitNewMessage(event: { dialogId: string; payload: any }) {
		this.server.to(`dlg:${event.dialogId}`).emit('message', event.payload);
	}

	@SubscribeMessage('join')
	async join(@MessageBody() data: { dialogId: string }, @ConnectedSocket() client: Socket) {
		try {
			const token = (client.handshake.auth as any)?.token as string | undefined;
			if (!token) {
				client.disconnect(true);
				return { error: 'No token provided' };
			}

			const payload = await this.jwt.verifyAsync(token);
			const userId = payload.sub;

			// Зберігаємо зв'язок користувача з сокетом
			if (!this.userSockets.has(userId)) {
				this.userSockets.set(userId, new Set());
			}
			this.userSockets.get(userId)!.add(client.id);

			// Отримуємо ID профілю з dialogId (формат: profileId-interlocutorId)
			const profileId = parseInt(data.dialogId.split('-')[0]);
			if (!isNaN(profileId)) {
				// Підписуємося на RTM події для цього профілю
				this.rtmService.subscribeToUser(profileId.toString());
			}

			const room = `dlg:${data.dialogId}`;
			client.join(room);
			
			this.logger.log(`👤 User ${userId} joined dialog ${data.dialogId}`);
			return { joined: room, userId };

		} catch (error) {
			this.logger.error('❌ JWT verification failed', error);
			client.disconnect(true);
			return { error: 'Invalid token' };
		}
	}
}