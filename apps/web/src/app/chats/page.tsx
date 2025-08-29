"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { getSession } from '@/lib/session';
import { useRouter } from 'next/navigation';

type ChatDialog = {
	id: string;
	title?: string;
	[key: string]: unknown;
};

export default function ChatsPage() {
	const router = useRouter();
	const [dialogs, setDialogs] = useState<ChatDialog[]>([]);
	const [search, setSearch] = useState('');

	useEffect(() => {
		const s = getSession();
		if (!s) {
			router.replace('/login');
			return;
		}
		apiGet<ChatDialog[]>('/api/chats/dialogs').then((d) => setDialogs(Array.isArray(d) ? d : [])).catch(() => setDialogs([]));
	}, [router]);

	const filtered = useMemo(() => {
		if (!search) return dialogs;
		return dialogs.filter((d) => JSON.stringify(d).toLowerCase().includes(search.toLowerCase()));
	}, [dialogs, search]);

	return (
		<div className="p-4 space-y-3">
			<div className="flex gap-2">
				<input className="border px-2 py-1 rounded w-full" placeholder="Пошук" value={search} onChange={(e) => setSearch(e.target.value)} />
			</div>
			<ul className="space-y-2">
				{filtered.map((dlg) => (
					<li key={dlg.id} className="border rounded p-2 hover:bg-gray-50">
						<Link href={`/chats/${encodeURIComponent(dlg.id)}`}>{dlg.title ?? dlg.id}</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
