import { clearSession, getAccessToken } from './session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function authz(): HeadersInit {
	const token = getAccessToken();
	return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response, path: string): Promise<T> {
	if (res.status === 401) {
		console.error('🚨 API 401 Unauthorized:', path);
		console.error('🔑 Current token:', getAccessToken() ? 'Present' : 'Missing');
		clearSession();
		if (typeof window !== 'undefined') {
			console.error('🔄 Redirecting to login...');
			window.location.href = '/login';
		}
		throw new Error('Unauthorized');
	}
	if (!res.ok) {
		// Спробуємо отримати детальну інформацію про помилку з відповіді
		try {
			const errorData = await res.json();
			const errorMessage = errorData.message || `${res.status} ${path}`;
			throw new Error(errorMessage);
		} catch {
			// Якщо не вдалося розпарсити JSON, використовуємо стандартну помилку
			throw new Error(`${res.status} ${path}`);
		}
	}
	return res.json() as Promise<T>;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers = {
		...authz(),
		...(options.body ? { 'content-type': 'application/json' } : {}),
		...options.headers
	};

	console.log('🌐 API Request:', {
		url: `${API_BASE}${path}`,
		method: options.method || 'GET',
		hasAuth: !!headers.Authorization,
		hasBody: !!options.body,
		headers: Object.keys(headers)
	});

	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
		cache: 'no-store',
	});
	return handle<T>(res, path);
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
	const url = params ? `${path}?${new URLSearchParams(params).toString()}` : path;
	return apiRequest<T>(url, { method: 'GET' });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
	return apiRequest<T>(path, { 
		method: 'POST', 
		body: JSON.stringify(body) 
	});
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
	return apiRequest<T>(path, { 
		method: 'PUT', 
		body: JSON.stringify(body) 
	});
}

export async function apiDelete<T>(path: string): Promise<T> {
	return apiRequest<T>(path, { method: 'DELETE' });
}
