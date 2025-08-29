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
}
