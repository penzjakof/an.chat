"use client";

import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getSession } from '@/lib/session';

type Profile = {
	id: string;
	credentialLogin: string;
	displayName: string;
	profileId?: string;
};

type AuthStatus = {
	profileId: string;
	status: 'authenticating' | 'authenticated' | 'failed' | 'no-session';
	message?: string;
};

// Відомі паролі для профілів (тимчасово для демо)
const KNOWN_PASSWORDS: Record<string, string> = {
	'aoshlatyyy@gmail.com': 'aoshlatyyy',
	'aaallonnno44ka03@gmail.com': 'aaallonnno44ka03'
};

// Глобальний кеш для уникнення повторних завантажень
let profilesCache: Profile[] | null = null;
let authStatusesCache: Record<string, AuthStatus> | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 хвилин

export function ProfileAuthenticator() {
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [authStatuses, setAuthStatuses] = useState<Record<string, AuthStatus>>({});
	const [isVisible, setIsVisible] = useState(false);
	const [isAuthenticating, setIsAuthenticating] = useState(false);

	useEffect(() => {
		// Перевіряємо кеш перед завантаженням
		const now = Date.now();
		if (profilesCache && authStatusesCache && (now - lastCheckTime) < CACHE_DURATION) {
			console.log('📋 Using cached profiles');
			setProfiles(profilesCache);
			setAuthStatuses(authStatusesCache);
			
			// Показуємо тільки якщо є неавтентифіковані профілі
			const needsAuth = Object.values(authStatusesCache).some(status => 
				status.status === 'failed'
			);
			setIsVisible(needsAuth);
			return;
		}
		
		loadProfilesAndAuthenticate();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadProfilesAndAuthenticate = async () => {
		try {
			// Перевіряємо, чи користувач залогінився
			const session = getSession();
			if (!session) {
				console.log('User not logged in, skipping profile authentication');
				return;
			}

			// Отримуємо профілі користувача
			console.log('🔍 Loading user profiles...');
			const userProfiles = await apiGet<Profile[]>('/profiles/my');
			console.log('✅ Loaded profiles:', userProfiles.length);
			setProfiles(userProfiles);

			// Перевіряємо статус автентифікації для кожного профілю
			const statuses: Record<string, AuthStatus> = {};
			let needsAuth = false;

			for (const profile of userProfiles) {
				if (!profile.profileId) {
					statuses[profile.id] = {
						profileId: profile.id,
						status: 'no-session',
						message: 'Профіль не має profileId'
					};
					continue;
				}

				try {
					const sessionStatus = await apiPost<{ authenticated: boolean; message: string }>(`/profiles/${profile.id}/session/status`, {});
					if (sessionStatus.authenticated) {
						statuses[profile.id] = {
							profileId: profile.id,
							status: 'authenticated',
							message: 'Автентифіковано'
						};
					} else {
						statuses[profile.id] = {
							profileId: profile.id,
							status: 'failed',
							message: 'Потрібна автентифікація'
						};
						needsAuth = true;
					}
				} catch {
					statuses[profile.id] = {
						profileId: profile.id,
						status: 'failed',
						message: 'Помилка перевірки сесії'
					};
					needsAuth = true;
				}
			}

			setAuthStatuses(statuses);
			
			// Зберігаємо в кеш
			profilesCache = userProfiles;
			authStatusesCache = statuses;
			lastCheckTime = Date.now();
			
			// Показуємо компонент тільки якщо потрібна автентифікація
			if (needsAuth) {
				setIsVisible(true);
				// Автоматично автентифікуємо профілі з відомими паролями
				await autoAuthenticateKnownProfiles(userProfiles, statuses);
			}
		} catch (error) {
			console.error('Failed to load profiles:', error);
			// Показуємо більш детальну інформацію про помилку
			if (error instanceof Error) {
				console.error('Error details:', error.message);
			}
		}
	};

	const autoAuthenticateKnownProfiles = async (userProfiles: Profile[], statuses: Record<string, AuthStatus>) => {
		setIsAuthenticating(true);
		
		for (const profile of userProfiles) {
			const status = statuses[profile.id];
			if (status?.status === 'failed' && profile.credentialLogin) {
				const knownPassword = KNOWN_PASSWORDS[profile.credentialLogin];
				if (knownPassword) {
					await authenticateProfile(profile.id, knownPassword);
				}
			}
		}
		
		setIsAuthenticating(false);
	};

	const authenticateProfile = async (profileId: string, password: string) => {
		setAuthStatuses(prev => ({
			...prev,
			[profileId]: { ...prev[profileId], status: 'authenticating', message: 'Автентифікація...' }
		}));

		try {
			await apiPost(`/profiles/${profileId}/authenticate`, { password });
			const newStatuses = {
				...authStatuses,
				[profileId]: { ...authStatuses[profileId], status: 'authenticated' as const, message: 'Успішно автентифіковано' }
			};
			setAuthStatuses(newStatuses);
			
			// Оновлюємо кеш
			authStatusesCache = newStatuses;
			
			// Перевіряємо чи всі профілі автентифіковані
			setTimeout(() => {
				const currentStatuses = authStatuses;
				const allAuthenticated = Object.values(currentStatuses).every(status => 
					status.status === 'authenticated' || status.status === 'no-session'
				);
				
				if (allAuthenticated) {
					setIsVisible(false);
					// НЕ перезавантажуємо сторінку - це викликає повторні завантаження
					console.log('✅ Всі профілі автентифіковані');
				}
			}, 1000);
		} catch {
			setAuthStatuses(prev => ({
				...prev,
				[profileId]: { ...prev[profileId], status: 'failed', message: 'Помилка автентифікації' }
			}));
		}
	};

	if (!isVisible) return null;

	const needsAuthProfiles = profiles.filter(p => 
		authStatuses[p.id]?.status === 'failed' || authStatuses[p.id]?.status === 'authenticating'
	);

	if (needsAuthProfiles.length === 0) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
				<h2 className="text-xl font-bold mb-4">Автентифікація профілів</h2>
				{isAuthenticating ? (
					<p className="text-blue-600 mb-4">
						🔄 Автоматична автентифікація профілів...
					</p>
				) : (
					<p className="text-gray-600 mb-4">
						Для отримання діалогів потрібно автентифікувати профілі TalkyTimes:
					</p>
				)}
				
				<div className="space-y-4">
					{needsAuthProfiles.map(profile => {
						const status = authStatuses[profile.id];
						return (
							<div key={profile.id} className="border rounded p-3">
								<div className="font-medium">{profile.displayName}</div>
								<div className="text-sm text-gray-600">{profile.credentialLogin}</div>
								<div className="text-xs text-gray-500 mt-1">
									Статус: {status?.message || 'Невідомо'}
								</div>
								
								{status?.status === 'failed' && (
									<div className="mt-2">
										<input
											type="password"
											placeholder="Пароль TalkyTimes"
											className="border rounded px-2 py-1 w-full text-sm"
											onKeyDown={(e) => {
												if (e.key === 'Enter') {
													const password = (e.target as HTMLInputElement).value;
													if (password) {
														authenticateProfile(profile.id, password);
													}
												}
											}}
										/>
									</div>
								)}
								
								{status?.status === 'authenticating' && (
									<div className="mt-2 text-sm text-blue-600">
										🔄 Автентифікація...
									</div>
								)}
								
								{status?.status === 'authenticated' && (
									<div className="mt-2 text-sm text-green-600">
										✅ Успішно автентифіковано
									</div>
								)}
							</div>
						);
					})}
				</div>
				
				<div className="mt-4 flex gap-2">
					{!isAuthenticating && (
						<button
							onClick={() => autoAuthenticateKnownProfiles(profiles, authStatuses)}
							className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
						>
							🔄 Автентифікувати автоматично
						</button>
					)}
					<button
						onClick={() => setIsVisible(false)}
						className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded"
					>
						Пропустити
					</button>
				</div>
			</div>
		</div>
	);
}
