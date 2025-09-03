import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import { TalkyTimesSessionService } from './session.service';

// Типи RTM повідомлень
export type RTMMessageType = 
  | 'MessageSent'           // Нове повідомлення
  | 'chat_DialogLimitChanged'; // Оновлення лімітів

// Структура RTM повідомлення
export interface RTMMessage {
  id?: string;
  connect?: { name: string };
  push?: {
    channel: string;
    data?: {
      type: RTMMessageType;
      data: any;
    };
  };
}

// Структура нового повідомлення
export interface MessageData {
  message: {
    id: number;
    idUserFrom: number;
    idUserTo: number;
    content: {
      message?: string;
      id?: number;
      url?: string;
    };
    dateCreated: string;
  };
}

// Структура оновлення лімітів
export interface DialogLimitData {
  idUser: number;
  idInterlocutor: number;
  limitLeft: number;
}

// Структура події нового повідомлення
export interface MessageEvent {
  messageId: number;
  idUserFrom: number;
  idUserTo: number;
  dateCreated: string;
  content: {
    message?: string;
    id?: number;
    url?: string;
  };
}

// Структура події оновлення лімітів
export interface DialogLimitEvent {
  idUser: number;
  idInterlocutor: number;
  limitLeft: number;
}

@Injectable()
export class TalkyTimesRTMService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TalkyTimesRTMService.name);
	private ws: WebSocket | null = null;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private isConnecting = false;
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 3;
	private readonly reconnectDelay = 3000; // 3 секунди між спробами
	private readonly connectionTimeout = 10000; // 10 секунд таймаут підключення
	private heartbeatInterval: NodeJS.Timeout | null = null;

	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly sessionService: TalkyTimesSessionService
	) {}

	async onModuleInit() {
		await this.connect();
	}

	onModuleDestroy() {
		this.cleanup();
	}

	private cleanup() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
		this.isConnecting = false;
		this.reconnectAttempts = 0;
	}



	private async connect() {
		if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
			this.logger.log('🔌 RTM: Already connecting or connected');
			return;
		}

		this.isConnecting = true;
		this.logger.log('🔌 RTM: Starting connection...');

		try {
			// Отримуємо активну сесію
			const sessions = await this.sessionService.getAllActiveSessions();
			if (!sessions.length) {
				this.logger.warn('⚠️ RTM: No active sessions found');
				return;
			}

			const session = sessions[0];
			this.logger.log(`🔌 RTM: Using session for profile ${session.profileId}`);
			
			// Валідуємо сесію перед підключенням
			const isValid = await this.sessionService.validateSession(session.profileId.toString());
			if (!isValid) {
				this.logger.warn('⚠️ RTM: Session validation failed');
				return;
			}

			this.logger.log('🔌 RTM: Session validated, connecting to WebSocket...');
			const headers = {
				'Origin': 'https://talkytimes.com',
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
				'Cookie': session.cookies
			};

			this.ws = new WebSocket('wss://talkytimes.com/rtm', { headers });

			// Встановлюємо таймаут для підключення
			const connectionTimeout = setTimeout(() => {
				if (this.ws?.readyState === WebSocket.CONNECTING) {
					this.logger.warn('⚠️ RTM: Connection timeout, closing...');
					this.ws.close();
				}
			}, this.connectionTimeout);

			this.ws.on('open', () => {
				clearTimeout(connectionTimeout);
				this.isConnecting = false;
				this.reconnectAttempts = 0;
				
				this.logger.log('✅ RTM: Connected successfully!');
				
				// Відправляємо connect повідомлення
				const connectMessage = {
					connect: { name: "js", version: "1.0" },
					id: 1
				};
				this.ws!.send(JSON.stringify(connectMessage));
				this.logger.log('📤 RTM: Sent connect message:', JSON.stringify(connectMessage, null, 2));

				// Встановлюємо heartbeat
				this.heartbeatInterval = setInterval(() => {
					if (this.ws?.readyState === WebSocket.OPEN) {
						this.ws.ping();
						this.logger.log('💓 RTM: Sent heartbeat');
					}
				}, 30000);
			});

			this.ws.on('message', (data) => {
				try {
					const message: RTMMessage = JSON.parse(data.toString());
					this.logger.log('📨 RTM: Received message:', JSON.stringify(message, null, 2));
					this.handleMessage(message);
				} catch (error) {
					this.logger.error('❌ RTM: Failed to parse message:', error);
				}
			});

			this.ws.on('close', (code, reason) => {
				clearTimeout(connectionTimeout);
				this.isConnecting = false;
				this.logger.warn(`🔌 RTM: Connection closed (${code}): ${reason}`);
				
				if (this.reconnectAttempts < this.maxReconnectAttempts) {
					this.scheduleReconnect();
				}
			});

			this.ws.on('error', (error) => {
				clearTimeout(connectionTimeout);
				this.isConnecting = false;
				this.logger.error('❌ RTM: WebSocket error:', error);
				
				if (this.reconnectAttempts < this.maxReconnectAttempts) {
					this.scheduleReconnect();
				}
			});

		} catch (error) {
			this.isConnecting = false;
			this.logger.error('❌ RTM: Connection error:', error);
			if (this.reconnectAttempts < this.maxReconnectAttempts) {
				this.scheduleReconnect();
			}
		}
	}

	private disconnect() {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private scheduleReconnect() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.logger.error('❌ RTM: Max reconnection attempts reached');
			return;
		}

		this.reconnectAttempts++;
		this.logger.log(`🔄 RTM: Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
		
		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, this.reconnectDelay);
	}



	private handleMessage(message: RTMMessage) {
		// Ігноруємо відповідь на connect
		if (message.id === "1" && message.connect) {
			return;
		}
		
		// Обробляємо push повідомлення
		if (message.push?.data) {
			this.handlePushData(message.push.data);
		}
	}

	private handlePushData(data: { type: RTMMessageType; data: any }) {
		switch (data.type) {
			case 'MessageSent':
				this.handleMessageSent(data.data as MessageData);
				break;
			case 'chat_DialogLimitChanged':
				this.handleDialogLimitChanged(data.data as DialogLimitData);
				break;
		}
	}

	private handleMessageSent(data: MessageData) {
		const { message } = data;
		if (!message) return;

		const event: MessageEvent = {
			messageId: message.id,
			idUserFrom: message.idUserFrom,
			idUserTo: message.idUserTo,
			dateCreated: message.dateCreated,
			content: message.content
		};

		this.eventEmitter.emit('rtm.message.new', event);
	}

	private handleDialogLimitChanged(data: DialogLimitData) {
		const event: DialogLimitEvent = {
			idUser: data.idUser,
			idInterlocutor: data.idInterlocutor,
			limitLeft: data.limitLeft
		};

		this.eventEmitter.emit('rtm.dialog.limit.changed', event);
	}

	// Статус підключення
	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	// Метод для отримання статусу RTM
	getConnectionStatus(): { connected: boolean; attempts: number; maxAttempts: number } {
		return {
			connected: this.ws?.readyState === WebSocket.OPEN,
			attempts: this.reconnectAttempts,
			maxAttempts: this.maxReconnectAttempts
		};
	}

	// Тестовий метод для симуляції RTM повідомлення
	simulateRTMMessage(testData: any) {
		const event: MessageEvent = {
			messageId: testData.messageId,
			idUserFrom: testData.idUserFrom,
			idUserTo: testData.idUserTo,
			dateCreated: testData.dateCreated,
			content: testData.content
		};
		
		this.eventEmitter.emit('rtm.message.new', event);
	}

	// Методи для сумісності
	subscribeToUser(userId: number) {
		// RTM автоматично підписує на personal канал
		this.logger.log(`📡 RTM: Auto-subscribed to personal:${userId}`);
	}

	unsubscribeFromUser(userId: number) {
		// Нічого не робимо, бо підписка автоматична
		this.logger.log(`📡 RTM: Auto-unsubscribed from personal:${userId}`);
	}



	// Діагностичний метод для перевірки сесій
	async getSessionsDebugInfo() {
		try {
			const sessions = await this.sessionService.getAllActiveSessions();
			return {
				totalSessions: sessions.length,
				sessions: sessions.map(s => ({
					profileId: s.profileId,
					hasToken: !!s.token,
					hasRefreshToken: !!s.refreshToken,
					expiresAt: s.expiresAt,
					cookiesLength: s.cookies?.length || 0,
					cookiesPreview: s.cookies?.substring(0, 100) + '...'
				}))
			};
		} catch (error) {
			return {
				error: error.message,
				totalSessions: 0,
				sessions: []
			};
		}
	}
}
