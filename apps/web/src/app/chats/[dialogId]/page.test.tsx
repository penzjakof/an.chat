import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DialogPage from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({ dialogId: 'dlg-1' }), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/session', () => ({ getSession: () => ({ accessToken: 't', agencyCode: 'AG', role: 'OWNER' }), getAccessToken: () => 't' }));
vi.mock('socket.io-client', () => ({ io: () => ({ emit: vi.fn(), on: vi.fn(), disconnect: vi.fn() }) }));

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => (url.includes('/messages') ? [{ id: 'm1', text: 'Привіт!' }] : []) })) as unknown as typeof fetch);
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('DialogPage', () => {
	it('renders messages list', async () => {
		render(<DialogPage />);
		await waitFor(() => expect(screen.getByText(/Привіт!/)).toBeInTheDocument());
	});
});
