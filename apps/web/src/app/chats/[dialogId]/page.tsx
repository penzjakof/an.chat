"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { getAccessToken, getSession } from '@/lib/session';
import { ChatHeaderSkeleton, MessageSkeleton } from '@/components/SkeletonLoader';
import { useDialogWebSocket } from '@/hooks/useDialogWebSocket';
import { MediaGallery, Photo } from '@/components/MediaGallery';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import LottieErrorBoundary from '@/components/LottieErrorBoundary';
import EmailHistory from '@/components/EmailHistory';
import { useResourceManager, cleanupLottieAnimations } from '@/utils/memoryCleanup';
import { checkDialogRestrictions, logRestrictionsCheck } from '@/utils/grpcUtils';
import { ClientPublicProfileModal } from '@/components/ClientPublicProfileModal';
import { MyPublicProfileModal } from '@/components/MyPublicProfileModal';

// Типи для Lottie
declare global {
	interface Window {
		lottie?: {
			loadAnimation: (params: {
				container: HTMLElement;
				animationData: any;
				renderer: string;
				loop: boolean;
				autoplay: boolean;
				rendererSettings?: {
					preserveAspectRatio: string;
				};
			}) => {
				addEventListener: (event: string, callback: (data?: any) => void) => void;
			};
		};
		activeLottieInstances?: Map<string, any>;
	}
}

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
		photos?: Array<{ id: number; url: string }>; // Для пакетів фото
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

type VirtualGiftLimit = {
	limit: number;
	canSendWithoutLimit: boolean;
};

type VirtualGiftCategory = {
	id: number;
	name: string;
};

type VirtualGiftItem = {
	id: number;
	cost: number;
	name: string;
	imageSrc: string | null;
	animationSrc: string | null;
	category: VirtualGiftCategory;
	gender: string | null;
};

type VirtualGiftListResponse = {
	cursor: string;
	items: VirtualGiftItem[];
};

export default function DialogPage() {
	const router = useRouter();
	const params = useParams();
	const dialogId = params.dialogId as string;
	
	// Resource manager для безпечного cleanup
	const resourceManager = useResourceManager();

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
    const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [imagePreviewLoading, setImagePreviewLoading] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const lastScrollTop = useRef<number>(0);
	const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const unlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const canLoadMore = useRef<boolean>(true);
	const [isChatGalleryOpen, setIsChatGalleryOpen] = useState(false);
	const [isAttachGalleryOpen, setIsAttachGalleryOpen] = useState(false);
	const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
	const [isEmailHistoryOpen, setIsEmailHistoryOpen] = useState(false);
	const [stickerCategories, setStickerCategories] = useState<StickerCategory[]>([]);
	const [isLoadingStickers, setIsLoadingStickers] = useState(false);
	const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(0);
	const stickerScrollRef = useRef<HTMLDivElement>(null);
	const [giftLimit, setGiftLimit] = useState<VirtualGiftLimit | null>(null);
	const [isLoadingGiftLimit, setIsLoadingGiftLimit] = useState(false);
	const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
	const [giftItems, setGiftItems] = useState<VirtualGiftItem[]>([]);
	const [isLoadingGifts, setIsLoadingGifts] = useState(false);
	const [giftCursor, setGiftCursor] = useState<string>('');
	const [hasMoreGifts, setHasMoreGifts] = useState(true);

	// Прапор для запобігання race condition
	const isLoadingGiftsRef = useRef(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	// Стан для відправки подарунку
	const [selectedGift, setSelectedGift] = useState<VirtualGiftItem | null>(null);
	const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
	const [giftMessage, setGiftMessage] = useState('');
	const [isSendingGift, setIsSendingGift] = useState(false);

	// Стан для TalkTimes exclusive posts
	const [hasExclusivePosts, setHasExclusivePosts] = useState(false);
	const [ttCategories, setTtCategories] = useState<string[]>([]);
	const [ttTier, setTtTier] = useState<'special' | 'specialplus' | undefined>(undefined);
	// Модалка для ексклюзивного посту
	const [isExclusiveModalOpen, setIsExclusiveModalOpen] = useState(false);
	const [exclusiveText, setExclusiveText] = useState('');
	const minExclusiveLength = 100;
	const [attachedPhotos, setAttachedPhotos] = useState<number[]>([]);
	const [attachedVideos, setAttachedVideos] = useState<number[]>([]);
	const [attachedPhotoPreviews, setAttachedPhotoPreviews] = useState<Array<{ idPhoto: number; url: string }>>([]);
	const [attachedVideoPreviews, setAttachedVideoPreviews] = useState<Array<{ idVideo: number; url: string }>>([]);

	// Ініціалізуємо глобальну змінну для Lottie інстансів
	useEffect(() => {
		if (!window.activeLottieInstances) {
			window.activeLottieInstances = new Map();
		}
		return () => {
			// Cleanup при unmount компонента
			cleanupLottieAnimations();
		};
	}, []);

	// Функція cleanup для Lottie анімацій
	const cleanupLottieAnimations = useCallback(() => {
		console.log('🧹 Cleaning up Lottie animations...');
		if (typeof window !== 'undefined' && window.activeLottieInstances) {
			window.activeLottieInstances.forEach((animation, key) => {
				try {
					if (animation && typeof animation.destroy === 'function') {
						animation.destroy();
						console.log(`✅ Destroyed Lottie animation: ${key}`);
					}
					// Також видаляємо event listeners якщо є
					if (animation && typeof animation.removeEventListener === 'function') {
						animation.removeEventListener('data_ready');
						animation.removeEventListener('error');
						animation.removeEventListener('complete');
					}
				} catch (error) {
					console.warn(`⚠️ Error destroying Lottie animation ${key}:`, error);
				}
			});
			window.activeLottieInstances.clear();
		}
		
		// Також очищуємо всі DOM елементи з Lottie
		if (typeof document !== 'undefined') {
			const lottieContainers = document.querySelectorAll('[data-lottie-url]');
			lottieContainers.forEach(container => {
				if (container instanceof HTMLElement) {
					container.innerHTML = ''; // Очищуємо вміст
				}
			});
		}
	}, []);

	// Функція cleanup для активних запитів
	const cleanupActiveRequests = useCallback(() => {
		console.log('🧹 Cleaning up active requests...');
		if (abortControllerRef.current) {
			try {
				abortControllerRef.current.abort();
				console.log('✅ Cancelled active gift loading request');
			} catch (error) {
				console.warn('⚠️ Error aborting request:', error);
			} finally {
				abortControllerRef.current = null;
				isLoadingGiftsRef.current = false;
			}
		}
		
		// Також скидаємо всі loading стейти
		setIsLoadingGifts(false);
		setIsLoadingMore(false);
		setIsLoadingHeader(false);
		
		// Очищуємо всі можливі pending promises
		// (це допоможе уникнути setState на unmounted компонентах)
	}, []);

	// Функція для завантаження Lottie анімації для конкретного елемента
	const loadLottieForElement = async (container: HTMLElement, gift: VirtualGiftItem) => {
		try {
			console.log('🎭 Loading Lottie for gift:', gift.name, gift.animationSrc);

			// Завантажуємо Lottie бібліотеку якщо її немає
			if (!window.lottie) {
				await new Promise<void>((resolve, reject) => {
					const script = document.createElement('script');
					script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
					script.onload = () => {
						console.log('✅ Lottie library loaded');
						resolve();
					};
					script.onerror = () => {
						console.error('❌ Failed to load Lottie library');
						reject(new Error('Failed to load Lottie'));
					};
					document.head.appendChild(script);
				});
			}

			// Завантажуємо анімаційні дані
			const response = await fetch(gift.animationSrc);
			if (!response.ok) {
				throw new Error('Failed to fetch Lottie data: ' + response.status);
			}

			const data = await response.json();
			console.log('🎭 Lottie data loaded for:', gift.name);

			// Очищуємо контейнер і створюємо анімацію
			container.innerHTML = '';
			const animation = window.lottie.loadAnimation({
				container: container,
				animationData: data,
				renderer: 'svg',
				loop: true,
				autoplay: true,
				rendererSettings: {
					preserveAspectRatio: 'xMidYMid meet'
				}
			});

			// Зберігаємо інстанс для cleanup
			const animationKey = gift.id + '-' + Date.now();
			if (window.activeLottieInstances) {
				window.activeLottieInstances.set(animationKey, animation);
			}

			animation.addEventListener('data_ready', () => {
				console.log('✅ Lottie animation loaded and playing for:', gift.name);
			});

			animation.addEventListener('error', (error: any) => {
				console.error('❌ Lottie animation error for:', gift.name, error);
				// Спробуємо fallback
				showLottieFallback(container, gift);
			});

		} catch (error) {
			console.error('❌ Failed to load Lottie for:', gift.name, error);
			showLottieFallback(container, gift);
		}
	};

	// Fallback для Lottie
	const showLottieFallback = (container: HTMLElement, gift: VirtualGiftItem) => {
		// Спробуємо завантажити статичну версію (PNG)
		const staticUrl = gift.animationSrc.replace('.json', '.png');
		const img = new Image();

		img.onload = () => {
			container.innerHTML = '<img src="' + staticUrl + '" class="w-full h-full object-cover" alt="Static version" />';
		};

		img.onerror = () => {
			// Якщо і PNG немає, показуємо placeholder
			container.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100"><div class="text-center"><div class="text-2xl mb-1">🎭</div><div class="text-xs text-gray-600">Lottie анімація</div></div></div>';
		};

		img.src = staticUrl;
	};

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

	// Завантажуємо ліміти подарунків після завантаження профілю
	useEffect(() => {
		if (sourceProfile?.id && !isLoadingGiftLimit && !giftLimit) {
			loadGiftLimits();
		}
	}, [sourceProfile?.id, isLoadingGiftLimit, giftLimit]);

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

			// 🎪 Перевіряємо TalkTimes restrictions для exclusive posts
			if (idRegularUser && idProfile) {
				const ttResult = await checkDialogRestrictions(idProfile, idRegularUser);
				logRestrictionsCheck(idRegularUser, ttResult);
				
				if (ttResult.success) {
					setHasExclusivePosts(ttResult.hasExclusivePosts);
					setTtCategories(ttResult.categories);
					setTtTier(ttResult.tier);
				} else {
					// Fallback при помилці
					setHasExclusivePosts(false);
					setTtCategories([]);
					setTtTier(undefined);
				}
			}

		} catch (error) {
			console.error('Failed to load restrictions:', error);
			// Встановлюємо fallback значення для обох лічільників
			if (messagesLeft === null) setMessagesLeft(0);
			setLettersLeft(0);
			// Також скидаємо TT стани при помилці
			setHasExclusivePosts(false);
			setTtCategories([]);
			setTtTier(undefined);
		} finally {
			setIsLoadingRestrictions(false);
		}
	};

	const loadGiftLimits = async () => {
		// Перевірка race condition для лімітів
		if (isLoadingGiftLimit) {
			console.log('🎁 Skipping loadGiftLimits - already loading');
			return;
		}

		try {
			setIsLoadingGiftLimit(true);
			console.log('🎁 Loading gift limits for dialog:', dialogId, 'client:', idRegularUser);

			// Робимо запит до нашого API для отримання лімітів подарунків
			const response = await apiPost<{ success: boolean; data?: VirtualGiftLimit; error?: string }>(`/profiles/${sourceProfile?.id}/gift-limits`, {
				clientId: idRegularUser
			});

			if (response.success && response.data) {
				console.log('✅ Gift limits loaded:', response.data);
				setGiftLimit(response.data);
			} else {
				console.warn('Failed to load gift limits:', response.error);
				setGiftLimit(null);
			}
		} catch (error) {
			console.error('Failed to load gift limits:', error);
			setGiftLimit(null);
		} finally {
			setIsLoadingGiftLimit(false);
		}
	};

	const loadGifts = async (isInitial = true) => {
		// Перевірка race condition
		if (isLoadingGiftsRef.current) {
			console.log('🎁 Skipping loadGifts - already loading');
			return;
		}

		// Скасовуємо попередній запит якщо він існує
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Створюємо новий AbortController
		abortControllerRef.current = new AbortController();

		try {
			isLoadingGiftsRef.current = true;

			if (isInitial) {
				setIsLoadingGifts(true);
				setGiftItems([]);
				setGiftCursor('');
				setHasMoreGifts(true);
			} else {
				setIsLoadingGifts(true);
			}

			console.log('🎁 Loading gifts for client:', idRegularUser, 'cursor:', giftCursor);

			// Перевіряємо чи увімкнений mock режим
			const isMockMode = process.env.NODE_ENV === 'development' && localStorage.getItem('mockMode') === 'true';
			console.log('🎭 Mock mode:', isMockMode ? 'enabled' : 'disabled');

			// Робимо запит до нашого API для отримання списку подарунків
			const response = await apiPost<{ success: boolean; data?: VirtualGiftListResponse; error?: string }>(`/profiles/${sourceProfile?.id}/gift-list`, {
				clientId: idRegularUser,
				cursor: isInitial ? '' : giftCursor,
				limit: 30
			}, {
				signal: abortControllerRef.current.signal
			});

			if (response.success && response.data) {
				console.log('✅ Gifts loaded:', response.data.items.length, 'items');

				// Логуємо інформацію про перші кілька зображень для діагностики
				response.data.items.slice(0, 3).forEach((gift, index) => {
					const displaySrc = gift.imageSrc || gift.animationSrc;
					const isAnimated = !!gift.animationSrc;
					const animationType = gift.animationSrc?.endsWith('.json') ? 'JSON/Lottie' :
										gift.animationSrc?.endsWith('.gif') || gift.animationSrc?.includes('gif') ? 'GIF' :
										gift.animationSrc ? 'Other' : 'Static';
					console.log(`🎁 Gift ${index + 1}: ${gift.name}${isAnimated ? ` (${animationType})` : ''}, src: ${displaySrc}`);
					console.log(`🎁 Final URL for ${gift.name}:`, displaySrc.startsWith('http') || displaySrc.startsWith('//')
						? displaySrc.startsWith('//') ? `https:${displaySrc}` : displaySrc
						: `https://talkytimes.com${displaySrc}`);
				});

				if (isInitial) {
					setGiftItems(response.data.items);
				} else {
					// Додаємо нові подарунки до існуючих
					setGiftItems(prev => [...prev, ...response.data!.items]);
				}

				setGiftCursor(response.data.cursor);
				setHasMoreGifts(response.data.items.length === 30); // Якщо отримали повний ліміт, можливо є ще
			} else {
				console.warn('Failed to load gifts:', response.error);
				setGiftItems([]);
				setHasMoreGifts(false);
			}
		} catch (error: any) {
			// Не логуємо помилки для скасованих запитів
			if (error.name !== 'AbortError') {
				console.error('❌ Failed to load gifts:', error);
				setGiftItems([]);
				setHasMoreGifts(false);
			} else {
				console.log('🎁 Gift loading was cancelled');
			}
		} finally {
			setIsLoadingGifts(false);
			isLoadingGiftsRef.current = false;
			abortControllerRef.current = null;
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

		// Обробка закриття модальних вікон по Escape
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				if (isStickerModalOpen) {
					setIsStickerModalOpen(false);
				}
				if (isGiftModalOpen) {
					setIsGiftModalOpen(false);
				}
				if (isMessageModalOpen) {
					setIsMessageModalOpen(false);
				}
				if (isEmailHistoryOpen) {
					setIsEmailHistoryOpen(false);
				}
			}
		};

		if (isStickerModalOpen || isGiftModalOpen || isMessageModalOpen || isEmailHistoryOpen) {
			document.addEventListener('keydown', handleEscape);
		}

		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isStickerModalOpen, isGiftModalOpen, isMessageModalOpen, isEmailHistoryOpen]);

	// Cleanup Lottie анімацій та запитів при закритті модальних вікон
	useEffect(() => {
		if (!isGiftModalOpen && !isMessageModalOpen) {
			cleanupLottieAnimations();
			cleanupActiveRequests();
		}
	}, [isGiftModalOpen, isMessageModalOpen]);

	// Глобальний cleanup при unmount компонента
	useEffect(() => {
		return () => {
			console.log('🧹 Component unmounting, cleaning up all resources...');
			
			// Очищуємо всі timeouts
			if (loadingTimeoutRef.current) {
				clearTimeout(loadingTimeoutRef.current);
				loadingTimeoutRef.current = null;
			}
			if (unlockTimeoutRef.current) {
				clearTimeout(unlockTimeoutRef.current);
				unlockTimeoutRef.current = null;
			}
			
			// Очищуємо Lottie анімації
			cleanupLottieAnimations();
			
			// Очищуємо активні запити
			cleanupActiveRequests();
			
			// Очищуємо глобальні event listeners якщо є
			if (typeof window !== 'undefined') {
				// Видаляємо всі можливі event listeners
				window.removeEventListener('beforeunload', cleanupLottieAnimations);
				window.removeEventListener('unload', cleanupLottieAnimations);
			}
		};
	}, []); // Порожній масив залежностей - виконується тільки при unmount

	// Використовуємо WebSocket pool для цього профілю та діалогу
	useDialogWebSocket({
		profileId: idProfile.toString(),
		dialogId,
		onMessage: (payload: ChatMessage) => {
			console.log('📨 RTM Pool: Received new message', payload);

			// Нормалізація вхідного payload
			const normalized: ChatMessage = {
				id: Number((payload as any).id) || Date.now(),
				idUserFrom: Number((payload as any).idUserFrom),
				idUserTo: Number((payload as any).idUserTo),
				type: (payload as any).type || 'text',
				dateCreated: (() => {
					const d = new Date((payload as any).dateCreated || Date.now());
					return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
				})(),
				content: {
					message: (payload as any).content?.message || (payload as any).message?.message || (payload as any).text || '',
					url: (payload as any).content?.url,
					id: (payload as any).content?.id
				}
			};

			setMessages((prev) => {
				// Перевіряємо чи повідомлення вже існує
				const exists = prev.some(msg => msg.id === normalized.id);
				if (exists) {
					return prev;
				}

				// Якщо це стікер від нас і у нас є локальна версія з тимчасовим ID,
				// замінюємо її на справжнє повідомлення від сервера
				if (normalized.type === 'sticker' && normalized.idUserFrom === idProfile) {
					const localStickerIndex = prev.findIndex(msg =>
						msg.type === 'sticker' &&
						msg.idUserFrom === idProfile &&
						msg.idUserTo === idRegularUser &&
						msg.content.id === normalized.content.id &&
						(msg as any).isSending === true
					);

					if (localStickerIndex !== -1) {
						const newMessages = [...prev];
						newMessages[localStickerIndex] = normalized;
						return newMessages.sort((a, b) =>
							new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
						);
					}
				}

				const newMessages = [...prev, normalized].sort((a, b) =>
					new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
				);

				// Оновлюємо лічільник повідомлень якщо це наше повідомлення
				if (normalized.idUserFrom === idProfile) {
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
		},
		onDialogLimitChanged: (data: { idUser: number; idInterlocutor: number; limitLeft: number }) => {
			// Оновлюємо лічильник лише для поточного діалогу
			if (data.idUser === idProfile && data.idInterlocutor === idRegularUser) {
				setMessagesLeft(data.limitLeft ?? messagesLeft);
				if (typeof data.limitLeft === 'number') {
					localStorage.setItem(`messagesLeft_${dialogId}`, String(data.limitLeft));
				}
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

		// Оптимістичне відображення повідомлення з фото одразу
		const localPhotoMessage: ChatMessage = {
			id: Date.now(),
			dateCreated: new Date().toISOString(),
			idUserFrom: idProfile,
			idUserTo: idRegularUser,
			type: 'photo_batch',
			content: {
				photos: selectedPhotos.map(p => ({ id: p.idPhoto, url: p.urls.urlPreview }))
			},
			isSending: true
		};

		setMessages(prev => [...prev, localPhotoMessage].sort((a, b) =>
			new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
		));
		setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

		setIsChatGalleryOpen(false);
	};

	// Обробка вибору подарунку
	const handleGiftSelect = async (gift: VirtualGiftItem) => {
		console.log('🎁 Selected gift:', gift);
		console.log('Dialog info:', { idProfile, idRegularUser });

		// Закриваємо модальне вікно подарунків
		setIsGiftModalOpen(false);

		// Відкриваємо діалог введення повідомлення
		setSelectedGift(gift);
		setGiftMessage(''); // Очищуємо повідомлення
		setIsMessageModalOpen(true);
	};

	const handleSendGift = async () => {
		if (!selectedGift || !sourceProfile?.id) return;

		try {
			setIsSendingGift(true);

			console.log('📤 Sending gift:', {
				giftId: selectedGift.id,
				fromProfile: sourceProfile.id,
				toClient: idRegularUser,
				message: giftMessage
			});

			const response = await apiPost<{ success: boolean; data?: any; error?: string }>(`/profiles/${sourceProfile.id}/send-gift`, {
				clientId: idRegularUser,
				giftId: selectedGift.id,
				message: giftMessage
			});

			if (response.success) {
				console.log('✅ Gift sent successfully:', response.data);

				// Показуємо успішне повідомлення
				toast.success(`🎁 Подарунок "${selectedGift.name}" відправлено!`);

				// Закриваємо діалог
				setIsMessageModalOpen(false);
				setSelectedGift(null);
				setGiftMessage('');

				// Можливо оновити ліміт подарунків
				loadGiftLimits();

			} else {
				console.error('❌ Failed to send gift:', response.error);
				toast.error(`❌ Помилка відправки: ${response.error || 'Невідома помилка'}`);
			}

		} catch (error: any) {
			console.error('❌ Error sending gift:', error);
			toast.error(`❌ Помилка відправки: ${error.message || 'Невідома помилка'}`);
		} finally {
			setIsSendingGift(false);
		}
	};

	// Завантаження більше подарунків для пагінації
	const loadMoreGifts = async () => {
		if (!hasMoreGifts || isLoadingGifts || !giftCursor || isLoadingGiftsRef.current) {
			console.log('🔄 Skipping loadMoreGifts - conditions not met');
			return;
		}
		console.log('🔄 Loading more gifts with cursor:', giftCursor);
		await loadGifts(false);
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

	// Обробка відкриття модального вікна подарунків
	const handleGiftModalOpen = () => {
		setIsGiftModalOpen(true);
		// Завантажуємо подарунки тільки якщо вони ще не завантажені
		if (giftItems.length === 0) {
			loadGifts();
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

    // Відкриття превʼю фото (отримуємо оригінал через бекенд)
    const openPhotoPreview = async (previewUrl: string) => {
        try {
            setIsImagePreviewOpen(true);
            setImagePreviewLoading(true);
            setImagePreviewUrl(previewUrl);
            const res = await apiPost('/api/chats/photo-original', {
                profileId: idProfile.toString(),
                idRegularUser,
                previewUrl
            });
            const original = (res && (res.url || res.data?.url)) ? (res.url || res.data?.url) : null;
            if (original) setImagePreviewUrl(original as string);
        } catch (e) {
            // залишаємо превʼю як fallback
        } finally {
            setImagePreviewLoading(false);
        }
    };

	const formatDateTime = (dateString: string) => {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) {
			return '—';
		}
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

	const renderMessage = (message: ChatMessage & { _idx?: number }) => {
		// ВИПРАВЛЕННЯ: idProfile - це наш профіль, idRegularUser - співрозмовник
		const isFromProfile = message.idUserFrom === idProfile;
		const isFromUser = message.idUserFrom === idRegularUser;
		const uniqueKey = String(message.id ?? `${message.idUserFrom}-${message.idUserTo}-${message.dateCreated || ''}`) + `-${message._idx ?? 0}`;
		
		// Системні повідомлення відображаються по-особливому
		if (message.type === 'system') {
			return (
				<div key={uniqueKey} className="flex justify-center mb-4">
					<div className="text-center text-gray-500 text-sm">
						{message.content?.message && (
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
			<div key={uniqueKey} className={`flex ${isFromProfile ? 'justify-end' : 'justify-start'} mb-4`}>
				<div className={`max-w-xs lg:max-w-md ${message.type === 'photo_batch' ? 'px-0 pt-0 pb-1' : 'px-4 py-2'} rounded-lg ${
					isFromProfile 
						? 'bg-purple-500 text-white' 
						: 'bg-gray-200 text-gray-800'
				}`}
				>
					{/* Відображення різних типів повідомлень */}
					{(message.type === 'message' || message.type === 'text') && message.content?.message && (
						<p className="text-sm whitespace-pre-wrap break-words">{message.content.message}</p>
					)}
					{message.type === 'likephoto' && (
						<div className="text-sm">
							<p>❤️ Вподобав фото</p>
							{message.content?.url && (
								<img src={message.content.url} alt="Photo" className="mt-2 rounded max-w-full h-auto" />
							)}
						</div>
					)}
					{message.type === 'photo' && message.content?.url && (
						<div className="text-sm">
							<img src={message.content.url} alt="Photo" className="rounded max-w-full h-auto" />
						</div>
					)}
					{message.type === 'photo_batch' && (message as any).content?.photos?.length > 0 && (() => {
						const photos = (((message as any).content?.photos) || []) as Array<{ id: number; url: string }>;
						if (photos.length === 1) {
							const p = photos[0];
							return (
								<div className="text-sm">
									<img
										key={`${message.id}-${p.id || 0}`}
										src={p.url}
										alt={`Photo ${p.id || 0}`}
										className="rounded max-w-full h-auto cursor-zoom-in"
										onClick={() => openPhotoPreview(p.url)}
									/>
								</div>
							);
						}

						const gridCols = photos.length >= 5 ? 3 : 2;
						return (
							<div className={`grid gap-0 text-sm ${gridCols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
								{photos.map((p, idx) => (
									<img
										key={`${message.id}-${p.id || idx}`}
										src={p.url}
										alt={`Photo ${p.id || idx}`}
										className="rounded max-w-full h-auto cursor-zoom-in"
										onClick={() => openPhotoPreview(p.url)}
									/>
								))}
							</div>
						);
					})()}
					{message.type === 'sticker' && message.content?.url && (
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
					{!['message', 'text', 'likephoto', 'photo', 'photo_batch', 'sticker', 'system'].includes(message.type) && (
						<div className="text-sm italic text-gray-500">
							Тип повідомлення: {message.type}
							{message.content?.message && <p className="mt-1">{message.content.message}</p>}
						</div>
					)}
					<p className={`text-xs mt-1 ml-2 ${isFromProfile ? 'text-purple-200' : 'text-gray-500'}`}>
						{formatDateTime(message.dateCreated)}
					</p>
				</div>
			</div>
		);
	};

	const [isClientProfileOpen, setIsClientProfileOpen] = useState(false);
	const [isMyProfileOpen, setIsMyProfileOpen] = useState(false);

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
								<div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 cursor-pointer" onClick={() => setIsClientProfileOpen(true)}>
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
								<div
									className="w-11 h-11 rounded-full overflow-hidden bg-gray-200 cursor-pointer"
									onClick={() => setIsMyProfileOpen(true)}
								>
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
						{messages.slice().reverse().map((m, idx) => renderMessage({ ...m, _idx: idx } as any))}
						
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
						onClick={() => setIsChatGalleryOpen(true)}
						className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						title="Прикріпити медіа"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
						</svg>
					</button>

					{/* Кнопка листа */}
					<button
						onClick={() => setIsEmailHistoryOpen(true)}
						className="flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						title="Історія листування"
					>
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

					{/* Кнопка віртуальних подарунків */}
					{(giftLimit && (giftLimit.limit > 0 || giftLimit.canSendWithoutLimit)) && (
						<button
							onClick={handleGiftModalOpen}
							className="flex-shrink-0 p-2 text-pink-500 hover:text-pink-700 hover:bg-pink-50 rounded-lg transition-colors relative"
							title={`Віртуальні подарунки (${giftLimit.canSendWithoutLimit ? 'без ліміту' : `${giftLimit.limit} залишилось`})`}
						>
							<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
								<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
							</svg>
							{/* Індикатор кількості, якщо є ліміт */}
							{!giftLimit.canSendWithoutLimit && giftLimit.limit > 0 && (
								<span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
									{giftLimit.limit > 99 ? '99+' : giftLimit.limit}
								</span>
							)}
						</button>
					)}

					{/* Іконка молнії для exclusive posts */}
					{hasExclusivePosts && (
						<button
							onClick={() => setIsExclusiveModalOpen(true)}
							className={`flex-shrink-0 p-2 rounded-lg transition-colors relative ${ttTier === 'specialplus' ? 'text-red-600 hover:text-red-700' : 'text-yellow-500 hover:text-yellow-600'}`}
							title={`${ttTier === 'specialplus' ? '⚡ SpecialPlus' : '⚡ Special'} — Категорії: ${ttCategories.join(', ')}`}
						>
							<svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
								<path d="M13 10V3L4 14h7v7l9-11h-7z"/>
							</svg>
							<div className={`absolute inset-0 rounded-lg opacity-20 animate-pulse ${ttTier === 'specialplus' ? 'bg-red-500' : 'bg-yellow-400'}`}></div>
							{ttTier === 'specialplus' && (
								<div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-red-600 flex items-center justify-center text-[10px] font-extrabold leading-none">+</div>
							)}
						</button>
					)}

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
			{/* Галерея для звичайного чату */}
			<MediaGallery
				profileId={idProfile.toString()}
				isOpen={isChatGalleryOpen}
				onClose={() => setIsChatGalleryOpen(false)}
				onPhotoSelect={handlePhotoSelect}
				maxSelection={6}
				context="chat"
				idRegularUser={idRegularUser}
				mode="send"
				allowAudio={true}
			/>

			{/* Галерея для прикріплення в ексклюзивному пості */}
			<MediaGallery
				profileId={idProfile.toString()}
				isOpen={isAttachGalleryOpen}
				onClose={() => setIsAttachGalleryOpen(false)}
				onPhotoSelect={() => {}}
				maxSelection={6}
				context="chat"
				idRegularUser={idRegularUser}
				mode="attach"
				actionLabel="Прикріпити"
				allowAudio={false}
				allowedPhotoTabs={ttTier === 'specialplus' ? ['special','special_plus'] : ['special']}
				isSpecialPlusAllowed={ttTier === 'specialplus'}
				onAttach={({ photos, videos }) => {
					setAttachedPhotos(photos.map(p => p.idPhoto));
					setAttachedVideos(videos.map(v => v.idVideo));
					setAttachedPhotoPreviews(photos.map(p => ({ idPhoto: p.idPhoto, url: p.urls.urlPreview })));
					setAttachedVideoPreviews(videos.map(v => ({ idVideo: v.idVideo, url: v.urls.urlThumbnail })));
					setIsAttachGalleryOpen(false);
				}}
			/>

			{/* Історія листування */}
			<EmailHistory
				isOpen={isEmailHistoryOpen}
				onClose={() => setIsEmailHistoryOpen(false)}
				profileId={idProfile.toString()}
				clientId={idRegularUser.toString()}
				correspondenceId={dialogId}
				lettersLeft={lettersLeft}
			/>

			{/* Модальне вікно ексклюзивного посту */}
			{isExclusiveModalOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4">
					<div className="bg-white rounded-lg w-full max-w-2xl p-4 space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">Ексклюзивний пост</h3>
							<button onClick={() => setIsExclusiveModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
						</div>
						<div>
							<label className="block text-sm text-gray-600 mb-1">Текст (мінімум {minExclusiveLength} символів)</label>
							<textarea
								value={exclusiveText}
								onChange={(e) => setExclusiveText(e.target.value)}
								rows={4}
								className="w-full border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
								placeholder="Введіть текст посту..."
							/>
							<div className={`${exclusiveText.length < minExclusiveLength ? 'text-red-600' : 'text-gray-500'} text-sm mt-1`}>
								Залишилось: {Math.max(0, minExclusiveLength - exclusiveText.length)}
							</div>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-sm text-gray-600">Прикріплені медіа</span>
								<button
									onClick={() => setIsAttachGalleryOpen(true)}
									className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
								>
									Додати з галереї
								</button>
							</div>
							<div className="flex flex-wrap gap-2">
								{attachedPhotoPreviews.map(p => (
									<div key={`p-${p.idPhoto}`} className="relative w-16 h-16 rounded-md overflow-hidden border border-gray-200">
										<img src={p.url} alt={`Фото ${p.idPhoto}`} className="w-full h-full object-cover" />
										<button
											onClick={() => {
												setAttachedPhotos(prev => prev.filter(id => id !== p.idPhoto));
												setAttachedPhotoPreviews(prev => prev.filter(x => x.idPhoto !== p.idPhoto));
											}}
											className="absolute -top-1 -right-1 bg-white/90 border border-gray-300 rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow"
											title="Прибрати фото"
										>
											✕
										</button>
									</div>
								))}
								{attachedVideoPreviews.map(v => (
									<div key={`v-${v.idVideo}`} className="relative w-16 h-16 rounded-md overflow-hidden border border-gray-200">
										<img src={v.url} alt={`Відео ${v.idVideo}`} className="w-full h-full object-cover" />
										<span className="absolute bottom-0 right-0 m-0.5 text-[10px] px-1 py-0.5 rounded bg-black/60 text-white">▶</span>
										<button
											onClick={() => {
												setAttachedVideos(prev => prev.filter(id => id !== v.idVideo));
												setAttachedVideoPreviews(prev => prev.filter(x => x.idVideo !== v.idVideo));
											}}
											className="absolute -top-1 -right-1 bg-white/90 border border-gray-300 rounded-full w-5 h-5 text-[10px] flex items-center justify-center shadow"
											title="Прибрати відео"
										>
											✕
										</button>
									</div>
								))}
								{attachedPhotos.length === 0 && attachedVideos.length === 0 && (
									<div className="text-sm text-gray-400">Нічого не прикріплено</div>
								)}
							</div>
						</div>
						<div className="flex items-center justify-between pt-2 border-t">
							<div className="text-xs text-gray-500">
								Правила: максимум 1 відео або 1 відео + будь-яка кількість фото, або ≥4 фото без відео. Special+ фото дозволені лише для tier=SpecialPlus.
							</div>
							<div className="space-x-2">
								<button onClick={() => setIsExclusiveModalOpen(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200">Скасувати</button>
								<button
									onClick={async () => {
										if (exclusiveText.length < minExclusiveLength) return;
										const hasVideo = attachedVideos.length > 0;
										if (hasVideo) {
											if (attachedVideos.length > 1) return;
										} else {
											if (attachedPhotos.length > 0 && attachedPhotos.length < 4) return;
										}
										try {
											const res = await apiPost<{ success: boolean; error?: string }>(
												'/api/chats/tt-send-post',
												{ profileId: idProfile, idRegularUser, idsGalleryPhotos: attachedPhotos, idsGalleryVideos: attachedVideos, text: exclusiveText }
											);
											if (res.success) {
												setIsExclusiveModalOpen(false);
												setExclusiveText('');
												setAttachedPhotos([]);
												setAttachedVideos([]);
											}
										} catch {}
									}}
									disabled={
										exclusiveText.length < minExclusiveLength ||
										(attachedVideos.length === 0 && (attachedPhotos.length === 0 || attachedPhotos.length < 4)) ||
										(attachedVideos.length > 1)
									}
									className="px-4 py-2 rounded-md bg-purple-600 text-white disabled:bg-gray-300"
								>
									Відправити
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

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

			{/* Модальне вікно віртуальних подарунків */}
			{isGiftModalOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
						{/* Хедер */}
						<div className="flex items-center justify-between p-4 border-b border-gray-200">
							<h3 className="text-lg font-semibold text-gray-900">Віртуальні подарунки</h3>
							<button
								onClick={() => setIsGiftModalOpen(false)}
								className="text-gray-400 hover:text-gray-600 p-1"
							>
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						{/* Контент */}
						<div className="flex-1 overflow-y-auto p-4">


							{isLoadingGifts && giftItems.length === 0 ? (
								<div className="flex items-center justify-center h-32">
									<div className="text-gray-500">Завантаження...</div>
								</div>
							) : giftItems.length === 0 ? (
								<div className="flex items-center justify-center h-32">
									<div className="text-gray-500">Немає доступних подарунків</div>
								</div>
							) : (
								<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
									{giftItems.map((gift) => (
										<div
											key={gift.id}
											className="border border-gray-200 rounded-lg p-3 hover:border-pink-300 transition-colors cursor-pointer"
											onClick={() => handleGiftSelect(gift)}
											title={`${gift.name} - ${gift.cost} монет${gift.animationSrc ? ' (анімований)' : ''}`}
										>
											{/* Зображення або анімація */}
											<div className="relative w-full aspect-square mb-2 bg-gray-100 rounded-md overflow-hidden">
												{gift.imageSrc || gift.animationSrc ? (
													<>
														{gift.animationSrc && gift.animationSrc.endsWith('.json') ? (
															/* Lottie анімація або спеціальний JSON */
															<LottieErrorBoundary
																onError={(error, errorInfo) => {
																	console.error(`🎭 Lottie error for gift "${gift.name}":`, error);
																	// Можна додати додаткову логіку обробки помилок тут
																}}
															>
																{/* Спробуємо завантажити як Lottie JSON */}
																<div
																	className="w-full h-full"
																	data-lottie-url={gift.animationSrc}
																	style={{
																		background: 'linear-gradient(135deg, #fce7f3 0%, #e9d5ff 100%)',
																		display: 'flex',
																		alignItems: 'center',
																		justifyContent: 'center'
																	}}
																>
																	<div className="text-center">
																		<div className="text-3xl mb-2 animate-pulse">💖</div>
																		<div className="text-xs text-gray-600 font-medium">Завантаження анімації...</div>
																		<div className="text-xs text-gray-500 mt-1">Lottie</div>
																	</div>
																</div>

																{/* Lottie буде завантажено через useEffect */}
																<div
																	ref={(el) => {
																		if (el && gift.animationSrc && !el.hasAttribute('data-lottie-loaded')) {
																			el.setAttribute('data-lottie-loaded', 'true');
																			el.setAttribute('data-gift-id', gift.id.toString());
																			el.setAttribute('data-animation-src', gift.animationSrc);

																			// Завантажуємо Lottie асинхронно
																			setTimeout(() => {
																				loadLottieForElement(el, gift);
																			}, 100);
																		}
																	}}
																	className="w-full h-full"
																	data-lottie-url={gift.animationSrc}
																	style={{
																		background: 'linear-gradient(135deg, #fce7f3 0%, #e9d5ff 100%)',
																		display: 'flex',
																		alignItems: 'center',
																		justifyContent: 'center'
																	}}
																>
																	<div className="text-center">
																		<div className="text-3xl mb-2 animate-pulse">💖</div>
																		<div className="text-xs text-gray-600 font-medium">Завантаження анімації...</div>
																		<div className="text-xs text-gray-500 mt-1">Lottie</div>
																	</div>
																</div>

																{/* Індикатор анімації */}
																<div className="absolute top-1 right-1 bg-pink-500 text-white text-xs px-1 py-0.5 rounded flex items-center gap-0.5">
																	🎭
																	<span className="text-xs">Lottie</span>
																</div>
															</LottieErrorBoundary>
														) : gift.animationSrc && (gift.animationSrc.endsWith('.gif') || gift.animationSrc.includes('gif')) ? (
															/* GIF анімація */
															<img
																src={
																	gift.animationSrc.startsWith('http') || gift.animationSrc.startsWith('//')
																		? gift.animationSrc.startsWith('//') ? `https:${gift.animationSrc}` : gift.animationSrc
																		: `https://talkytimes.com${gift.animationSrc}`
																}
																alt={gift.name}
																className="w-full h-full object-cover"
																loading="lazy"
																onError={(e) => {
																	console.error(`GIF failed for ${gift.name}:`, e.target.src);
																	const target = e.target as HTMLImageElement;
																	target.src = `https://picsum.photos/64/64?random=${gift.id}`;
																	target.onerror = null;
																}}
															/>
														) : (
															/* Звичайне зображення */
															<img
																src={
																	(gift.imageSrc || gift.animationSrc).startsWith('http') || (gift.imageSrc || gift.animationSrc).startsWith('//')
																		? (gift.imageSrc || gift.animationSrc).startsWith('//') ? `https:${gift.imageSrc || gift.animationSrc}` : (gift.imageSrc || gift.animationSrc)
																		: `https://talkytimes.com${gift.imageSrc || gift.animationSrc}`
																}
																alt={gift.name}
																className="w-full h-full object-cover"
																loading="lazy"
																onError={(e) => {
																	const target = e.target as HTMLImageElement;
																	if (gift.animationSrc) {
																		// Спробуємо як GIF
																		target.src = gift.animationSrc.replace('.json', '.gif');
																	} else {
																		target.src = `https://picsum.photos/64/64?random=${gift.id}`;
																	}
																	target.onerror = null;
																}}
															/>
														)}
														{/* Індикатор анімації для різних типів */}
														{gift.animationSrc && (
															<div className="absolute top-1 right-1 bg-pink-500 text-white text-xs px-1 py-0.5 rounded flex items-center gap-0.5">
																{gift.animationSrc.endsWith('.json') ? '🎭' : '🎬'}
																<span className="text-xs">
																	{gift.animationSrc.endsWith('.json') ? 'JSON' :
																	 gift.animationSrc.endsWith('.gif') || gift.animationSrc.includes('gif') ? 'GIF' : '🎬'}
																</span>
															</div>
														)}
													</>
												) : (
													<div className="w-full h-full bg-gray-200 flex items-center justify-center">
														<svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
															<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
														</svg>
													</div>
												)}
											</div>

											{/* Назва */}
											<h4 className="text-xs font-medium text-gray-900 text-center mb-1 truncate flex items-center justify-center gap-1">
												{gift.name}
												{gift.animationSrc && (
													<span className="text-pink-500 text-xs" title={
														gift.animationSrc.endsWith('.json') ? 'Lottie анімація (JSON)' :
														gift.animationSrc.endsWith('.gif') || gift.animationSrc.includes('gif') ? 'GIF анімація' :
														'Анімований подарунок'
													}>
														{gift.animationSrc.endsWith('.json') ? '🎭' : '🎬'}
													</span>
												)}
											</h4>

											{/* Вартість */}
											<div className="flex items-center justify-center gap-1 text-xs text-pink-600 font-medium">
												<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
													<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
												</svg>
												{gift.cost}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Модальне вікно для введення повідомлення до подарунку */}
			{isMessageModalOpen && selectedGift && (
				<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
					<div className="bg-white rounded-lg shadow-xl w-full max-w-md">
						{/* Хедер */}
						<div className="flex items-center justify-between p-4 border-b border-gray-200">
							<h3 className="text-lg font-semibold text-gray-900">Надіслати подарунок</h3>
							<button
								onClick={() => setIsMessageModalOpen(false)}
								className="text-gray-400 hover:text-gray-600 p-1"
								disabled={isSendingGift}
							>
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						{/* Контент */}
						<div className="p-6">
							{/* Попередній перегляд вибраного подарунку */}
							<div className="flex items-center gap-3 mb-4 p-3 bg-pink-50 rounded-lg">
								<div className="relative w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
									{selectedGift.imageSrc || selectedGift.animationSrc ? (
										selectedGift.animationSrc && selectedGift.animationSrc.endsWith('.json') ? (
											<LottieErrorBoundary
												onError={(error, errorInfo) => {
													console.error(`🎭 Lottie error in message modal for gift "${selectedGift.name}":`, error);
												}}
											>
												<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100">
													<span className="text-lg">🎭</span>
												</div>
											</LottieErrorBoundary>
										) : (
											<img
												src={
													(selectedGift.imageSrc || selectedGift.animationSrc).startsWith('http') || (selectedGift.imageSrc || selectedGift.animationSrc).startsWith('//')
														? (selectedGift.imageSrc || selectedGift.animationSrc).startsWith('//') ? `https:${selectedGift.imageSrc || selectedGift.animationSrc}` : (selectedGift.imageSrc || selectedGift.animationSrc)
														: `https://talkytimes.com${selectedGift.imageSrc || selectedGift.animationSrc}`
												}
												alt={selectedGift.name}
												className="w-full h-full object-cover"
											/>
										)
									) : (
										<div className="w-full h-full bg-gray-200 flex items-center justify-center">
											<svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
												<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
											</svg>
										</div>
									)}
									{selectedGift.animationSrc && (
										<div className="absolute top-0 right-0 bg-pink-500 text-white text-xs px-1 py-0.5 rounded">
											🎬
										</div>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<h4 className="font-medium text-gray-900 truncate">{selectedGift.name}</h4>
									<div className="flex items-center gap-1 text-sm text-pink-600">
										<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
											<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
										</svg>
										{selectedGift.cost}
									</div>
								</div>
							</div>

							{/* Поле введення повідомлення */}
							<div className="mb-4">
								<label htmlFor="gift-message" className="block text-sm font-medium text-gray-700 mb-2">
									Особисте повідомлення (не обов'язково)
								</label>
								<textarea
									id="gift-message"
									value={giftMessage}
									onChange={(e) => setGiftMessage(e.target.value)}
									placeholder="Напишіть тепле повідомлення до подарунку..."
									className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500 resize-none"
									rows={3}
									maxLength={200}
									disabled={isSendingGift}
								/>
								<div className="text-xs text-gray-500 mt-1 text-right">
									{giftMessage.length}/200
								</div>
							</div>

							{/* Кнопки дій */}
							<div className="flex gap-3">
								<button
									onClick={() => setIsMessageModalOpen(false)}
									className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={isSendingGift}
								>
									Відмінити
								</button>
								<button
									onClick={handleSendGift}
									disabled={isSendingGift}
									className="flex-1 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
								>
									{isSendingGift ? (
										<>
											<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
												<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
												<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
											</svg>
											Надсилаю...
										</>
									) : (
										<>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
											</svg>
											Надіслати
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		<ImagePreviewModal isOpen={isImagePreviewOpen} src={imagePreviewUrl} isLoading={imagePreviewLoading} onClose={() => setIsImagePreviewOpen(false)} />
		{sourceProfile?.id && (
			<ClientPublicProfileModal
				isOpen={isClientProfileOpen}
				onClose={() => setIsClientProfileOpen(false)}
				profileId={sourceProfile.id}
				clientId={idRegularUser}
			/>
		)}
		{sourceProfile?.id && (
			<MyPublicProfileModal
				isOpen={isMyProfileOpen}
				onClose={() => setIsMyProfileOpen(false)}
				profileId={sourceProfile.id}
			/>
		)}
		</div>

);
}
