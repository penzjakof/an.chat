"use client";

import Link from 'next/link';
import { clearSession, getSession } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Header } from '@/components/Header';

type ShiftLogItem = {
	id: string;
	action: 'START' | 'END';
	createdAt: string;
	operatorName: string;
	operatorId: string;
	message?: string;
};

export default function OwnerPage() {
	const router = useRouter();
	const [logs, setLogs] = useState<ShiftLogItem[]>([]);
	const [error, setError] = useState<string | null>(null);
  const [activeShifts, setActiveShifts] = useState<Array<{ shiftId: string; operatorId: string; operatorName: string; startedAt: string; groupsCount: number }>>([]);
	const [active, setActive] = useState<boolean>(false);

	useEffect(() => {
		const s = getSession();
		if (!s || s.role !== 'OWNER') router.replace('/login');
		else load();
	}, [router]);

	async function load() {
		try {
			const [logsData, activeShiftsData, shiftStatus] = await Promise.all([
				apiGet<ShiftLogItem[]>('/api/shifts/logs'),
				apiGet<Array<{ shiftId: string; operatorId: string; operatorName: string; startedAt: string; groupsCount: number }>>('/api/shifts/active'),
				apiGet<{ active: boolean }>('/api/shifts/is-active')
			]);
			setLogs(logsData);
			setActiveShifts(activeShiftsData);
			setActive(!!shiftStatus?.active);
		} catch (e) {
			setError('Не вдалося завантажити лог аудиту змін');
		}
	}

  async function forceEnd(operatorId: string) {
    try {
      await apiPost('/api/shifts/force-end', { operatorId });
      await load();
    } catch (e) {
      // no-op simple UI
    }
  }

	return (
		<div className="flex flex-col h-screen">
			<Header
				title="Owner Dashboard"
				showChatsButton={true}
				showLogoutButton={true}
				isActive={active}
				currentPath="/owner"
			/>

			{/* Основний контент */}
			<div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll">
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<Link className="border rounded p-3 hover:bg-gray-50" href="/chats">Чати</Link>
					<Link className="border rounded p-3 hover:bg-gray-50" href="/operators">Оператори</Link>
					<Link className="border rounded p-3 hover:bg-gray-50" href="/profiles">Профілі</Link>
					<Link className="border rounded p-3 hover:bg-gray-50" href="/owner/settings">Налаштування</Link>
				</div>

				<div className="mt-6">
					<h2 className="text-lg font-semibold mb-2">Активні зміни</h2>
					<div className="border rounded divide-y mb-6">
						{activeShifts.length === 0 ? (
							<div className="p-3 text-gray-500">Активних змін немає</div>
						) : (
							activeShifts.map(s => (
								<div key={s.shiftId} className="p-3 flex items-center justify-between">
									<div>
										<div className="font-medium">{s.operatorName}</div>
										<div className="text-xs text-gray-500">Старт: {new Date(s.startedAt).toLocaleString('uk-UA')} · Груп: {s.groupsCount}</div>
									</div>
									<button className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:opacity-90" onClick={() => forceEnd(s.operatorId)}>Зупинити</button>
								</div>
							))
						)}
					</div>
					<h2 className="text-lg font-semibold mb-2">Аудит змін</h2>
					{error && <div className="text-red-600 text-sm mb-2">{error}</div>}
					<div className="border rounded divide-y">
						{logs.length === 0 ? (
							<div className="p-3 text-gray-500">Подій немає</div>
						) : (
							logs.map((l) => (
								<div key={l.id} className="p-3 flex items-center justify-between">
									<div>
										<div className="font-medium">
											{l.action === 'START' ? 'Початок зміни' : 'Завершення зміни'} — {l.operatorName}
										</div>
										<div className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString('uk-UA')}</div>
										{l.message && <div className="text-xs text-gray-500">{l.message}</div>}
									</div>
									<div className={`text-xs px-2 py-1 rounded ${l.action === 'START' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
										{l.action}
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
