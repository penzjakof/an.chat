"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { apiGet, apiPost } from '@/lib/api';
import { getAccessToken, getSession } from '@/lib/session';

type ChatMessage = {
	id?: string;
	text?: string;
	[key: string]: unknown;
};

export default function DialogPage() {
	const router = useRouter();
	const params = useParams();
	const dialogId = params.dialogId as string;
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState('');
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const s = getSession();
		if (!s) {
			router.replace('/login');
			return;
		}
		apiGet<ChatMessage[]>(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/messages`).then((m) => setMessages(Array.isArray(m) ? m : [])).catch(() => setMessages([]));
	}, [dialogId, router]);

	useEffect(() => {
		const token = getAccessToken();
		const socket = io('http://localhost:4000/ws', { transports: ['websocket'], auth: token ? { token } : undefined });
		socket.emit('join', { dialogId });
		socket.on('message', (payload: ChatMessage) => {
			setMessages((prev) => [...prev, payload]);
			bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
		});
		return () => { socket.disconnect(); };
	}, [dialogId]);

	useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

	async function send() {
		if (!text.trim()) return;
		await apiPost(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/text`, { text });
		setText('');
	}

	return (
		<div className="flex flex-col h-[calc(100vh-80px)] p-4 gap-3">
			<div className="flex-1 overflow-auto border rounded p-3 space-y-2">
				{messages.map((m, idx) => (
					<div key={idx} className="bg-gray-100 rounded px-2 py-1 text-sm">{JSON.stringify(m)}</div>
				))}
				<div ref={bottomRef} />
			</div>
			<div className="flex gap-2">
				<input className="border px-2 py-1 rounded w-full" placeholder="Повідомлення" value={text} onChange={(e) => setText(e.target.value)} />
				<button className="bg-primary text-white px-3 py-1 rounded" onClick={send}>Надіслати</button>
			</div>
		</div>
	);
}
