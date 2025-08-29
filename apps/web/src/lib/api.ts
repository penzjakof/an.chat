import { clearSession, getAccessToken } from './session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function authz(): HeadersInit {
	const token = getAccessToken();
	return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response, path: string): Promise<T> {
	if (res.status === 401) {
		clearSession();
		if (typeof window !== 'undefined') window.location.href = '/login';
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
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: { 
			...authz(), 
			...(options.body ? { 'content-type': 'application/json' } : {}),
			...options.headers 
		},
		cache: 'no-store',
	});
	return handle<T>(res, path);
}

export async function apiGet<T>(path: string): Promise<T> {
	return apiRequest<T>(path, { method: 'GET' });
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
