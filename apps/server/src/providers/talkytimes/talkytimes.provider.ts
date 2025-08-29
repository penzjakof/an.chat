import type { ProviderRequestContext, SiteProvider, SiteProviderDialogsQuery } from '../site-provider.interface';

const DEFAULT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number }): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	try {
		const res = await fetch(url, { ...options, signal: controller.signal, headers: { ...(options.headers ?? {}), 'x-requested-with': options.headers?.['x-requested-with'] as string, 'x-gateway': options.headers?.['x-gateway'] as string } });
		return res;
	} finally {
		clearTimeout(timeout);
	}
}

export class TalkyTimesProvider implements SiteProvider {
	constructor(private readonly baseUrl: string) {}

	private isMock(): boolean {
		return this.baseUrl.startsWith('mock:');
	}

	private buildHeaders(ctx: ProviderRequestContext): Record<string, string> {
		const headers: Record<string, string> = { 'x-requested-with': ctx.agencyCode };
		if (ctx.operatorCode) headers['x-gateway'] = ctx.operatorCode;
		return headers;
	}

	async fetchDialogs(ctx: ProviderRequestContext, query?: SiteProviderDialogsQuery): Promise<unknown> {
		if (this.isMock()) {
			return [
				{ id: 'dlg-1', title: 'Діалог 1' },
				{ id: 'dlg-2', title: 'Діалог 2' },
			];
		}
		const qs = new URLSearchParams();
		if (query?.search) qs.set('search', query.search);
		if (query?.status) qs.set('status', query.status);
		const url = `${this.baseUrl}/dialogs?${qs.toString()}`;
		const res = await fetchWithTimeout(url, { method: 'GET', headers: this.buildHeaders(ctx) });
		return res.json();
	}

	async fetchMessages(ctx: ProviderRequestContext, dialogId: string, cursor?: string): Promise<unknown> {
		if (this.isMock()) {
			return [
				{ id: 'm-1', text: 'Привіт!' },
				{ id: 'm-2', text: 'Як справи?' },
			];
		}
		const qs = new URLSearchParams();
		if (cursor) qs.set('cursor', cursor);
		const url = `${this.baseUrl}/dialogs/${encodeURIComponent(dialogId)}/messages?${qs.toString()}`;
		const res = await fetchWithTimeout(url, { method: 'GET', headers: this.buildHeaders(ctx) });
		return res.json();
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

	async validateCredentials(email: string, password: string): Promise<{ success: boolean; error?: string; profileId?: string }> {
		if (this.isMock()) {
			// В mock режимі завжди повертаємо успіх для тестування з фейковим ID
			return { success: true, profileId: `mock_${Date.now()}` };
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
				return { success: true, profileId: data.data.idUser.toString() };
			} else {
				return { success: false, error: 'Невірні облікові дані' };
			}
		} catch (error) {
			console.error('TalkyTimes login validation error:', error);
			return { success: false, error: 'Помилка з\'єднання з TalkyTimes' };
		}
	}
}
