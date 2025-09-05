import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/lib/session', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    getSession: () => ({ accessToken: 't', agencyCode: 'AG', role: 'OPERATOR' }),
    getRole: () => 'OPERATOR',
  } as typeof actual;
});

vi.mock('@/lib/api', async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    apiGet: vi.fn(async (path: string) => {
      if (path === '/api/shifts/groups-status') {
        return [
          { id: 'g1', name: 'G1', busy: false, operatorName: null, operatorId: null },
        ];
      }
      if (path === '/api/shifts/can-start') {
        return { canStart: true, busyGroups: [] };
      }
      return {};
    }),
    apiPost: vi.fn(async () => ({})),
  } as typeof actual;
});

describe('DashboardPage', () => {
  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows groups and enables start when free', async () => {
    render(<DashboardPage />);
    expect(await screen.findByText(/Ваші призначені групи/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Почати зміну/i });
    expect(btn).not.toBeDisabled();
  });

  it('navigates to /chats after starting shift', async () => {
    render(<DashboardPage />);
    const btn = await screen.findByRole('button', { name: /Почати зміну/i });
    fireEvent.click(btn);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/chats'));
  });
});


