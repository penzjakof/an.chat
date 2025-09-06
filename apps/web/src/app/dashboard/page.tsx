"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRole, getSession, clearSession } from '@/lib/session';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { Header } from '@/components/Header';

interface GroupStatus {
  id: string;
  name: string;
  busy: boolean;
  operatorName: string | null;
  operatorId: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [groups, setGroups] = useState<GroupStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [active, setActive] = useState<boolean>(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    const role = getRole();
    if (role === 'OWNER') {
      router.push('/owner');
      return;
    }
    load();
  }, [router]);

  async function load() {
    try {
      setLoading(true);
      const [status, gs] = await Promise.all([
        apiGet<{ active: boolean }>('/api/shifts/is-active'),
        apiGet<GroupStatus[]>('/api/shifts/groups-status'),
      ]);
      setActive(!!status?.active);
      setGroups(gs);
    } catch (e) {
      setError('Не вдалося завантажити групи');
    } finally {
      setLoading(false);
    }
  }

  async function startShift() {
    try {
      setStarting(true);
      const can = await apiGet<{ canStart: boolean; busyGroups: { id: string; name: string }[] }>(
        '/api/shifts/can-start'
      );
      if (!can.canStart) {
        const msg = 'Деякі групи зайняті: ' + can.busyGroups.map((g) => g.name).join(', ');
        setError(msg);
        showToast({ messageId: '', type: 'error', message: msg } as any);
        return;
      }
      await apiPost('/api/shifts/start', {});
      showToast({ messageId: '', type: 'info', message: 'Зміну розпочато' } as any);
      router.push('/chats');
    } catch (e) {
      setError('Не вдалося розпочати зміну');
      showToast({ messageId: '', type: 'error', message: 'Не вдалося розпочати зміну' } as any);
    } finally {
      setStarting(false);
    }
  }

  async function endShift() {
    try {
      setEnding(true);
      await apiPost('/api/shifts/end', {});
      showToast({ messageId: '', type: 'info', message: 'Зміну завершено' } as any);
      setActive(false);
      load();
    } catch (e) {
      showToast({ messageId: '', type: 'error', message: 'Не вдалося завершити зміну' } as any);
    } finally {
      setEnding(false);
    }
  }

  const hasBusy = groups.some((g) => g.busy);

  if (loading) return <div className="p-6">Завантаження...</div>;

  return (
    <div className="flex flex-col h-screen">
      <Header
        showHomeButton={true}
        showChatsButton={true}
        showSettingsButton={true}
        showEndShiftButton={true}
        showLogoutButton={true}
        isActive={active}
        currentPath="/dashboard"
        onEndShift={endShift}
      />

      {/* Основний контент */}
      <div className="flex-1 bg-white overflow-y-auto">

        <div className="max-w-xl mx-auto p-6 space-y-6">
          <h1 className="text-2xl font-bold">Особистий дашборд</h1>
          <p className="text-gray-600">Ваші призначені групи та їх готовність:</p>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="border rounded divide-y">
            {groups.length === 0 ? (
              <div className="p-3 text-gray-500">Групи не призначені</div>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{g.name}</div>
                    <div className="text-sm text-gray-500">
                      {g.busy
                        ? `Зайнята оператором: ${g.operatorName || g.operatorId}`
                        : 'Готова до роботи'}
                    </div>
                  </div>
                  <div
                    className={`w-2 h-2 rounded-full ${g.busy ? 'bg-red-500' : 'bg-green-500'}`}
                    title={g.busy ? 'Зайнята' : 'Вільна'}
                  />
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <button
              className={`bg-primary text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-50`}
              onClick={startShift}
              disabled={hasBusy || starting || active}
            >
              Почати зміну
            </button>
            <button
              className={`bg-gray-600 text-white px-4 py-2 rounded hover:opacity-90 disabled:opacity-50`}
              onClick={endShift}
              disabled={!active || ending}
            >
              Завершити зміну
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


