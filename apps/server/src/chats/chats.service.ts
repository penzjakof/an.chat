import { Inject, Injectable, Optional, ForbiddenException } from '@nestjs/common';
import type { SiteProvider, DialogsFilters } from '../providers/site-provider.interface';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import type { RequestAuthContext } from '../common/auth/auth.types';
import { ChatsGateway } from './chats.gateway';
import { ChatAccessService } from './chat-access.service';

@Injectable()
export class ChatsService {
	// ВИПРАВЛЕННЯ: Простий кеш для accessibleProfiles
	private profilesCache = new Map<string, { profiles: any[], timestamp: number }>();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 хвилин

	constructor(
		@Inject(TALKY_TIMES_PROVIDER) private readonly provider: SiteProvider,
		private readonly chatAccess: ChatAccessService,
		@Optional() private readonly gateway?: ChatsGateway,
	) {}

	private toCtx(auth: RequestAuthContext) {
		return { agencyCode: auth.agencyCode, operatorCode: auth.operatorCode };
	}

	// ВИПРАВЛЕННЯ: Кешований метод для отримання accessibleProfiles
	private async getCachedAccessibleProfiles(auth: RequestAuthContext): Promise<any[]> {
		const cacheKey = `${auth.agencyCode}-${auth.operatorCode}`;
		const cached = this.profilesCache.get(cacheKey);
		
		if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
			console.log(`📋 Using cached accessible profiles for ${cacheKey}`);
			return cached.profiles;
		}

		console.log(`📋 Fetching fresh accessible profiles for ${cacheKey}`);
		const profiles = await this.chatAccess.getAccessibleProfiles(auth);
		this.profilesCache.set(cacheKey, { profiles, timestamp: Date.now() });
		
		return profiles;
	}

	private processCriteria(filters?: DialogsFilters): string[] {
		const criteria: string[] = [];

		// Додаємо статус фільтр
		if (!filters?.status || filters.status === 'active') {
			criteria.push('active');
		} else if (filters.status === 'bookmarked') {
			criteria.push('bookmarked');
		} else if (filters.status === 'unanswered') {
			criteria.push('unanswered');
		}
		// Для 'all' не додаємо жодного статусу

		// Додаємо онлайн фільтр якщо активний
		if (filters?.onlineOnly) {
			criteria.push('online');
		}

		return criteria;
	}

		async fetchDialogs(auth: RequestAuthContext, filters?: DialogsFilters): Promise<unknown> {
		// ВИПРАВЛЕННЯ: Використовуємо кешовану версію
		const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
		
		if (accessibleProfiles.length === 0) {
			return {
				dialogs: [],
				cursor: '',
				profiles: {},
				sourceProfiles: []
			};
		}
		
		if (!this.provider.fetchDialogsByProfile) {
			// Fallback до старого методу якщо новий не підтримується
			const dialogs = await this.provider.fetchDialogs(this.toCtx(auth), filters);
			return this.chatAccess.filterDialogsByAccess(dialogs, auth);
		}

		// Збираємо діалоги з усіх доступних профілів
		const allDialogs: any[] = [];
		
		// Обробляємо фільтри
		const criteria = this.processCriteria(filters);
		console.log(`ChatsService.fetchDialogs: filters=`, filters, 'criteria=', criteria);
		
		for (const profile of accessibleProfiles) {
			if (profile.profileId) {
				try {
					const profileDialogs = await this.provider.fetchDialogsByProfile(
						profile.profileId, 
						criteria, 
						'', // cursor
						15  // limit
					);
					
					// Додаємо діалоги до загального списку
					if (profileDialogs && typeof profileDialogs === 'object' && 'dialogs' in profileDialogs) {
						const dialogsData = profileDialogs as { dialogs: any[] };
						if (Array.isArray(dialogsData.dialogs)) {
							allDialogs.push(...dialogsData.dialogs);
						}
					}
				} catch (error) {
					console.warn(`Failed to fetch dialogs for profile ${profile.profileId}:`, error instanceof Error ? error.message : 'Unknown error');
				}
			}
		}

		// Сортуємо діалоги за датою оновлення (найновіші спочатку)
		allDialogs.sort((a, b) => {
			const dateA = new Date(a.dateUpdated || 0).getTime();
			const dateB = new Date(b.dateUpdated || 0).getTime();
			return dateB - dateA;
		});

		// Збираємо унікальні ID користувачів для отримання їх профілів
		const userIds = new Set<number>();
		allDialogs.forEach(dialog => {
			if (dialog.idInterlocutor) {
				userIds.add(dialog.idInterlocutor);
			}
		});

		// Отримуємо профілі користувачів асинхронно
		const profilesMap: Record<number, any> = {};
		if (userIds.size > 0 && this.provider.fetchProfiles && accessibleProfiles.length > 0) {
			// Використовуємо перший доступний профіль для автентифікації
			const firstProfile = accessibleProfiles.find(p => p.profileId);
			if (firstProfile?.profileId) {
				try {
					const profilesResult = await this.provider.fetchProfiles(
						firstProfile.profileId,
						Array.from(userIds)
					);
					
					if (profilesResult.success && profilesResult.profiles) {
						profilesResult.profiles.forEach(profile => {
							profilesMap[profile.id] = profile;
						});
					}
				} catch (error) {
					console.warn('Failed to fetch user profiles:', error instanceof Error ? error.message : 'Unknown error');
				}
			}
		}

		return {
			dialogs: allDialogs,
			cursor: allDialogs.length > 0 ? new Date().toISOString() : '',
			profiles: profilesMap,
			sourceProfiles: accessibleProfiles.map(p => ({
				id: p.id,
				displayName: p.displayName,
				provider: p.provider,
				profileId: p.profileId
			}))
		};
	}

	async fetchMessages(auth: RequestAuthContext, dialogId: string, cursor?: string): Promise<unknown> {
		try {
			console.log(`🔍 ChatsService.fetchMessages called for dialog: ${dialogId}`);
			
					// ВИПРАВЛЕННЯ: Використовуємо кешовану версію
		const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
		console.log(`📋 Accessible profiles:`, accessibleProfiles.map(p => ({ id: p.id, profileId: p.profileId, displayName: p.displayName })));
			
			// Парсимо dialogId для отримання idUser та idInterlocutor
			const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
			console.log(`🔢 Parsed dialogId: idUser=${idUser}, idInterlocutor=${idInterlocutor}`);
			
			// Знаходимо профіль, який відповідає за цей діалог (за profileId = idUser)
			const targetProfile = accessibleProfiles.find(profile => profile.profileId === idUser.toString());
			console.log(`🎯 Target profile:`, targetProfile ? { id: targetProfile.id, profileId: targetProfile.profileId, displayName: targetProfile.displayName } : 'not found');

			if (!targetProfile || !targetProfile.profileId) {
				throw new Error(`No authenticated profile found for this dialog. Looking for profileId: ${idUser}`);
			}

			// ВИПРАВЛЕННЯ: Якщо cursor не передано, знаходимо lastMessage.id з діалогів
			let effectiveCursor = cursor;
			if (!effectiveCursor) {
				try {
					const dialogsResult = await this.fetchDialogs(auth, {}) as { dialogs?: any[] };
					const targetDialog = dialogsResult.dialogs?.find((d: any) => 
						`${d.idUser}-${d.idInterlocutor}` === dialogId
					);
					if (targetDialog?.lastMessage?.id) {
						effectiveCursor = targetDialog.lastMessage.id.toString();
						console.log(`🎯 Auto-found cursor from dialog: ${effectiveCursor}`);
					}
				} catch (error) {
					console.warn('Failed to auto-find cursor, proceeding without:', error);
				}
			}

			if (this.provider.fetchMessagesByProfile) {
				console.log(`📞 Calling fetchMessagesByProfile with profileId: ${targetProfile.profileId}, dialogId: ${dialogId}, cursor: ${effectiveCursor}`);
				try {
					const result = await this.provider.fetchMessagesByProfile(targetProfile.profileId, dialogId, effectiveCursor);
					console.log(`📥 fetchMessagesByProfile result:`, { success: result.success, messagesCount: result.messages?.length, error: result.error });
					if (!result.success) {
						throw new Error(result.error || 'Failed to fetch messages');
					}
					return { messages: result.messages || [] };
				} catch (error) {
					console.error(`❌ Error in fetchMessagesByProfile:`, error);
					throw error;
				}
			}

			// Fallback до старого методу
			return this.provider.fetchMessages(this.toCtx(auth), dialogId, cursor);
		} catch (error) {
			console.error(`💥 КРИТИЧНА ПОМИЛКА в ChatsService.fetchMessages:`, error);
			throw error;
		}
	}

	async sendText(auth: RequestAuthContext, dialogId: string, text: string): Promise<unknown> {
		// TODO: Додати перевірку доступу до конкретного діалогу перед відправкою
		// Наразі дозволяємо відправку, але потрібно буде додати валідацію
		const result = await this.provider.sendTextMessage(this.toCtx(auth), dialogId, text);
		this.gateway?.emitNewMessage({ dialogId, payload: result });
		return result;
	}

	async getAccessibleProfiles(auth: RequestAuthContext) {
		// ВИПРАВЛЕННЯ: Використовуємо кешовану версію
		return this.getCachedAccessibleProfiles(auth);
	}

	async fetchUserProfiles(profileId: string, userIds: number[]) {
		if (this.provider.fetchProfiles) {
			return this.provider.fetchProfiles(profileId, userIds);
		}
		return { profiles: [] };
	}
}
