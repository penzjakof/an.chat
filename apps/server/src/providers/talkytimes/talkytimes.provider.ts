import type { ProviderRequestContext, SiteProvider, DialogsFilters } from '../site-provider.interface';
import { TalkyTimesSessionService } from './session.service';
import { ConnectionPoolService } from '../../common/http/connection-pool.service';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

interface RetryOptions {
	maxRetries?: number;
	baseDelayMs?: number;
	timeoutMs?: number;
	retryCondition?: (error: any, attempt: number) => boolean;
}

// Функція для затримки з exponential backoff
function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Перевірка чи потрібно повторювати запит
function shouldRetry(error: any, attempt: number, maxRetries: number): boolean {
	if (attempt >= maxRetries) return false;
	
	// Повторюємо при мережевих помилках
	if (error.name === 'AbortError') return false; // Timeout - не повторюємо
	if (error.name === 'TypeError' && error.message.includes('fetch')) return true; // Network error
	
	// Повторюємо при серверних помилках (5xx)
	if (error.status >= 500) return true;
	
	// Повторюємо при 429 (Too Many Requests)
	if (error.status === 429) return true;
	
	// Повторюємо при 408 (Request Timeout)
	if (error.status === 408) return true;
	
	return false;
}

// Backward compatibility - deprecated, use TalkyTimesProvider.fetchWithConnectionPool instead
async function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number }): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);
	
	try {
		const res = await fetch(url, {
			...options,
			signal: controller.signal
		});
		clearTimeout(timeout);
		return res;
	} catch (error) {
		clearTimeout(timeout);
		throw error;
	}
}

export class TalkyTimesProvider implements SiteProvider {
	// Кеш для стікерів
	private stickersCache = new Map<string, { data: any; timestamp: number }>();
	private readonly STICKERS_CACHE_TTL = 30 * 60 * 1000; // 30 хвилин

	constructor(
		private readonly baseUrl: string,
		private readonly sessionService: TalkyTimesSessionService,
		private readonly connectionPool: ConnectionPoolService
	) {
		console.log('TalkyTimesProvider baseUrl:', this.baseUrl);
	}

	/**
	 * Оптимізований fetch з connection pooling, timeout та retry логікою
	 */
	private async fetchWithConnectionPool(
		url: string, 
		options: RequestInit & RetryOptions = {}
	): Promise<Response> {
		const {
			maxRetries = DEFAULT_MAX_RETRIES,
			baseDelayMs = DEFAULT_BASE_DELAY_MS,
			timeoutMs = DEFAULT_TIMEOUT_MS,
			retryCondition = shouldRetry,
			...fetchOptions
		} = options;
		
		let lastError: any;
		
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), timeoutMs);
			
			try {
				// Використовуємо connection pool agent
				const agent = this.connectionPool.getAgentForUrl(url);
				
				const res = await fetch(url, {
					...fetchOptions,
					signal: controller.signal,
					// @ts-ignore - Node.js fetch підтримує agent
					agent: agent
				});
				
				clearTimeout(timeout);
				
				if (!res.ok) {
					const error = new Error(`HTTP ${res.status}: ${res.statusText}`);
					(error as any).status = res.status;
					(error as any).response = res;
					
					if (retryCondition(error, attempt, maxRetries)) {
						lastError = error;
						console.warn(`🔄 Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying...`);
						
						const delayMs = baseDelayMs * Math.pow(2, attempt);
						await delay(delayMs);
						continue;
					}
					
					throw error;
				}
				
				if (attempt > 0) {
					console.log(`✅ Request succeeded after ${attempt + 1} attempts`);
				}
				
				return res;
				
			} catch (error) {
				clearTimeout(timeout);
				lastError = error;
				
				if (retryCondition(error, attempt, maxRetries)) {
					console.warn(`🔄 Request failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying...`);
					
					const delayMs = baseDelayMs * Math.pow(2, attempt);
					const jitter = Math.random() * 0.1 * delayMs;
					await delay(delayMs + jitter);
					continue;
				}
				
				throw error;
			}
		}
		
		throw lastError;
	}

	/**
	 * Універсальний метод для виконання HTTP запитів до TalkyTimes API
	 */
	async makeRequest(options: {
		method: 'GET' | 'POST' | 'PUT' | 'DELETE';
		url: string;
		data?: any;
		profileId: number;
		headers?: Record<string, string>;
	}): Promise<{ success: boolean; data?: any; error?: string }> {
		// Логуємо тільки POST/PUT/DELETE запити для зменшення спаму
		if (options.method !== 'GET') {
			console.log(`🌐 TalkyTimesProvider.makeRequest: ${options.method} ${options.url} for profile ${options.profileId}`);
		}

		if (this.isMock()) {
			return { 
				success: true, 
				data: { 
					cursor: '',
					photos: []
				} 
			};
		}

		try {
			// Отримуємо активну сесію для профілю
			const session = await this.sessionService.getActiveSession(options.profileId);
			if (!session) {
				return { success: false, error: `No active session found for profile ${options.profileId}` };
			}

			// Формуємо повний URL
			const fullUrl = options.url.startsWith('http') ? options.url : `${this.baseUrl}${options.url}`;
			
			// Підготовуємо headers
			const headers = {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Cookie': session.cookies,
				'Referer': `${this.baseUrl}/chat/${options.profileId}_123456`,
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
				...options.headers
			};

			console.log(`🌐 Making ${options.method} request to ${fullUrl}`);

			// Налаштування retry в залежності від типу запиту
			const retryOptions: RetryOptions = {
				timeoutMs: 15000, // 15 секунд timeout
				maxRetries: options.method === 'GET' ? 3 : 2, // GET запити повторюємо більше
				baseDelayMs: options.method === 'GET' ? 1000 : 2000, // POST запити чекають довше
			};

			const response = await this.fetchWithConnectionPool(fullUrl, {
				method: options.method,
				headers,
				body: options.data ? JSON.stringify(options.data) : undefined,
				...retryOptions
			});

			const result = await response.json();
			
			// Логуємо тільки важливі успішні операції
			if (options.method !== 'GET' || result.error) {
				console.log(`✅ Request successful:`, result);
			}

			return { success: true, data: result };

		} catch (error) {
			console.error(`💥 Error making request:`, error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Відправляє фото в чат
	 */
	async sendPhoto(ctx: ProviderRequestContext, params: { idProfile: number; idRegularUser: number; idPhoto: number }): Promise<{ success: boolean; data?: any; error?: string }> {
		console.log(`📸 TalkyTimesProvider.sendPhoto: profile ${params.idProfile} → user ${params.idRegularUser}, photo ${params.idPhoto}`);

		if (this.isMock()) {
			return { 
				success: true, 
				data: { 
					messageId: `mock-msg-${Date.now()}`,
					photoId: params.idPhoto
				} 
			};
		}

		try {
			// Отримуємо активну сесію для профілю
			const session = await this.sessionService.getActiveSession(params.idProfile);
			if (!session) {
				return { success: false, error: `No active session found for profile ${params.idProfile}` };
			}

			// Формуємо URL для відправки фото
			const url = `${this.baseUrl}/api/send-photo`;
			
			// Підготовуємо headers
			const headers = {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Cookie': session.cookies,
				'Referer': `${this.baseUrl}/chat/${params.idProfile}_${params.idRegularUser}`,
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
			};

			const payload = {
				idProfile: params.idProfile,
				idRegularUser: params.idRegularUser,
				idPhoto: params.idPhoto
			};

			console.log(`🌐 Sending photo request to ${url}`, payload);

			const response = await fetchWithTimeout(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`❌ Photo send failed with status ${response.status}:`, errorText);
				return { success: false, error: `HTTP ${response.status}: ${errorText}` };
			}

			const result = await response.json();
			console.log(`✅ Photo sent successfully:`, result);

			return { success: true, data: result };

		} catch (error) {
			console.error(`💥 Error sending photo:`, error);
			return { success: false, error: error.message };
		}
	}

	private isMock(): boolean {
		// ВИПРАВЛЕННЯ: перевіряємо тільки змінну середовища, ігноруємо this.baseUrl
		const ttBaseUrl = process.env.TT_BASE_URL || '';
		const result = ttBaseUrl.startsWith('mock:') || ttBaseUrl === '';
		// Логуємо тільки при зміні режиму
		if (!this._lastMockState || this._lastMockState !== result) {
			console.log(`🔍 isMock mode changed: TT_BASE_URL="${ttBaseUrl}", result=${result}`);
			this._lastMockState = result;
		}
		return result;
	}

	private _lastMockState?: boolean;

	private buildHeaders(ctx: ProviderRequestContext): Record<string, string> {
		const headers: Record<string, string> = { 'x-requested-with': ctx.agencyCode };
		if (ctx.operatorCode) headers['x-gateway'] = ctx.operatorCode;
		return headers;
	}

	async fetchDialogs(ctx: ProviderRequestContext, filters?: DialogsFilters): Promise<unknown> {
		if (this.isMock()) {
			return {
				status: "error",
				details: { message: "Page not found.", code: 0 }
			};
		}
		const qs = new URLSearchParams();
		if (filters?.search) qs.set('search', filters.search);
		if (filters?.status) qs.set('status', filters.status);
		const url = `${this.baseUrl}/dialogs?${qs.toString()}`;
		const res = await fetchWithTimeout(url, { method: 'GET', headers: this.buildHeaders(ctx) });
		return res.json();
	}

	async fetchDialogsByProfile(profileId: string, criteria: string[] = ['active'], cursor = '', limit = 15): Promise<unknown> {
		const isMockMode = this.isMock();
		// Логуємо тільки якщо є cursor (пагінація) або в mock режимі
		if (cursor || isMockMode) {
			console.log(`🔍 TalkyTimes.fetchDialogsByProfile: profileId=${profileId}, isMock=${isMockMode}, cursor="${cursor}"`);
		}
		
		if (isMockMode) {
			console.log(`🎭 Mock fetchDialogsByProfile for profile ${profileId}`);
			// В mock режимі перевіряємо/створюємо сесію
			let session = await this.sessionService.getSession(profileId);
			if (!session) {
				// Створюємо mock сесію для профілю
				session = await this.sessionService.authenticateProfile(profileId, 'mock_login', 'mock_password');
			}

			// Повертаємо mock діалоги тільки для наших тестових профілів
			const validProfileIds = ['7162437', '7162438'];
			if (!validProfileIds.includes(profileId)) {
				return {
					dialogs: [],
					cursor: ""
				};
			}

			// Генеруємо різні діалоги залежно від критеріїв
			const allMockDialogs = [
				{ 
					idUser: parseInt(profileId), 
					idInterlocutor: 112752976 + parseInt(profileId.slice(-1)),
					idLastReadMsg: 42214651246,
					dateUpdated: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 хвилин тому
					hasNewMessage: true,
					isActive: true,
					type: "active",
					status: "active",
					isOnline: true, // Онлайн користувач
					lastMessage: {
						id: 43258791390 + parseInt(profileId.slice(-1)),
						content: { message: `Активний онлайн діалог` },
						dateCreated: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
						idUserFrom: 112752976 + parseInt(profileId.slice(-1)),
						idUserTo: parseInt(profileId)
					},
					unreadMessagesCount: 2
				},
				{ 
					idUser: parseInt(profileId), 
					idInterlocutor: 112752977 + parseInt(profileId.slice(-1)),
					idLastReadMsg: 42214651247,
					dateUpdated: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 хвилин тому
					hasNewMessage: false,
					isActive: true,
					type: "active",
					status: "active",
					isOnline: false, // Офлайн користувач
					lastMessage: {
						id: 43258791391 + parseInt(profileId.slice(-1)),
						content: { message: `Активний офлайн діалог` },
						dateCreated: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
						idUserFrom: 112752977 + parseInt(profileId.slice(-1)),
						idUserTo: parseInt(profileId)
					},
					unreadMessagesCount: 0
				},
				{ 
					idUser: parseInt(profileId), 
					idInterlocutor: 123456789 + parseInt(profileId.slice(-1)),
					idLastReadMsg: null,
					dateUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 хвилин тому
					hasNewMessage: true,
					isActive: false,
					type: "unanswered",
					status: "unanswered",
					isOnline: false, // Офлайн користувач
					lastMessage: {
						id: 43258791392 + parseInt(profileId.slice(-1)),
						content: { message: `Неотвеченное офлайн` },
						dateCreated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
						idUserFrom: 123456789 + parseInt(profileId.slice(-1)),
						idUserTo: parseInt(profileId)
					},
					unreadMessagesCount: 1
				},
				{ 
					idUser: parseInt(profileId), 
					idInterlocutor: 123456790 + parseInt(profileId.slice(-1)),
					idLastReadMsg: null,
					dateUpdated: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 хвилин тому
					hasNewMessage: true,
					isActive: false,
					type: "unanswered",
					status: "unanswered",
					isOnline: true, // Онлайн користувач
					lastMessage: {
						id: 43258791393 + parseInt(profileId.slice(-1)),
						content: { message: `Неотвеченное онлайн` },
						dateCreated: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
						idUserFrom: 123456790 + parseInt(profileId.slice(-1)),
						idUserTo: parseInt(profileId)
					},
					unreadMessagesCount: 2
				},
				{ 
					idUser: parseInt(profileId), 
					idInterlocutor: 987654321 + parseInt(profileId.slice(-1)),
					idLastReadMsg: 42214651248,
					dateUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 день тому
					hasNewMessage: false,
					isActive: false,
					type: "bookmarked",
					status: "bookmarked",
					isOnline: true, // Онлайн користувач
					lastMessage: {
						id: 43258791394 + parseInt(profileId.slice(-1)),
						content: { message: `Закладка онлайн` },
						dateCreated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
						idUserFrom: parseInt(profileId),
						idUserTo: 987654321 + parseInt(profileId.slice(-1))
					},
					unreadMessagesCount: 0
				}
			];

			// Фільтруємо діалоги за критеріями
			let filteredDialogs = allMockDialogs;
			if (criteria && criteria.length > 0) {
				// Фільтруємо за статусом
				const statusCriteria = criteria.filter(c => ['active', 'unanswered', 'bookmarked'].includes(c));
				if (statusCriteria.length > 0) {
					filteredDialogs = filteredDialogs.filter(dialog => statusCriteria.includes(dialog.status));
				}

				// Фільтруємо за онлайн статусом
				if (criteria.includes('online')) {
					filteredDialogs = filteredDialogs.filter(dialog => dialog.isOnline);
				}
			}

			// Генеруємо cursor для mock режиму (симулюємо що є ще діалоги)
			const mockCursor = cursor ? 
				new Date(new Date(cursor).getTime() - 24 * 60 * 60 * 1000).toISOString() : // На день раніше
				new Date(Date.now() - 60 * 60 * 1000).toISOString(); // На годину раніше

			return {
				dialogs: filteredDialogs,
				cursor: mockCursor,
				hasMore: filteredDialogs.length > 0 // Є ще діалоги якщо знайшли хоча б один
			};
		}

		// Для реального режиму потрібна автентифікація
		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			throw new Error(`No active session for profile ${profileId}. Please authenticate first.`);
		}

		try {
			const url = 'https://talkytimes.com/platform/chat/dialogs/by-criteria';
			const headers = this.sessionService.getRequestHeaders(session);
			
			// Логування для діагностики
			console.log(`🚀 TalkyTimes API request for profile ${profileId}:`, {
				criteria,
				cursor,
				limit,
				url
			});
			
			const res = await this.fetchWithConnectionPool(url, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					criteria,
					cursor,
					limit
				}),
				timeoutMs: 15000,
				maxRetries: 2, // Діалоги критичні, але не повторюємо багато
				baseDelayMs: 1500
			});

			if (!res.ok) {
				// Якщо 401, можливо сесія застаріла
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					throw new Error(`Session expired for profile ${profileId}. Please re-authenticate.`);
				}
				throw new Error(`HTTP ${res.status}`);
			}

			const result = await res.json();
			console.log(`📥 TalkyTimes API response for profile ${profileId}:`, {
				dialogsCount: result.dialogs?.length,
				cursor: result.cursor,
				hasMore: result.hasMore,
				hasMoreField: 'hasMore' in result
			});
			return result;
		} catch (error) {
			console.error('TalkyTimes fetchDialogsByProfile error:', error);
			throw error;
		}
	}

	async fetchMessages(ctx: ProviderRequestContext, dialogId: string, cursor?: string): Promise<unknown> {
		if (this.isMock()) {
			return {
				messages: [
					{
						id: 43256456550,
						dateCreated: "2025-08-29T11:50:36+00:00",
						idUserFrom: 94384965,
						idUserTo: 126232553,
						type: "text",
						content: { message: "Привіт! Як справи?" }
					},
					{
						id: 43256456966,
						dateCreated: "2025-08-29T11:50:40+00:00",
						idUserFrom: 126232553,
						idUserTo: 94384965,
						type: "text",
						content: { message: "Привіт! Все добре, дякую!" }
					},
					{
						id: 43256457321,
						dateCreated: "2025-08-29T11:50:43+00:00",
						idUserFrom: 94384965,
						idUserTo: 126232553,
						type: "text",
						content: { message: "Чудово! Що робиш?" }
					}
				]
			};
		}

		// Парсимо dialogId для отримання idRegularUser та idProfile
		const [idRegularUser, idProfile] = dialogId.split('-').map(Number);
		
		const url = 'https://talkytimes.com/platform/chat/messages';
		const res = await fetchWithTimeout(url, {
			method: 'POST',
			headers: this.buildHeaders(ctx),
			body: JSON.stringify({
				idLastMessage: cursor ? parseInt(cursor) : undefined,
				idRegularUser: idRegularUser,
				limit: 15,
				withoutTranslation: false
			}),
		});
		return res.json();
	}

	async fetchMessagesByProfile(profileId: string, dialogId: string, cursor?: string): Promise<{ success: boolean; messages?: any[]; error?: string }> {
		console.log(`🔍 fetchMessagesByProfile: isMock=${this.isMock()}, baseUrl=${this.baseUrl}`);
		if (this.isMock()) {
			console.log(`🎭 Mock mode: generating messages for profile ${profileId}, dialog ${dialogId}, cursor=${cursor}`);
			const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
			
			// Генеруємо повідомлення на основі cursor (lastMessageId)
			const baseId = cursor ? parseInt(cursor) : 43256456550;
			const messages: any[] = [];
			
			// Генеруємо 5-10 повідомлень перед lastMessage
			const messageCount = 7;
			for (let i = messageCount; i >= 1; i--) {
				const messageId = baseId - i * 100;
				const isFromUser = i % 2 === 0;
				
				messages.push({
					id: messageId,
					dateCreated: new Date(Date.now() - i * 10 * 60 * 1000).toISOString(), // кожні 10 хвилин
					idUserFrom: isFromUser ? idInterlocutor : idUser,
					idUserTo: isFromUser ? idUser : idInterlocutor,
					type: "text",
					content: { 
						message: isFromUser 
							? `Повідомлення від користувача ${i}` 
							: `Відповідь оператора ${i}` 
					}
				});
			}
			
			return {
				success: true,
				messages
			};
		}

		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			// Парсимо dialogId для отримання idUser та idInterlocutor
			const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
			// ВИПРАВЛЕННЯ: idRegularUser = співрозмовник (idInterlocutor), як у робочому прикладі
			const idRegularUser = idInterlocutor;
			
			// ВИПРАВЛЕННЯ: використовуємо правильний URL для messages API
			const url = 'https://talkytimes.com/platform/chat/messages';
			const headers = this.sessionService.getRequestHeaders(session);
			
			// Оновлюємо referer для конкретного діалогу
			// СПРОБУЄМО: поміняти місцями - спочатку наш профіль, потім співрозмовник
			headers['referer'] = `https://talkytimes.com/chat/${idUser}_${idInterlocutor}`;
			
			console.log(`🚀 TalkyTimes messages request for profile ${profileId}:`, {
				dialogId,
				idUser: idUser,
				idInterlocutor: idInterlocutor,
				idRegularUser,
				cursor,
				url,
				referer: headers['referer']
			});
			
			const requestBody: any = {};
			
					// Додаємо idLastMessage першим, якщо є cursor (як у вашому прикладі)
		if (cursor) {
			requestBody.idLastMessage = parseInt(cursor);
		}
			
			// Додаємо решту параметрів у точному порядку як у вашому прикладі
			requestBody.idRegularUser = idRegularUser;
			requestBody.limit = 15;
			requestBody.withoutTranslation = false;
			console.log(`📤 Request body:`, requestBody);
			console.log(`📋 Full headers:`, headers);

					const res = await this.fetchWithConnectionPool(url, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(requestBody),
			timeoutMs: 15000,
			maxRetries: 3, // Повідомлення важливі, повторюємо більше
			baseDelayMs: 1000
		});

			if (!res.ok) {
				const errorText = await res.text();
				console.error(`❌ TalkyTimes API error ${res.status}:`, errorText);
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}: ${errorText}` };
			}

			const data = await res.json();
			
			console.log(`📥 TalkyTimes messages response for profile ${profileId}:`, {
				messagesCount: data?.messages?.length || 0,
				dialogId
			});

			if (data && Array.isArray(data.messages)) {
				return { success: true, messages: data.messages };
			} else {
				console.warn('Unexpected TalkyTimes messages response format:', data);
				return { success: false, error: 'Invalid response format' };
			}
		} catch (error) {
			console.error('TalkyTimes fetchMessagesByProfile error:', error);
			return { success: false, error: 'Connection error' };
		}
	}

	async sendTextMessage(ctx: ProviderRequestContext, dialogId: string, text: string): Promise<unknown> {
		if (this.isMock()) {
			return { id: `m-${Date.now()}`, text };
		}
		const url = `${this.baseUrl}/dialogs/${encodeURIComponent(dialogId)}/messages`;
		const res = await fetchWithTimeout(url, {
			method: 'POST',
			headers: { ...this.buildHeaders(ctx), 'content-type': 'application/json' },
			body: JSON.stringify({ type: 'text', text }),
		});
		return res.json();
	}



	async fetchProfileData(profileId: string): Promise<{ success: boolean; profileData?: any; error?: string }> {
		if (this.isMock()) {
			// В mock режимі повертаємо фейкові дані профілю
			const mockProfileData = {
				id: parseInt(profileId) || 126232553,
				name: `Mock Profile ${profileId}`,
				personal: {
					avatar_large: `https://picsum.photos/100/100?random=${profileId}`,
					avatar_xl: `https://picsum.photos/592/538?random=${profileId}`,
					age: 25 + (parseInt(profileId) % 30)
				},
				is_online: Math.random() > 0.5
			};

			return { success: true, profileData: mockProfileData };
		}

		// Для реального режиму потрібна автентифікація
		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/private/personal-profile';
			const headers = this.sessionService.getRequestHeaders(session);

			const res = await this.fetchWithConnectionPool(url, {
				method: 'POST',
				headers,
				timeoutMs: 15000,
				maxRetries: 2, // Профіль критичний, але не спамимо
				baseDelayMs: 2000
			});

			if (!res.ok) {
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}` };
			}

			const data = await res.json();

			if (data && data.id) {
				return { success: true, profileData: data };
			} else {
				return { success: false, error: 'Invalid response format' };
			}
		} catch (error) {
			console.error('TalkyTimes fetchProfileData error:', error);
			return { success: false, error: 'Connection error' };
		}
	}

	async fetchProfiles(profileId: string, userIds: number[]): Promise<{ success: boolean; profiles?: any[]; error?: string }> {
		if (this.isMock()) {
			// В mock режимі повертаємо фейкові профілі
			const mockProfiles = userIds.map(id => ({
				id,
				id_user: id,
				name: `Mock User ${id}`,
				personal: {
					avatar_small: `https://picsum.photos/50/50?random=${id}`,
					avatar_large: `https://picsum.photos/100/100?random=${id}`,
					avatar_xl: `https://picsum.photos/592/538?random=${id}`,
					age: 25 + (id % 30)
				},
				is_online: Math.random() > 0.5,
				last_visit: new Date(Date.now() - Math.random() * 86400000).toISOString()
			}));
			
			return { success: true, profiles: mockProfiles };
		}

		// Для реального режиму потрібна автентифікація
		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/connections/profiles';
			const headers = this.sessionService.getRequestHeaders(session);
			
			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers,
				body: JSON.stringify({ ids: userIds }),
				timeoutMs: 15000
			});

			if (!res.ok) {
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}` };
			}

			const data = await res.json();
			
			if (data?.data?.profiles) {
				return { success: true, profiles: data.data.profiles };
			} else {
				return { success: false, error: 'Invalid response format' };
			}
		} catch (error) {
			console.error('TalkyTimes fetchProfiles error:', error);
			return { success: false, error: 'Connection error' };
		}
	}

	async validateCredentials(email: string, password: string): Promise<{ success: boolean; error?: string; profileId?: string }> {
		if (this.isMock()) {
			// В mock режимі створюємо фейковий profileId та сесію
			const profileId = `mock_${Date.now()}`;
			await this.sessionService.authenticateProfile(profileId, email, password);
			return { success: true, profileId };
		}

		try {
			const loginUrl = 'https://talkytimes.com/platform/auth/login';
			const res = await this.fetchWithConnectionPool(loginUrl, {
				method: 'POST',
				headers: {
					'accept': 'application/json',
					'accept-language': 'en-US,en;q=0.9',
					'cache-control': 'no-cache',
					'content-type': 'application/json',
					'origin': 'https://talkytimes.com',
					'pragma': 'no-cache',
					'referer': 'https://talkytimes.com/auth/login',
					'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
					'sec-ch-ua-mobile': '?0',
					'sec-ch-ua-platform': '"macOS"',
					'sec-fetch-dest': 'empty',
					'sec-fetch-mode': 'cors',
					'sec-fetch-site': 'same-origin',
					'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
					'x-requested-with': '0'
				},
				body: JSON.stringify({
					email,
					password,
					captcha: ''
				}),
				timeoutMs: 20000, // Збільшуємо таймаут для логіну
				maxRetries: 1, // Логін повторюємо тільки один раз
				baseDelayMs: 3000 // Довша затримка для логіну
			});

			if (!res.ok) {
				return { success: false, error: `HTTP ${res.status}` };
			}

			const data = await res.json();
			
			// Перевіряємо структуру відповіді TalkyTimes
			if (data?.data?.result === true && data?.data?.idUser) {
				const profileId = data.data.idUser.toString();
				
							// Зберігаємо сесію з cookies та токенами
			// ВИПРАВЛЕННЯ: правильно парсимо cookies з set-cookie headers
			const setCookieHeaders = res.headers.getSetCookie?.() || [];
			
			// Витягуємо тільки name=value частини з кожного set-cookie header
			const cookieValues = setCookieHeaders.map(header => {
				// Беремо тільки першу частину до першого ';' (name=value)
				return header.split(';')[0].trim();
			}).filter(Boolean);
			
			const cookies = cookieValues.join('; ');
			const refreshToken = data.data.refreshToken;
			
			console.log(`🍪 Saving ${setCookieHeaders.length} set-cookie headers as ${cookieValues.length} cookies for profile ${profileId}`);
			console.log(`🍪 Raw headers: ${setCookieHeaders.join(' | ')}`);
			console.log(`🍪 Clean cookies: ${cookies}`);
			
			await this.sessionService.saveSession(profileId, {
				cookies,
				refreshToken,
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 години
			});
				
				return { success: true, profileId };
			} else {
				return { success: false, error: 'Невірні облікові дані' };
			}
		} catch (error) {
			console.error('TalkyTimes login validation error:', error);
			return { success: false, error: 'Помилка з\'єднання з TalkyTimes' };
		}
	}

	async searchDialogByPair(profileId: string, clientId: number): Promise<{ success: boolean; dialog?: any; error?: string }> {
		console.log(`🔍 TalkyTimes.searchDialogByPair: profileId=${profileId}, clientId=${clientId}, isMock=${this.isMock()}`);
		
		if (this.isMock()) {
			console.log(`🎭 Mock mode: generating dialog for profile ${profileId} and client ${clientId}`);
			
			// Генеруємо мок діалог
			const mockDialog = {
				idUser: parseInt(profileId),
				idInterlocutor: clientId,
				idLastReadMsg: 43266034646,
				idInterlocutorLastReadMsg: 43257663229,
				dateUpdated: new Date().toISOString(),
				draft: "",
				hasNewMessage: false,
				highlightExpireDate: null,
				highlightType: "none",
				isActive: true,
				isBlocked: false,
				isBookmarked: false,
				isHidden: false,
				isPinned: false,
				lastMessage: {
					id: 43266256908,
					dateCreated: new Date().toISOString(),
					idUserFrom: parseInt(profileId),
					idUserTo: clientId,
					type: "text",
					content: {
						message: "Тестове повідомлення для пошуку діалогу"
					}
				},
				messagesLeft: 2,
				type: "active",
				unreadMessagesCount: 0
			};
			
			return {
				success: true,
				dialog: mockDialog
			};
		}

		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/chat/dialogs/by-pairs';
			const headers = this.sessionService.getRequestHeaders(session);
			
			console.log(`🚀 TalkyTimes search dialog request for profile ${profileId}:`, {
				profileId,
				clientId,
				url
			});
			
			const requestBody = {
				idsRegularUser: [clientId],
				withoutTranslation: false
			};
			
			console.log(`📤 Request body:`, requestBody);
			console.log(`📋 Full headers:`, headers);

			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(requestBody),
				timeoutMs: 15000
			});

			if (!res.ok) {
				const errorText = await res.text();
				console.error(`❌ TalkyTimes search dialog API error ${res.status}:`, errorText);
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}: ${errorText}` };
			}

			const result = await res.json();
			console.log(`📥 TalkyTimes search dialog response for profile ${profileId}:`, {
				dialogsCount: result?.length,
				hasDialog: result?.length > 0
			});
			
			if (result && Array.isArray(result) && result.length > 0) {
				return {
					success: true,
					dialog: result[0] // Беремо перший діалог з результату
				};
			} else {
				return {
					success: false,
					error: 'Dialog not found'
				};
			}
		} catch (error) {
			console.error('TalkyTimes searchDialogByPair error:', error);
			return { success: false, error: error.message || 'Unknown error' };
		}
	}

	async fetchRestrictions(profileId: string, clientId: number): Promise<{ success: boolean; lettersLeft?: number; error?: string }> {
		console.log(`🔍 TalkyTimes.fetchRestrictions: profileId=${profileId}, clientId=${clientId}, isMock=${this.isMock()}`);

		if (this.isMock()) {
			console.log(`🎭 Mock mode: generating restrictions for profile ${profileId} and client ${clientId}`);

			// Генеруємо мок обмеження
			const mockRestrictions = {
				lettersLeft: Math.floor(Math.random() * 10) // Випадкове число від 0 до 9
			};

			return {
				success: true,
				lettersLeft: mockRestrictions.lettersLeft
			};
		}

		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/correspondence/restriction';
			const headers = this.sessionService.getRequestHeaders(session);

			// Оновлюємо referer для конкретного діалогу
			headers['referer'] = `https://talkytimes.com/chat/${profileId}_${clientId}`;

			console.log(`🚀 TalkyTimes restrictions request for profile ${profileId}:`, {
				profileId,
				clientId,
				url,
				referer: headers['referer']
			});

			const requestBody = {
				idRegularUser: clientId
			};

			console.log(`📤 Request body:`, requestBody);
			console.log(`📋 Full headers:`, headers);

			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(requestBody),
				timeoutMs: 15000
			});

			if (!res.ok) {
				const errorText = await res.text();
				console.error(`❌ TalkyTimes restrictions API error ${res.status}:`, errorText);
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}: ${errorText}` };
			}

			const result = await res.json();
			console.log(`📥 TalkyTimes restrictions response for profile ${profileId}:`, result);

			if (result && result.data && typeof result.data.messagesLeft === 'number') {
				return {
					success: true,
					lettersLeft: result.data.messagesLeft // API повертає messagesLeft, але це насправді листи
				};
			} else {
				return {
					success: false,
					error: 'Invalid response format'
				};
			}
		} catch (error) {
			console.error('TalkyTimes fetchRestrictions error:', error);
			return { success: false, error: error.message || 'Unknown error' };
		}
	}

		async getStickers(profileId: string, interlocutorId: number): Promise<{ success: boolean; categories?: any[]; error?: string }> {
		console.log(`😀 TalkyTimes.getStickers: profileId=${profileId}, interlocutorId=${interlocutorId}, isMock=${this.isMock()}`);

		// Перевіряємо кеш спочатку
		const cacheKey = `stickers-${profileId}`;
		const now = Date.now();
		const cached = this.stickersCache.get(cacheKey);

		if (cached && (now - cached.timestamp) < this.STICKERS_CACHE_TTL) {
			console.log(`📋 Using cached stickers for profile ${profileId} (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
			return cached.data;
		}

		if (this.isMock()) {
			console.log(`🎭 Mock mode: generating stickers for profile ${profileId}`);

			// Генеруємо мок стікери
			const mockCategories = [
				{
					name: 'Funny Faces',
					stickers: [
						{ id: 1001, url: 'https://via.placeholder.com/64x64?text=😀' },
						{ id: 1002, url: 'https://via.placeholder.com/64x64?text=😂' },
						{ id: 1003, url: 'https://via.placeholder.com/64x64?text=😍' },
						{ id: 1004, url: 'https://via.placeholder.com/64x64?text=🤔' },
					]
				},
				{
					name: 'Hearts',
					stickers: [
						{ id: 2001, url: 'https://via.placeholder.com/64x64?text=❤️' },
						{ id: 2002, url: 'https://via.placeholder.com/64x64?text=💛' },
						{ id: 2003, url: 'https://via.placeholder.com/64x64?text=💚' },
						{ id: 2004, url: 'https://via.placeholder.com/64x64?text=💙' },
					]
				},
				{
					name: 'Animals',
					stickers: [
						{ id: 3001, url: 'https://via.placeholder.com/64x64?text=🐱' },
						{ id: 3002, url: 'https://via.placeholder.com/64x64?text=🐶' },
						{ id: 3003, url: 'https://via.placeholder.com/64x64?text=🐼' },
						{ id: 3004, url: 'https://via.placeholder.com/64x64?text=🦁' },
					]
				}
			];

			const result = { success: true, categories: mockCategories };

			// Зберігаємо в кеш
			this.stickersCache.set(cacheKey, { data: result, timestamp: now });

			return result;
		}

		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/chat/stickers';
			const headers = this.sessionService.getRequestHeaders(session);

			// Оновлюємо referer для конкретного діалогу
			headers['referer'] = `https://talkytimes.com/chat/${profileId}_${interlocutorId}`;

			console.log(`🚀 TalkyTimes stickers request for profile ${profileId}:`, {
				profileId,
				interlocutorId,
				url,
				referer: headers['referer']
			});

			const requestBody = {
				idInterlocutor: interlocutorId
			};

			console.log(`📤 Request body:`, requestBody);
			console.log(`📋 Full headers:`, headers);

			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(requestBody),
				timeoutMs: 15000
			});

			if (!res.ok) {
				const errorText = await res.text();
				console.error(`❌ TalkyTimes stickers API error ${res.status}:`, errorText);
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}: ${errorText}` };
			}

			const result = await res.json();
			console.log(`📥 TalkyTimes stickers response for profile ${profileId}:`, result);

			if (result && result.categories && Array.isArray(result.categories)) {
				const response = {
					success: true,
					categories: result.categories
				};

				// Зберігаємо в кеш
				this.stickersCache.set(cacheKey, { data: response, timestamp: now });

				return response;
			} else {
				return {
					success: false,
					error: 'Invalid response format'
				};
			}
		} catch (error) {
			console.error('TalkyTimes getStickers error:', error);
			return { success: false, error: error.message || 'Unknown error' };
		}
	}

	async sendSticker(ctx: ProviderRequestContext, params: { idProfile: number; idRegularUser: number; stickerId: number; stickerUrl: string }): Promise<{ success: boolean; data?: any; error?: string }> {
		console.log(`😀 TalkyTimes.sendSticker: profile ${params.idProfile} → user ${params.idRegularUser}, sticker ${params.stickerId}`);

		if (this.isMock()) {
			return {
				success: true,
				data: {
					messageId: `sticker-msg-${Date.now()}`,
					stickerId: params.stickerId,
					stickerUrl: params.stickerUrl
				}
			};
		}

		try {
			// Отримуємо активну сесію для профілю
			const session = await this.sessionService.getActiveSession(params.idProfile);
			if (!session) {
				return { success: false, error: `No active session found for profile ${params.idProfile}` };
			}

			// Формуємо URL для відправки стікера
			const url = `${this.baseUrl}/api/send-sticker`;

			// Підготовуємо headers
			const headers = {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Cookie': session.cookies,
				'Referer': `${this.baseUrl}/chat/${params.idProfile}_${params.idRegularUser}`,
				'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
			};

			const payload = {
				idProfile: params.idProfile,
				idRegularUser: params.idRegularUser,
				stickerId: params.stickerId,
				stickerUrl: params.stickerUrl
			};

			console.log(`🌐 Sending sticker request to ${url}`, payload);

			const response = await fetchWithTimeout(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`❌ Sticker send failed with status ${response.status}:`, errorText);
				return { success: false, error: `HTTP ${response.status}: ${errorText}` };
			}

			const result = await response.json();
			console.log(`✅ Sticker sent successfully:`, result);

			return { success: true, data: result };

		} catch (error) {
			console.error(`💥 Error sending sticker:`, error);
			return { success: false, error: error.message };
		}
	}

	async getVirtualGiftLimits(profileId: string, clientId: number): Promise<{ success: boolean; data?: { limit: number; canSendWithoutLimit: boolean }; error?: string }> {
		console.log(`🎁 TalkyTimes.getVirtualGiftLimits: profileId=${profileId}, clientId=${clientId}, isMock=${this.isMock()}`);

		if (this.isMock()) {
			console.log(`🎭 Mock mode: generating gift limits for profile ${profileId} and client ${clientId}`);

			// Генеруємо мок ліміти
			const mockLimits = {
				limit: Math.floor(Math.random() * 20) + 1, // Випадкове число від 1 до 20
				canSendWithoutLimit: Math.random() > 0.8 // 20% шанс мати canSendWithoutLimit = true
			};

			return { success: true, data: mockLimits };
		}

		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/virtual-gift/limit/get';
			const headers = this.sessionService.getRequestHeaders(session);

			// Оновлюємо referer для конкретного діалогу
			headers['referer'] = `https://talkytimes.com/chat/${profileId}_${clientId}`;

			console.log(`🚀 TalkyTimes get gift limits request for profile ${profileId}:`, {
				profileId,
				clientId,
				url,
				referer: headers['referer']
			});

			const requestBody = {
				idUserFrom: parseInt(profileId),
				idUserTo: clientId
			};

			console.log(`📤 Request body:`, requestBody);
			console.log(`📋 Full headers:`, headers);

			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(requestBody),
				timeoutMs: 15000
			});

			if (!res.ok) {
				const errorText = await res.text();
				console.error(`❌ TalkyTimes get gift limits API error ${res.status}:`, errorText);
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}: ${errorText}` };
			}

			const result = await res.json();
			console.log(`📥 TalkyTimes get gift limits response for profile ${profileId}:`, result);

			if (result && typeof result.limit === 'number' && typeof result.canSendWithoutLimit === 'boolean') {
				return { success: true, data: result };
			} else {
				return { success: false, error: 'Invalid response format' };
			}
		} catch (error) {
			console.error('TalkyTimes getVirtualGiftLimits error:', error);
			return { success: false, error: error.message || 'Unknown error' };
		}
	}

	async sendStickerById(profileId: string, interlocutorId: number, stickerId: number): Promise<{ success: boolean; data?: any; error?: string }> {
		console.log(`😀 TalkyTimes.sendStickerById: profile ${profileId} → user ${interlocutorId}, sticker ${stickerId}`);

		if (this.isMock()) {
			return {
				success: true,
				data: {
					messageId: `sticker-msg-${Date.now()}`,
					stickerId: stickerId
				}
			};
		}

		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/chat/send/sticker';
			const headers = this.sessionService.getRequestHeaders(session);

			// Оновлюємо referer для конкретного діалогу
			headers['referer'] = `https://talkytimes.com/chat/${profileId}_${interlocutorId}`;

			console.log(`🚀 TalkyTimes send sticker request for profile ${profileId}:`, {
				profileId,
				interlocutorId,
				stickerId,
				url,
				referer: headers['referer']
			});

			const requestBody = {
				idSticker: stickerId,
				idRegularUser: interlocutorId
			};

			console.log(`📤 Request body:`, requestBody);
			console.log(`📋 Full headers:`, headers);

			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(requestBody),
				timeoutMs: 15000
			});

			if (!res.ok) {
				const errorText = await res.text();
				console.error(`❌ TalkyTimes send sticker API error ${res.status}:`, errorText);
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}: ${errorText}` };
			}

			const result = await res.json();
			console.log(`📥 TalkyTimes send sticker response for profile ${profileId}:`, result);

			return { success: true, data: result };

		} catch (error) {
			console.error(`💥 Error sending sticker by ID:`, error);
			return { success: false, error: error.message };
		}
	}

	async getVirtualGiftList(profileId: string, clientId: number, cursor: string = '', limit: number = 30): Promise<{ success: boolean; data?: { cursor: string; items: any[] }; error?: string }> {
		console.log(`🎁 TalkyTimes.getVirtualGiftList: profileId=${profileId}, clientId=${clientId}, cursor=${cursor}, limit=${limit}, isMock=${this.isMock()}`);

		if (this.isMock()) {
			console.log(`🎭 Mock mode: generating gift list for profile ${profileId} and client ${clientId}`);

			// Генеруємо мок подарунки з реалістичними URL (fallback на picsum.photos)
			const mockItems = [
				{
					id: 1180,
					cost: 3340,
					name: "Ocean diamond",
					imageSrc: "https://picsum.photos/100/100?random=diamond",
					animationSrc: null,
					category: { id: 74, name: "Labor Day in the U.S." },
					gender: "female"
				},
				{
					id: 1181,
					cost: 4490,
					name: "Forever mine ring",
					imageSrc: "https://picsum.photos/100/100?random=ring",
					animationSrc: null,
					category: { id: 74, name: "Labor Day in the U.S." },
					gender: "female"
				},
				{
					id: 1182,
					cost: 95,
					name: "Fresh XL bouquet",
					imageSrc: "https://picsum.photos/100/100?random=flowers",
					animationSrc: null,
					category: { id: 75, name: "Flowers" },
					gender: "unisex"
				},
				{
					id: 1183,
					cost: 1090,
					name: "Floral symphony",
					imageSrc: "https://picsum.photos/100/100?random=floral",
					animationSrc: null,
					category: { id: 75, name: "Flowers" },
					gender: "female"
				},
				{
					id: 1184,
					cost: 240,
					name: "Hair styling set",
					imageSrc: "https://picsum.photos/100/100?random=hair",
					animationSrc: null,
					category: { id: 75, name: "Beauty" },
					gender: "female"
				},
				{
					id: 1185,
					cost: 89,
					name: "Glam bag",
					imageSrc: "https://picsum.photos/100/100?random=bag",
					animationSrc: null,
					category: { id: 75, name: "Beauty" },
					gender: "female"
				},
				{
					id: 1186,
					cost: 690,
					name: "Eagle power",
					imageSrc: "https://picsum.photos/100/100?random=eagle",
					animationSrc: null,
					category: { id: 77, name: "Animals" },
					gender: "male"
				},
				{
					id: 1187,
					cost: 289,
					name: "I heart you!",
					imageSrc: null,
					animationSrc: "https://i.gstatvb.com/1b9c94ba16c5a89a891483b104a276581675182874.rng.json",
					category: { id: 7, name: "animated" },
					gender: null
				},
				{
					id: 1188,
					cost: 450,
					name: "Dancing cat",
					imageSrc: "https://picsum.photos/100/100?random=cat",
					animationSrc: "https://picsum.photos/100/100?random=dancing",
					category: { id: 7, name: "animated" },
					gender: "unisex"
				},
				{
					id: 1189,
					cost: 320,
					name: "Sparkling heart",
					imageSrc: null,
					animationSrc: "https://picsum.photos/100/100?random=sparkle",
					category: { id: 7, name: "animated" },
					gender: "unisex"
				}
			];

			const mockCursor = cursor ? parseInt(cursor) + 10 : "35";

			return {
				success: true,
				data: {
					cursor: mockCursor.toString(),
					items: mockItems.slice(0, limit)
				}
			};
		}

		let session = await this.sessionService.getSession(profileId);
		if (!session) {
			return { success: false, error: `No active session for profile ${profileId}. Please authenticate first.` };
		}

		try {
			const url = 'https://talkytimes.com/platform/virtual-gift/gift/list';
			const headers = this.sessionService.getRequestHeaders(session);

			// Оновлюємо referer для конкретного діалогу
			headers['referer'] = `https://talkytimes.com/chat/${profileId}_${clientId}`;

			console.log(`🚀 TalkyTimes get gift list request for profile ${profileId}:`, {
				profileId,
				clientId,
				cursor,
				limit,
				url,
				referer: headers['referer']
			});

			const requestBody = {
				limit,
				cursor: cursor || '',
				idRegularUser: clientId
			};

			console.log(`📤 Request body:`, requestBody);
			console.log(`📋 Full headers:`, headers);

			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers: headers,
				body: JSON.stringify(requestBody),
				timeoutMs: 15000
			});

			if (!res.ok) {
				const errorText = await res.text();
				console.error(`❌ TalkyTimes get gift list API error ${res.status}:`, errorText);
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					return { success: false, error: `Session expired for profile ${profileId}. Please re-authenticate.` };
				}
				return { success: false, error: `HTTP ${res.status}: ${errorText}` };
			}

			const result = await res.json();
			console.log(`📥 TalkyTimes get gift list response for profile ${profileId}:`, result);

			// Детальне логування перших 3 елементів
			if (result && result.items && Array.isArray(result.items)) {
				console.log(`🎁 Processing ${result.items.length} gift items`);
				result.items.slice(0, 3).forEach((item, index) => {
					console.log(`🎁 Item ${index + 1}: ${item.name}, imageSrc: ${item.imageSrc}`);
				});
			}

			if (result && result.items && Array.isArray(result.items)) {
				return { success: true, data: result };
			} else {
				return { success: false, error: 'Invalid response format' };
			}
				} catch (error) {
					console.error('TalkyTimes getVirtualGiftList error:', error);
		return { success: false, error: error.message || 'Unknown error' };
	}
	}

	async getEmailHistory(profileId: string, clientId: number, correspondenceId: string, page: number = 1, limit: number = 10): Promise<{ success: boolean; data?: any; error?: string }> {
		try {
			console.log(`📧 TalkyTimes.getEmailHistory: profileId=${profileId}, clientId=${clientId}, correspondenceId=${correspondenceId}, page=${page}, limit=${limit}, isMock=${this.isMock()}`);

			if (this.isMock()) {
				console.log(`🎭 Mock mode: simulating email history for profile ${profileId} with client ${clientId}`);
				await new Promise(resolve => setTimeout(resolve, 500));
				const mockEmails = [
					{
						id: "9085270527",
						id_user_from: profileId,
						id_user_to: clientId.toString(),
						id_correspondence: correspondenceId,
						content: "<p>Привіт! Як справи?</p>",
						date_created: new Date().toISOString(),
						date_read: new Date().toISOString(),
						is_paid: false,
						is_sent: "1",
						is_deleted: "0",
						status: "read",
						title: "Привітання",
						attachments: {
							images: [
								{
									id: "img_12345",
									url_thumbnail: "https://talkytimes.com/uploads/images/thumbnail_12345.jpg",
									url_original: "https://talkytimes.com/uploads/images/original_12345.jpg"
								},
								{
									id: "img_67890",
									url_thumbnail: "https://talkytimes.com/uploads/images/thumbnail_67890.jpg",
									url_original: "https://talkytimes.com/uploads/images/original_67890.jpg"
								}
							],
							videos: []
						}
					}
				];
				return {
					success: true,
					data: {
						status: "success",
						history: mockEmails,
						limit: limit,
						page: page
					}
				};
			}

					const session = await this.sessionService.getSession(profileId);
		if (!session) {
			throw new Error('Failed to get session for profile');
		}
		
		// Додаткова перевірка для TypeScript
		if (!session.cookies) {
			throw new Error('Session cookies are missing');
		}

		const url = 'https://talkytimes.com/platform/correspondence/emails-history';
			const payload = {
				page: page,
				limit: limit,
				id_correspondence: correspondenceId,
				id_interlocutor: clientId,
				id_user: parseInt(profileId),
				without_translation: false
			};

			console.log(`📧 Making API request to: ${url}`);
			console.log(`📧 Payload:`, JSON.stringify(payload, null, 2));

			const response = await fetchWithTimeout(url, {
				method: 'POST',
				headers: {
					'accept': 'application/json',
					'accept-language': 'en-US,en;q=0.9',
					'baggage': 'sentry-environment=PROD,sentry-release=PROD%3A68578-1-71d5,sentry-public_key=36f772c5edd5474cbfbbc825a80816b8,sentry-trace_id=a494bc58364b41d89afcab5b46233489,sentry-sampled=false,sentry-sample_rand=0.38253945589427885,sentry-sample_rate=0.0001',
					'content-type': 'application/json',
					'origin': 'https://talkytimes.com',
					'priority': 'u=1, i',
					'referer': `https://talkytimes.com/mails/view/${profileId}_${clientId}`,
					'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
					'sec-ch-ua-mobile': '?0',
					'sec-ch-ua-platform': '"macOS"',
					'sec-fetch-dest': 'empty',
					'sec-fetch-mode': 'cors',
					'sec-fetch-site': 'same-origin',
					'sentry-trace': 'a494bc58364b41d89afcab5b46233489-b3d30c6c2f41a5f9-0',
					'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
					'x-requested-with': '2055',
					'Cookie': session.cookies
				},
				body: JSON.stringify(payload),
				timeoutMs: DEFAULT_TIMEOUT_MS
			});

			console.log(`📧 TalkyTimes getEmailHistory response:`, response.status);

			const responseData = await response.json();

			return {
				success: true,
				data: responseData
			};

		} catch (error: any) {
			console.error('TalkyTimes getEmailHistory error:', error);
			return { success: false, error: error.message || 'Unknown error' };
		}
	}

	async sendVirtualGift(profileId: string, clientId: number, giftId: number, message: string = ''): Promise<{ success: boolean; data?: any; error?: string }> {
		try {
			console.log(`🎁 TalkyTimes.sendVirtualGift: profileId=${profileId}, clientId=${clientId}, giftId=${giftId}, message="${message}", isMock=${this.isMock()}`);

			if (this.isMock()) {
				console.log(`🎭 Mock mode: simulating gift send for profile ${profileId} to client ${clientId}`);

				// Імітуємо успішну відправку подарунку
				await new Promise(resolve => setTimeout(resolve, 1000)); // Імітація затримки API

				return {
					success: true,
					data: {
						success: true,
						message: `Подарунок успішно відправлено! Повідомлення: "${message || 'Без повідомлення'}"`,
						giftId,
						timestamp: new Date().toISOString()
					}
				};
			}

			// Реальний API запит до TalkyTimes
			const session = await this.sessionService.getSession(profileId);
			if (!session) {
				throw new Error('Failed to get session for profile');
			}

			const url = 'https://talkytimes.com/platform/virtual-gift/send';
			const payload = {
				idUserTo: clientId,
				idGift: giftId,
				message: message || 'kiss' // fallback повідомлення як у прикладі
			};

			console.log(`🎁 Making API request to: ${url}`);
			console.log(`🎁 Payload:`, JSON.stringify(payload, null, 2));

			const response = await fetchWithTimeout(url, {
				method: 'POST',
				headers: {
					'accept': 'application/json',
					'accept-language': 'en-US,en;q=0.9',
					'content-type': 'application/json',
					'origin': 'https://talkytimes.com',
					'referer': `https://talkytimes.com/virtual-gifts/buy/000${clientId}/cart/checkout`,
					'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
					'sec-ch-ua-mobile': '?0',
					'sec-ch-ua-platform': '"macOS"',
					'sec-fetch-dest': 'empty',
					'sec-fetch-mode': 'cors',
					'sec-fetch-site': 'same-origin',
					'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
					'x-requested-with': '2055',
					'Cookie': session.cookies
				},
				body: JSON.stringify(payload),
				timeoutMs: DEFAULT_TIMEOUT_MS
			});

			console.log(`🎁 TalkyTimes sendVirtualGift response:`, response.status);

			const responseData = await response.json();

			return {
				success: true,
				data: responseData
			};

		} catch (error: any) {
			console.error('TalkyTimes sendVirtualGift error:', error);
			return { success: false, error: error.message || 'Unknown error' };
		}
	}
}
