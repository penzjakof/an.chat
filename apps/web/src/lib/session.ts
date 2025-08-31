"use client";

import type { AuthContext } from './auth';

export type UserRole = 'OWNER' | 'OPERATOR';

export type StoredSession = {
	accessToken: string;
	agencyCode: string;
	role: UserRole;
	operatorCode?: string;
};

const KEY = 'anchat-auth';

export function getSession(): StoredSession | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as StoredSession) : null;
	} catch {
		return null;
	}
}

export function setSession(s: StoredSession): void {
	if (typeof window === 'undefined') return;
	window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
	if (typeof window === 'undefined') return;
	window.localStorage.removeItem(KEY);
}

export function getAuthContextFromSession(): AuthContext | null {
	const s = getSession();
	if (!s) return null;
	return { agencyCode: s.agencyCode, operatorCode: s.role === 'OPERATOR' ? s.operatorCode : undefined };
}

export function getAccessToken(): string | null {
	const session = getSession();
	const token = session?.accessToken ?? null;
	console.log('🔑 getAccessToken called:', {
		hasSession: !!session,
		hasToken: !!token,
		tokenLength: token?.length || 0
	});
	return token;
}

export function getRole(): UserRole | null {
	return getSession()?.role ?? null;
}

export function getAgencyCode(): string | null {
	return getSession()?.agencyCode ?? null;
}
