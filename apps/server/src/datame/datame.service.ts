import { Injectable } from '@nestjs/common';
import { ConnectionPoolService } from '../common/http/connection-pool.service';

interface DatameLoginResponse {
  data?: { result?: boolean; idUser?: number | null; refreshToken?: string };
}

@Injectable()
export class DatameService {
  private readonly base = 'https://datame.cloud';

  constructor(private readonly pool: ConnectionPoolService) {}

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async login(email: string, password: string, cookies?: string): Promise<{ refreshToken: string; setCookie?: string[] }> {
    const url = `${this.base}/platform/auth/login`;
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'content-type': 'application/json',
      'origin': this.base,
      'referer': `${this.base}/statistics`,
      'user-agent': 'Mozilla/5.0',
    };
    if (cookies) headers['cookie'] = cookies;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, captcha: '' }),
      // агент не додаємо для уникнення несумісностей з undici
    } as any);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = (await res.json()) as DatameLoginResponse;
    const refreshToken = data?.data?.refreshToken || '';
    const setCookie = (res as any).headers?.getSetCookie?.() || [];
    return { refreshToken, setCookie };
  }

  async collection(params: { status?: string; limit?: number; id_last?: number | string }, cookie: string): Promise<any> {
    const url = `${this.base}/platform/trusted-user/collection`;
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'content-type': 'application/json',
      'origin': this.base,
      'referer': `${this.base}/members`,
      'user-agent': 'Mozilla/5.0',
      'cookie': cookie,
    };
    return this.fetchJson<any>(url, { method: 'POST', headers, body: JSON.stringify({ status: params.status ?? 'approved', limit: params.limit ?? 25, id_last: params.id_last ?? undefined }) });
  }

  async formData(id: number, cookie: string): Promise<any> {
    const url = `${this.base}/platform/trusted-user/form-data?id=${id}`;
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'origin': this.base,
      'referer': `${this.base}/profile-trusted-edit/${id}`,
      'user-agent': 'Mozilla/5.0',
      'cookie': cookie,
    };
    return this.fetchJson<any>(url, { method: 'POST', headers });
  }

  async getFemale(id: number, cookie: string): Promise<any> {
    const url = `${this.base}/platform/operator/get-female/${id}`;
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'origin': this.base,
      'referer': `${this.base}/members`,
      'user-agent': 'Mozilla/5.0',
      'cookie': cookie,
    };
    return this.fetchJson<any>(url, { method: 'POST', headers });
  }
}


