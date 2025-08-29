"use client";

import Link from 'next/link';
import { clearSession, getSession } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OwnerPage() {
	const router = useRouter();
	useEffect(() => {
		const s = getSession();
		if (!s || s.role !== 'OWNER') router.replace('/login');
	}, [router]);

	return (
		<div className="p-6 space-y-4">
			<div className="flex justify-between items-center">
				<h1 className="text-xl font-semibold">Owner Dashboard</h1>
				<button className="text-sm underline" onClick={() => { clearSession(); router.push('/login'); }}>Вийти</button>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				<Link className="border rounded p-3 hover:bg-gray-50" href="/chats">Чати</Link>
				<Link className="border rounded p-3 hover:bg-gray-50" href="#">Користувачі (скоро)</Link>
				<Link className="border rounded p-3 hover:bg-gray-50" href="#">Групи/Профілі (скоро)</Link>
			</div>
		</div>
	);
}
