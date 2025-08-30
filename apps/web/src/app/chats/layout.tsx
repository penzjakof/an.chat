"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { apiGet } from '@/lib/api';
import { getSession, getAccessToken } from '@/lib/session';
import { ProfileAuthenticator } from '@/components/ProfileAuthenticator';
import { DialogSkeleton } from '@/components/SkeletonLoader';

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
	const [dialogs, setDialogs] = useState<ChatDialog[]>([]);
	const [profiles, setProfiles] = useState<Record<number, UserProfile>>({});
	const [sourceProfiles, setSourceProfiles] = useState<SourceProfile[]>([]);
	const [profileAvatars, setProfileAvatars] = useState<Record<string, string>>({});
	const [isLoadingDialogs, setIsLoadingDialogs] = useState(true);
	const [isLoadingMoreDialogs, setIsLoadingMoreDialogs] = useState(false);
	const [hasMoreDialogs, setHasMoreDialogs] = useState(true);
	const [dialogsCursor, setDialogsCursor] = useState<string>('');
	const [filters, setFilters] = useState<{ status: string; onlineOnly: boolean }>({ 
		status: 'active', 
		onlineOnly: false 
	});
	
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
			
			const response = await apiGet(`/api/chats/search-dialog?${params.toString()}`);
			
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
				if (isInitial) {
					setDialogs(response.dialogs);
					setProfiles(response.profiles || {});
					setSourceProfiles(response.sourceProfiles || []);
				} else {
					// Додаємо нові діалоги до кінця списку, виключаючи дублікати
					const existingIds = new Set(dialogs.map(dlg => `${dlg.idUser}-${dlg.idInterlocutor}`));
					const newDialogs = response.dialogs.filter(dlg => 
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
					if (response.dialogs.length < 15) {
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

		const socket = io('http://localhost:4000/ws', { 
			transports: ['websocket'], 
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

		// Обробляємо нові повідомлення для оновлення списку діалогів
		socket.on('message', (payload: any) => {
			console.log('📨 RTM: New message in dialogs list', payload);
			
			// Оновлюємо останнє повідомлення в діалозі
			setDialogs(prev => prev.map(dialog => {
				const dialogMatches = 
					(dialog.idUser === payload.idUserFrom && dialog.idInterlocutor === payload.idUserTo) ||
					(dialog.idUser === payload.idUserTo && dialog.idInterlocutor === payload.idUserFrom);
				
				if (dialogMatches) {
					return {
						...dialog,
						lastMessage: {
							content: payload.content
						},
						dateUpdated: payload.dateCreated
					};
				}
				return dialog;
			}));
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	// Функція для знаходження профілю за idUser (profileId)
	const getSourceProfileByIdUser = (idUser: number) => {
		return sourceProfiles.find(p => p.profileId === idUser.toString());
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
			<div className="flex h-screen">
				{/* Ліва панель - список діалогів (завжди видимий) */}
				<div className="w-[320px] bg-white border-r border-gray-200 flex flex-col">
					{/* Фільтри діалогів */}
					<div className="p-4 border-b border-gray-200">
						<div className="flex items-center gap-3">
							<select
								value={filters.status}
								onChange={(e) => setFilters({ ...filters, status: e.target.value })}
								className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
							>
								<option value="active">Активні</option>
								<option value="unanswered">Без відповіді</option>
								<option value="bookmarked">Збережені</option>
								<option value="all">Усі діалоги</option>
							</select>
							
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
									<select
										value={searchProfileId}
										onChange={(e) => setSearchProfileId(e.target.value)}
										className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
									>
										<option value="">ІД профілю</option>
										{sourceProfiles.map((profile) => (
											<option key={profile.id} value={profile.profileId || ''}>
												{profile.displayName || profile.profileId} ({profile.profileId})
											</option>
										))}
									</select>
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
					<div className="flex-1 overflow-y-auto" onScroll={searchResult ? undefined : handleDialogsScroll}>
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
													if (typeof dialog.messagesLeft === 'number') {
														localStorage.setItem(`messagesLeft_${dialogId}`, dialog.messagesLeft.toString());
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
													href={`/chats/${encodeURIComponent(dialogId)}`} 
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
																<div className={`text-xs ml-2 flex-shrink-0 ${
																	isActive ? 'text-purple-500' : 'text-gray-400'
																}`}>
																	{timeDisplay}
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
				<div className="flex-1 bg-gray-50">
					{children}
				</div>
			</div>
		</>
	);
}
