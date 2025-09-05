"use client";

import type { AuthContext } from './auth';

export type UserRole = 'OWNER' | 'OPERATOR';

export type StoredSession = {
	accessToken: string;
	agencyCode: string;
	role: UserRole;
	operatorCode?: string;
    userId?: string;
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
	return getSession()?.accessToken ?? null;
}

export function getRole(): UserRole | null {
	return getSession()?.role ?? null;
}

export function getAgencyCode(): string | null {
	return getSession()?.agencyCode ?? null;
}

export function getUserId(): string | null {
	const s = getSession();
	if (s?.userId) return s.userId;
	const token = s?.accessToken;
	if (!token) return null;
	try {
		const [, payload] = token.split('.');
		const data = JSON.parse(atob(payload)) as { sub?: string };
		return data.sub ?? null;
	} catch {
		return null;
	}
}