import type { Request } from 'express';
import type { SiteProvider } from '../providers/site-provider.interface';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';
export declare class TTCompatController {
    private readonly tt;
    private readonly rtmService;
    constructor(tt: SiteProvider, rtmService: TalkyTimesRTMService);
    getRtmStatus(): Promise<{
        status: string;
        connectedProfiles: number[];
        totalProfiles: number;
        timestamp: string;
    }>;
    emailsHistory(_req: Request, body: {
        page?: number;
        limit?: number;
        id_correspondence: string;
        id_interlocutor: string;
        id_user: string;
        without_translation?: boolean;
    }): Promise<any>;
}
