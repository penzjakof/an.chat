import type { Request } from 'express';
import { ChatsService } from './chats.service';
import { SendPhotoDto } from './dto/send-photo.dto';
export declare class ChatsController {
    private readonly chats;
    constructor(chats: ChatsService);
    dialogs(req: Request, filters: {
        status?: string;
        search?: string;
        onlineOnly?: string;
        cursor?: string;
    }): Promise<unknown>;
    searchDialog(req: Request, query: {
        profileId: string;
        clientId: string;
    }): Promise<{
        dialog: any;
        profiles: {};
    }>;
    restrictions(req: Request, id: string): Promise<{
        lettersLeft: number;
    }>;
    messages(req: Request, id: string, cursor?: string): Promise<unknown>;
    sendText(req: Request, id: string, body: {
        text: string;
    }): Promise<unknown>;
    getProfiles(ids: string, req: Request): Promise<{
        success: boolean;
        profiles?: any[];
        error?: string;
    } | {
        profiles: never[];
    }>;
    sendPhoto(req: Request, sendPhotoDto: SendPhotoDto): Promise<{
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
    getStickers(req: Request, body: {
        idInterlocutor: number;
    }): Promise<unknown>;
    sendSticker(req: Request, body: {
        idProfile?: number;
        idRegularUser: number;
        stickerId: number;
        stickerUrl?: string;
    }): Promise<unknown>;
    getTtRestrictions(req: Request, body: {
        profileId: number;
        idInterlocutor: number;
    }): Promise<{
        success: boolean;
        hasExclusivePosts?: boolean;
        categories?: string[];
        categoryCounts?: Record<string, number>;
        tier?: "special" | "specialplus";
        error?: string;
    }>;
    getForbiddenTags(req: Request, body: {
        profileId: number;
        idInterlocutor: number;
    }): Promise<{
        success: boolean;
        tags?: string[];
        error?: string;
    }>;
    sendLetter(req: Request, body: {
        profileId: number;
        idUserTo: number;
        content: string;
        photoIds?: number[];
        videoIds?: number[];
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    sendExclusivePost(req: Request, body: {
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
    getPostDetails(req: Request, body: {
        idPost: number;
        idProfile: number;
        idInterlocutor: number;
    }): Promise<any>;
    getOriginalPhoto(req: Request, body: {
        profileId: string;
        idRegularUser: number;
        previewUrl: string;
    }): Promise<any>;
    getConnections(req: Request, body: {
        profileId: number;
        idsInterlocutor: number[];
    }): Promise<any>;
}
