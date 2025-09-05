import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import { TalkyTimesSessionService } from './session.service';
import * as fs from 'fs';
import * as path from 'path';

interface RTMMessage {
	id?: number;
	connect?: {
		client: string;
		version: string;
		subs?: Record<string, any>;
		ping?: number;
		pong?: boolean;
	};
	subscribe?: {
		channel: string;
		recoverable?: boolean;
		epoch?: string;
		offset?: string | number;
		positioned?: boolean;
	};
	push?: {
		channel: string;
		pub: {
			data: any;
		};
	};
	error?: {
		code: number;
		message: string;
	};
}

interface ProfileConnection {
	ws: WebSocket;
	heartbeatInterval: NodeJS.Timeout;
	reconnectTimeout?: NodeJS.Timeout;
	reconnectAttempts: number;
	session: any;
}

@Injectable()
export class TalkyTimesRTMService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TalkyTimesRTMService.name);
	private connections = new Map<number, ProfileConnection>(); // Окреме підключення для кожного профілю
	private readonly maxReconnectAttempts = 3;
	private readonly reconnectDelay = 3000; // 3 секунди між спробами
	private readonly connectionTimeout = 10000; // 10 секунд таймаут підключення
	private isConnecting = false;

	// Файлове логування всіх RTM повідомлень (apps/server/tt-rtm-messages.log)
	private readonly rtmLogFilePath = path.resolve(process.cwd(), 'tt-rtm-messages.log');

	private appendRtmLog(entry: Record<string, unknown>): void {
		try {
			const payload = { timestamp: new Date().toISOString(), ...entry };
			fs.appendFileSync(this.rtmLogFilePath, JSON.stringify(payload) + '\n', 'utf8');
		} catch (e) {
			// ігноруємо помилки файлового логування, не впливаємо на роботу сервісу
		}
	}

	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly sessionService: TalkyTimesSessionService
	) {}

	async onModuleInit() {
		this.logger.log('🚀 RTM Service initializing...');
		await this.connect();
	}

	onModuleDestroy() {
		this.cleanup();
	}

	private cleanup() {
		// Закриваємо всі підключення
		for (const [profileId, connection] of this.connections) {
			this.logger.log(`🔌 RTM: Closing connection for profile ${profileId}`);
			connection.ws.close();
			if (connection.heartbeatInterval) {
				clearInterval(connection.heartbeatInterval);
			}
			if (connection.reconnectTimeout) {
				clearTimeout(connection.reconnectTimeout);
			}
		}
		this.connections.clear();
		this.isConnecting = false;
	}

	private async connect() {
		if (this.isConnecting) {
			this.logger.log('🔌 RTM: Already connecting');
			return;
		}

		this.isConnecting = true;
		this.logger.log('🔌 RTM: Starting connections for all profiles...');

		try {
			const sessions = await this.sessionService.getAllActiveSessions();
			if (!sessions.length) {
				this.logger.warn('⚠️ RTM: No active sessions found');
				this.isConnecting = false;
				return;
			}

			this.logger.log(`🔌 RTM: Found ${sessions.length} profiles to connect`);

			// Створюємо окреме підключення для кожного профілю
			for (const session of sessions) {
				await this.connectProfile(session);
				// Невелика затримка між підключеннями
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			this.isConnecting = false;
			this.logger.log(`✅ RTM: All connections established (${this.connections.size} profiles)`);
		} catch (error) {
			this.isConnecting = false;
			this.logger.error('❌ RTM: Connection error:', error);
		}
	}

	private async connectProfile(session: any) {
		const profileId = session.profileId;
		const timestamp = new Date().toISOString();
		
		// Перевіряємо чи вже підключені
		if (this.connections.has(profileId)) {
			this.logger.log(`🔌 RTM: Profile ${profileId} already connected`);
			return;
		}

		this.logger.log(`🔌 RTM: Connecting profile ${profileId} with own cookies at ${timestamp}`);
		
		// Валідуємо сесію
		const isValid = await this.sessionService.validateSession(profileId.toString());
		if (!isValid) {
			this.logger.warn(`⚠️ RTM: Session validation failed for profile ${profileId}`);
			return;
		}

		const headers = {
			'Origin': 'https://talkytimes.com',
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
			'Cookie': session.cookies
		};

		const ws = new WebSocket('wss://talkytimes.com/rtm', { headers });

		const connectionTimeout = setTimeout(() => {
			if (ws.readyState === WebSocket.CONNECTING) {
				this.logger.warn(`⚠️ RTM: Connection timeout for profile ${profileId}, closing...`);
				ws.close();
			}
		}, this.connectionTimeout);

		ws.on('open', () => {
			clearTimeout(connectionTimeout);
			const timestamp = new Date().toISOString();
			this.logger.log(`✅ RTM: Profile ${profileId} connected successfully at ${timestamp}!`);

			// Відправляємо connect повідомлення
			const connectMessage = { connect: { name: "js", version: "1.0" }, id: 1 };
			ws.send(JSON.stringify(connectMessage));
			this.logger.log(`📤 RTM: Sent connect message for profile ${profileId} at ${timestamp}`);

			// Налаштовуємо heartbeat
			const heartbeatInterval = setInterval(() => {
				if (ws.readyState === WebSocket.OPEN) {
					ws.ping();
					const timestamp = new Date().toISOString();
					this.logger.log(`💓 RTM: Sent heartbeat for profile ${profileId} at ${timestamp}`);
				}
			}, 30000);

			// Зберігаємо підключення
			this.connections.set(profileId, {
				ws,
				heartbeatInterval,
				reconnectAttempts: 0,
				session
			});
		});

		ws.on('message', (data) => {
			try {
				const message: RTMMessage = JSON.parse(data.toString());
				const timestamp = new Date().toISOString();
				this.logger.log(`📨 RTM: Profile ${profileId} received message at ${timestamp}:`, JSON.stringify(message, null, 2));
				// Записуємо у файл ВСІ отримані повідомлення
				this.appendRtmLog({ profileId, direction: 'in', message });
				this.handleMessage(message, profileId);
			} catch (error) {
				const timestamp = new Date().toISOString();
				this.logger.error(`❌ RTM: Profile ${profileId} failed to parse message at ${timestamp}:`, error);
			}
		});

		ws.on('close', (code, reason) => {
			clearTimeout(connectionTimeout);
			const timestamp = new Date().toISOString();
			this.logger.warn(`🔌 RTM: Profile ${profileId} connection closed at ${timestamp} (${code}): ${reason}`);
			this.appendRtmLog({ profileId, event: 'close', code, reason: reason?.toString?.() });
			
			const connection = this.connections.get(profileId);
			if (connection) {
				clearInterval(connection.heartbeatInterval);
				this.connections.delete(profileId);
				
				// Спробуємо перепідключитися
				if (connection.reconnectAttempts < this.maxReconnectAttempts) {
					this.scheduleReconnectProfile(profileId, session, connection.reconnectAttempts + 1);
				}
			}
		});

		ws.on('error', (error) => {
			clearTimeout(connectionTimeout);
			const timestamp = new Date().toISOString();
			this.logger.error(`❌ RTM: Profile ${profileId} WebSocket error at ${timestamp}:`, error);
			this.appendRtmLog({ profileId, event: 'error', error: (error as any)?.message || String(error) });
			
			const connection = this.connections.get(profileId);
			if (connection) {
				clearInterval(connection.heartbeatInterval);
				this.connections.delete(profileId);
			}
		});
	}

	private scheduleReconnectProfile(profileId: number, session: any, attempt: number) {
		const timestamp = new Date().toISOString();
		this.logger.log(`🔄 RTM: Reconnecting profile ${profileId} in ${this.reconnectDelay}ms (attempt ${attempt}) at ${timestamp}`);
		
		const reconnectTimeout = setTimeout(async () => {
			try {
				await this.connectProfile({ ...session, reconnectAttempts: attempt });
			} catch (error) {
				this.logger.error(`❌ RTM: Profile ${profileId} reconnection failed:`, error);
			}
		}, this.reconnectDelay);

		// Зберігаємо timeout для можливості скасування
		const connection = this.connections.get(profileId);
		if (connection) {
			connection.reconnectTimeout = reconnectTimeout;
		}
	}

	private handleMessage(message: RTMMessage, profileId: number) {
		// Обробляємо різні типи повідомлень
		if (message.push?.channel?.includes('personal:')) {
			const timestamp = new Date().toISOString();
			const data = message.push.pub.data;
			this.logger.log(`🎯 RTM: Profile ${profileId} received personal message at ${timestamp}:`, data);
			
			// Емітимо події залежно від типу повідомлення
			const messageType = data.type;
			
			if (messageType === 'chat_MessageRead') {
				this.eventEmitter.emit('rtm.message.read', {
					profileId,
					idInterlocutor: data.data?.idInterlocutor,
					idMessage: data.data?.idMessage,
					timestamp
				});
				this.logger.log(`📖 RTM: Message read event emitted for profile ${profileId}`);
			} 
			else if (messageType === 'chat_DialogTyping') {
				// Не емітимо подію для typing, це не потрібно для тоастів
				this.logger.log(`⌨️ RTM: Typing event for profile ${profileId} (not emitted)`);
			}
			else if (messageType === 'chat_MessageNew' || messageType === 'chat_MessageSent' || messageType === 'MessageSent' || messageType === 'MessageNew') {
				// Для MessageSent дані знаходяться в data.message
				const messageData = data.data?.message || data.message || data;
				
				this.eventEmitter.emit('rtm.message.new', {
					profileId,
					idUserFrom: messageData?.idUserFrom,
					idUserTo: messageData?.idUserTo,
					content: messageData?.content,
					messageId: messageData?.id || data.id,
					dateCreated: messageData?.dateCreated || timestamp,
					timestamp
				});
				this.logger.log(`🆕 RTM: New message event emitted for profile ${profileId}, from: ${messageData?.idUserFrom}, to: ${messageData?.idUserTo}`);
			}
			else if (messageType === 'chat_DialogLimitChanged' || messageType === 'platform_CorrespondenceLimitChanged') {
				// Уніфікуємо подію ліміту діалогу
				const limitData = data.data || data;
				this.eventEmitter.emit('rtm.dialog.limit.changed', {
					profileId,
					idUser: limitData?.idUser,
					idInterlocutor: limitData?.idInterlocutor,
					limitLeft: limitData?.limitLeft,
					timestamp
				});
				this.logger.log(`📊 RTM: Dialog limit event emitted for profile ${profileId}: user ${limitData?.idUser}, interlocutor ${limitData?.idInterlocutor}, left ${limitData?.limitLeft}`);
			}
			else {
				// Загальна подія для інших типів
				this.eventEmitter.emit('rtm.message', {
					profileId,
					channel: message.push.channel,
					data: data,
					timestamp
				});
				this.logger.log(`📨 RTM: Generic message event emitted for profile ${profileId}, type: ${messageType}`);
			}
		}

		if (message.connect) {
			const timestamp = new Date().toISOString();
			this.logger.log(`🔗 RTM: Profile ${profileId} connect response at ${timestamp}:`, message.connect);
		}

		if (message.error) {
			const timestamp = new Date().toISOString();
			this.logger.error(`❌ RTM: Profile ${profileId} error at ${timestamp}:`, message.error);
		}
	}

	// Публічні методи для управління RTM
	public getConnectionStatus(): Record<number, boolean> {
		const status: Record<number, boolean> = {};
		for (const [profileId, connection] of this.connections) {
			status[profileId] = connection.ws.readyState === WebSocket.OPEN;
		}
		return status;
	}

	public async reconnectAll() {
		this.logger.log('🔄 RTM: Reconnecting all profiles...');
		this.cleanup();
		await this.connect();
	}

	public async subscribeToUser(userId: string) {
		// Цей метод залишається для сумісності, але тепер не потрібен
		// оскільки кожен профіль автоматично підписується на свій канал
		this.logger.log(`📡 RTM: Subscribe to user ${userId} (handled automatically by profile connections)`);
	}

	public async unsubscribeFromUser(userId: string) {
		// Цей метод залишається для сумісності
		this.logger.log(`📡 RTM: Unsubscribe from user ${userId} (handled automatically)`);
	}
}