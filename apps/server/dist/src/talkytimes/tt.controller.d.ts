import type { Request } from 'express';
import type { SiteProvider } from '../providers/site-provider.interface';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';
export declare class TTController {
    private readonly tt;
    private readonly rtmService;
    constructor(tt: SiteProvider, rtmService: TalkyTimesRTMService);
    dialogs(req: Request, search?: string, status?: string): Promise<unknown>;
    messages(req: Request, id: string, cursor?: string): Promise<unknown>;
    emailsHistory(req: Request, body: {
        page?: number;
        limit?: number;
        id_correspondence: string;
        id_interlocutor: string;
        id_user: string;
        without_translation?: boolean;
    }): Promise<any>;
    getRtmStatus(): Promise<{
        status: string;
        connectedProfiles: number[];
        totalProfiles: number;
        timestamp: string;
    }>;
    getActiveSessions(): Promise<{
        connections: Record<number, boolean>;
        timestamp: string;
    }>;
    testToast(body: {
        idUserFrom: number;
        idUserTo: number;
        message?: string;
    }): Promise<{
        success: boolean;
        testData: {
            messageId: number;
            idUserFrom: number;
            idUserTo: number;
            dateCreated: string;
            content: {
                message: string;
            };
        };
    }>;
}
