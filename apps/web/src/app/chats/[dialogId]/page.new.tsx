"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getAccessToken, getSession } from '@/lib/session';
import { ChatHeaderSkeleton, MessageSkeleton } from '@/components/SkeletonLoader';
import { useWebSocketPool } from '@/contexts/WebSocketPoolContext';

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
		mood?: string;
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
	const [isLoadingMessages, setIsLoadingMessages] = useState(true);
	const [isLoadingHeader, setIsLoadingHeader] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasMoreMessages, setHasMoreMessages] = useState(true);
	const [cursor, setCursor] = useState<number | null>(null);
	const [messagesLeft, setMessagesLeft] = useState<number | null>(null);
	const [lettersLeft, setLettersLeft] = useState<number | null>(null);
	const [isLoadingRestrictions, setIsLoadingRestrictions] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const lastScrollTop = useRef<number>(0);
	const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const unlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const canLoadMore = useRef<boolean>(true);

	// ВИПРАВЛЕННЯ: dialogId має формат "idProfile-idRegularUser" (наш профіль - співрозмовник)
	const [idProfile, idRegularUser] = dialogId.split('-').map(Number);

	// Функція для отримання стилів настрою
	const getMoodStyles = (mood?: string) => {
		if (!mood) return {};
		
		switch (mood.toLowerCase()) {
			case 'happy':
			case 'веселий':
				return { color: '#FFD700', fontWeight: 'bold' };
			case 'sad':
			case 'сумний':
				return { color: '#87CEEB', fontStyle: 'italic' };
			case 'angry':
			case 'злий':
				return { color: '#FF6B6B', fontWeight: 'bold' };
			case 'love':
			case 'закоханий':
				return { color: '#FF69B4', fontWeight: 'bold' };
			case 'excited':
			case 'збуджений':
				return { color: '#FF4500', fontWeight: 'bold' };
			default:
				return { color: '#9CA3AF' };
		}
	};

	const { getSocketForProfile, joinDialog, leaveDialog } = useWebSocketPool();

	useEffect(() => {
		// Підключаємося до діалогу через WebSocket pool
		joinDialog(profileId, dialogId);

		return () => {
			// Виходимо з діалогу при unmount
			leaveDialog(profileId, dialogId);
			
			// Очищуємо timeouts при unmount
			if (loadingTimeoutRef.current) {
				clearTimeout(loadingTimeoutRef.current);
			}
			if (unlockTimeoutRef.current) {
				clearTimeout(unlockTimeoutRef.current);
			}
		};
	}, [dialogId, joinDialog, leaveDialog]);

	useEffect(() => {
		const socket = getSocketForProfile(profileId);
		if (!socket) return;

		// Обробляємо нові повідомлення з RTM
		const handleMessage = (payload: ChatMessage) => {
			console.log('📨 RTM: Received new message', payload);
			
			setMessages((prev) => {
				// Перевіряємо чи повідомлення вже існує
				const exists = prev.some(msg => msg.id === payload.id);
				if (exists) {
					return prev;
				}
				
				const newMessages = [...prev, payload].sort((a, b) => 
					new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
				);
				
				// Оновлюємо лічільник повідомлень якщо це наше повідомлення
				if (payload.idUserFrom === idProfile) {
					updateCountersAfterSend();
				}
				
				return newMessages;
			});
			
			// Автоматично прокручуємо до низу при новому повідомленні
			setTimeout(() => {
				bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
			}, 100);
		};

		// Обробляємо зміни онлайн статусу
		const handleUserOnlineStatus = (data: { userId: number; isOnline: boolean }) => {
			console.log('👤 RTM: User online status changed', data);
			
			// Оновлюємо статус користувача якщо це наш співрозмовник
			if (data.userId === idRegularUser) {
				setUserProfile(prev => prev ? { ...prev, is_online: data.isOnline } : null);
			}
		};

		socket.on('message', handleMessage);
		socket.on('user_online_status', handleUserOnlineStatus);

		return () => {
			socket.off('message', handleMessage);
			socket.off('user_online_status', handleUserOnlineStatus);
		};
	}, [getSocketForProfile, profileId, idProfile, idRegularUser]);

	// Завантажуємо повідомлення при зміні діалогу
	useEffect(() => {
		loadMessages();
		loadRestrictions();
	}, [dialogId]);

	// Завантажуємо профіль користувача при зміні діалогу
	useEffect(() => {
		loadUserProfile();
	}, [idRegularUser]);

	// Завантажуємо профіль джерела при зміні діалогу
	useEffect(() => {
		loadSourceProfile();
	}, [idProfile]);

	async function loadMessages() {
		try {
			setIsLoadingMessages(true);
			const response = await apiGet(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/messages`);
			setMessages(response.messages || []);
			setCursor(response.cursor);
			setHasMoreMessages(response.hasMore || false);
			
			// Прокручуємо до низу після завантаження
			setTimeout(() => {
				bottomRef.current?.scrollIntoView({ behavior: 'auto' });
			}, 100);
		} catch (error) {
			console.error('Error loading messages:', error);
		} finally {
			setIsLoadingMessages(false);
		}
	}

	async function loadUserProfile() {
		try {
			setIsLoadingHeader(true);
			const response = await apiGet(`/api/chats/profiles?userId=${idRegularUser}`);
			if (response.profiles && response.profiles.length > 0) {
				setUserProfile(response.profiles[0]);
			}
		} catch (error) {
			console.error('Error loading user profile:', error);
		} finally {
			setIsLoadingHeader(false);
		}
	}

	async function loadSourceProfile() {
		try {
			const session = getSession();
			if (!session) return;
			
			const response = await apiGet('/profiles/my');
			const profiles = response.profiles || [];
			const profile = profiles.find((p: any) => p.profileId === idProfile.toString());
			
			if (profile) {
				setSourceProfile(profile);
				// Завантажуємо аватар профілю
				try {
					const avatarResponse = await apiGet(`/profiles/${profile.id}/profile-data`);
					if (avatarResponse.profileData?.personal?.avatar_small) {
						setProfileAvatar(avatarResponse.profileData.personal.avatar_small);
					}
				} catch (error) {
					console.error('Error loading profile avatar:', error);
				}
			}
		} catch (error) {
			console.error('Error loading source profile:', error);
		}
	}

	async function loadRestrictions() {
		try {
			setIsLoadingRestrictions(true);
			const response = await apiGet(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/restrictions`);
			setMessagesLeft(response.messagesLeft);
			setLettersLeft(response.lettersLeft);
		} catch (error) {
			console.error('Error loading restrictions:', error);
		} finally {
			setIsLoadingRestrictions(false);
		}
	}

	async function loadMoreMessages() {
		if (!hasMoreMessages || isLoadingMore || !cursor) return;
		
		try {
			setIsLoadingMore(true);
			const response = await apiGet(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/messages?cursor=${cursor}`);
			
			const newMessages = response.messages || [];
			setMessages(prev => {
				const combined = [...newMessages, ...prev];
				// Видаляємо дублікати
				const unique = combined.filter((msg, index, arr) => 
					arr.findIndex(m => m.id === msg.id) === index
				);
				return unique.sort((a, b) => 
					new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
				);
			});
			
			setCursor(response.cursor);
			setHasMoreMessages(response.hasMore || false);
		} catch (error) {
			console.error('Error loading more messages:', error);
		} finally {
			setIsLoadingMore(false);
			// Розблоковуємо можливість завантаження через 1 секунду
			unlockTimeoutRef.current = setTimeout(() => {
				canLoadMore.current = true;
			}, 1000);
		}
	}

	const updateCountersAfterSend = () => {
		if (messagesLeft !== null && messagesLeft > 0) {
			setMessagesLeft(prev => prev ? prev - 1 : 0);
		}
		if (lettersLeft !== null && lettersLeft > 0) {
			setLettersLeft(prev => prev ? Math.max(0, prev - text.length) : 0);
		}
	};

	// Обробляємо скролінг для завантаження більше повідомлень
	const handleScroll = () => {
		if (!scrollContainerRef.current || !canLoadMore.current) return;
		
		const container = scrollContainerRef.current;
		const scrollTop = container.scrollTop;
		
		// Якщо скролимо вгору і досягли верху
		if (scrollTop === 0 && scrollTop < lastScrollTop.current && hasMoreMessages && !isLoadingMore) {
			canLoadMore.current = false;
			
			// Додаємо невелику затримку для уникнення спаму
			loadingTimeoutRef.current = setTimeout(() => {
				loadMoreMessages();
			}, 300);
		}
	};

	async function send() {
		if (!text.trim()) return;
		await apiPost(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/text`, { text });
		setText('');
	}

	const formatDateTime = (dateString: string) => {
		const date = new Date(dateString);
		
		// Завжди показуємо дату і час
		const dateStr = date.toLocaleDateString('uk-UA', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
		const timeStr = date.toLocaleTimeString('uk-UA', { 
			hour: '2-digit', 
			minute: '2-digit' 
		});
		
		return `${dateStr} ${timeStr}`;
	};

	const renderMessageContent = (message: ChatMessage) => {
		if (message.type === 'text' && message.content.message) {
			return <span>{message.content.message}</span>;
		}
		
		if (message.type === 'photo' && message.content.url) {
			return (
				<div className="max-w-xs">
					<img 
						src={message.content.url} 
						alt="Фото" 
						className="rounded-lg max-w-full h-auto"
						loading="lazy"
					/>
				</div>
			);
		}
		
		return <span className="text-gray-500 italic">Непідтримуваний тип повідомлення</span>;
	};

	if (isLoadingMessages) {
		return (
			<div className="flex flex-col h-full">
				<ChatHeaderSkeleton />
				<div className="flex-1 p-4 space-y-4">
					{[...Array(5)].map((_, i) => (
						<MessageSkeleton key={i} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-gray-50">
			{/* Заголовок чату */}
			<div className="bg-white border-b border-gray-200 p-4 flex items-center space-x-3">
				<button 
					onClick={() => router.push('/chats')}
					className="text-gray-600 hover:text-gray-800 transition-colors"
				>
					← Назад
				</button>
				
				{isLoadingHeader ? (
					<ChatHeaderSkeleton />
				) : userProfile ? (
					<>
						<div className="relative">
							<img 
								src={userProfile.personal.avatar_small || '/default-avatar.png'} 
								alt={userProfile.name}
								className="w-10 h-10 rounded-full object-cover"
							/>
							{userProfile.is_online && (
								<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
							)}
						</div>
						<div className="flex-1">
							<h2 className="font-semibold text-gray-900">{userProfile.name}</h2>
							<div className="flex items-center space-x-2 text-sm">
								<span className={userProfile.is_online ? 'text-green-600' : 'text-gray-500'}>
									{userProfile.is_online ? 'Онлайн' : 'Офлайн'}
								</span>
								{userProfile.personal.mood && (
									<>
										<span className="text-gray-400">•</span>
										<span style={getMoodStyles(userProfile.personal.mood)}>
											{userProfile.personal.mood}
										</span>
									</>
								)}
							</div>
						</div>
						
						{/* Показуємо профіль джерела */}
						{sourceProfile && (
							<div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
								{profileAvatar && (
									<img 
										src={profileAvatar} 
										alt={sourceProfile.displayName}
										className="w-6 h-6 rounded-full object-cover"
									/>
								)}
								<span>від {sourceProfile.displayName}</span>
							</div>
						)}
					</>
				) : (
					<div className="text-gray-500">Профіль не знайдено</div>
				)}
			</div>

			{/* Обмеження */}
			{!isLoadingRestrictions && (messagesLeft !== null || lettersLeft !== null) && (
				<div className="bg-yellow-50 border-b border-yellow-200 p-3">
					<div className="flex items-center space-x-4 text-sm text-yellow-800">
						{messagesLeft !== null && (
							<span>Повідомлень залишилось: {messagesLeft}</span>
						)}
						{lettersLeft !== null && (
							<span>Символів залишилось: {lettersLeft}</span>
						)}
					</div>
				</div>
			)}

			{/* Повідомлення */}
			<div 
				ref={scrollContainerRef}
				className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll"
				onScroll={handleScroll}
			>
				{isLoadingMore && (
					<div className="text-center py-2">
						<div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
					</div>
				)}
				
				{messages.map((message) => (
					<div
						key={message.id}
						className={`flex ${message.idUserFrom === idProfile ? 'justify-end' : 'justify-start'}`}
					>
						<div
							className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
								message.idUserFrom === idProfile
									? 'bg-blue-600 text-white'
									: 'bg-white text-gray-900 border border-gray-200'
							}`}
						>
							<div className="break-words">
								{renderMessageContent(message)}
							</div>
							<div
								className={`text-xs mt-1 ${
									message.idUserFrom === idProfile ? 'text-blue-100' : 'text-gray-500'
								}`}
							>
								{formatDateTime(message.dateCreated)}
							</div>
						</div>
					</div>
				))}
				<div ref={bottomRef} />
			</div>

			{/* Поле вводу */}
			<div className="bg-white border-t border-gray-200 p-4">
				<div className="flex space-x-2">
					<input
						type="text"
						value={text}
						onChange={(e) => setText(e.target.value)}
						onKeyPress={(e) => e.key === 'Enter' && send()}
						placeholder="Введіть повідомлення..."
						className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						disabled={messagesLeft === 0}
					/>
					<button
						onClick={send}
						disabled={!text.trim() || messagesLeft === 0}
						className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
					>
						Надіслати
					</button>
				</div>
				{messagesLeft === 0 && (
					<div className="text-red-600 text-sm mt-2">
						Ліміт повідомлень вичерпано
					</div>
				)}
			</div>
		</div>
	);
}
