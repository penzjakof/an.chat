"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getAccessToken, getSession } from '@/lib/session';
import { ChatHeaderSkeleton, MessageSkeleton } from '@/components/SkeletonLoader';
import { useDialogWebSocket } from '@/hooks/useDialogWebSocket';
import { MediaGallery, Photo } from '@/components/MediaGallery';


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
		id?: number; // Для стікерів
	};
	isSending?: boolean; // Для локальних повідомлень що відправляються
	error?: boolean; // Для повідомлень з помилкою відправки
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

type Sticker = {
	id: number;
	url: string;
};

type StickerCategory = {
	name: string;
	stickers: Sticker[];
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
	const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
	const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
	const [stickerCategories, setStickerCategories] = useState<StickerCategory[]>([]);
	const [isLoadingStickers, setIsLoadingStickers] = useState(false);
	const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(0);
	const stickerScrollRef = useRef<HTMLDivElement>(null);

	// Кеш для стікерів
	const stickersCache = useRef<{
		data: StickerCategory[];
		timestamp: number;
		profileId: string;
	} | null>(null);
	const STICKERS_CACHE_TTL = 30 * 60 * 1000; // 30 хвилин

	// ВИПРАВЛЕННЯ: dialogId має формат "idProfile-idRegularUser" (наш профіль - співрозмовник)
	const [idProfile, idRegularUser] = dialogId.split('-').map(Number);

	// Функція для отримання стилів настрою
	const getMoodStyles = (mood: string | null | undefined) => {
		// Перевіряємо на null/undefined
		if (!mood || typeof mood !== 'string') {
			return {
				iconColor: 'text-gray-600',
				textColor: 'text-gray-600',
				displayName: 'Невідомо',
				icon: (
					<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
						<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
					</svg>
				)
			};
		}

		switch (mood.toLowerCase()) {
			case 'real_love':
				return {
					iconColor: 'text-red-600',
					textColor: 'text-red-600',
					displayName: 'Любов',
					icon: (
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
						</svg>
					)
				};
			case 'friendship':
				return {
					iconColor: 'text-blue-600',
					textColor: 'text-blue-600',
					displayName: 'Дружба',
					icon: (
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
						</svg>
					)
				};
			case 'hot_talks':
				return {
					iconColor: 'text-pink-600',
					textColor: 'text-pink-600',
					displayName: 'Інтим',
					icon: (
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0112.12 15.12z" />
						</svg>
					)
				};
			default:
				return {
					iconColor: 'text-gray-600',
					textColor: 'text-gray-600',
					displayName: mood,
					icon: (
						<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
							<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
						</svg>
					)
				};
		}
	};

	useEffect(() => {
		const s = getSession();
		if (!s) {
			router.replace('/login');
			return;
		}
		
		// Скидаємо стани при зміні діалогу
		canLoadMore.current = true;
		lastScrollTop.current = 0;
		
		// Очищуємо timeouts при зміні діалогу
		if (loadingTimeoutRef.current) {
			clearTimeout(loadingTimeoutRef.current);
			loadingTimeoutRef.current = null;
		}
		if (unlockTimeoutRef.current) {
			clearTimeout(unlockTimeoutRef.current);
			unlockTimeoutRef.current = null;
		}
		
		// Завантажуємо повідомлення
		loadMessages();
		
		// Завантажуємо дані користувача та профілю
		loadUserAndProfileData();
		
		// Завантажуємо обмеження
		loadRestrictions();
	}, [dialogId, router]);

	const loadMessages = async (isInitial = true) => {
		try {
			if (isInitial) {
				setIsLoadingMessages(true);
				setMessages([]);
				setCursor(null);
				setHasMoreMessages(true);
			} else {
				setIsLoadingMore(true);
			}

			// Будуємо URL з cursor для пагінації
			const params = new URLSearchParams();
			if (cursor && !isInitial) {
				params.set('cursor', cursor.toString());
			}
			
			const messagesUrl = `/api/chats/dialogs/${encodeURIComponent(dialogId)}/messages${params.toString() ? '?' + params.toString() : ''}`;
			
			const response = await apiGet<{ messages: ChatMessage[]; cursor?: string; hasMore?: boolean }>(messagesUrl);
			
			// Сортуємо повідомлення за датою (старіші спочатку)
			const sortedMessages = (response.messages || []).sort((a, b) => 
				new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
			);

			if (isInitial) {
				setMessages(sortedMessages);
				// Встановлюємо cursor на найстаріше повідомлення для наступного завантаження
				if (sortedMessages.length > 0) {
					setCursor(sortedMessages[0].id);
				}
			} else {
				// Додаємо старіші повідомлення на початок, виключаючи дублікати
				const existingIds = new Set(messages.map(msg => msg.id));
				const newMessages = sortedMessages.filter(msg => !existingIds.has(msg.id));
				
				console.log(`📄 Pagination: loaded ${sortedMessages.length} messages, ${newMessages.length} new, ${sortedMessages.length - newMessages.length} duplicates filtered`);
				
				// Якщо немає нових повідомлень після фільтрації - зупиняємо завантаження
				if (newMessages.length === 0) {
					console.log(`⏹️ No new messages after filtering, stopping pagination`);
					setHasMoreMessages(false);
				} else {
					setMessages(prev => [...newMessages, ...prev]);
				}
				
				// Оновлюємо cursor на найстаріше з нових повідомлень
				if (sortedMessages.length > 0) {
					const newCursor = sortedMessages[0].id;
					// Оновлюємо cursor тільки якщо він відрізняється
					setCursor(prevCursor => prevCursor !== newCursor ? newCursor : prevCursor);
				}
			}

			// Перевіряємо чи є ще повідомлення
			if (isInitial) {
				// При початковому завантаженні - завжди дозволяємо пагінацію якщо є повідомлення
				setHasMoreMessages(response.hasMore !== false && sortedMessages.length > 0);
			} else {
				// При пагінації - перевіряємо чи є нові повідомлення після фільтрації дублікатів
				const existingIds = new Set(messages.map(msg => msg.id));
				const actualNewMessages = sortedMessages.filter(msg => !existingIds.has(msg.id));
				const hasRealNewMessages = actualNewMessages.length > 0;
				
				console.log(`📊 Pagination check: received ${sortedMessages.length}, new ${actualNewMessages.length}, hasMore=${response.hasMore}`);
				
				// Зупиняємо пагінацію якщо немає нових повідомлень або API каже що більше немає
				setHasMoreMessages(response.hasMore !== false && hasRealNewMessages);
			}
		} catch (error) {
			console.error('Failed to load messages:', error);
			if (isInitial) {
				setMessages([]);
			}
		} finally {
			if (isInitial) {
				setIsLoadingMessages(false);
				canLoadMore.current = true; // Розблоковуємо для початкового завантаження
			} else {
				setIsLoadingMore(false);
				// Розблоковуємо після завантаження, але тільки після невеликої затримки
				unlockTimeoutRef.current = setTimeout(() => {
					canLoadMore.current = true;
					console.log(`✅ Pagination unlocked, can load more`);
				}, 100);
			}
		}
	};

	const loadUserAndProfileData = async () => {
		try {
			setIsLoadingHeader(true);
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
		} finally {
			setIsLoadingHeader(false);
		}
	};

	const loadRestrictions = async () => {
		try {
			setIsLoadingRestrictions(true);

			// Читаємо messagesLeft з localStorage (отримано з діалогу)
			const storedMessagesLeft = localStorage.getItem(`messagesLeft_${dialogId}`);
			if (storedMessagesLeft && !isNaN(parseInt(storedMessagesLeft))) {
				setMessagesLeft(parseInt(storedMessagesLeft));
			} else {
				console.warn(`No valid messagesLeft found in localStorage for ${dialogId}`);
				setMessagesLeft(0); // Fallback значення
			}

			// Завантажуємо lettersLeft через API
			const response = await apiGet<{ lettersLeft: number }>(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/restrictions`);
			if (typeof response.lettersLeft === 'number') {
				setLettersLeft(response.lettersLeft);
			} else {
				console.warn('Invalid lettersLeft response:', response);
				setLettersLeft(0);
			}
		} catch (error) {
			console.error('Failed to load restrictions:', error);
			// Встановлюємо fallback значення для обох лічильників
			if (messagesLeft === null) setMessagesLeft(0);
			setLettersLeft(0);
		} finally {
			setIsLoadingRestrictions(false);
		}
	};

	// Функція для очищення кеша стікерів (якщо потрібно примусово оновити)
	const clearStickersCache = () => {
		stickersCache.current = null;
		console.log('🗑️ Stickers cache cleared');
	};

	const loadStickers = async () => {
		try {
			// Перевіряємо кеш спочатку
			const now = Date.now();
			if (
				stickersCache.current &&
				stickersCache.current.profileId === idProfile.toString() &&
				(now - stickersCache.current.timestamp) < STICKERS_CACHE_TTL
			) {
				console.log('📋 Using cached stickers (age:', Math.round((now - stickersCache.current.timestamp) / 1000), 'seconds)');
				setStickerCategories(stickersCache.current.data);
				return;
			}

			setIsLoadingStickers(true);
			console.log('📥 Loading stickers from server...');

			// Викликаємо API для отримання стікерів
			const response = await apiPost<{ categories: StickerCategory[] }>(`/api/chats/stickers`, {
				idInterlocutor: idRegularUser
			});

			if (response.categories && Array.isArray(response.categories)) {
				setStickerCategories(response.categories);

				// Зберігаємо в кеш
				stickersCache.current = {
					data: response.categories,
					timestamp: now,
					profileId: idProfile.toString()
				};

				console.log(`✅ Loaded ${response.categories.length} sticker categories and cached them`);
			} else {
				console.warn('Invalid stickers response:', response);
				setStickerCategories([]);
			}
		} catch (error) {
			console.error('Failed to load stickers:', error);
			// Очищуємо кеш при помилці, щоб при наступній спробі завантажити свіжі дані
			stickersCache.current = null;
			setStickerCategories([]);
		} finally {
			setIsLoadingStickers(false);
		}
	};

	// Функція для оновлення лічильників після відправки повідомлення
	const updateCountersAfterSend = () => {
		// Зменшуємо лічильник повідомлень якщо він більше 0
		if (messagesLeft && messagesLeft > 0) {
			const newMessagesLeft = messagesLeft - 1;
			setMessagesLeft(newMessagesLeft);
			// Оновлюємо localStorage
			localStorage.setItem(`messagesLeft_${dialogId}`, newMessagesLeft.toString());
		}
	};

	// Функція для завантаження старіших повідомлень
	const loadMoreMessages = async () => {
		if (!hasMoreMessages || isLoadingMore || isLoadingMessages || !cursor || !canLoadMore.current) return;
		
		canLoadMore.current = false; // Блокуємо повторні завантаження
		console.log(`🔄 Loading more messages with cursor: ${cursor}`);
		await loadMessages(false);
	};

	// Обробник скролу для пагінації
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop } = e.currentTarget;
		
		// Очищуємо попередній timeout
		if (loadingTimeoutRef.current) {
			clearTimeout(loadingTimeoutRef.current);
		}
		
		// Перевіряємо чи скролимо вгору
		const isScrollingUp = scrollTop < lastScrollTop.current;
		lastScrollTop.current = scrollTop;
		
		// ТІЛЬКИ якщо доскролили до самого верху (менше 20px) і скролили вгору
		if (
			scrollTop <= 20 && 
			isScrollingUp &&
			hasMoreMessages && 
			!isLoadingMore && 
			!isLoadingMessages &&
			cursor &&
			canLoadMore.current
		) {
			// Додаємо debounce 300ms
			loadingTimeoutRef.current = setTimeout(() => {
				console.log(`🔄 At top! Triggering pagination: scrollTop=${scrollTop}, canLoad=${canLoadMore.current}`);
				loadMoreMessages();
			}, 300);
		}
	};

	useEffect(() => {
		const token = getAccessToken();
		const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
		let socket: any = null;
		let isCleanedUp = false;
		
		// СТАРИЙ КОД - ЗАКОМЕНТОВАНО, ВИКОРИСТОВУЄМО WEBSOCKET POOL
		/*
		const connectTimeout = setTimeout(() => {
			if (isCleanedUp) return;
			
			socket = io(`${apiUrl}/ws`, { 
				transports: ['websocket'], 
				auth: token ? { token } : undefined,
				forceNew: true, // Завжди створюємо нове підключення
				timeout: 5000 // Таймаут підключення 5 секунд
			});
			
			// Обробляємо помилки підключення
			socket.on('connect_error', (error: Error) => {
				console.warn('🔌 WebSocket connection error:', error.message);
			});
			
			socket.on('disconnect', (reason: string) => {
				console.log('🔌 WebSocket disconnected:', reason);
			});
			
			socket.on('connect', () => {
				if (isCleanedUp) return;
				console.log('🔌 WebSocket connected for dialog:', dialogId);
				// Підключаємося до кімнати діалогу тільки після успішного підключення
				socket.emit('join', { dialogId });
			});
			
			// Обробляємо нові повідомлення з RTM
			socket.on('message', (payload: ChatMessage) => {
				if (isCleanedUp) return;
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
					
					// Оновлюємо лічильник повідомлень якщо це наше повідомлення
					if (payload.idUserFrom === idProfile) {
						updateCountersAfterSend();
					}
					
					return newMessages;
				});
				
				// Автоматично прокручуємо до низу при новому повідомленні
				setTimeout(() => {
					bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
				}, 100);
			});
			
			// Обробляємо зміни онлайн статусу
			socket.on('user_online_status', (data: { userId: number; isOnline: boolean }) => {
				if (isCleanedUp) return;
				console.log('👤 RTM: User online status changed', data);
				
				// Оновлюємо статус користувача якщо це наш співрозмовник
				if (data.userId === idRegularUser) {
					setUserProfile(prev => prev ? { ...prev, is_online: data.isOnline } : null);
				}
			});
		}, 100); // Затримка 100мс для уникнення конфліктів
		*/
		
		return () => {
			// СТАРИЙ CLEANUP КОД - ЗАКОМЕНТОВАНО
			/*
			isCleanedUp = true;
			clearTimeout(connectTimeout);
			
			// Якщо socket створений, закриваємо його
			if (socket && socket.connected) {
				socket.emit('leave', { dialogId });
				socket.disconnect();
			}
			*/
			
			// Очищуємо timeouts при unmount
			if (loadingTimeoutRef.current) {
				clearTimeout(loadingTimeoutRef.current);
			}
			if (unlockTimeoutRef.current) {
				clearTimeout(unlockTimeoutRef.current);
			}
		};
	}, [dialogId, idProfile, idRegularUser]);

		// Обробка закриття модального вікна стікерів по Escape
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && isStickerModalOpen) {
				setIsStickerModalOpen(false);
			}
		};

		if (isStickerModalOpen) {
			document.addEventListener('keydown', handleEscape);
		}

		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isStickerModalOpen]);

	// Використовуємо WebSocket pool для цього профілю та діалогу
	useDialogWebSocket({
		profileId: idProfile.toString(),
		dialogId,
		onMessage: (payload: ChatMessage) => {
			console.log('📨 RTM Pool: Received new message', payload);

			setMessages((prev) => {
				// Перевіряємо чи повідомлення вже існує
				const exists = prev.some(msg => msg.id === payload.id);
				if (exists) {
					return prev;
				}

				// Якщо це стікер від нас і у нас є локальна версія з тимчасовим ID,
				// замінюємо її на справжнє повідомлення від сервера
				if (payload.type === 'sticker' && payload.idUserFrom === idProfile) {
					const localStickerIndex = prev.findIndex(msg =>
						msg.type === 'sticker' &&
						msg.idUserFrom === idProfile &&
						msg.idUserTo === idRegularUser &&
						msg.content.id === payload.content.id &&
						msg.isSending === true // Шукаємо тільки повідомлення що відправляються
					);

					if (localStickerIndex !== -1) {
						// Замінюємо локальне повідомлення на справжнє від сервера
						const newMessages = [...prev];
						newMessages[localStickerIndex] = payload; // Видаляємо isSending поле
						return newMessages.sort((a, b) =>
							new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
						);
					}
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
		},
		onUserOnlineStatus: (data: { userId: number; isOnline: boolean }) => {
			console.log('👤 RTM Pool: User online status changed', data);

			// Оновлюємо статус користувача якщо це наш співрозмовник
			if (data.userId === idRegularUser) {
				setUserProfile(prev => prev ? { ...prev, is_online: data.isOnline } : null);
			}
		}
	});

	async function send() {
		if (!text.trim()) return;
		await apiPost(`/api/chats/dialogs/${encodeURIComponent(dialogId)}/text`, { text });
		setText('');
	}

	// Обробка вибору фото з галереї
	const handlePhotoSelect = async (selectedPhotos: Photo[]) => {
		console.log('Selected photos:', selectedPhotos);

		try {
			const photoIds = selectedPhotos.map(photo => photo.idPhoto);

			const response = await apiPost('/api/chats/send-photo', {
				idProfile,
				idRegularUser,
				photoIds
			});

			if (response.success) {
				console.log(`✅ Successfully sent ${response.data.successCount}/${response.data.totalCount} photos`);
				// Фото будуть додані в чат через WebSocket/RTM
			} else {
				console.error('Failed to send photos:', response.error);
			}
		} catch (error) {
			console.error('Error sending photos:', error);
		}

		setIsMediaGalleryOpen(false);
	};

	// Обробка вибору стікера
	const handleStickerSelect = async (sticker: Sticker) => {
		console.log('Selected sticker:', sticker);
		console.log('Dialog info:', { idProfile, idRegularUser });

		// Створюємо локальне повідомлення стікера для негайного відображення
		const localStickerMessage: ChatMessage = {
			id: Date.now(), // Тимчасовий ID до отримання з сервера
			dateCreated: new Date().toISOString(),
			idUserFrom: idProfile,
			idUserTo: idRegularUser,
			type: 'sticker',
			content: {
				id: sticker.id,
				url: sticker.url
			},
			isSending: true // Позначаємо що повідомлення відправляється
		};

		// Додаємо стікер до повідомлень негайно
		setMessages(prev => [...prev, localStickerMessage].sort((a, b) =>
			new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
		));

		// Прокручуємо донизу для показу нового стікера
		setTimeout(() => {
			bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
		}, 100);

		// Закриваємо модальне вікно одразу
		setIsStickerModalOpen(false);

		try {
			// Використовуємо новий API з тільки необхідними параметрами
			const response = await apiPost('/api/chats/send-sticker', {
				stickerId: sticker.id,
				idRegularUser,
				idProfile // Додаємо idProfile явно
			});

			if (response.success) {
				console.log('✅ Successfully sent sticker');
				// Стікер буде доданий в чат через WebSocket/RTM, але він вже відображається локально
				// Позначаємо повідомлення як успішно відправлене
				setMessages(prev => prev.map(msg =>
					msg.id === localStickerMessage.id
						? { ...msg, isSending: false }
						: msg
				));
			} else {
				console.error('Failed to send sticker:', response.error);
				// Позначаємо повідомлення як помилкове
				setMessages(prev => prev.map(msg =>
					msg.id === localStickerMessage.id
						? { ...msg, isSending: false, error: true }
						: msg
				));
			}
		} catch (error) {
			console.error('Error sending sticker:', error);
			console.error('Request details:', {
				stickerId: sticker.id,
				idRegularUser,
				idProfile
			});
			// Позначаємо повідомлення як помилкове
			setMessages(prev => prev.map(msg =>
				msg.id === localStickerMessage.id
					? { ...msg, isSending: false, error: true }
					: msg
			));
		}
	};

	// Обробка відкриття модального вікна стікерів
	const handleStickerModalOpen = () => {
		setIsStickerModalOpen(true);
		setActiveCategoryIndex(0); // Скидаємо активну категорію
		// Завантажуємо стікери тільки якщо вони ще не завантажені
		if (stickerCategories.length === 0) {
			loadStickers();
		}
	};

	// Обробка кліку на категорію в боковій панелі
	const handleCategoryClick = (categoryIndex: number) => {
		setActiveCategoryIndex(categoryIndex);

		// Знаходимо елемент секції категорії та скролимо до нього
		const categoryElement = document.getElementById(`sticker-category-${categoryIndex}`);
		if (categoryElement && stickerScrollRef.current) {
			const container = stickerScrollRef.current;
			const elementTop = categoryElement.offsetTop;
			const containerHeight = container.clientHeight;
			const elementHeight = categoryElement.clientHeight;

			// Розраховуємо позицію для центрування елемента в контейнері
			const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);

			container.scrollTo({
				top: Math.max(0, scrollTop),
				behavior: 'smooth'
			});
		}
	};

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

	const renderMessage = (message: ChatMessage) => {
		// ВИПРАВЛЕННЯ: idProfile - це наш профіль, idRegularUser - співрозмовник
		const isFromProfile = message.idUserFrom === idProfile;
		const isFromUser = message.idUserFrom === idRegularUser;
		
		// Системні повідомлення відображаються по-особливому
		if (message.type === 'system') {
			return (
				<div key={message.id} className="flex justify-center mb-4">
					<div className="text-center text-gray-500 text-sm">
						{message.content.message && (
							<p className="whitespace-pre-wrap break-words">{message.content.message}</p>
						)}
						<p className="text-xs mt-1 text-gray-400">
							{formatDateTime(message.dateCreated)}
						</p>
					</div>
				</div>
			);
		}
		
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
					{message.type === 'sticker' && message.content.url && (
						<div className="text-sm relative">
							<img
								src={message.content.url}
								alt={`Sticker ${message.content.id || ''}`}
								className={`max-w-[124px] max-h-[124px] object-contain rounded-md ${
									message.isSending ? 'opacity-70' : message.error ? 'opacity-50' : ''
								}`}
							/>
							{/* Індикатор відправки */}
							{message.isSending && (
								<div className="absolute -bottom-1 -right-1">
									<div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
										<div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"></div>
									</div>
								</div>
							)}
							{/* Індикатор помилки */}
							{message.error && (
								<div className="absolute -bottom-1 -right-1">
									<div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
										<svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
										</svg>
									</div>
								</div>
							)}
						</div>
					)}
					{/* Відображення невідомих типів повідомлень для дебагу */}
					{!['message', 'text', 'likephoto', 'photo', 'sticker', 'system'].includes(message.type) && (
						<div className="text-sm italic text-gray-500">
							Тип повідомлення: {message.type}
							{message.content.message && <p className="mt-1">{message.content.message}</p>}
						</div>
					)}
					<p className={`text-xs mt-1 ${isFromProfile ? 'text-purple-200' : 'text-gray-500'}`}>
						{formatDateTime(message.dateCreated)}
					</p>
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col h-full">
			{/* Хедер діалогу */}
			{isLoadingHeader ? (
				<ChatHeaderSkeleton />
			) : (
				<div className="bg-white border-b border-gray-200 p-4">
					<div className="flex items-center justify-between">
						{/* Ліва частина - інформація про користувача */}
						<div className="flex items-center gap-3">
							{/* Аватар користувача */}
							<div className="relative flex-shrink-0">
								<div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200">
									{userProfile?.personal?.avatar_small ? (
										<img
											src={userProfile.personal.avatar_small}
											alt={userProfile.name}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-white bg-purple-500 text-sm font-medium">
											{userProfile?.name?.charAt(0).toUpperCase() || 'U'}
										</div>
									)}
								</div>
								{/* Індикатор онлайн */}
								{userProfile?.is_online && (
									<div className="absolute top-0 left-0 w-3 h-3 bg-green-500 rounded-full border border-white"></div>
								)}
							</div>
							
							{/* Інформація про користувача */}
							<div>
								<div className="font-medium text-gray-900">
									{userProfile?.name || `Користувач ${idRegularUser}`}
								</div>
								<div className="text-sm text-gray-500">
									{idRegularUser}
								</div>
							</div>
						</div>

						{/* Права частина - інформація про профіль */}
						<div className="flex items-center gap-3">
							{/* Інформація про профіль */}
							<div className="text-right">
								<div className="font-medium text-gray-900">
									{sourceProfile?.displayName || 'Невідомий'}
								</div>
								<div className="text-sm text-gray-500">
									{idProfile}
								</div>
							</div>
							
							{/* Аватар профілю */}
							<div className="relative flex-shrink-0">
								<div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200">
									{profileAvatar ? (
										<img
											src={profileAvatar}
											alt={sourceProfile?.displayName || 'Profile'}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center text-white bg-blue-500 text-sm font-medium">
											{sourceProfile?.displayName?.charAt(0).toUpperCase() || 'P'}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Лічильники обмежень (під хедером, поверх історії) */}
			<div className="relative">
				<div className="absolute top-2 left-4 z-10 flex items-center gap-2">
					{/* Лічильник повідомлень */}
					<div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm border border-gray-200/50">
						<div className="w-4 h-4 flex items-center justify-center">
							<svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
							</svg>
						</div>
						{isLoadingRestrictions ? (
							<div className="w-4 h-3 bg-gray-200 rounded animate-pulse"></div>
						) : (
							<span className={`text-xs font-medium ${messagesLeft === 0 ? 'text-red-600' : messagesLeft && messagesLeft <= 3 ? 'text-orange-600' : 'text-green-600'}`}>
								{messagesLeft ?? '—'}
							</span>
						)}
					</div>

					{/* Лічильник листів */}
					<div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm border border-gray-200/50">
						<div className="w-4 h-4 flex items-center justify-center">
							<svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
								<path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
								<path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
							</svg>
						</div>
						{isLoadingRestrictions ? (
							<div className="w-4 h-3 bg-gray-200 rounded animate-pulse"></div>
						) : (
							<span className={`text-xs font-medium ${lettersLeft === 0 ? 'text-red-600' : lettersLeft === 1 ? 'text-orange-600' : lettersLeft && lettersLeft >= 2 ? 'text-green-600' : 'text-gray-500'}`}>
								{lettersLeft ?? '—'}
							</span>
						)}
					</div>

					{/* Чіп настрою */}
					{userProfile?.personal && (() => {
						// Показуємо чіп навіть якщо mood відсутній (з fallback)
						const moodStyles = getMoodStyles(userProfile.personal.mood);
						return (
							<div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm border border-gray-200/50">
								<div className={`w-4 h-4 flex items-center justify-center ${moodStyles.iconColor}`}>
									{moodStyles.icon}
								</div>
								<span className={`text-xs font-medium ${moodStyles.textColor}`}>
									{moodStyles.displayName}
								</span>
							</div>
						);
					})()}
				</div>
			</div>

			{/* Область повідомлень */}
			<div 
				ref={scrollContainerRef}
				className="flex-1 overflow-auto p-4 bg-gray-50 flex flex-col-reverse"
				onScroll={handleScroll}
			>
				{isLoadingMessages ? (
					<div className="space-y-2 flex flex-col-reverse">
						{/* Показуємо кілька skeleton повідомлень */}
						<MessageSkeleton isFromProfile={false} />
						<MessageSkeleton isFromProfile={true} />
						<MessageSkeleton isFromProfile={false} />
						<MessageSkeleton isFromProfile={true} />
						<MessageSkeleton isFromProfile={false} />
					</div>
				) : messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-gray-500">
						<p>Немає повідомлень</p>
					</div>
				) : (
					<div className="space-y-2 flex flex-col-reverse">
						<div ref={bottomRef} />
						{messages.slice().reverse().map(renderMessage)}
						
						{/* Індикатор завантаження більше повідомлень вгорі */}
						{isLoadingMore && (
							<div className="flex justify-center py-4">
								<div className="flex items-center gap-2 text-gray-500 text-sm">
									<div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full"></div>
									Завантаження старіших повідомлень...
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Поле вводу */}
			<div className="bg-white border-t border-gray-200 p-4">
				<div className="flex gap-2 items-center">
					{/* Кнопка атачменту */}
					<button
						onClick={() => setIsMediaGalleryOpen(true)}
						className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						title="Прикріпити медіа"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
						</svg>
					</button>

					{/* Кнопка стікера */}
					<button
						onClick={handleStickerModalOpen}
						className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						title="Вибрати стікер"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<circle cx="12" cy="12" r="10"/>
							<circle cx="9" cy="9" r="1"/>
							<circle cx="15" cy="9" r="1"/>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 14c1 1 3 1 5 0"/>
						</svg>
					</button>

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

			{/* Медіа галерея */}
			<MediaGallery
				profileId={idProfile.toString()}
				isOpen={isMediaGalleryOpen}
				onClose={() => setIsMediaGalleryOpen(false)}
				onPhotoSelect={handlePhotoSelect}
				maxSelection={6}
				context="chat"
				idRegularUser={idRegularUser}
			/>

			{/* Модальне вікно стікерів */}
			{isStickerModalOpen && (
				<div
					className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
					onClick={(e) => {
						// Закриваємо тільки при кліку на backdrop, не на контент
						if (e.target === e.currentTarget) {
							setIsStickerModalOpen(false);
						}
					}}
				>
					<div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[85vh] overflow-hidden">
						{/* Хедер модального вікна */}
						<div className="flex items-center justify-between p-3 border-b border-gray-200">
							<h3 className="text-lg font-semibold text-gray-900">Виберіть стікер</h3>
							<button
								onClick={() => setIsStickerModalOpen(false)}
								className="text-gray-400 hover:text-gray-600 transition-colors p-1"
							>
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						{/* Контент модального вікна */}
						<div className="flex h-[70vh]">
							{isLoadingStickers ? (
								<div className="flex items-center justify-center w-full">
									<div className="flex items-center gap-2 text-gray-500">
										<div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-purple-500 rounded-full"></div>
										Завантаження стікерів...
									</div>
								</div>
							) : stickerCategories.length === 0 ? (
								<div className="flex items-center justify-center w-full">
									<p className="text-gray-500">Не вдалося завантажити стікери</p>
								</div>
							) : (
								<>
									{/* Бокова панель з категоріями */}
									<div className="w-20 bg-gray-50 border-r border-gray-200 overflow-y-auto">
										<div className="p-2 space-y-2">
											{stickerCategories.map((category, categoryIndex) => (
												<div
													key={categoryIndex}
													onClick={() => handleCategoryClick(categoryIndex)}
													className={`cursor-pointer rounded-lg transition-all duration-200 p-1 m-1 ${
														activeCategoryIndex === categoryIndex
															? 'bg-purple-200 ring-2 ring-purple-400'
															: 'hover:bg-gray-200'
													}`}
													title={category.name}
												>
													{category.stickers.length > 0 && (
														<img
															src={category.stickers[0].url}
															alt={category.name}
															className="w-11 h-11 mx-auto object-cover rounded-md hover:scale-150 transition-transform"
															loading="lazy"
														/>
													)}
												</div>
											))}
										</div>
									</div>

									{/* Основна область з стікерами */}
									<div ref={stickerScrollRef} className="flex-1 overflow-y-auto">
										<div className="p-3">
											{stickerCategories.map((category, categoryIndex) => (
												<div
													key={categoryIndex}
													id={`sticker-category-${categoryIndex}`}
													className="mb-6 last:mb-0"
												>
													<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
														{category.stickers.map((sticker) => (
															<button
																key={sticker.id}
																onClick={() => handleStickerSelect(sticker)}
																className="w-24 h-24 overflow-hidden hover:scale-150 transition-transform"
																title={`Стікер ${sticker.id}`}
															>
																<img
																	src={sticker.url}
																	alt={`Sticker ${sticker.id}`}
																	className="w-full h-full object-cover rounded-md"
																	loading="lazy"
																/>
															</button>
														))}
													</div>
												</div>
											))}
										</div>
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
