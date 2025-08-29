import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './page';

const TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
	Buffer.from(JSON.stringify({ role: 'OWNER', agencyCode: 'AG' }), 'utf8').toString('base64') +
	'.signature';

function setupFetchOk() {
	vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ accessToken: TOKEN }) })) as unknown as typeof fetch);
}

function setupFetchFail() {
	vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch);
}

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
	push.mockReset();
	setupFetchOk();
	const store: Record<string, string> = {};
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store[k] ?? null,
		setItem: (k: string, v: string) => { store[k] = v; },
		removeItem: (k: string) => { delete store[k]; },
	} as Storage);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('LoginPage', () => {
	it('logs in owner and redirects to /owner', async () => {
		render(<LoginPage />);
		const btn = screen.getByRole('button', { name: /увійти/i });
		fireEvent.click(btn);
		await waitFor(() => expect(push).toHaveBeenCalledWith('/owner'));
	});

	it('shows error on invalid credentials', async () => {
		setupFetchFail();
		render(<LoginPage />);
		const btn = screen.getByRole('button', { name: /увійти/i });
		fireEvent.click(btn);
		await waitFor(() => expect(screen.getByText(/Невірні дані|Помилка входу/i)).toBeInTheDocument());
	});
});
