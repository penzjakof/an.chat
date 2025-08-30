import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import WebSocket from 'ws';
import { TalkyTimesSessionService } from './session.service';

export interface RTMMessage {
	id?: string;
	type: 'connect' | 'push' | 'subscribe' | 'unsubscribe';
	data?: any;
	pub?: {
		data: {
			type: string;
			data: any;
		};
	};
}

export interface MessageSentEvent {
	from: number;
	to: number;
	text: string;
	type: string;
	createdAt?: string;
}

export interface OnlineStatusEvent {
	userId: number;
	status: 'online' | 'offline';
}

@Injectable()
export class TalkyTimesRTMService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TalkyTimesRTMService.name);
	private ws: WebSocket | null = null;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private isConnecting = false;
	private subscriptions = new Set<string>();
	private readonly maxReconnectAttempts = 5;
	private reconnectAttempts = 0;
	private readonly reconnectDelays = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
	private heartbeatInterval: NodeJS.Timeout | null = null;

	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly sessionService: TalkyTimesSessionService
	) {}

	async onModuleInit() {
		// ТИМЧАСОВЕ РІШЕННЯ: використовуємо робочі cookies для тестування
		this.logger.log('🔌 RTM: Using temporary working cookies for testing');
		await this.connectWithWorkingCookies();
		return;

		// Підключаємося тільки якщо не в mock режимі
		if (this.isMockMode()) {
			this.logger.log('🔌 RTM: Mock mode detected, skipping WebSocket connection');
			return;
		}

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

	private isMockMode(): boolean {
		const baseUrl = process.env.TT_BASE_URL || 'mock:dev';
		return baseUrl.startsWith('mock:');
	}

	private async connectWithWorkingCookies() {
		if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
			return;
		}

		this.isConnecting = true;
		this.logger.log('🔌 RTM: Connecting with working cookies to wss://talkytimes.com/rtm');

		try {
			// Використовуємо робочі cookies з curl прикладу
			const workingCookies = 'cc_cookie=%7B%22required%22%3A1%2C%22marketing%22%3A0%7D; sm_anonymous_id=8c13911a-9578-4fc8-905a-5abbe3edbacf; _hjSessionUser_2813883=eyJpZCI6IjZlYWQ2MDE4LTFkNmItNWMxOC04MGEyLThiNWZiMmJiYWMzYyIsImNyZWF0ZWQiOjE3NTM4OTI2NzkzNDAsImV4aXN0aW5nIjp0cnVlfQ==; _hjSession_2813883=eyJpZCI6IjcyZjRhMThmLTBmNjMtNGMzYi1iZWY1LTBlNDc1MDBlY2E2NSIsImMiOjE3NTY1NTEzODE3ODQsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; tld-token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoidXNlciIsImlzcyI6ImRlZiIsInZlciI6IjEuMSIsImlhdCI6MTc1NjU1NzM0NCwiZXhwIjoxNzU5MjM1NzQ0LCJzdWIiOjcxNjI0Mzd9.WC8R1Jxh-fsKf3ufPm7_efmzOHDxDzSsvtzi7XcfB0A; tu_auth=%7B%22result%22%3Atrue%2C%22idUser%22%3A7162437%2C%22refreshToken%22%3A%221cf0985f8c594b4c2d713a0bc66cd0be1b4bc85c%22%7D; _csrf=GED4Ups3_DncYKdpO7ss-xXW12ioIlg-';
			
			const headers = {
				'Origin': 'https://talkytimes.com',
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
				'Cookie': workingCookies
			};

			this.ws = new WebSocket('wss://talkytimes.com/rtm', { headers });

			this.ws.on('open', () => {
				this.logger.log('✅ RTM: Connected with working cookies!');
				this.isConnecting = false;
				this.reconnectAttempts = 0;
				
				// Відправляємо connect повідомлення
				const connectMessage = {
					connect: { name: "js" },
					id: 1
				};
				this.ws!.send(JSON.stringify(connectMessage));
			});

			this.ws.on('message', (data) => {
				try {
					const message = JSON.parse(data.toString());
					this.handleMessage(message);
				} catch (error) {
					this.logger.error('❌ RTM: Failed to parse message', error);
				}
			});

			this.ws.on('close', (code, reason) => {
				this.logger.warn(`🔌 RTM: Connection closed (${code}): ${reason}`);
				this.isConnecting = false;
				this.scheduleReconnect();
			});

			this.ws.on('error', (error) => {
				this.logger.error('❌ RTM: WebSocket error', error);
				this.isConnecting = false;
			});

		} catch (error) {
			this.logger.error('❌ RTM: Failed to create WebSocket connection', error);
			this.isConnecting = false;
			this.scheduleReconnect();
		}
	}

	private async connect() {
		if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
			return;
		}

		this.isConnecting = true;
		this.logger.log('🔌 RTM: Connecting to wss://talkytimes.com/rtm');

		try {
			// Отримуємо активну сесію для RTM підключення
			const sessions = await this.sessionService.getAllActiveSessions();
			let headers = {
				'Origin': 'https://talkytimes.com',
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
			};
			
			if (sessions.length > 0) {
				// Використовуємо першу активну сесію
				const session = sessions[0];
				headers['Cookie'] = session.cookies;
				this.logger.log(`🔌 RTM: Using session for profile ${session.profileId}`);
			} else {
				this.logger.warn('⚠️ RTM: No active sessions found, connecting without auth');
			}

			this.ws = new WebSocket('wss://talkytimes.com/rtm', { headers });

			this.ws.on('open', () => {
				this.logger.log('✅ RTM: Connected to TalkyTimes RTM');
				this.isConnecting = false;
				this.reconnectAttempts = 0;
				
				// Відправляємо connect повідомлення згідно з протоколом
				this.logger.log('📡 RTM: Sending connect message...');
				const connectMessage = {
					connect: { name: "js" },
					id: 1
				};
				this.ws!.send(JSON.stringify(connectMessage));
			});

			this.ws.on('message', (data) => {
				try {
					const message: RTMMessage = JSON.parse(data.toString());
					this.handleMessage(message);
				} catch (error) {
					this.logger.error('❌ RTM: Failed to parse message', error);
				}
			});

			this.ws.on('close', (code, reason) => {
				this.logger.warn(`🔌 RTM: Connection closed (${code}): ${reason}`);
				this.isConnecting = false;
				this.scheduleReconnect();
			});

			this.ws.on('error', (error) => {
				this.logger.error('❌ RTM: WebSocket error', error);
				this.isConnecting = false;
			});

		} catch (error) {
			this.logger.error('❌ RTM: Failed to create WebSocket connection', error);
			this.isConnecting = false;
			this.scheduleReconnect();
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

		// Використовуємо предвизначені затримки для більш передбачуваної поведінки
		const delay = this.reconnectDelays[Math.min(this.reconnectAttempts, this.reconnectDelays.length - 1)];
		this.reconnectAttempts++;

		this.logger.log(`🔄 RTM: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
		
		this.reconnectTimeout = setTimeout(() => {
			this.connectWithWorkingCookies();
		}, delay);
	}

	private resubscribe() {
		for (const subscription of this.subscriptions) {
			this.sendSubscribe(subscription);
		}
	}

	private sendSubscriptions() {
		this.logger.log('📡 RTM: Sending subscriptions...');
		
		// Підписуємося на online канал
		const onlineMessage = {
			subscribe: { channel: "online" },
			id: 2
		};
		this.ws!.send(JSON.stringify(onlineMessage));
		this.logger.log('📡 RTM: Subscribed to online');
		
		// Підписуємося на broadcast канал
		const broadcastMessage = {
			subscribe: { channel: "broadcast" },
			id: 3
		};
		this.ws!.send(JSON.stringify(broadcastMessage));
		this.logger.log('📡 RTM: Subscribed to broadcast');
	}

	private handleMessage(message: any) {
		this.logger.debug('📨 RTM: Received message', JSON.stringify(message));

		// Обробляємо відповідь на connect
		if (message.id === 1 && message.connect) {
			this.logger.log('🔗 RTM: Connect response received');
			this.sendSubscriptions();
		}
		
		// Обробляємо push повідомлення
		if (message.push) {
			this.handlePushFrame(message);
		}
	}

	private handleConnectFrame(message: RTMMessage) {
		this.logger.log('🔗 RTM: Connect frame received');
		
		// Обробляємо початкові публікації
		if (message.data?.publications) {
			for (const publication of message.data.publications) {
				this.handlePublication(publication);
			}
		}
		
		// Тепер можемо підписатися на канали
		this.logger.log('📡 RTM: Connect frame processed, subscribing to channels...');
		this.resubscribe();
	}

	private handlePushFrame(message: any) {
		if (message.push?.pub?.data) {
			this.handlePublication(message.push.pub.data);
		}
	}

	private handlePublication(publication: { type: string; data: any }) {
		this.logger.debug(`📢 RTM: Publication ${publication.type}`);

		switch (publication.type) {
			case 'MessageSent':
				this.handleMessageSent(publication.data);
				break;
			case 'online':
				this.handleOnlineStatus(publication.data as OnlineStatusEvent);
				break;
			case 'chat_MessageDisplayAttributesApplied':
				this.handleNewMessage(publication.data);
				break;
			case 'chat_MessageRead':
				this.handleMessageRead(publication.data);
				break;
			case 'chat_DialogLimitChanged':
				this.handleDialogLimitChanged(publication.data);
				break;
			default:
				this.logger.debug(`📢 RTM: Unknown publication type: ${publication.type}`);
		}
	}

	private handleMessageSent(data: any) {
		// MessageSent має структуру: data.message.idUserFrom, data.message.idUserTo
		const message = data.message;
		if (message) {
			this.logger.log(`💬 RTM: New message ${message.id} from ${message.idUserFrom} to ${message.idUserTo}`);
			
			// Емітимо подію для toast сповіщення (аналогічно до chat_MessageDisplayAttributesApplied)
			this.eventEmitter.emit('rtm.message.new', {
				messageId: message.id,
				idUserFrom: message.idUserFrom,
				idUserTo: message.idUserTo,
				dateCreated: message.dateCreated,
				content: message.content
			});
			
			// Також емітимо стару подію для сумісності
			this.eventEmitter.emit('rtm.message.sent', {
				idUserFrom: message.idUserFrom,
				idUserTo: message.idUserTo,
				content: message.content,
				type: message.type,
				dateCreated: message.dateCreated
			});
		} else {
			this.logger.log(`💬 RTM: MessageSent with unknown structure:`, data);
		}
	}

	private handleOnlineStatus(data: OnlineStatusEvent) {
		this.logger.log(`👤 RTM: User ${data.userId} is ${data.status}`);
		
		// Емітимо подію для оновлення онлайн статусу
		this.eventEmitter.emit('rtm.user.online', {
			userId: data.userId,
			isOnline: data.status === 'online'
		});
	}

	private handleNewMessage(data: any) {
		this.logger.log(`📨 RTM: New message ${data.idMessage} from ${data.idUserFrom} to ${data.idUserTo}`);
		
		// Емітимо подію для toast сповіщення
		this.eventEmitter.emit('rtm.message.new', {
			messageId: data.idMessage,
			idUserFrom: data.idUserFrom,
			idUserTo: data.idUserTo,
			dateCreated: data.dateCreated,
			displayAttributes: data.displayAttributes
		});
	}

	private handleMessageRead(data: any) {
		this.logger.log(`👁️ RTM: Message ${data.idMessage} read by ${data.idInterlocutor}`);
		
		// Емітимо подію для оновлення статусу прочитання
		this.eventEmitter.emit('rtm.message.read', {
			messageId: data.idMessage,
			idInterlocutor: data.idInterlocutor
		});
	}

	private handleDialogLimitChanged(data: any) {
		this.logger.log(`📊 RTM: Dialog limit changed for user ${data.idUser}, interlocutor ${data.idInterlocutor}, limit left: ${data.limitLeft}`);
		
		// Емітимо подію для оновлення лімітів
		this.eventEmitter.emit('rtm.dialog.limit.changed', {
			idUser: data.idUser,
			idInterlocutor: data.idInterlocutor,
			limitLeft: data.limitLeft
		});
	}

	// Публічні методи для підписок
	subscribeToUser(userId: number) {
		const subscription = `personal:${userId}`;
		this.subscriptions.add(subscription);
		this.sendSubscribe(subscription);
		this.logger.log(`📡 RTM: Subscribed to user ${userId}`);
	}

	unsubscribeFromUser(userId: number) {
		const subscription = `personal:${userId}`;
		this.subscriptions.delete(subscription);
		this.sendUnsubscribe(subscription);
		this.logger.log(`📡 RTM: Unsubscribed from user ${userId}`);
	}

	subscribeToOnline() {
		const subscription = 'online';
		this.subscriptions.add(subscription);
		this.sendSubscribe(subscription);
		this.logger.log('📡 RTM: Subscribed to online status');
	}

	subscribeToBroadcast() {
		const subscription = 'broadcast';
		this.subscriptions.add(subscription);
		this.sendSubscribe(subscription);
		this.logger.log('📡 RTM: Subscribed to broadcast');
	}

	private sendSubscribe(channel: string) {
		this.sendMessage({
			type: 'subscribe',
			data: { channel }
		});
	}

	private sendUnsubscribe(channel: string) {
		this.sendMessage({
			type: 'unsubscribe',
			data: { channel }
		});
	}

	private sendMessage(message: RTMMessage) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			this.logger.warn('⚠️ RTM: Cannot send message, WebSocket not connected');
		}
	}

	// Статус підключення
	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	getSubscriptions(): string[] {
		return Array.from(this.subscriptions);
	}
}
