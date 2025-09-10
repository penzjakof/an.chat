import type { SiteProvider, DialogsFilters } from '../providers/site-provider.interface';
import type { RequestAuthContext } from '../common/auth/auth.types';
import { ChatsGateway } from './chats.gateway';
import { ChatAccessService } from './chat-access.service';
import { SendPhotoDto } from './dto/send-photo.dto';
export declare class ChatsService {
    private readonly provider;
    private readonly chatAccess;
    private readonly gateway?;
    private profilesCache;
    private readonly CACHE_TTL;
    constructor(provider: SiteProvider, chatAccess: ChatAccessService, gateway?: ChatsGateway | undefined);
    private toCtx;
    private getCachedAccessibleProfiles;
    private processCriteria;
    fetchDialogs(auth: RequestAuthContext, filters?: DialogsFilters): Promise<unknown>;
    fetchMessages(auth: RequestAuthContext, dialogId: string, cursor?: string): Promise<unknown>;
    sendText(auth: RequestAuthContext, dialogId: string, text: string): Promise<unknown>;
    getAccessibleProfiles(auth: RequestAuthContext): Promise<any[]>;
    fetchUserProfiles(profileId: string, userIds: number[]): Promise<{
        success: boolean;
        profiles?: any[];
        error?: string;
    } | {
        profiles: never[];
    }>;
    getOriginalPhotoUrl(auth: RequestAuthContext, profileId: string, idRegularUser: number, previewUrl: string): Promise<any>;
    searchDialogByPair(auth: RequestAuthContext, profileId: string, clientId: string): Promise<{
        dialog: any;
        profiles: {};
    }>;
    fetchRestrictions(auth: RequestAuthContext, dialogId: string): Promise<{
        lettersLeft: number;
    }>;
    sendPhoto(auth: RequestAuthContext, sendPhotoDto: SendPhotoDto): Promise<{
        success: boolean;
        results: {
            photoId: number;
            success: boolean;
            messageId?: any;
            error?: string;
        }[];
        successCount: number;
        totalCount: number;
    }>;
    getStickers(auth: RequestAuthContext, interlocutorId: number): Promise<unknown>;
    sendSticker(auth: RequestAuthContext, params: {
        idProfile: number;
        idRegularUser: number;
        stickerId: number;
        stickerUrl?: string;
    }): Promise<unknown>;
    getTtRestrictions(auth: RequestAuthContext, profileIdInput: number, idInterlocutor: number): Promise<{
        success: boolean;
        hasExclusivePosts?: boolean;
        categories?: string[];
        categoryCounts?: Record<string, number>;
        tier?: "special" | "specialplus";
        error?: string;
    }>;
    sendExclusivePost(auth: RequestAuthContext, body: {
        profileId: number;
        idRegularUser: number;
        idsGalleryPhotos: number[];
        idsGalleryVideos: number[];
        text: string;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getForbiddenCorrespondenceTags(auth: RequestAuthContext, profileIdInput: number, idInterlocutor: number): Promise<{
        success: boolean;
        tags?: string[];
        error?: string;
    }>;
    sendLetter(auth: RequestAuthContext, profileIdInput: number, idUserTo: number, payload: {
        content: string;
        photoIds?: number[];
        videoIds?: number[];
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getPostDetails(auth: RequestAuthContext, idPost: number, idProfile: number, idInterlocutor: number): Promise<any>;
    getConnections(auth: RequestAuthContext, profileIdInput: number, idsInterlocutor: number[]): Promise<any>;
}
