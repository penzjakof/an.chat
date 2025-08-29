"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setSession, type StoredSession } from '@/lib/session';

type JWTPayload = {
	rule?: never;
	role?: 'OWNER' | 'OPERATOR';
	agencyCode?: string;
	operatorCode?: string;
};

function parseJwt(token: string): JWTPayload | unknown {
	try {
		const [, payload] = token.split('.');
		return JSON.parse(atob(payload)) as JWTPayload;
	} catch {
		return {} as const;
	}
}

export default function LoginPage() {
	const router = useRouter();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		try {
			const res = await fetch((process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ username, password }),
			});
			if (!res.ok) throw new Error('Невірні дані');
			const { accessToken } = (await res.json()) as { accessToken: string };
			const payload = parseJwt(accessToken) as JWTPayload;
			const role: 'OWNER' | 'OPERATOR' = payload.role === 'OWNER' ? 'OWNER' : 'OPERATOR';
			const s: StoredSession = { accessToken, agencyCode: payload.agencyCode ?? '', role, operatorCode: payload.operatorCode };
			setSession(s);
			router.push(s.role === 'OWNER' ? '/owner' : '/chats');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Помилка входу');
		}
	}

	return (
		<div className="max-w-sm mx-auto p-6 space-y-4">
			<h1 className="text-xl font-semibold">Вхід</h1>
			<form onSubmit={submit} className="space-y-3">
				<label className="block">
					<span className="text-sm">Username</span>
					<input className="border rounded px-2 py-1 w-full" value={username} onChange={(e) => setUsername(e.target.value)} />
				</label>
				<label className="block">
					<span className="text-sm">Пароль</span>
					<input type="password" className="border rounded px-2 py-1 w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
				</label>
				{error && <div className="text-red-600 text-sm">{error}</div>}
				<button className="bg-primary text-white px-3 py-1 rounded w-full" type="submit">Увійти</button>
			</form>
		</div>
	);
}
