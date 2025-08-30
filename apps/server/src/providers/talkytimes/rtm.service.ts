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

	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly sessionService: TalkyTimesSessionService
	) {}

	async onModuleInit() {
		// Підключаємося тільки якщо не в mock режимі
		if (this.isMockMode()) {
			this.logger.log('🔌 RTM: Mock mode detected, skipping WebSocket connection');
			return;
		}

		this.connect();
	}

	onModuleDestroy() {
		this.disconnect();
	}

	private isMockMode(): boolean {
		const baseUrl = process.env.TT_BASE_URL || 'mock:dev';
		return baseUrl.startsWith('mock:');
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
			let headers = {};
			
			if (sessions.length > 0) {
				// Використовуємо першу активну сесію
				const session = sessions[0];
				headers = {
					'Cookie': session.cookies
				};
				this.logger.log(`🔌 RTM: Using session for profile ${session.profileId}`);
			} else {
				this.logger.warn('⚠️ RTM: No active sessions found, connecting without auth');
			}

			this.ws = new WebSocket('wss://talkytimes.com/rtm', { headers });

			this.ws.on('open', () => {
				this.logger.log('✅ RTM: Connected to TalkyTimes RTM');
				this.isConnecting = false;
				this.reconnectAttempts = 0;
				
				// Відновлюємо підписки
				this.resubscribe();
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

		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
		this.reconnectAttempts++;

		this.logger.log(`🔄 RTM: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
		
		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, delay);
	}

	private resubscribe() {
		for (const subscription of this.subscriptions) {
			this.sendSubscribe(subscription);
		}
	}

	private handleMessage(message: RTMMessage) {
		this.logger.debug('📨 RTM: Received message', message.type);

		switch (message.type) {
			case 'connect':
				this.handleConnectFrame(message);
				break;
			case 'push':
				this.handlePushFrame(message);
				break;
			default:
				this.logger.debug('📨 RTM: Unknown message type', message.type);
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
	}

	private handlePushFrame(message: RTMMessage) {
		if (message.pub?.data) {
			this.handlePublication(message.pub.data);
		}
	}

	private handlePublication(publication: { type: string; data: any }) {
		this.logger.debug(`📢 RTM: Publication ${publication.type}`);

		switch (publication.type) {
			case 'MessageSent':
				this.handleMessageSent(publication.data as MessageSentEvent);
				break;
			case 'online':
				this.handleOnlineStatus(publication.data as OnlineStatusEvent);
				break;
			default:
				this.logger.debug(`📢 RTM: Unknown publication type: ${publication.type}`);
		}
	}

	private handleMessageSent(data: MessageSentEvent) {
		this.logger.log(`💬 RTM: New message from ${data.from} to ${data.to}`);
		
		// Емітимо подію для нашого внутрішнього WebSocket
		this.eventEmitter.emit('rtm.message.sent', {
			idUserFrom: data.from,
			idUserTo: data.to,
			content: { message: data.text },
			type: data.type,
			dateCreated: data.createdAt || new Date().toISOString()
		});
	}

	private handleOnlineStatus(data: OnlineStatusEvent) {
		this.logger.log(`👤 RTM: User ${data.userId} is ${data.status}`);
		
		// Емітимо подію для оновлення онлайн статусу
		this.eventEmitter.emit('rtm.user.online', {
			userId: data.userId,
			isOnline: data.status === 'online'
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
