import { OnModuleInit, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';

@WebSocketGateway({ namespace: '/ws', cors: { origin: '*' } })
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
		
		// Підписуємося на загальні події RTM
		this.rtmService.subscribeToOnline();
		this.rtmService.subscribeToBroadcast();
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

	@OnEvent('rtm.user.online')
	handleRTMOnlineStatus(data: { userId: number; isOnline: boolean }) {
		this.logger.log(`👤 RTM Online: User ${data.userId} is ${data.isOnline ? 'online' : 'offline'}`);
		
		// Відправляємо статус онлайн всім підключеним клієнтам
		this.server.emit('user_online_status', {
			userId: data.userId,
			isOnline: data.isOnline
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

			// Підписуємося на RTM події для цього користувача
			this.rtmService.subscribeToUser(userId);

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
					// Відписуємося від RTM подій для цього користувача
					this.rtmService.unsubscribeFromUser(userId);
					this.logger.log(`👤 User ${userId} disconnected from RTM`);
				}
				break;
			}
		}
	}
}
