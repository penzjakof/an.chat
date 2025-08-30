"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { getSession } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { ProfileAuthenticator } from '@/components/ProfileAuthenticator';

type ChatDialog = {
	idUser: number;
	idInterlocutor: number;
	lastMessage?: {
		content?: {
			message?: string;
		};
	};
	dateUpdated?: string;
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

// Мок-діалоги для демонстрації
const MOCK_DIALOGS: ChatDialog[] = [
	{
		idUser: 7162437,
		idInterlocutor: 12345,
		lastMessage: { content: { message: "Привіт! Як справи?" } },
		dateUpdated: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 хвилин тому
	},
	{
		idUser: 7162437,
		idInterlocutor: 67890,
		lastMessage: { content: { message: "Дякую за швидку відповідь!" } },
		dateUpdated: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 години тому
	},
	{
		idUser: 117326723,
		idInterlocutor: 11111,
		lastMessage: { content: { message: "Коли буде готово замовлення?" } },
		dateUpdated: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() // 5 годин тому
	}
];

export default function ChatsPage() {
	const router = useRouter();
	const [dialogs, setDialogs] = useState<ChatDialog[]>([]);
	const [profiles, setProfiles] = useState<Record<number, UserProfile>>({});
	const [sourceProfiles, setSourceProfiles] = useState<SourceProfile[]>([]);
	const [profileAvatars, setProfileAvatars] = useState<Record<string, string>>({});
	const [filters, setFilters] = useState<{ status: string; onlineOnly: boolean }>({ 
		status: 'active', 
		onlineOnly: false 
	});

	const loadDialogs = async (currentFilters: { status: string; onlineOnly: boolean }) => {
		const s = getSession();
		if (!s) {
			router.replace('/login');
			return;
		}
		
		try {
			// Будуємо URL з параметрами фільтрів
			const params = new URLSearchParams();
			if (currentFilters.status !== 'active') {
				params.set('status', currentFilters.status);
			}
			if (currentFilters.onlineOnly) {
				params.set('onlineOnly', 'true');
			}
			
			const url = `/api/chats/dialogs${params.toString() ? '?' + params.toString() : ''}`;
			const response = await apiGet<ChatsResponse>(url);
			
			if (response && Array.isArray(response.dialogs)) {
				setDialogs(response.dialogs);
				setProfiles(response.profiles || {});
				setSourceProfiles(response.sourceProfiles || []);
			} else {
				setDialogs([]);
				setProfiles({});
				setSourceProfiles([]);
			}
		} catch (error) {
			setDialogs([]);
			setProfiles({});
			setSourceProfiles([]);
		}
	};

	useEffect(() => {
		loadDialogs(filters);
	}, [router, filters]);

	// Завантажуємо аватари профілів після отримання sourceProfiles
	useEffect(() => {
		if (sourceProfiles.length > 0) {
			loadProfileAvatars();
		}
	}, [sourceProfiles]);



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
				{/* Ліва панель - список діалогів */}
				<div className="w-[250px] bg-white border-r border-gray-200 flex flex-col">
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
						</div>
					</div>
					
					{/* Список діалогів */}
					<div className="flex-1 overflow-y-auto">
						{dialogs.length === 0 ? (
							<div className="text-gray-500 text-center py-8 text-sm">Немає діалогів</div>
						) : (
							<ul className="divide-y divide-gray-100">
								{dialogs.map((dlg, index) => {
									const dialogId = `${dlg.idUser}-${dlg.idInterlocutor}`;
									
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
											<Link href={`/chats/${encodeURIComponent(dialogId)}`} className="block p-3 hover:bg-gray-50 transition-colors">
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
																<div className="font-medium text-gray-900 text-sm truncate">
																	{userName}
																</div>
																<div className="text-xs text-gray-500 truncate mt-0.5">
																	{profileName}
																</div>
															</div>
															<div className="text-xs text-gray-400 ml-2 flex-shrink-0">
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
						)}
					</div>
				</div>
				
				{/* Права панель - область для чату */}
				<div className="flex-1 bg-gray-50 flex items-center justify-center">
					<div className="text-center text-gray-500">
						<div className="text-4xl mb-4">💬</div>
						<div className="text-lg font-medium mb-2">Оберіть діалог</div>
						<div className="text-sm">Виберіть діалог зі списку, щоб почати спілкування</div>
					</div>
				</div>
			</div>
		</>
	);
}
