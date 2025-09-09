"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { apiGet, apiPost } from '@/lib/api';
import { getSession, getAccessToken, clearSession, getUserId } from '@/lib/session';
import { ProfileAuthenticator } from '@/components/ProfileAuthenticator';
import { DialogSkeleton } from '@/components/SkeletonLoader';
import { CustomSelect } from '@/components/CustomSelect';
import { useToast } from '@/contexts/ToastContext';

type ChatDialog = {
	idUser: number;
	idInterlocutor: number;
	lastMessage?: {
		content?: {
			message?: string;
		};
	};
	dateUpdated?: string;
	messagesLeft?: number;
	[key: string]: unknown;
};

type UserProfile = {
	id: number;
	id_user: number;
	name: string;
	personal: {
		avatar_small: string;
		avatar_large: string;
		avatar_xl: string;
		age: number;
	};
	is_online: boolean;
	last_visit: string;
};

type SourceProfile = {
	id: string;
	displayName: string | null;
	provider: string;
	profileId: string | null;
};

type ChatsResponse = {
	dialogs: ChatDialog[];
	cursor: string;
	profiles: Record<number, UserProfile>;
	sourceProfiles: SourceProfile[];
};

export default function ChatsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const { showToast } = useToast();
	const [dialogs, setDialogs] = useState<ChatDialog[]>([]);
	const [profiles, setProfiles] = useState<Record<number, UserProfile>>({});
	const [sourceProfiles, setSourceProfiles] = useState<SourceProfile[]>([]);
	const [profileAvatars, setProfileAvatars] = useState<Record<string, string>>({});
	const [isLoadingDialogs, setIsLoadingDialogs] = useState(true);
	const [isLoadingMoreDialogs, setIsLoadingMoreDialogs] = useState(false);
	const [hasMoreDialogs, setHasMoreDialogs] = useState(true);
	const [dialogsCursor, setDialogsCursor] = useState<string>('');
	const [filters, setFilters] = useState<{ status: string; onlineOnly: boolean }>({
		status: 'unanswered',
		onlineOnly: false
	});
	const [active, setActive] = useState<boolean>(true);

	// Актуальний стан фільтрів у ref для доступу в колбеках сокета/інтервалів
	const filtersRef = useRef(filters);
	useEffect(() => { filtersRef.current = filters; }, [filters]);

	// Перевірка активної зміни: якщо немає – редірект на /dashboard
	useEffect(() => {
		(async () => {
			const s = getSession();
			if (!s) {
				router.replace('/login');
				return;
			}
			try {
				const data = await apiGet<{ active: boolean }>('/api/shifts/is-active');
				if (!data?.active) {
					router.replace('/dashboard');
				}
			} catch {
				// якщо бек віддає 401/403, apiGet сам редіректне
			}
		})();
	}, [router]);

	// Стан для пошуку діалогів
	const [showSearchForm, setShowSearchForm] = useState(false);
	const [searchProfileId, setSearchProfileId] = useState('');
	const [searchClientId, setSearchClientId] = useState('');
	const [searchResult, setSearchResult] = useState<ChatDialog | null>(null);
	const [isSearching, setIsSearching] = useState(false);

	// Отримуємо поточний dialogId з URL
	const currentDialogId = pathname.includes('/chats/') && pathname !== '/chats' 
		? pathname.split('/chats/')[1] 
		: null;

	// Функція пошуку діалогу за парою профіль-клієнт
	const searchDialog = async () => {
		if (!searchProfileId || !searchClientId) {
			alert('Будь ласка, оберіть профіль та введіть ІД клієнта');
			return;
		}

		const s = getSession();
		if (!s) {
			router.replace('/login');
			return;
		}

		try {
			setIsSearching(true);
			
			// Будуємо URL з параметрами пошуку
			const params = new URLSearchParams();
			params.set('profileId', searchProfileId);
			params.set('clientId', searchClientId);
			
			const response = await apiGet<{ dialog?: ChatDialog; profiles?: Record<number, UserProfile> }>(`/api/chats/search-dialog?${params.toString()}`);
			
			if (response && response.dialog) {
				setSearchResult(response.dialog);
				// Також оновлюємо профілі якщо є
				if (response.profiles) {
					setProfiles(prev => ({ ...prev, ...response.profiles }));
				}
			} else {
				setSearchResult(null);
				alert('Діалог не знайдено');
			}
		} catch (error) {
			console.error('Failed to search dialog:', error);
			alert('Помилка при пошуку діалогу');
			setSearchResult(null);
		} finally {
			setIsSearching(false);
		}
	};

	// Функція очищення пошуку
	const clearSearch = () => {
		setSearchResult(null);
		setSearchProfileId('');
		setSearchClientId('');
		setShowSearchForm(false);
	};

	// Функція переключення форми пошуку
	const toggleSearchForm = () => {
		if (showSearchForm) {
			// Якщо форма відкрита - закриваємо і очищаємо
			clearSearch();
		} else {
			// Якщо форма закрита - відкриваємо
			setShowSearchForm(true);
		}
	};

	const loadDialogs = async (currentFilters: { status: string; onlineOnly: boolean }, isInitial = true) => {
		const s = getSession();
		if (!s) {
			router.replace('/login');
			return;
		}
		
		try {
			if (isInitial) {
				setIsLoadingDialogs(true);
				setDialogs([]);
				setDialogsCursor('');
				setHasMoreDialogs(true);
			} else {
				setIsLoadingMoreDialogs(true);
			}

			// Будуємо URL з параметрами фільтрів
			const params = new URLSearchParams();
			if (currentFilters.status !== 'active') {
				params.set('status', currentFilters.status);
			}
			if (currentFilters.onlineOnly) {
				params.set('onlineOnly', 'true');
			}
			// Додаємо cursor для пагінації
			if (!isInitial && dialogsCursor) {
				params.set('cursor', dialogsCursor);
			}
			
			const url = `/api/chats/dialogs${params.toString() ? '?' + params.toString() : ''}`;
			const response = await apiGet<ChatsResponse & { cursor?: string; hasMore?: boolean }>(url);
			
			console.log(`📥 Frontend received response:`, {
				dialogsCount: response?.dialogs?.length,
				cursor: response?.cursor,
				hasMore: response?.hasMore,
				isInitial
			});
			
			if (response && Array.isArray(response.dialogs)) {
				// Додаткова фронтенд-фільтрація для «Вхідні»: виключаємо діалоги з isBlocked/is_blocked=true
				const filterUnanswered = (list: ChatDialog[], profilesMap?: Record<number, any>) => {
					if (currentFilters.status !== 'unanswered') return list;
					return list.filter((d: any) => {
						if (d?.isBlocked === true || d?.is_blocked === true) return false;
						const p = profilesMap?.[d.idInterlocutor];
						if (p && p.is_blocked === true) return false;
						return true;
					});
				};

				const safeDialogs = filterUnanswered(response.dialogs, response.profiles);
				if (isInitial) {
					setDialogs(safeDialogs);
					setProfiles(response.profiles || {});
					setSourceProfiles(response.sourceProfiles || []);
				} else {
					// Додаємо нові діалоги до кінця списку, виключаючи дублікати
					const existingIds = new Set(dialogs.map(dlg => `${dlg.idUser}-${dlg.idInterlocutor}`));
					const newDialogs = safeDialogs.filter(dlg => 
						!existingIds.has(`${dlg.idUser}-${dlg.idInterlocutor}`)
					);
					
					console.log(`📄 Dialogs pagination: loaded ${response.dialogs.length} dialogs, ${newDialogs.length} new`);
					console.log(`📊 Current dialogs count: ${dialogs.length}, existing IDs sample:`, Array.from(existingIds).slice(0, 5));
					console.log(`📊 New dialogs sample:`, newDialogs.slice(0, 3).map(dlg => `${dlg.idUser}-${dlg.idInterlocutor}`));
					
					// Якщо немає нових діалогів - зупиняємо завантаження
					if (newDialogs.length === 0) {
						console.log(`⏹️ No new dialogs after filtering, stopping pagination`);
						setHasMoreDialogs(false);
						return; // Виходимо без оновлення cursor
					}
					
					// Якщо завантажили менше ніж очікували - можливо досягли кінця
					if (safeDialogs.length < 15) {
						console.log(`📉 Received ${response.dialogs.length} dialogs (less than 15), might be end of data`);
						setHasMoreDialogs(false);
					}
					
					// Обмежуємо загальну кількість діалогів (захист від безкінечного завантаження)
					const totalAfterAdd = dialogs.length + newDialogs.length;
					if (totalAfterAdd > 500) {
						console.log(`🛑 Reached maximum dialogs limit (${totalAfterAdd}), stopping pagination`);
						setHasMoreDialogs(false);
					}
					
					setDialogs(prev => [...prev, ...newDialogs]);
					// Оновлюємо profiles та sourceProfiles
					setProfiles(prev => ({ ...prev, ...(response.profiles || {}) }));
					setSourceProfiles(prev => [...prev, ...(response.sourceProfiles || [])]);
				}
				
				// Оновлюємо cursor та hasMore тільки якщо є нові діалоги
				if (response.cursor) {
					setDialogsCursor(response.cursor);
				}
				setHasMoreDialogs(response.hasMore !== false && response.dialogs.length > 0);
			} else {
				if (isInitial) {
					setDialogs([]);
					setProfiles({});
					setSourceProfiles([]);
				}
			}
		} catch (error) {
			console.error('Failed to load dialogs:', error);
			if (isInitial) {
				setDialogs([]);
				setProfiles({});
				setSourceProfiles([]);
			}
		} finally {
			if (isInitial) {
				setIsLoadingDialogs(false);
			} else {
				setIsLoadingMoreDialogs(false);
			}
		}
	};

	useEffect(() => {
		loadDialogs(filters);
		
		// Cleanup timeout при зміні фільтрів
		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, [router, filters]);

	// Локальне видалення зі «Вхідні» відразу після відправки (будь-який тип)
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail as { profileId: number; clientId: number; kind?: string } | undefined;
			if (!detail) return;
			if (filtersRef.current?.status !== 'unanswered') return;
			setDialogs(prev => prev.filter(d => {
				const matchPair = d.idUser === detail.profileId && d.idInterlocutor === detail.clientId;
				if (!matchPair) return true;
				const isEmailItem = (d as any).__email === true;
				// Якщо відправлено лист — видаляємо ТІЛЬКИ email-айтем («Новий лист»), залишаємо звичайний діалог
				if (detail.kind === 'email') {
					return !isEmailItem; // прибираємо лише email-айтем
				}
				// Для інших типів (чат) — прибираємо тільки звичайний діалог, не чіпаємо email-айтем
				return isEmailItem; // залишаємо email-айтем, якщо він є
			}));
		};
		window.addEventListener('dialog:sent', handler as EventListener);
		return () => window.removeEventListener('dialog:sent', handler as EventListener);
	}, []);

	// Автооновлення списку «Вхідні» кожні 60 сек, тільки коли активний саме цей фільтр
	useEffect(() => {
		if (filters.status !== 'unanswered') return;
		const intervalId = setInterval(() => {
			// Виконуємо повне перезавантаження списку за поточними фільтрами
			loadDialogs(filters, true);
		}, 60000);
		return () => clearInterval(intervalId);
	}, [filters]);

	// Функція для завантаження більше діалогів
	const loadMoreDialogs = async () => {
		if (!hasMoreDialogs || isLoadingMoreDialogs || isLoadingDialogs || !dialogsCursor) return;
		console.log(`🔄 Loading more dialogs with cursor: ${dialogsCursor}`);
		await loadDialogs(filters, false);
	};

	// Refs для debounce
	const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Обробник скролу для пагінації діалогів
	const handleDialogsScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
		
		// Очищуємо попередній timeout
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}
		
		// Якщо доскролили майже до низу (залишилось менше 100px)
		if (
			scrollHeight - scrollTop - clientHeight < 100 &&
			hasMoreDialogs &&
			!isLoadingMoreDialogs &&
			!isLoadingDialogs &&
			dialogsCursor
		) {
			console.log(`🔄 Near bottom! Triggering dialogs pagination`);
			// Додаємо debounce для уникнення спаму
			scrollTimeoutRef.current = setTimeout(() => {
				if (hasMoreDialogs && !isLoadingMoreDialogs && !isLoadingDialogs) {
					loadMoreDialogs();
				}
			}, 200);
		}
	};

	// Завантажуємо аватари профілів після отримання sourceProfiles
	useEffect(() => {
		if (sourceProfiles.length > 0) {
			loadProfileAvatars();
		}
	}, [sourceProfiles]);

	// WebSocket для RTM оновлень
	useEffect(() => {
		const token = getAccessToken();
		if (!token) return;

		const base = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SOCKET_BASE || 'http://localhost:4000');
		const socket = io(base, {
			transports: ['polling'],
			upgrade: false,
			path: '/socket.io/',
			auth: { token }
		});

		// Обробляємо зміни онлайн статусу
		socket.on('user_online_status', (data: { userId: number; isOnline: boolean }) => {
			console.log('👤 RTM: User online status changed in dialogs list', data);
			
			// Оновлюємо статус у profiles
			setProfiles(prev => ({
				...prev,
				[data.userId]: prev[data.userId] ? {
					...prev[data.userId],
					is_online: data.isOnline
				} : prev[data.userId]
			}));
		});

		// Отримуємо toast про нове повідомлення або лист: оновлюємо/створюємо діалоги
		socket.on('message_toast', (payload: { messageId: number; idUserFrom: number; idUserTo: number; dateCreated: string; type: string; dialogId: string; correspondenceId?: string; title?: string }) => {
			console.log('🍞 RTM: Message toast in dialogs list', payload);
			setDialogs(prev => {
				// Парсимо dialogId у форматі `${profileId}-${interlocutorId}` (profileId завжди перший)
				const parts = (payload.dialogId || '').split('-');
				const profileId = Number(parts[0]);
				const interlocutorId = Number(parts[1]);
				
				// Фолбек: якщо dialogId некоректний, використовуємо напрямок з payload
				const pid = !isNaN(profileId) ? profileId : payload.idUserFrom;
				const iid = !isNaN(interlocutorId) ? interlocutorId : payload.idUserTo;

				// Якщо відкрито «Вхідні» і прийшов тост про НАШЕ вихідне повідомлення —
				// видаляємо діалог із списку «Вхідні» (він більше не «без відповіді»)
				if (filtersRef.current?.status === 'unanswered' && payload.type !== 'new_email') {
					const isOutgoingFromProfile = payload.idUserFrom === pid;
					if (isOutgoingFromProfile) {
						const next = prev.filter(d => !(d.idUser === pid && d.idInterlocutor === iid));
						if (next.length !== prev.length) {
							return next;
						}
					}
				}

				// Якщо це email (або є correspondenceId) — ЗАВЖДА додаємо новий айтем
				if (payload.type === 'new_email' || payload.correspondenceId) {
					const emailDialog: ChatDialog = {
						idUser: pid,
						idInterlocutor: iid,
						dateUpdated: payload.dateCreated,
						lastMessage: { content: { message: payload.title || 'Новий лист' } },
						__email: true,
						__emailBadge: true,
						__correspondenceId: payload.correspondenceId
					} as any;
					return [emailDialog, ...prev];
				}
				// Для чат-повідомлень: якщо існує НЕ email-айтем — оновлюємо його; якщо є лише email-айтем — створюємо новий
				const matchesDialog = (dlg: ChatDialog) => (dlg.idUser === pid && dlg.idInterlocutor === iid);
				const nonEmailIndex = prev.findIndex(dlg => matchesDialog(dlg) && !(dlg as any).__email);
				if (nonEmailIndex !== -1) {
					const updatedDialog: ChatDialog = { ...prev[nonEmailIndex], dateUpdated: payload.dateCreated };
					return [updatedDialog, ...prev.filter((_, i) => i !== nonEmailIndex)];
				}
				// Створюємо новий звичайний айтем діалогу
				const newDialog: ChatDialog = {
					idUser: pid,
					idInterlocutor: iid,
					dateUpdated: payload.dateCreated,
					lastMessage: { content: {} }
				};
				return [newDialog, ...prev];
			});
			
			// Підвантажуємо ім'я та аватар клієнта в список, якщо їх ще немає (з резолвером внутрішнього profile.id)
			(async () => {
				const parts = (payload.dialogId || '').split('-');
				const ttPidNum = Number(parts[0]);
				const iidNum = Number(parts[1]);
				const internalProfileId = !isNaN(ttPidNum) ? await resolveInternalProfileId(ttPidNum) : null;
				if (internalProfileId && !isNaN(iidNum)) {
					await ensureClientProfileInState(internalProfileId, iidNum);
				}
			})();
		});

		// Обробляємо нові повідомлення для оновлення списку діалогів
		socket.on('message', (payload: any) => {
			console.log('📨 RTM: New message in dialogs list', payload);
			setDialogs(prev => {
				// Визначаємо пару idUser/idInterlocutor незалежно від напрямку
				const pid = payload.idUserFrom;
				const iid = payload.idUserTo;
				const matches = (d: ChatDialog) => (
					(d.idUser === pid && d.idInterlocutor === iid) || (d.idUser === iid && d.idInterlocutor === pid)
				);

				// Якщо активний фільтр «Вхідні» і повідомлення надійшло ВІД профіля для цього діалогу —
				// прибираємо діалог зі списку (він більше не «без відповіді»)
				if (filtersRef.current?.status === 'unanswered') {
					const hasDialogFromProfile = prev.some(d => d.idUser === pid && d.idInterlocutor === iid);
					if (hasDialogFromProfile) {
						return prev.filter(d => !(d.idUser === pid && d.idInterlocutor === iid));
					}
				}
				const nonEmailIndex = prev.findIndex(d => matches(d) && !(d as any).__email);
				if (nonEmailIndex !== -1) {
					const updated: ChatDialog = {
						...prev[nonEmailIndex],
						lastMessage: { content: payload.content },
						dateUpdated: payload.dateCreated
					};
					return [updated, ...prev.filter((_, i) => i !== nonEmailIndex)];
				}
				// Якщо є тільки email-айтем, створюємо новий звичайний айтем
				const emailIndex = prev.findIndex(d => matches(d) && (d as any).__email);
				if (emailIndex !== -1) {
					const newDialog: ChatDialog = {
						idUser: pid,
						idInterlocutor: iid,
						dateUpdated: payload.dateCreated,
						lastMessage: { content: payload.content }
					};
					return [newDialog, ...prev];
				}
				// Інакше просто додаємо новий звичайний айтем
				const newDialog: ChatDialog = {
					idUser: pid,
					idInterlocutor: iid,
					dateUpdated: payload.dateCreated,
					lastMessage: { content: payload.content }
				};
				return [newDialog, ...prev];
			});
		});

		// Слухаємо завершення зміни — редіректимо на дашборд
		socket.on('shift_ended', (payload: { operatorId?: string }) => {
			const uid = getUserId();
			if (uid && payload?.operatorId && uid === payload.operatorId) {
				router.replace('/dashboard');
			}
		});

		return () => {
			socket.off('shift_ended');
			socket.off('message_toast');
			socket.disconnect();
		};
	}, []);

	// Функція для знаходження профілю за idUser (profileId)
	const getSourceProfileByIdUser = (idUser: number) => {
		return sourceProfiles.find(p => p.profileId === idUser.toString());
	};
	
	// Мапінг TT profileId (idUser) -> внутрішній profile.id
	const getInternalProfileIdByTT = (ttProfileId: number): string | null => {
		const found = sourceProfiles.find(p => p.profileId === String(ttProfileId));
		return found?.id || null;
	};
	
	// Резолвер внутрішнього profile.id за TT profileId з fallback на /profiles/my
	const resolveInternalProfileId = async (ttProfileId: number): Promise<string | null> => {
		const fromLocal = getInternalProfileIdByTT(ttProfileId);
		if (fromLocal) return fromLocal;
		try {
			const list = await apiGet<Array<{ id: string; profileId: string | null }>>('/profiles/my');
			const match = Array.isArray(list) ? list.find((p) => p.profileId === String(ttProfileId)) : null;
			return match?.id || null;
		} catch {
			return null;
		}
	};

	// Завантаження публічного профілю клієнта для підстановки імені та аватару в списку діалогів
	const ensureClientProfileInState = async (profileId: string, clientId: number) => {
		if (profiles[clientId]) return;
		try {
			const resp = await apiGet<{ success?: boolean; profile?: any }>(`/profiles/${profileId}/client/${clientId}/public`);
			const personal = resp?.profile?.personal;
			let avatarSmall = personal?.avatar_small || personal?.avatar_large || personal?.avatar_xl || '';
			let avatarLarge = personal?.avatar_large || personal?.avatar_xl || personal?.avatar_small || '';
			let avatarXL = personal?.avatar_xl || personal?.avatar_large || personal?.avatar_small || '';
			// Якщо аватар відсутній у публічному профілі — пробуємо фотки
			if (!avatarSmall) {
				try {
					const photos = await apiPost<any>(`/profiles/${profileId}/client/${clientId}/photos`, {});
					const data = photos?.data || photos;
					const allPhotos = [
						...(Array.isArray(data?.public) ? data.public : []),
						...(Array.isArray(data?.private) ? data.private : [])
					];
					const main = allPhotos.find((x: any) => x?.isMain === 1 || x?.is_main === 1) || allPhotos[0];
					if (main) {
						avatarSmall = main.url_small || main.url_medium || main.url_large || main.url_xl || main.url_xs || '';
						avatarLarge = main.url_large || main.url_xl || main.url_medium || main.url_small || '';
						avatarXL = main.url_xl || main.url_large || main.url_medium || main.url_small || '';
					}
				} catch {}
			}
			if (personal || avatarSmall) {
				setProfiles(prev => ({
					...prev,
					[clientId]: {
						id: clientId,
						id_user: clientId,
						name: (personal?.name ? personal.name : `Користувач ${clientId}`),
						personal: {
							avatar_small: avatarSmall,
							avatar_large: avatarLarge,
							avatar_xl: avatarXL,
							age: typeof personal?.age === 'number' ? personal!.age : (personal?.age ? parseInt(String(personal.age)) || 0 : 0)
						},
						is_online: Boolean(resp?.profile?.is_online),
						last_visit: resp?.profile?.last_visit || ''
					}
				}));
			}
		} catch {}
	};

	// Кешування даних профілю в localStorage
	const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 години

	const getCachedProfileData = (profileId: string) => {
		try {
			const cached = localStorage.getItem(`tt_profile_${profileId}`);
			if (cached) {
				const data = JSON.parse(cached);
				if (Date.now() - data.timestamp < PROFILE_CACHE_TTL) {
					return data.profileData;
				}
				// Видаляємо застарілий кеш
				localStorage.removeItem(`tt_profile_${profileId}`);
			}
		} catch (error) {
			console.warn('Error reading profile cache:', error);
		}
		return null;
	};

	const setCachedProfileData = (profileId: string, profileData: any) => {
		try {
			localStorage.setItem(`tt_profile_${profileId}`, JSON.stringify({
				profileData,
				timestamp: Date.now()
			}));
		} catch (error) {
			console.warn('Error saving profile cache:', error);
		}
	};

	// Завантаження аватарів профілів
	const loadProfileAvatars = async () => {
		const avatarsToLoad: Record<string, string> = {};
		
		for (const sourceProfile of sourceProfiles) {
			if (!sourceProfile.id) continue;
			
			// Спочатку перевіряємо кеш
			const cached = getCachedProfileData(sourceProfile.id);
			if (cached && cached.personal?.avatar_large) {
				avatarsToLoad[sourceProfile.id] = cached.personal.avatar_large;
				continue;
			}
			
			// Якщо немає в кеші, завантажуємо з API
			try {
				const response = await apiGet<{ success: boolean; profileData?: any; error?: string }>(`/profiles/${sourceProfile.id}/profile-data`);
				if (response.success && response.profileData?.personal?.avatar_large) {
					avatarsToLoad[sourceProfile.id] = response.profileData.personal.avatar_large;
					setCachedProfileData(sourceProfile.id, response.profileData);
				}
			} catch (error) {
				console.warn(`Failed to load profile data for ${sourceProfile.id}:`, error);
			}
		}
		
		setProfileAvatars(avatarsToLoad);
	};

	return (
		<>
			<ProfileAuthenticator />
			<div className="flex flex-col h-screen">
				{/* Хедер */}
				<header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 flex-shrink-0">
					{/* Назва додатку */}
					<div className="font-bold text-xl text-[#680098] mr-4">
						AnChat
					</div>

					<button
						onClick={() => router.push('/dashboard')}
						className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100"
						title="На дашборд"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
							<path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
						</svg>
						<span className="text-[14px] text-gray-500">Дашборд</span>
					</button>
					<button
						onClick={() => router.push('/chats')}
						className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${
							pathname.includes('/chats') ? 'bg-blue-50 text-blue-700' : ''
						}`}
						title="Чати"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${
							pathname.includes('/chats') ? 'text-blue-600' : 'text-gray-700'
						}`}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
						</svg>
						<span className={`text-[14px] ${
							pathname.includes('/chats') ? 'text-blue-700 font-medium' : 'text-gray-500'
						}`}>Чати</span>
					</button>
					<button
						onClick={() => router.push('/settings')}
						className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 ${
							pathname.includes('/settings') ? 'bg-blue-50 text-blue-700' : ''
						}`}
						title="Налаштування"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${
							pathname.includes('/settings') ? 'text-blue-600' : 'text-gray-700'
						}`}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.165.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.108 1.204.165.397.506.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.108 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.939-1.11.939h-1.094c-.55 0-1.019-.397-1.11-.94l-.148-.893c-.071-.425-.383-.763-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.939-.56-.939-1.109v-1.094c0-.55.397-1.019.94-1.11l.894-.149c.424-.07.763-.383.929-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
							<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						<span className={`text-[14px] ${
							pathname.includes('/settings') ? 'text-blue-700 font-medium' : 'text-gray-500'
						}`}>Налаштування</span>
					</button>
					<div className="ml-auto flex items-center gap-4">
						<button
							onClick={async () => {
								try {
									await apiPost('/api/shifts/end', {});
									showToast({ messageId: '', type: 'info', message: 'Зміну завершено' } as any);
									router.replace('/dashboard');
								} catch {
									showToast({ messageId: '', type: 'error', message: 'Не вдалося завершити зміну' } as any);
								}
							}}
							className="group flex items-center gap-2 px-3 py-2 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
							title="Завершити зміну"
						>
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" strokeWidth={1.5} className="w-5 h-5 text-gray-700 group-hover:text-red-600 group-hover:fill-red-600 transition-all border border-gray-400 rounded group-hover:border-red-600" fill="none">
								<path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
							</svg>
							<span className="text-[14px] text-gray-500 group-hover:text-red-500 transition-colors">Завершити</span>
						</button>
						<button
							onClick={() => { clearSession(); router.replace('/login'); }}
							className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100"
							title="Вийти"
						>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-700">
							<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
						</svg>
						<span className="text-[14px] text-gray-500">Вийти</span>
					</button>
					</div>
				</header>
				{/* Основний контент */}
				<div className="flex flex-1 overflow-hidden">
					{/* Ліва панель - список діалогів (завжди видимий) */}
					<div className="w-[320px] bg-white border-r border-gray-200 flex flex-col">
						{/* Фільтри діалогів */}
						<div className="p-4 border-b border-gray-200">
							<div className="flex items-center gap-3">
							<CustomSelect
								value={filters.status}
								onChange={(value) => setFilters({ ...filters, status: value })}
								options={[
									{ value: "active", label: "Активні" },
									{ value: "unanswered", label: "Вхідні" },
									{ value: "bookmarked", label: "Збережені" },
									{ value: "all", label: "Усі діалоги" }
								]}
								className="flex-1"
							/>
							
							{/* Кнопка онлайн фільтра */}
							<button
								onClick={() => setFilters({ ...filters, onlineOnly: !filters.onlineOnly })}
								className={`w-3 h-3 rounded-full border-2 transition-colors ${
									filters.onlineOnly 
										? 'bg-green-500 border-green-500' 
										: 'bg-gray-200 border-gray-300 hover:border-gray-400'
								}`}
								title={filters.onlineOnly ? 'Показувати всіх' : 'Тільки онлайн'}
							/>
							
							{/* Кнопка пошуку діалогу */}
							<button
								onClick={toggleSearchForm}
								className={`p-2 rounded-md border transition-colors ${
									showSearchForm 
										? 'bg-purple-50 border-purple-300 text-purple-600' 
										: 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
								}`}
								title={showSearchForm ? 'Закрити пошук' : 'Пошук діалогу'}
							>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
								</svg>
							</button>
						</div>
					</div>
					
					{/* Форма пошуку діалогу */}
					{showSearchForm && (
						<div className="p-4 border-b border-gray-200 bg-gray-50">
							<div className="space-y-3">
								{/* Випадаючий список профілів */}
								<div>
									<CustomSelect
										value={searchProfileId}
										onChange={(value) => setSearchProfileId(value)}
										options={[
											{ value: "", label: "ІД профілю" },
											...sourceProfiles.map((profile) => ({
												value: profile.profileId || '',
												label: `${profile.displayName || profile.profileId} (${profile.profileId})`
											}))
										]}
										className="w-full"
									/>
								</div>
								
								{/* Інпут для ІД клієнта */}
								<div>
									<input
										type="text"
										value={searchClientId}
										onChange={(e) => setSearchClientId(e.target.value)}
										placeholder="ІД Клієнта"
										className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
									/>
								</div>
								
								{/* Кнопки */}
								<div className="flex gap-2">
									<button
										onClick={searchDialog}
										disabled={isSearching}
										className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{isSearching ? 'Пошук...' : 'Знайти діалог'}
									</button>
									
									{searchResult && (
										<button
											onClick={clearSearch}
											className="px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
										>
											Очистити
										</button>
									)}
								</div>
							</div>
						</div>
					)}
					
					{/* Список діалогів */}
					<div className="flex-1 overflow-y-auto custom-scroll" onScroll={searchResult ? undefined : handleDialogsScroll}>
						{searchResult ? (
							// Показуємо результат пошуку
							<ul className="divide-y divide-gray-100">
								{(() => {
									const dlg = searchResult;
									const dialogId = `${dlg.idUser}-${dlg.idInterlocutor}`;
									const isActive = currentDialogId === dialogId;
									
									// Форматування часу
									const formatTime = (dateString: string) => {
										if (!dateString) return '';
										
										const date = new Date(dateString);
										const now = new Date();
										const diffMs = now.getTime() - date.getTime();
										const diffMinutes = Math.floor(diffMs / (1000 * 60));
										
										// Якщо менше 15 хвилин тому - показуємо відносний час
										if (diffMinutes < 15) {
											if (diffMinutes < 1) return 'щойно';
											return `${diffMinutes} хв`;
										}
										
										// Інакше показуємо дату та час
										const day = date.getDate().toString().padStart(2, '0');
										const month = (date.getMonth() + 1).toString().padStart(2, '0');
										const hours = date.getHours().toString().padStart(2, '0');
										const minutes = date.getMinutes().toString().padStart(2, '0');
										
										return `${day}.${month} ${hours}:${minutes}`;
									};
									
									const timeDisplay = formatTime(dlg.dateUpdated || '');
									const userProfile = profiles[dlg.idInterlocutor];
									const userName = userProfile?.name || `Користувач ${dlg.idInterlocutor}`;
									const avatarUrl = userProfile?.personal?.avatar_small;
									const sourceProfile = getSourceProfileByIdUser(dlg.idUser);
									const profileAvatar = sourceProfile ? profileAvatars[sourceProfile.id] : null;
									
									return (
										<li key={dialogId}>
											<Link
												href={`/chats/${dialogId}`}
												className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
													isActive ? 'bg-purple-50 border-r-2 border-purple-500' : ''
												}`}
												onClick={() => {
													// Зберігаємо messagesLeft в localStorage для доступу на сторінці діалогу
													if (typeof dlg.messagesLeft === 'number') {
														localStorage.setItem(`messagesLeft_${dialogId}`, dlg.messagesLeft.toString());
													}
												}}
											>
												<div className="flex items-center space-x-3">
													{/* Аватар користувача з індикатором онлайн та профільним аватаром */}
													<div className="relative">
														<div className="w-11 h-11 bg-gray-300 rounded-full overflow-hidden">
															{avatarUrl ? (
																<img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
															) : (
																<div className="w-full h-full flex items-center justify-center text-gray-500 text-lg font-medium">
																	{userName.charAt(0).toUpperCase()}
																</div>
															)}
														</div>
														
														{/* Індикатор онлайн */}
														{userProfile?.is_online && (
															<div className="absolute -top-0 -left-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
														)}
														
														{/* Аватар профілю в правому нижньому куті */}
														{profileAvatar && (
															<div className="absolute -bottom-0 -right-0 w-6 h-6 bg-white rounded-full border border-gray-200 overflow-hidden">
																<img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
															</div>
														)}
													</div>
													
													{/* Інформація про діалог */}
													<div className="flex-1 min-w-0">
														<div className="flex items-center justify-between">
															<div className="text-sm font-medium text-gray-900 truncate">
																{userName}
															</div>
															<div className="text-xs text-gray-500 ml-2 flex-shrink-0">
																{timeDisplay}
															</div>
														</div>
														<div className="text-xs text-gray-500 mt-1 truncate">
															{sourceProfile?.displayName || `Профіль ${dlg.idUser}`}
														</div>
														{dlg.lastMessage?.content?.message && (
															<div className="text-sm text-gray-600 mt-1 truncate">
																{dlg.lastMessage.content.message}
															</div>
														)}
													</div>
												</div>
											</Link>
										</li>
									);
								})()}
							</ul>
						) : isLoadingDialogs ? (
							<div className="divide-y divide-gray-100">
								{/* Показуємо кілька skeleton діалогів */}
								<DialogSkeleton />
								<DialogSkeleton />
								<DialogSkeleton />
								<DialogSkeleton />
								<DialogSkeleton />
								<DialogSkeleton />
							</div>
						) : dialogs.length === 0 ? (
							<div className="text-gray-500 text-center py-8 text-sm">Немає діалогів</div>
						) : (
							<>
								<ul className="divide-y divide-gray-100">
									{dialogs.map((dlg, index) => {
										const dialogId = `${dlg.idUser}-${dlg.idInterlocutor}`;
										const isActive = currentDialogId === dialogId;
										
										// Форматування часу
										const formatTime = (dateString: string) => {
											if (!dateString) return '';
											
											const date = new Date(dateString);
											const now = new Date();
											const diffMs = now.getTime() - date.getTime();
											const diffMinutes = Math.floor(diffMs / (1000 * 60));
											
											// Якщо менше 15 хвилин тому - показуємо відносний час
											if (diffMinutes < 15) {
												if (diffMinutes < 1) return 'щойно';
												return `${diffMinutes} хв`;
											}
											
											// Інакше показуємо дату та час
											const day = date.getDate().toString().padStart(2, '0');
											const month = (date.getMonth() + 1).toString().padStart(2, '0');
											const hours = date.getHours().toString().padStart(2, '0');
											const minutes = date.getMinutes().toString().padStart(2, '0');
											
											return `${day}.${month} ${hours}:${minutes}`;
										};
										
										const timeDisplay = formatTime(dlg.dateUpdated || '');
										const userProfile = profiles[dlg.idInterlocutor];
										const userName = userProfile?.name || `Користувач ${dlg.idInterlocutor}`;
										const avatarUrl = userProfile?.personal?.avatar_small;
										const sourceProfile = getSourceProfileByIdUser(dlg.idUser);
										const profileName = sourceProfile?.displayName || 'Невідомий профіль';
										const profileAvatarUrl = sourceProfile?.id ? profileAvatars[sourceProfile.id] : null;
										
										return (
											<li key={`${dlg.idUser}-${dlg.idInterlocutor}-${index}`}>
												<Link 
													href={((dlg as any).__email && (dlg as any).__correspondenceId)
														? `/chats/${encodeURIComponent(dialogId)}?openEmailHistory=1&corrId=${encodeURIComponent(String((dlg as any).__correspondenceId))}`
														: `/chats/${encodeURIComponent(dialogId)}`} 
													className={`block p-3 transition-colors ${
														isActive 
															? 'bg-purple-50 border-r-2 border-purple-500' 
															: 'hover:bg-gray-50'
													}`}
													onClick={() => {
														// Зберігаємо messagesLeft в localStorage для доступу на сторінці діалогу
														if (typeof dlg.messagesLeft === 'number') {
															localStorage.setItem(`messagesLeft_${dialogId}`, dlg.messagesLeft.toString());
														}
													}}
												>
													<div className="flex items-center gap-3">
														{/* Аватар користувача з індикатором онлайн */}
														<div className="relative flex-shrink-0">
															<div className="w-11 h-11 rounded-full overflow-hidden bg-gray-200">
																{avatarUrl ? (
																	<img 
																		src={avatarUrl} 
																		alt={userName}
																		className="w-full h-full object-cover"
																		onError={(e) => {
																			// Fallback якщо зображення не завантажилося
																			const target = e.target as HTMLImageElement;
																			target.style.display = 'none';
																			target.nextElementSibling?.classList.remove('hidden');
																		}}
																	/>
																) : null}
																<div className={`w-full h-full flex items-center justify-center text-white bg-purple-500 text-sm font-medium ${avatarUrl ? 'hidden' : ''}`}>
																	{userName.charAt(0).toUpperCase()}
																</div>
															</div>
															{/* Індикатор онлайн поза контейнером */}
															{userProfile?.is_online && (
																<div className="absolute top-0 left-0 w-3 h-3 bg-green-500 rounded-full border border-white"></div>
															)}
															{/* Аватар профілю в правому нижньому куті */}
															{profileAvatarUrl && (
																<div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full overflow-hidden bg-white border border-gray-300">
																	<img
																		src={profileAvatarUrl}
																		alt={profileName}
																		className="w-full h-full object-cover"
																		onError={(e) => {
																			// Приховуємо аватар профілю якщо не завантажився
																			const target = e.target as HTMLImageElement;
																			target.parentElement!.style.display = 'none';
																		}}
																	/>
																</div>
															)}
														</div>
														
														{/* Інформація про діалог */}
														<div className="flex-1 min-w-0">
															<div className="flex justify-between items-start">
																<div className="flex-1 min-w-0">
																	<div className={`font-medium text-sm truncate ${
																		isActive ? 'text-purple-900' : 'text-gray-900'
																	}`}>
																		{userName}
																	</div>
																	<div className={`text-xs truncate mt-0.5 ${
																		isActive ? 'text-purple-600' : 'text-gray-500'
																	}`}>
																		{profileName}
																	</div>
																</div>
																<div className="flex flex-col items-end justify-between gap-1 ml-2 flex-shrink-0 min-h-[2rem]">
														<span className={`text-xs ${isActive ? 'text-purple-500' : 'text-gray-400'}`}>{timeDisplay}</span>
														{(dlg as any).__emailBadge && (
															<span className="flex items-center gap-1 text-[11px] text-blue-600 font-bold">
																<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
																</svg>
																Новий лист
															</span>
														)}
													</div>
														</div>
													</div>
													</div>
												</Link>
											</li>
										);
									})}
								</ul>
								
								{/* Індикатор завантаження більше діалогів внизу */}
								{isLoadingMoreDialogs && (
									<div className="flex justify-center py-4 border-t border-gray-100">
										<div className="flex items-center gap-2 text-gray-500 text-sm">
											<div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-purple-500 rounded-full"></div>
											Завантаження діалогів...
										</div>
									</div>
								)}
							</>
						)}
					</div>
				</div>
				
					{/* Права панель - контент чату */}
					<div className="flex-1 bg-gray-50 overflow-hidden">
						{children}
					</div>
				</div>
			</div>
		</>
	);
}
