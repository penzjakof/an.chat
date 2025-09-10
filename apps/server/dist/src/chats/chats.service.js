"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatsService = void 0;
const common_1 = require("@nestjs/common");
const providers_module_1 = require("../providers/providers.module");
const chats_gateway_1 = require("./chats.gateway");
const chat_access_service_1 = require("./chat-access.service");
let ChatsService = class ChatsService {
    provider;
    chatAccess;
    gateway;
    profilesCache = new Map();
    CACHE_TTL = 5 * 60 * 1000;
    constructor(provider, chatAccess, gateway) {
        this.provider = provider;
        this.chatAccess = chatAccess;
        this.gateway = gateway;
    }
    toCtx(auth) {
        return { agencyCode: auth.agencyCode, operatorCode: auth.operatorCode };
    }
    async getCachedAccessibleProfiles(auth) {
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
    processCriteria(filters) {
        const criteria = [];
        if (!filters?.status || filters.status === 'active') {
            criteria.push('active');
        }
        else if (filters.status === 'bookmarked') {
            criteria.push('bookmarked');
        }
        else if (filters.status === 'unanswered') {
            criteria.push('unanswered');
        }
        if (filters?.onlineOnly) {
            criteria.push('online');
        }
        return criteria;
    }
    async fetchDialogs(auth, filters) {
        const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
        const profilesCount = accessibleProfiles.filter(p => p?.profileId).length;
        let perProfileLimit = 15;
        if (profilesCount > 15) {
            perProfileLimit = 5;
        }
        else if (profilesCount > 10) {
            perProfileLimit = 10;
        }
        console.log('📊 Per-profile dialogs limit:', { profilesCount, perProfileLimit });
        if (accessibleProfiles.length === 0) {
            return {
                dialogs: [],
                cursor: '',
                profiles: {},
                sourceProfiles: []
            };
        }
        if (!this.provider.fetchDialogsByProfile) {
            const dialogs = await this.provider.fetchDialogs(this.toCtx(auth), filters);
            return this.chatAccess.filterDialogsByAccess(dialogs, auth);
        }
        const fetchDialogsByProfile = this.provider.fetchDialogsByProfile.bind(this.provider);
        const allDialogs = [];
        const profileCursors = {};
        let hasMoreAny = false;
        let inputCursors = {};
        if (filters?.cursor) {
            try {
                inputCursors = JSON.parse(filters.cursor);
            }
            catch {
                console.log(`📄 Using legacy cursor format: ${filters.cursor}`);
            }
        }
        const criteria = this.processCriteria(filters);
        console.log(`ChatsService.fetchDialogs: filters=`, filters, 'criteria=', criteria, 'inputCursors=', inputCursors);
        const fetchPromises = accessibleProfiles
            .filter(p => p?.profileId)
            .map(async (profile) => {
            const profileCursor = inputCursors[profile.profileId] || '';
            console.log(`🔄 Fetching dialogs for profile ${profile.profileId} with cursor: "${profileCursor}"`);
            try {
                const profileDialogs = await fetchDialogsByProfile(profile.profileId, criteria, profileCursor, perProfileLimit);
                return { profileId: profile.profileId, ok: true, data: profileDialogs };
            }
            catch (error) {
                return { profileId: profile.profileId, ok: false, error };
            }
        });
        const results = await Promise.allSettled(fetchPromises);
        for (const r of results) {
            if (r.status === 'fulfilled') {
                const { profileId, ok, data, error } = r.value;
                if (!ok) {
                    console.warn(`Failed to fetch dialogs for profile ${profileId}:`, error instanceof Error ? error.message : 'Unknown error');
                    continue;
                }
                if (data && typeof data === 'object' && 'dialogs' in data) {
                    const dialogsData = data;
                    if (Array.isArray(dialogsData.dialogs)) {
                        console.log(`📄 Profile ${profileId}: loaded ${dialogsData.dialogs.length} dialogs, cursor: "${dialogsData.cursor}", hasMore: ${dialogsData.hasMore}`);
                        allDialogs.push(...dialogsData.dialogs);
                        if (dialogsData.cursor) {
                            profileCursors[profileId] = dialogsData.cursor;
                        }
                        if (dialogsData.hasMore !== false) {
                            hasMoreAny = true;
                        }
                    }
                }
            }
            else {
                console.warn('Failed to fetch dialogs for a profile:', r.reason);
            }
        }
        if ((filters?.status === 'unanswered') && this.provider.getUnansweredMails) {
            const mailPromises = accessibleProfiles
                .filter(p => p?.profileId)
                .map(async (profile) => {
                try {
                    const mailsRes = await this.provider.getUnansweredMails(profile.profileId, 0, perProfileLimit);
                    return { profileId: profile.profileId, ok: true, mailsRes };
                }
                catch (err) {
                    return { profileId: profile.profileId, ok: false, error: err };
                }
            });
            const mailResults = await Promise.allSettled(mailPromises);
            for (const mr of mailResults) {
                if (mr.status !== 'fulfilled')
                    continue;
                const { profileId, ok, mailsRes, error } = mr.value;
                if (!ok) {
                    console.warn(`⚠️ Failed to fetch unanswered mails for profile ${profileId}:`, error instanceof Error ? error.message : 'Unknown error');
                    continue;
                }
                if (mailsRes?.success && mailsRes.data?.data?.mails && Array.isArray(mailsRes.data.data.mails)) {
                    const mails = mailsRes.data.data.mails;
                    const safeMails = mails.filter(m => m?.isTrustedUserAbused !== true);
                    for (const mail of safeMails) {
                        const idUser = parseInt(profileId);
                        const idInterlocutor = mail?.idRegularUser;
                        if (!idUser || !idInterlocutor)
                            continue;
                        const last = mail?.correspondence?.last || {};
                        const ts = Number(last?.date_created);
                        const dateUpdated = ts ? new Date((ts > 2_000_000_000 ? ts : ts * 1000)).toISOString() : new Date().toISOString();
                        const emailDialog = {
                            idUser,
                            idInterlocutor,
                            dateUpdated,
                            lastMessage: { content: { message: last?.title || 'Новий лист' } },
                            __email: true,
                            __emailBadge: true,
                            __correspondenceId: mail?.id,
                            messagesLeft: mail?.messagesLeft
                        };
                        allDialogs.push(emailDialog);
                    }
                }
            }
        }
        allDialogs.sort((a, b) => {
            const dateA = new Date(a.dateUpdated || 0).getTime();
            const dateB = new Date(b.dateUpdated || 0).getTime();
            return dateB - dateA;
        });
        const userIds = new Set();
        allDialogs.forEach(dialog => {
            if (dialog.idInterlocutor) {
                userIds.add(dialog.idInterlocutor);
            }
        });
        const profilesMap = {};
        if (userIds.size > 0 && this.provider.fetchProfiles && accessibleProfiles.length > 0) {
            const remaining = new Set(Array.from(userIds));
            const MAX_CHUNK = 50;
            for (const candidate of accessibleProfiles) {
                if (remaining.size === 0)
                    break;
                const candidateProfileId = candidate?.profileId;
                if (!candidateProfileId)
                    continue;
                const idsArray = Array.from(remaining);
                for (let i = 0; i < idsArray.length; i += MAX_CHUNK) {
                    const chunk = idsArray.slice(i, i + MAX_CHUNK);
                    try {
                        const result = await this.provider.fetchProfiles(candidateProfileId, chunk);
                        if (result?.success && Array.isArray(result.profiles)) {
                            for (const raw of result.profiles) {
                                const rawId = raw.id ?? raw.id_user;
                                const id = typeof rawId === 'number' ? rawId : parseInt(String(rawId));
                                if (Number.isNaN(id))
                                    continue;
                                const personal = raw.personal || {};
                                profilesMap[id] = {
                                    id,
                                    id_user: raw.id_user ?? id,
                                    name: raw.name ?? personal?.name ?? `User ${id}`,
                                    personal: {
                                        avatar_small: personal?.avatar_small || '',
                                        avatar_large: personal?.avatar_large || '',
                                        avatar_xl: personal?.avatar_xl || '',
                                        age: typeof personal?.age === 'number' ? personal.age : (personal?.age ? parseInt(String(personal.age)) || 0 : 0)
                                    },
                                    is_online: Boolean(raw.is_online),
                                    is_blocked: raw.is_blocked === true,
                                    last_visit: raw.last_visit || ''
                                };
                                remaining.delete(id);
                            }
                            console.log(`✅ Loaded profiles chunk (${chunk.length}) using session ${candidateProfileId}. Remaining: ${remaining.size}`);
                        }
                        else {
                            console.warn(`⚠️ fetchProfiles returned no profiles for chunk (${chunk.length}) using ${candidateProfileId}`);
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ fetchProfiles failed for session ${candidateProfileId} (chunk size ${chunk.length}):`, err?.message || String(err));
                        continue;
                    }
                    if (remaining.size === 0)
                        break;
                }
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
    async fetchMessages(auth, dialogId, cursor) {
        try {
            console.log(`🔍 ChatsService.fetchMessages called for dialog: ${dialogId}`);
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            console.log(`📋 Accessible profiles:`, accessibleProfiles.map(p => ({ id: p.id, profileId: p.profileId, displayName: p.displayName })));
            const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
            console.log(`🔢 Parsed dialogId: idUser=${idUser}, idInterlocutor=${idInterlocutor}`);
            const targetProfile = accessibleProfiles.find(profile => profile.profileId === idUser.toString());
            console.log(`🎯 Target profile:`, targetProfile ? { id: targetProfile.id, profileId: targetProfile.profileId, displayName: targetProfile.displayName } : 'not found');
            if (!targetProfile || !targetProfile.profileId) {
                throw new Error(`No authenticated profile found for this dialog. Looking for profileId: ${idUser}`);
            }
            let effectiveCursor = cursor;
            if (!effectiveCursor) {
                console.log(`🔄 No cursor provided, will fetch latest messages (idLastMessage=undefined)`);
                effectiveCursor = undefined;
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
                }
                catch (error) {
                    console.error(`❌ Error in fetchMessagesByProfile:`, error);
                    throw error;
                }
            }
            return this.provider.fetchMessages(this.toCtx(auth), dialogId, cursor);
        }
        catch (error) {
            console.error(`💥 КРИТИЧНА ПОМИЛКА в ChatsService.fetchMessages:`, error);
            throw error;
        }
    }
    async sendText(auth, dialogId, text) {
        const result = await this.provider.sendTextMessage(this.toCtx(auth), dialogId, text);
        try {
            const [idUser, idInterlocutor] = dialogId.split('-').map(Number);
            const payload = {
                id: result?.idMessage || Date.now(),
                idUserFrom: idUser,
                idUserTo: idInterlocutor,
                type: 'message',
                content: { message: text },
                message: text,
                dateCreated: new Date().toISOString()
            };
            this.gateway?.emitNewMessage({ dialogId, payload });
        }
        catch (e) {
        }
        return result;
    }
    async getAccessibleProfiles(auth) {
        return this.getCachedAccessibleProfiles(auth);
    }
    async fetchUserProfiles(profileId, userIds) {
        if (this.provider.fetchProfiles) {
            return this.provider.fetchProfiles(profileId, userIds);
        }
        return { profiles: [] };
    }
    async getOriginalPhotoUrl(auth, profileId, idRegularUser, previewUrl) {
        try {
            if (!this.provider.getOriginalPhotoUrl) {
                throw new Error('getOriginalPhotoUrl not supported by provider');
            }
            const res = await this.provider.getOriginalPhotoUrl(profileId, idRegularUser, previewUrl);
            return res;
        }
        catch (error) {
            console.error('💥 ПОМИЛКА в ChatsService.getOriginalPhotoUrl:', error);
            throw error;
        }
    }
    async searchDialogByPair(auth, profileId, clientId) {
        try {
            console.log(`🔍 ChatsService.searchDialogByPair: profileId=${profileId}, clientId=${clientId}`);
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            const targetProfile = accessibleProfiles.find(p => p.profileId === profileId);
            if (!targetProfile) {
                throw new common_1.ForbiddenException(`Profile ${profileId} is not accessible`);
            }
            if (!this.provider.searchDialogByPair) {
                throw new Error('Search dialog by pair is not supported by this provider');
            }
            const result = await this.provider.searchDialogByPair(profileId, parseInt(clientId));
            if (result && result.dialog) {
                const clientIds = [result.dialog.idInterlocutor];
                const profilesResult = await this.fetchUserProfiles(profileId, clientIds);
                return {
                    dialog: result.dialog,
                    profiles: profilesResult.profiles || {}
                };
            }
            return { dialog: null, profiles: {} };
        }
        catch (error) {
            console.error(`💥 ПОМИЛКА в ChatsService.searchDialogByPair:`, error);
            throw error;
        }
    }
    async fetchRestrictions(auth, dialogId) {
        try {
            console.log(`🔍 ChatsService.fetchRestrictions: dialogId=${dialogId}`);
            const [profileId, clientId] = dialogId.split('-');
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            const targetProfile = accessibleProfiles.find(p => p.profileId === profileId);
            if (!targetProfile) {
                throw new common_1.ForbiddenException(`Profile ${profileId} is not accessible`);
            }
            if (!this.provider.fetchRestrictions) {
                throw new Error('Fetch restrictions is not supported by this provider');
            }
            const result = await this.provider.fetchRestrictions(profileId, parseInt(clientId));
            if (result.success) {
                return {
                    lettersLeft: result.lettersLeft || 0
                };
            }
            else {
                throw new Error(result.error || 'Failed to fetch restrictions');
            }
        }
        catch (error) {
            console.error(`💥 ПОМИЛКА в ChatsService.fetchRestrictions:`, error);
            throw error;
        }
    }
    async sendPhoto(auth, sendPhotoDto) {
        console.log(`📸 ChatsService.sendPhoto: Sending ${sendPhotoDto.photoIds.length} photos from profile ${sendPhotoDto.idProfile} to user ${sendPhotoDto.idRegularUser}`);
        try {
            const accessibleProfiles = await this.getAccessibleProfiles(auth);
            const targetProfile = accessibleProfiles.find(p => p.profileId === sendPhotoDto.idProfile);
            if (!targetProfile) {
                throw new common_1.ForbiddenException(`Access denied to profile ${sendPhotoDto.idProfile}`);
            }
            if (!this.provider.sendPhoto) {
                throw new Error('Provider does not support photo sending');
            }
            const results = [];
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
                    }
                    catch { }
                }
                else {
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
        }
        catch (error) {
            console.error(`💥 ПОМИЛКА в ChatsService.sendPhoto:`, error);
            throw error;
        }
    }
    async getStickers(auth, interlocutorId) {
        console.log(`😀 ChatsService.getStickers: interlocutorId=${interlocutorId}`);
        try {
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            if (accessibleProfiles.length === 0) {
                throw new common_1.ForbiddenException('No accessible profiles found');
            }
            const targetProfile = accessibleProfiles.find(p => p.profileId);
            if (!targetProfile || !targetProfile.profileId) {
                throw new common_1.ForbiddenException('No valid profile found');
            }
            if (!this.provider.getStickers) {
                throw new Error('Stickers are not supported by this provider');
            }
            const result = await this.provider.getStickers(targetProfile.profileId, interlocutorId);
            if (result.success) {
                return { categories: result.categories || [] };
            }
            else {
                throw new Error(result.error || 'Failed to fetch stickers');
            }
        }
        catch (error) {
            console.error(`💥 ПОМИЛКА в ChatsService.getStickers:`, error);
            throw error;
        }
    }
    async sendSticker(auth, params) {
        console.log(`😀 ChatsService.sendSticker: profile ${params.idProfile} → user ${params.idRegularUser}, sticker ${params.stickerId}`);
        try {
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            const targetProfile = accessibleProfiles.find(p => p.profileId === params.idProfile.toString());
            if (!targetProfile) {
                throw new common_1.ForbiddenException(`Access denied to profile ${params.idProfile}`);
            }
            const useNewMethod = !params.stickerUrl;
            if (useNewMethod && this.provider.sendStickerById) {
                const result = await this.provider.sendStickerById(params.idProfile.toString(), params.idRegularUser, params.stickerId);
                if (result.success) {
                    console.log(`✅ Sticker sent successfully (by ID)`);
                    return result;
                }
                else {
                    throw new Error(result.error || 'Failed to send sticker');
                }
            }
            else if (this.provider.sendSticker) {
                const result = await this.provider.sendSticker(this.toCtx(auth), params);
                if (result.success) {
                    console.log(`✅ Sticker sent successfully (by URL)`);
                    return result;
                }
                else {
                    throw new Error(result.error || 'Failed to send sticker');
                }
            }
            else {
                throw new Error('Sticker sending is not supported by this provider');
            }
        }
        catch (error) {
            console.error(`💥 ПОМИЛКА в ChatsService.sendSticker:`, error);
            throw error;
        }
    }
    async getTtRestrictions(auth, profileIdInput, idInterlocutor) {
        try {
            console.log('⚡ ChatsService.getTtRestrictions called for:', { profileId: profileIdInput, idInterlocutor });
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            if (accessibleProfiles.length === 0) {
                throw new common_1.ForbiddenException('No accessible profiles found');
            }
            const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput) || accessibleProfiles[0];
            const profileId = parseInt(targetProfile.profileId);
            console.log('⚡ Using profile for TT restrictions:', {
                profileId,
                idInterlocutor,
                displayName: targetProfile.displayName
            });
            if (!this.provider.getTtRestrictions) {
                throw new Error('getTtRestrictions method not supported by provider');
            }
            const result = await this.provider.getTtRestrictions(this.toCtx(auth), profileId, idInterlocutor);
            console.log('⚡ TT restrictions result:', result);
            return result;
        }
        catch (error) {
            console.error(`💥 ПОМИЛКА в ChatsService.getTtRestrictions:`, error);
            throw error;
        }
    }
    async sendExclusivePost(auth, body) {
        try {
            const { profileId, idRegularUser, idsGalleryPhotos = [], idsGalleryVideos = [], text = '' } = body;
            console.log('📝 ChatsService.sendExclusivePost:', { profileId, idRegularUser, photos: idsGalleryPhotos.length, videos: idsGalleryVideos.length, textLen: text.length });
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileId);
            if (!targetProfile) {
                throw new common_1.ForbiddenException(`Access denied to profile ${profileId}`);
            }
            if (!this.provider.sendExclusivePost) {
                throw new Error('sendExclusivePost not supported by provider');
            }
            const result = await this.provider.sendExclusivePost(profileId, idRegularUser, { idsGalleryPhotos, idsGalleryVideos, text });
            console.log('✅ ChatsService.sendExclusivePost result:', result);
            return result;
        }
        catch (error) {
            console.error('💥 ПОМИЛКА в ChatsService.sendExclusivePost:', error);
            throw error;
        }
    }
    async getForbiddenCorrespondenceTags(auth, profileIdInput, idInterlocutor) {
        try {
            console.log('⚠️ ChatsService.getForbiddenCorrespondenceTags called for:', { profileId: profileIdInput, idInterlocutor });
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            if (accessibleProfiles.length === 0) {
                throw new common_1.ForbiddenException('No accessible profiles found');
            }
            const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput) || accessibleProfiles[0];
            const profileId = parseInt(targetProfile.profileId);
            if (!this.provider.getForbiddenCorrespondenceTags) {
                throw new Error('getForbiddenCorrespondenceTags method not supported by provider');
            }
            const result = await this.provider.getForbiddenCorrespondenceTags(profileId, idInterlocutor);
            console.log('⚠️ Forbidden-tags result:', result);
            return result;
        }
        catch (error) {
            console.error('💥 ПОМИЛКА в ChatsService.getForbiddenCorrespondenceTags:', error);
            throw error;
        }
    }
    async sendLetter(auth, profileIdInput, idUserTo, payload) {
        try {
            const text = (payload.content || '').trim();
            if (text.length < 300)
                throw new Error('Мінімальна довжина листа 300 символів');
            if (text.length > 3000)
                throw new Error('Максимальна довжина листа 3000 символів');
            const photoIds = (payload.photoIds || []).slice(0, 10);
            const videoIds = (payload.videoIds || []).slice(0, 10);
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput);
            if (!targetProfile)
                throw new common_1.ForbiddenException(`Access denied to profile ${profileIdInput}`);
            if (!this.provider.sendLetter)
                throw new Error('sendLetter not supported by provider');
            return await this.provider.sendLetter(profileIdInput, idUserTo, { content: text, photoIds, videoIds });
        }
        catch (error) {
            console.error('💥 ПОМИЛКА в ChatsService.sendLetter:', error);
            throw error;
        }
    }
    async getPostDetails(auth, idPost, idProfile, idInterlocutor) {
        try {
            console.log('📄 ChatsService.getPostDetails called:', { idPost, idProfile, idInterlocutor });
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            console.log('🔍 Accessible profiles:', accessibleProfiles.map(p => ({ id: p.profileId, name: p.displayName })));
            const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === idProfile);
            console.log('🎯 Target profile search:', { lookingFor: idProfile, found: !!targetProfile, profile: targetProfile });
            if (!targetProfile)
                throw new common_1.ForbiddenException(`Access denied to profile ${idProfile}`);
            if (!this.provider.getPostDetails)
                throw new Error('getPostDetails not supported by provider');
            const result = await this.provider.getPostDetails(idPost, idProfile, idInterlocutor, this.toCtx(auth));
            console.log('✅ ChatsService.getPostDetails success:', { idPost, hasPhotos: result.photos?.length || 0, hasVideos: result.videos?.length || 0 });
            return result;
        }
        catch (error) {
            console.error('💥 ПОМИЛКА в ChatsService.getPostDetails:', error);
            throw error;
        }
    }
    async getConnections(auth, profileIdInput, idsInterlocutor) {
        try {
            const accessibleProfiles = await this.getCachedAccessibleProfiles(auth);
            const targetProfile = accessibleProfiles.find(p => parseInt(p.profileId) === profileIdInput);
            if (!targetProfile)
                throw new common_1.ForbiddenException(`Access denied to profile ${profileIdInput}`);
            if (!this.provider.getConnections) {
                throw new Error('getConnections not supported by provider');
            }
            const result = await this.provider.getConnections(targetProfile.profileId, idsInterlocutor);
            return result;
        }
        catch (error) {
            console.error('💥 ПОМИЛКА в ChatsService.getConnections:', error);
            throw error;
        }
    }
};
exports.ChatsService = ChatsService;
exports.ChatsService = ChatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(providers_module_1.TALKY_TIMES_PROVIDER)),
    __param(2, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, chat_access_service_1.ChatAccessService,
        chats_gateway_1.ChatsGateway])
], ChatsService);
//# sourceMappingURL=chats.service.js.map