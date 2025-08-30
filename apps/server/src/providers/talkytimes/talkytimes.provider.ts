import type { ProviderRequestContext, SiteProvider, DialogsFilters } from '../site-provider.interface';
import { TalkyTimesSessionService } from './session.service';

const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number }): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	try {
		// ВИПРАВЛЕННЯ: правильно зберігаємо всі headers включаючи cookies
		const cleanOptions = { ...options };
		delete cleanOptions.timeoutMs;
		
		const res = await fetch(url, { 
			...cleanOptions, 
			signal: controller.signal
		});
		return res;
	} finally {
		clearTimeout(timeout);
	}
}

export class TalkyTimesProvider implements SiteProvider {
	constructor(
		private readonly baseUrl: string,
		private readonly sessionService: TalkyTimesSessionService
	) {
		console.log('TalkyTimesProvider baseUrl:', this.baseUrl);
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

			return {
				dialogs: filteredDialogs,
				cursor: new Date().toISOString()
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
			
			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					criteria,
					cursor,
					limit
				}),
				timeoutMs: 15000
			});

			if (!res.ok) {
				// Якщо 401, можливо сесія застаріла
				if (res.status === 401) {
					await this.sessionService.removeSession(profileId);
					throw new Error(`Session expired for profile ${profileId}. Please re-authenticate.`);
				}
				throw new Error(`HTTP ${res.status}`);
			}

			return res.json();
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
			
			// ВИПРАВЛЕННЯ: використовуємо реальний URL з змінної середовища
			const realBaseUrl = process.env.TT_BASE_URL || 'https://talkytimes.com/platform';
			const url = `${realBaseUrl}/chat/messages`;
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

					const res = await fetchWithTimeout(url, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(requestBody),
			timeoutMs: 15000
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
					avatar_large: `https://via.placeholder.com/100x100/680098/ffffff?text=P${profileId.slice(-2)}`,
					avatar_xl: `https://via.placeholder.com/592x538/680098/ffffff?text=P${profileId.slice(-2)}`,
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

			const res = await fetchWithTimeout(url, {
				method: 'POST',
				headers,
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
					avatar_small: `https://via.placeholder.com/50x50/680098/ffffff?text=${id.toString().slice(-2)}`,
					avatar_large: `https://via.placeholder.com/100x100/680098/ffffff?text=${id.toString().slice(-2)}`,
					avatar_xl: `https://via.placeholder.com/592x538/680098/ffffff?text=${id.toString().slice(-2)}`,
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
			const res = await fetchWithTimeout(loginUrl, {
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
				timeoutMs: 15000 // Збільшуємо таймаут для логіну
			});

			if (!res.ok) {
				return { success: false, error: `HTTP ${res.status}` };
			}

			const data = await res.json();
			
			// Перевіряємо структуру відповіді TalkyTimes
			if (data?.data?.result === true && data?.data?.idUser) {
				const profileId = data.data.idUser.toString();
				
				// Зберігаємо сесію з cookies та токенами
				const cookies = res.headers.get('set-cookie') || '';
				const refreshToken = data.data.refreshToken;
				
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
}
