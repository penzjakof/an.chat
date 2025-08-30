"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { apiGet, apiPost } from '@/lib/api';
import { getAccessToken, getSession } from '@/lib/session';

type ChatMessage = {
	id: number;
	dateCreated: string;
	idUserFrom: number;
	idUserTo: number;
	type: string;
	content: {
		message?: string;
		idPhoto?: number;
		url?: string;
	};
	[key: string]: unknown;
};

type UserProfile = {
	id: number;
	name: string;
	personal: {
		avatar_small: string;
		avatar_large: string;
	};
	is_online: boolean;
};

type SourceProfile = {
	id: string;
	displayName: string;
};

export default function DialogPage() {
	const router = useRouter();
	const params = useParams();
	const dialogId = params.dialogId as string;
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState('');
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [sourceProfile, setSourceProfile] = useState<SourceProfile | null>(null);
	const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	// ВИПРАВЛЕННЯ: dialogId має формат "idProfile-idRegularUser" (наш профіль - співрозмовник)
	const [idProfile, idRegularUser] = dialogId.split('-').map(Number);

	useEffect(() => {
		const s = getSession();
		if (!s) {
			router.replace('/login');
			return;
		}
		
		// Завантажуємо повідомлення
		loadMessages();
		
		// Завантажуємо дані користувача та профілю
		loadUserAndProfileData();
	}, [dialogId, router]);

	const loadMessages = async () => {
		try {
			// ВИПРАВЛЕННЯ: Прямий запит повідомлень без зайвого запиту діалогів
			// API сам знайде lastMessage.id для cursor
			const messagesUrl = `/api/chats/dialogs/${encodeURIComponent(dialogId)}/messages`;
			
			const response = await apiGet<{ messages: ChatMessage[] }>(messagesUrl);
			// Сортуємо повідомлення за датою (старіші спочатку)
			const sortedMessages = (response.messages || []).sort((a, b) => 
				new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
			);
			setMessages(sortedMessages);
		} catch (error) {
			console.error('Failed to load messages:', error);
			setMessages([]);
		}
	};

	const loadUserAndProfileData = async () => {
		try {
			// Завантажуємо профіль користувача
			const userResponse = await apiGet<{ profiles: UserProfile[] }>(`/api/chats/profiles?ids=${idRegularUser}`);
			if (userResponse.profiles && userResponse.profiles.length > 0) {
				setUserProfile(userResponse.profiles[0]);
			}

			// Завантажуємо дані нашого профілю з бази
			const profilesResponse = await apiGet<SourceProfile[]>('/profiles/my');
			const profile = profilesResponse.find((p: any) => p.profileId === idProfile.toString());
			if (profile) {
				setSourceProfile(profile);
				
				// Завантажуємо аватар нашого профілю
				const profileDataResponse = await apiGet<{ profileData: any }>(`/profiles/${profile.id}/profile-data`);
				if (profileDataResponse.profileData?.personal?.avatar_large) {
					setProfileAvatar(profileDataResponse.profileData.personal.avatar_large);
				}
			}
		} catch (error) {
			console.error('Failed to load user/profile data:', error);
		}
	};

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

	const formatTime = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleTimeString('uk-UA', { 
			hour: '2-digit', 
			minute: '2-digit' 
		});
	};

	const renderMessage = (message: ChatMessage) => {
		// ВИПРАВЛЕННЯ: idProfile - це наш профіль, idRegularUser - співрозмовник
		const isFromProfile = message.idUserFrom === idProfile;
		const isFromUser = message.idUserFrom === idRegularUser;
		
		return (
			<div key={message.id} className={`flex ${isFromProfile ? 'justify-end' : 'justify-start'} mb-4`}>
				<div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
					isFromProfile 
						? 'bg-purple-500 text-white' 
						: 'bg-gray-200 text-gray-800'
				}`}>
					{/* Відображення різних типів повідомлень */}
					{(message.type === 'message' || message.type === 'text') && message.content.message && (
						<p className="text-sm whitespace-pre-wrap break-words">{message.content.message}</p>
					)}
					{message.type === 'likephoto' && (
						<div className="text-sm">
							<p>❤️ Вподобав фото</p>
							{message.content.url && (
								<img src={message.content.url} alt="Photo" className="mt-2 rounded max-w-full h-auto" />
							)}
						</div>
					)}
					{message.type === 'photo' && message.content.url && (
						<div className="text-sm">
							<img src={message.content.url} alt="Photo" className="rounded max-w-full h-auto" />
						</div>
					)}
					{/* Відображення невідомих типів повідомлень для дебагу */}
					{!['message', 'text', 'likephoto', 'photo'].includes(message.type) && (
						<div className="text-sm italic text-gray-500">
							Тип повідомлення: {message.type}
							{message.content.message && <p className="mt-1">{message.content.message}</p>}
						</div>
					)}
					<p className={`text-xs mt-1 ${isFromProfile ? 'text-purple-200' : 'text-gray-500'}`}>
						{formatTime(message.dateCreated)}
					</p>
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-screen">
			{/* Хедер діалогу */}
			<div className="bg-white border-b border-gray-200 p-4">
				<div className="flex items-center gap-3">
					{/* Аватар користувача */}
					<div className="relative flex-shrink-0">
						<div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
							{userProfile?.personal?.avatar_small ? (
								<img
									src={userProfile.personal.avatar_small}
									alt={userProfile.name}
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center text-white bg-purple-500 text-lg font-medium">
									{userProfile?.name?.charAt(0).toUpperCase() || 'U'}
								</div>
							)}
						</div>
						{/* Індикатор онлайн */}
						{userProfile?.is_online && (
							<div className="absolute top-0 left-0 w-3 h-3 bg-green-500 rounded-full border border-white"></div>
						)}
						{/* Аватар профілю в правому нижньому куті */}
						{profileAvatar && (
							<div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full overflow-hidden bg-white border border-gray-300">
								<img
									src={profileAvatar}
									alt={sourceProfile?.displayName || 'Profile'}
									className="w-full h-full object-cover"
								/>
							</div>
						)}
					</div>
					
					{/* Інформація про співрозмовника */}
					<div className="flex-1 min-w-0">
						<div className="font-medium text-gray-900 text-lg">
							{userProfile?.name || `Користувач ${idRegularUser}`}
						</div>
						<div className="text-sm text-gray-500">
							Профіль: {sourceProfile?.displayName || 'Невідомий'} • ID: {idRegularUser}
						</div>
					</div>
				</div>
			</div>

			{/* Область повідомлень */}
			<div className="flex-1 overflow-auto p-4 bg-gray-50">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-gray-500">
						<p>Немає повідомлень</p>
					</div>
				) : (
					<div className="space-y-2">
						{messages.map(renderMessage)}
						<div ref={bottomRef} />
					</div>
				)}
			</div>

			{/* Поле вводу */}
			<div className="bg-white border-t border-gray-200 p-4">
				<div className="flex gap-2">
					<input 
						className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" 
						placeholder="Напишіть повідомлення..." 
						value={text} 
						onChange={(e) => setText(e.target.value)}
						onKeyPress={(e) => e.key === 'Enter' && send()}
					/>
					<button 
						className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors" 
						onClick={send}
					>
						Надіслати
					</button>
				</div>
			</div>
		</div>
	);
}
