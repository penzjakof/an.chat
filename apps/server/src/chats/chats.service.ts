import { Inject, Injectable, Optional, ForbiddenException } from '@nestjs/common';
import type { SiteProvider, DialogsFilters } from '../providers/site-provider.interface';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import type { RequestAuthContext } from '../common/auth/auth.types';
import { ChatsGateway } from './chats.gateway';
import { ChatAccessService } from './chat-access.service';
import { SendPhotoDto } from './dto/send-photo.dto';

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
			console.log('🔍 Cached accessible profiles:', cached.profiles.map(p => ({ id: p.profileId, name: p.displayName })));
			return cached.profiles;
		}

		console.log(`📋 Fetching fresh accessible profiles for ${cacheKey}`);
		const profiles = await this.chatAccess.getAccessibleProfiles(auth);
		console.log('🔍 Fresh accessible profiles:', profiles.map(p => ({ id: p.profileId, name: p.displayName })));
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
		const profileCursors: Record<string, string> = {};
		let hasMoreAny = false;
		
		// Парсимо cursors з параметрів (може бути JSON об'єкт з cursor для кожного профілю)
		let inputCursors: Record<string, string> = {};
		if (filters?.cursor) {
			try {
				inputCursors = JSON.parse(filters.cursor);
			} catch {
				// Якщо не JSON, то це старий формат - використовуємо для всіх профілів
				console.log(`📄 Using legacy cursor format: ${filters.cursor}`);
			}
		}
		
		// Обробляємо фільтри
		const criteria = this.processCriteria(filters);
		console.log(`ChatsService.fetchDialogs: filters=`, filters, 'criteria=', criteria, 'inputCursors=', inputCursors);
		
		for (const profile of accessibleProfiles) {
			if (profile.profileId) {
				try {
					// Використовуємо cursor для конкретного профілю
					const profileCursor = inputCursors[profile.profileId] || '';
					console.log(`🔄 Fetching dialogs for profile ${profile.profileId} with cursor: "${profileCursor}"`);
					
					const profileDialogs = await this.provider.fetchDialogsByProfile(
						profile.profileId, 
						criteria, 
						profileCursor, // cursor для конкретного профілю
						15  // limit
					);
					
					// Додаємо діалоги до загального списку
					if (profileDialogs && typeof profileDialogs === 'object' && 'dialogs' in profileDialogs) {
						const dialogsData = profileDialogs as { dialogs: any[]; cursor?: string; hasMore?: boolean };
						if (Array.isArray(dialogsData.dialogs)) {
							console.log(`📄 Profile ${profile.profileId}: loaded ${dialogsData.dialogs.length} dialogs, cursor: "${dialogsData.cursor}", hasMore: ${dialogsData.hasMore}`);
							allDialogs.push(...dialogsData.dialogs);
							
							// Зберігаємо cursor для конкретного профілю
							if (dialogsData.cursor) {
								profileCursors[profile.profileId] = dialogsData.cursor;
							}
							
							// Якщо хоча б один профіль має ще діалоги
							if (dialogsData.hasMore !== false) {
								hasMoreAny = true;
							}
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


		// Якщо користувач переглядає список "без відповіді" (unanswered),
		// відфільтровуємо діалоги, де співрозмовник заблокований (is_blocked = true)
		if (filters?.status === 'unanswered' && Object.keys(profilesMap).length > 0) {
			const before = allDialogs.length;
			allDialogs.splice(0, allDialogs.length, ...allDialogs.filter(d => {
				const p = profilesMap[d.idInterlocutor];
				return !(p && p.is_blocked === true);
			}));
			const after = allDialogs.length;
			if (before !== after) {
				console.log(`🧹 Filtered blocked dialogs for unanswered: ${before - after} removed`);
			}
		}

		const finalCursor = Object.keys(profileCursors).length > 0 ? JSON.stringify(profileCursors) : '';
		console.log(`📤 ChatsService.fetchDialogs returning:`, {
			dialogsCount: allDialogs.length,
			cursor: finalCursor,
			hasMore: hasMoreAny,
			profileCursors: profileCursors
		});

		return {
			dialogs: allDialogs,
			cursor: finalCursor,
			hasMore: hasMoreAny,
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

			// ВИПРАВЛЕННЯ: Якщо cursor не передано, передаємо undefined для отримання найновіших повідомлень
			let effectiveCursor = cursor;
			if (!effectiveCursor) {
				console.log(`🔄 No cursor provided, will fetch latest messages (idLastMessage=undefined)`);
				effectiveCursor = undefined; // Явно встановлюємо undefined для першого завантаження
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

		// Формуємо повний payload для негайного оновлення чату на фронті
		try {
			const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
			const payload = {
				id: (result as any)?.idMessage || Date.now(),
				idUserFrom: idUser,
				idUserTo: idInterlocutor,
				type: 'message',
				content: { message: text },
				message: text,
				dateCreated: new Date().toISOString()
			};
			this.gateway?.emitNewMessage({ dialogId, payload });
		} catch (e) {
			// Мовчазний fallback, якщо формат dialogId несподівано некоректний
		}

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

	async getOriginalPhotoUrl(auth: RequestAuthContext, profileId: string, idRegularUser: number, previewUrl: string) {
		try {
			if (!(this.provider as any).getOriginalPhotoUrl) {
				throw new Error('getOriginalPhotoUrl not supported by provider');
			}
			const res = await (this.provider as any).getOriginalPhotoUrl(profileId, idRegularUser, previewUrl);
			return res;
		} catch (error) {
			console.error('💥 ПОМИЛКА в ChatsService.getOriginalPhotoUrl:', error);
			throw error;
		}
	}

	async searchDialogByPair(auth: RequestAuthContext, profileId: string, clientId: string) {
		try {
			console.log(`🔍 ChatsService.searchDialogByPair: profileId=${profileId}, clientId=${clientId}`);
			
			// Перевіряємо доступ до профілю
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			const targetProfile = accessibleProfiles.find(p => p.profileId === profileId);
			
			if (!targetProfile) {
				throw new ForbiddenException(`Profile ${profileId} is not accessible`);
			}

			// Викликаємо метод пошуку діалогу в провайдері
			if (!this.provider.searchDialogByPair) {
				throw new Error('Search dialog by pair is not supported by this provider');
			}
			
			const result = await this.provider.searchDialogByPair(profileId, parseInt(clientId));
			
			if (result && result.dialog) {
				// Додаємо профіль до результату для отримання інформації про клієнта
				const clientIds = [result.dialog.idInterlocutor];
				const profilesResult = await this.fetchUserProfiles(profileId, clientIds);
				
				return {
					dialog: result.dialog,
					profiles: profilesResult.profiles || {}
				};
			}
			
			return { dialog: null, profiles: {} };
		} catch (error) {
			console.error(`💥 ПОМИЛКА в ChatsService.searchDialogByPair:`, error);
			throw error;
		}
	}

	async fetchRestrictions(auth: RequestAuthContext, dialogId: string) {
		try {
			console.log(`🔍 ChatsService.fetchRestrictions: dialogId=${dialogId}`);
			
			// Парсимо dialogId для отримання profileId та clientId
			const [profileId, clientId] = dialogId.split('-');
			
			// Перевіряємо доступ до профілю
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			const targetProfile = accessibleProfiles.find(p => p.profileId === profileId);
			
			if (!targetProfile) {
				throw new ForbiddenException(`Profile ${profileId} is not accessible`);
			}

			// Викликаємо метод отримання обмежень в провайдері
			if (!this.provider.fetchRestrictions) {
				throw new Error('Fetch restrictions is not supported by this provider');
			}
			
			const result = await this.provider.fetchRestrictions(profileId, parseInt(clientId));
			
			if (result.success) {
				return {
					lettersLeft: result.lettersLeft || 0
				};
			} else {
				throw new Error(result.error || 'Failed to fetch restrictions');
			}
		} catch (error) {
			console.error(`💥 ПОМИЛКА в ChatsService.fetchRestrictions:`, error);
			throw error;
		}
	}

	/**
	 * Відправляє фото через TalkyTimes API
	 */
	async sendPhoto(auth: RequestAuthContext, sendPhotoDto: SendPhotoDto) {
		console.log(`📸 ChatsService.sendPhoto: Sending ${sendPhotoDto.photoIds.length} photos from profile ${sendPhotoDto.idProfile} to user ${sendPhotoDto.idRegularUser}`);

		try {
			// Перевіряємо доступ до профілю
			const accessibleProfiles = await this.getAccessibleProfiles(auth);
			const targetProfile = accessibleProfiles.find(p => p.profileId === sendPhotoDto.idProfile);
			
			if (!targetProfile) {
				throw new ForbiddenException(`Access denied to profile ${sendPhotoDto.idProfile}`);
			}

			// Перевіряємо чи підтримує провайдер відправку фото
			if (!this.provider.sendPhoto) {
				throw new Error('Provider does not support photo sending');
			}

			// Відправляємо кожне фото окремо (як робить TalkyTimes)
			const results: Array<{ photoId: number; success: boolean; messageId?: any; error?: string }> = [];
			for (const photoId of sendPhotoDto.photoIds) {
				console.log(`📸 Sending photo ${photoId} from profile ${sendPhotoDto.idProfile} to user ${sendPhotoDto.idRegularUser}`);
				
				const result = await this.provider.sendPhoto(this.toCtx(auth), {
					idProfile: sendPhotoDto.idProfile,
					idRegularUser: sendPhotoDto.idRegularUser,
					idPhoto: photoId
				});

				if (result.success) {
					console.log(`✅ Photo ${photoId} sent successfully`);
					results.push({ photoId, success: true, messageId: result.data?.messageId });

					// Негайно емітимо у кімнату діалогу локальне медіа-повідомлення
					try {
						const payload = {
							id: result.data?.messageId || Date.now(),
							idUserFrom: Number(sendPhotoDto.idProfile),
							idUserTo: Number(sendPhotoDto.idRegularUser),
							type: 'photo_batch',
							content: {
								photos: [
									{ id: photoId, url: result.data?.photoUrl || '' }
								]
							},
							dateCreated: new Date().toISOString()
						};
						const dialogId = `${sendPhotoDto.idProfile}-${sendPhotoDto.idRegularUser}`;
						this.gateway?.emitNewMessage({ dialogId, payload });
					} catch {}
				} else {
					console.error(`❌ Failed to send photo ${photoId}:`, result.error);
					results.push({ photoId, success: false, error: result.error });
				}
			}

			const successCount = results.filter(r => r.success).length;
			console.log(`📸 Sent ${successCount}/${sendPhotoDto.photoIds.length} photos successfully`);

			return {
				success: successCount > 0,
				results,
				successCount,
				totalCount: sendPhotoDto.photoIds.length
			};

		} catch (error) {
			console.error(`💥 ПОМИЛКА в ChatsService.sendPhoto:`, error);
			throw error;
		}
	}

	async getStickers(auth: RequestAuthContext, interlocutorId: number): Promise<unknown> {
		console.log(`😀 ChatsService.getStickers: interlocutorId=${interlocutorId}`);

		try {
			// Перевіряємо доступ до профілів
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);

			if (accessibleProfiles.length === 0) {
				throw new ForbiddenException('No accessible profiles found');
			}

			// Використовуємо перший доступний профіль
			const targetProfile = accessibleProfiles.find(p => p.profileId);
			if (!targetProfile || !targetProfile.profileId) {
				throw new ForbiddenException('No valid profile found');
			}

			// Викликаємо метод провайдера
			if (!this.provider.getStickers) {
				throw new Error('Stickers are not supported by this provider');
			}

			const result = await this.provider.getStickers(targetProfile.profileId, interlocutorId);

			if (result.success) {
				return { categories: result.categories || [] };
			} else {
				throw new Error(result.error || 'Failed to fetch stickers');
			}
		} catch (error) {
			console.error(`💥 ПОМИЛКА в ChatsService.getStickers:`, error);
			throw error;
		}
	}

	async sendSticker(auth: RequestAuthContext, params: { idProfile: number; idRegularUser: number; stickerId: number; stickerUrl?: string }): Promise<unknown> {
		console.log(`😀 ChatsService.sendSticker: profile ${params.idProfile} → user ${params.idRegularUser}, sticker ${params.stickerId}`);

		try {
			// Перевіряємо доступ до профілю
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			const targetProfile = accessibleProfiles.find(p => p.profileId === params.idProfile.toString());

			if (!targetProfile) {
				throw new ForbiddenException(`Access denied to profile ${params.idProfile}`);
			}

			// Визначаємо який метод використовувати залежно від наявності stickerUrl
			const useNewMethod = !params.stickerUrl;

			if (useNewMethod && this.provider.sendStickerById) {
				// Використовуємо новий метод з тільки idSticker та idRegularUser
				const result = await this.provider.sendStickerById(params.idProfile.toString(), params.idRegularUser, params.stickerId);

				if (result.success) {
					console.log(`✅ Sticker sent successfully (by ID)`);
					return result;
				} else {
					throw new Error(result.error || 'Failed to send sticker');
				}
			} else if (this.provider.sendSticker) {
				// Використовуємо старий метод з усіма параметрами
				const result = await this.provider.sendSticker(this.toCtx(auth), params as { idProfile: number; idRegularUser: number; stickerId: number; stickerUrl: string });

				if (result.success) {
					console.log(`✅ Sticker sent successfully (by URL)`);
					return result;
				} else {
					throw new Error(result.error || 'Failed to send sticker');
				}
			} else {
				throw new Error('Sticker sending is not supported by this provider');
			}
		} catch (error) {
			console.error(`💥 ПОМИЛКА в ChatsService.sendSticker:`, error);
			throw error;
		}
	}

	/**
	 * Отримує TalkTimes restrictions через gRPC API для перевірки exclusive posts
	 */
	async getTtRestrictions(auth: RequestAuthContext, profileIdInput: number, idInterlocutor: number) {
		try {
			console.log('⚡ ChatsService.getTtRestrictions called for:', { profileId: profileIdInput, idInterlocutor });

			// Отримуємо доступні профілі
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			if (accessibleProfiles.length === 0) {
				throw new ForbiddenException('No accessible profiles found');
			}

			// Вибираємо потрібний профіль за profileId
			const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput) || accessibleProfiles[0];
			const profileId = parseInt(targetProfile.profileId);

			console.log('⚡ Using profile for TT restrictions:', {
				profileId,
				idInterlocutor,
				displayName: targetProfile.displayName
			});

			// Викликаємо метод провайдера для gRPC запиту
			if (!this.provider.getTtRestrictions) {
				throw new Error('getTtRestrictions method not supported by provider');
			}
			
			const result = await this.provider.getTtRestrictions(this.toCtx(auth), profileId, idInterlocutor);
			
			console.log('⚡ TT restrictions result:', result);
			return result;

		} catch (error) {
			console.error(`💥 ПОМИЛКА в ChatsService.getTtRestrictions:`, error);
			throw error;
		}
	}

	async sendExclusivePost(auth: RequestAuthContext, body: { profileId: number; idRegularUser: number; idsGalleryPhotos: number[]; idsGalleryVideos: number[]; text: string }) {
		try {
			const { profileId, idRegularUser, idsGalleryPhotos = [], idsGalleryVideos = [], text = '' } = body;
			console.log('📝 ChatsService.sendExclusivePost:', { profileId, idRegularUser, photos: idsGalleryPhotos.length, videos: idsGalleryVideos.length, textLen: text.length });

			// Перевіряємо доступ до профілю
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileId);
			if (!targetProfile) {
				throw new ForbiddenException(`Access denied to profile ${profileId}`);
			}

			if (!this.provider.sendExclusivePost) {
				throw new Error('sendExclusivePost not supported by provider');
			}

			const result = await this.provider.sendExclusivePost(profileId, idRegularUser, { idsGalleryPhotos, idsGalleryVideos, text });
			console.log('✅ ChatsService.sendExclusivePost result:', result);
			return result;
		} catch (error) {
			console.error('💥 ПОМИЛКА в ChatsService.sendExclusivePost:', error);
			throw error;
		}
	}

	/**
	 * Отримує заборонені категорії для кореспонденції (forbidden-tags)
	 */
	async getForbiddenCorrespondenceTags(auth: RequestAuthContext, profileIdInput: number, idInterlocutor: number) {
		try {
			console.log('⚠️ ChatsService.getForbiddenCorrespondenceTags called for:', { profileId: profileIdInput, idInterlocutor });

			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			if (accessibleProfiles.length === 0) {
				throw new ForbiddenException('No accessible profiles found');
			}

			const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput) || accessibleProfiles[0];
			const profileId = parseInt(targetProfile.profileId);

			if (!this.provider.getForbiddenCorrespondenceTags) {
				throw new Error('getForbiddenCorrespondenceTags method not supported by provider');
			}

			const result = await this.provider.getForbiddenCorrespondenceTags(profileId, idInterlocutor);
			console.log('⚠️ Forbidden-tags result:', result);
			return result;
		} catch (error) {
			console.error('💥 ПОМИЛКА в ChatsService.getForbiddenCorrespondenceTags:', error);
			throw error;
		}
	}

	async sendLetter(auth: RequestAuthContext, profileIdInput: number, idUserTo: number, payload: { content: string; photoIds?: number[]; videoIds?: number[] }) {
		try {
			// Валідація обмежень
			const text = (payload.content || '').trim();
			if (text.length < 300) throw new Error('Мінімальна довжина листа 300 символів');
			if (text.length > 3000) throw new Error('Максимальна довжина листа 3000 символів');
			const photoIds = (payload.photoIds || []).slice(0, 10);
			const videoIds = (payload.videoIds || []).slice(0, 10);

			// Доступ до профілю
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput);
			if (!targetProfile) throw new ForbiddenException(`Access denied to profile ${profileIdInput}`);

			if (!this.provider.sendLetter) throw new Error('sendLetter not supported by provider');
			return await this.provider.sendLetter(profileIdInput, idUserTo, { content: text, photoIds, videoIds });
		} catch (error) {
			console.error('💥 ПОМИЛКА в ChatsService.sendLetter:', error);
			throw error;
		}
	}

	async getPostDetails(auth: RequestAuthContext, idPost: number, idProfile: number, idInterlocutor: number) {
		try {
			console.log('📄 ChatsService.getPostDetails called:', { idPost, idProfile, idInterlocutor });

			// Доступ до профілю
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			console.log('🔍 Accessible profiles:', accessibleProfiles.map(p => ({ id: p.profileId, name: p.displayName })));
			const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === idProfile);
			console.log('🎯 Target profile search:', { lookingFor: idProfile, found: !!targetProfile, profile: targetProfile });
			if (!targetProfile) throw new ForbiddenException(`Access denied to profile ${idProfile}`);

			// Викликаємо метод провайдера
			if (!this.provider.getPostDetails) throw new Error('getPostDetails not supported by provider');
			const result = await this.provider.getPostDetails(idPost, idProfile, idInterlocutor, this.toCtx(auth));

			console.log('✅ ChatsService.getPostDetails success:', { idPost, hasPhotos: result.photos?.length || 0, hasVideos: result.videos?.length || 0 });
			return result;
		} catch (error) {
			console.error('💥 ПОМИЛКА в ChatsService.getPostDetails:', error);
			throw error;
		}
	}

	async getConnections(auth: RequestAuthContext, profileIdInput: number, idsInterlocutor: number[]) {
		try {
			// Доступ до профілю
			const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
			const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput);
			if (!targetProfile) throw new ForbiddenException(`Access denied to profile ${profileIdInput}`);

			if (!(this.provider as any).getConnections) {
				throw new Error('getConnections not supported by provider');
			}

			const result = await (this.provider as any).getConnections(targetProfile.profileId, idsInterlocutor);
			return result;
		} catch (error) {
			console.error('💥 ПОМИЛКА в ChatsService.getConnections:', error);
			throw error;
		}
	}
}
