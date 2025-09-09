import { clearSession, getAccessToken } from './session';

const API_BASE = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

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

function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
	const headers = {
		...authz(),
		...(options.body ? { 'content-type': 'application/json' } : {}),
		...options.headers
	};

	// Логуємо тільки в development і тільки важливі запити (не photo-statuses)
	// Нормалізуємо шлях: якщо не починається з /api, додаємо префікс
	const normalizedPath = path.startsWith('/api')
		? path
		: (path.startsWith('/') ? `/api${path}` : `/api/${path}`);

	if (process.env.NODE_ENV === 'development') {
		const method = options.method || 'GET';
		const isPhotoStatusRequest = normalizedPath.includes('photo-statuses');
		const shouldLog = (method !== 'GET' || !headers.Authorization) && !isPhotoStatusRequest;
		if (shouldLog) {
			console.log('🌐 API Request:', {
				url: `${API_BASE}${normalizedPath}`,
				method,
				hasAuth: !!headers.Authorization,
				hasBody: !!options.body
			});
		}
	}


	// Ретраї для 429: GET та ідемпотентні POST (статуси галереї)
	const method = (options.method || 'GET').toUpperCase();
	const isIdempotentStatusesPost = method === 'POST' && (
		path.includes('/api/gallery/photo-statuses') ||
		path.includes('/api/gallery/video-statuses') ||
		path.includes('/api/gallery/audio-statuses')
	);
	const maxRetries = (method === 'GET' || isIdempotentStatusesPost) ? 3 : 0;
	let attempt = 0;

	while (true) {
		const res = await fetch(`${API_BASE}${normalizedPath}`, {
			...options,
			headers,
			cache: 'no-store',
		});

		if (res.status === 429 && attempt < maxRetries) {
			// Експоненційний backoff + повага до Retry-After, якщо є
			attempt += 1;
			const retryAfterHeader = res.headers.get('Retry-After');
			let delayMs = 0;
			if (retryAfterHeader) {
				const seconds = Number(retryAfterHeader);
				delayMs = Number.isFinite(seconds) ? seconds * 1000 : 0;
			}
			// Якщо Retry-After не заданий — 500ms * 2^(attempt-1) + невеликий jitter
			if (delayMs === 0) {
				delayMs = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
			}
			if (process.env.NODE_ENV === 'development') {
				console.warn(`⏳ 429 on ${path}, retry ${attempt}/${maxRetries} in ${delayMs}ms`);
			}
			await sleep(delayMs);
			continue;
		}

		return handle<T>(res, path);
	}
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
