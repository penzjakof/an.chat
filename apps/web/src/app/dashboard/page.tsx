"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRole, getSession, clearSession } from '@/lib/session';
import { apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="flex h-screen">
      {/* Лівий сайдбар (стискає контент) */}
      <div className={`${sidebarOpen ? 'w-16' : 'w-0'} overflow-hidden transition-all duration-200 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-4`}>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100 border border-gray-200"
          title="На дашборд"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700">
            <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.25 8.25a.75.75 0 1 1-1.06 1.06L12 5.69l-7.72 7.46a.75.75 0 1 1-1.04-1.08l8.23-8.23z" />
            <path d="M12 7.5 4.5 14v5.25A1.25 1.25 0 0 0 5.75 20.5h4.5V15h3.5v5.5h4.5a1.25 1.25 0 0 0 1.25-1.25V14L12 7.5z" />
          </svg>
        </button>
        <button
          onClick={endShift}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100 border border-gray-200"
          title="Завершити зміну"
          disabled={!active || ending}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700">
            <path d="M12 2.25a.75.75 0 0 1 .75.75v8a.75.75 0 0 1-1.5 0v-8A.75.75 0 0 1 12 2.25z" />
            <path fillRule="evenodd" d="M5.47 6.97a7.5 7.5 0 1 0 13.06 0 .75.75 0 1 1 1.06 1.06 9 9 0 1 1-15.18 0 .75.75 0 0 1 1.06-1.06z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={() => { clearSession(); router.replace('/login'); }}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100 border border-gray-200"
          title="Вийти"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700">
            <path d="M16.5 3.75a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-6.72 6.72a.75.75 0 0 1-1.06-1.06L14.69 4.5h-3.44a.75.75 0 0 1 0-1.5h5.25z" />
            <path d="M7.5 6.75A2.25 2.25 0 0 0 5.25 9v6A2.25 2.25 0 0 0 7.5 17.25h6a2.25 2.25 0 0 0 2.25-2.25v-1.5a.75.75 0 0 1 1.5 0v1.5A3.75 3.75 0 0 1 13.5 18.75h-6A3.75 3.75 0 0 1 3.75 15V9A3.75 3.75 0 0 1 7.5 5.25h1.5a.75.75 0 0 1 0 1.5h-1.5z" />
          </svg>
        </button>
      </div>

      {/* Основний контент */}
      <div className="flex-1 bg-white">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="p-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
            title={sidebarOpen ? 'Сховати панель' : 'Показати панель'}
          >
            <span className="text-sm">{sidebarOpen ? '←' : '→'}</span>
          </button>
        </div>

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


