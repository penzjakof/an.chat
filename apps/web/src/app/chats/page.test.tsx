import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatsPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/session', () => ({ getSession: () => ({ accessToken: 't', agencyCode: 'AG', role: 'OWNER' }) }));
vi.mock('@/lib/api', () => ({ apiGet: async () => ([{ id: 'dlg-1', title: 'Діалог 1' }]) }));

describe('ChatsPage', () => {
	it('renders dialogs from API', async () => {
		render(<ChatsPage />);
		const item = await screen.findByText('Діалог 1');
		expect(item).toBeInTheDocument();
	});
});
