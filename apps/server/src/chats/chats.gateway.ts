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

		// 1) Тост усім (як і було)
		// Формат dialogId у фронті: `${idProfile}-${idRegularUser}`
		// де idProfile = відправник (наш профіль), idRegularUser = співрозмовник
		const dialogId = `${data.idUserFrom}-${data.idUserTo}`;
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
			const text = data.content?.message ?? data.content?.text ?? '';
			this.server.to(room).emit('message', {
				id: data.messageId,
				idUserFrom: data.idUserFrom,
				idUserTo: data.idUserTo,
				type: 'message',
				content: { message: text },
				message: text,
				dateCreated: data.dateCreated
			});
		}
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

	@SubscribeMessage('leave')
	async leave(@MessageBody() data: { dialogId: string }, @ConnectedSocket() client: Socket) {
		const room = `dlg:${data.dialogId}`;
		client.leave(room);
		return { left: room };
	}

	// Обробка відключення клієнта
	handleDisconnect(client: Socket) {
		// Видаляємо сокет з усіх користувачів
		for (const [userId, sockets] of this.userSockets.entries()) {
			if (sockets.has(client.id)) {
				sockets.delete(client.id);
				
				// Якщо у користувача не залишилося активних сокетів
				if (sockets.size === 0) {
					this.userSockets.delete(userId);
					// НЕ відписуємося від RTM - RTM працює з профілями, а не з операторами
					this.logger.log(`👤 User ${userId} disconnected from WebSocket`);
				}
				break;
			}
		}
	}
}
