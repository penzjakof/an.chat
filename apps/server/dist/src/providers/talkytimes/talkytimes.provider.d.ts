import type { ProviderRequestContext, SiteProvider, DialogsFilters } from '../site-provider.interface';
import { TalkyTimesSessionService } from './session.service';
import { ConnectionPoolService } from '../../common/http/connection-pool.service';
export declare class TalkyTimesProvider implements SiteProvider {
    private readonly baseUrl;
    private readonly sessionService;
    private readonly connectionPool;
    private stickersCache;
    private readonly STICKERS_CACHE_TTL;
    constructor(baseUrl: string, sessionService: TalkyTimesSessionService, connectionPool: ConnectionPoolService);
    private fetchWithConnectionPool;
    makeRequest(options: {
        method: 'GET' | 'POST' | 'PUT' | 'DELETE';
        url: string;
        data?: any;
        profileId: number;
        headers?: Record<string, string>;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    sendPhoto(ctx: ProviderRequestContext, params: {
        idProfile: number;
        idRegularUser: number;
        idPhoto: number;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    private isMock;
    private _lastMockState?;
    private getOperatorRef;
    private applyOperatorRefHeader;
    private buildHeaders;
    fetchDialogs(ctx: ProviderRequestContext, filters?: DialogsFilters): Promise<unknown>;
    fetchDialogsByProfile(profileId: string, criteria?: string[], cursor?: string, limit?: number): Promise<unknown>;
    fetchMessages(ctx: ProviderRequestContext, dialogId: string, cursor?: string): Promise<unknown>;
    fetchMessagesByProfile(profileId: string, dialogId: string, cursor?: string): Promise<{
        success: boolean;
        messages?: any[];
        error?: string;
    }>;
    sendTextMessage(ctx: ProviderRequestContext, dialogId: string, text: string): Promise<unknown>;
    getOriginalPhotoUrl(profileId: string, idRegularUser: number, previewUrl: string): Promise<{
        success: boolean;
        url?: string;
        error?: string;
    }>;
    getUnansweredMails(profileId: string, offset?: number, limit?: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    fetchProfileData(profileId: string): Promise<{
        success: boolean;
        profileData?: any;
        error?: string;
    }>;
    fetchProfiles(profileId: string, userIds: number[]): Promise<{
        success: boolean;
        profiles?: any[];
        error?: string;
    }>;
    fetchClientPhotos(profileId: string, clientId: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getConnections(profileId: string, idsInterlocutor: number[]): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    validateCredentials(email: string, password: string): Promise<{
        success: boolean;
        error?: string;
        profileId?: string;
    }>;
    searchDialogByPair(profileId: string, clientId: number): Promise<{
        success: boolean;
        dialog?: any;
        error?: string;
    }>;
    fetchRestrictions(profileId: string, clientId: number): Promise<{
        success: boolean;
        lettersLeft?: number;
        error?: string;
    }>;
    getStickers(profileId: string, interlocutorId: number): Promise<{
        success: boolean;
        categories?: any[];
        error?: string;
    }>;
    sendSticker(ctx: ProviderRequestContext, params: {
        idProfile: number;
        idRegularUser: number;
        stickerId: number;
        stickerUrl: string;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getVirtualGiftLimits(profileId: string, clientId: number): Promise<{
        success: boolean;
        data?: {
            limit: number;
            canSendWithoutLimit: boolean;
        };
        error?: string;
    }>;
    sendStickerById(profileId: string, interlocutorId: number, stickerId: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    sendExclusivePost(profileId: number, idRegularUser: number, payload: {
        idsGalleryPhotos: number[];
        idsGalleryVideos: number[];
        text: string;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getVirtualGiftList(profileId: string, clientId: number, cursor?: string, limit?: number): Promise<{
        success: boolean;
        data?: {
            cursor: string;
            items: any[];
        };
        error?: string;
    }>;
    getEmailHistory(profileId: string, clientId: number, correspondenceId: string, page?: number, limit?: number): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getForbiddenCorrespondenceTags(profileId: number, idInterlocutor: number): Promise<{
        success: boolean;
        tags?: string[];
        error?: string;
    }>;
    sendLetter(profileId: number, idUserTo: number, payload: {
        content: string;
        photoIds?: number[];
        videoIds?: number[];
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    sendVirtualGift(profileId: string, clientId: number, giftId: number, message?: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getTtRestrictions(ctx: ProviderRequestContext, profileId: number, idInterlocutor: number): Promise<{
        success: boolean;
        hasExclusivePosts?: boolean;
        categories?: string[];
        categoryCounts?: Record<string, number>;
        tier?: 'special' | 'specialplus';
        error?: string;
    }>;
    private createGetRestrictionsBody;
    private encodeVarint;
    private decodeVarint;
    private parseGetRestrictionsResponse;
    fetchMyPublicProfile(profileId: string): Promise<{
        success: boolean;
        profileData?: any;
        error?: string;
    }>;
    fetchMyPhotos(profileId: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getPostDetails(idPost: number, idProfile: number, idInterlocutor: number, ctx: ProviderRequestContext): Promise<any>;
}
