import { ProfilesService } from './profiles.service';
import { ProviderSite } from '@prisma/client';
import type { Request } from 'express';
export declare class ProfilesController {
    private readonly profiles;
    constructor(profiles: ProfilesService);
    listAll(req: Request): import(".prisma/client").Prisma.PrismaPromise<({
        group: {
            id: string;
            name: string;
            agencyId: string;
            createdAt: Date;
            updatedAt: Date;
            activeShiftId: string | null;
        };
    } & {
        id: string;
        provider: import(".prisma/client").$Enums.ProviderSite;
        externalId: string;
        displayName: string | null;
        credentialLogin: string | null;
        credentialPassword: string | null;
        profileId: string | null;
        status: import(".prisma/client").$Enums.ProfileStatus;
        lastActiveAt: Date | null;
        groupId: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    listMy(req: Request): Promise<({
        group: {
            id: string;
            name: string;
            agencyId: string;
            createdAt: Date;
            updatedAt: Date;
            activeShiftId: string | null;
        };
    } & {
        id: string;
        provider: import(".prisma/client").$Enums.ProviderSite;
        externalId: string;
        displayName: string | null;
        credentialLogin: string | null;
        credentialPassword: string | null;
        profileId: string | null;
        status: import(".prisma/client").$Enums.ProfileStatus;
        lastActiveAt: Date | null;
        groupId: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    list(groupId: string): import(".prisma/client").Prisma.PrismaPromise<({
        group: {
            id: string;
            name: string;
            agencyId: string;
            createdAt: Date;
            updatedAt: Date;
            activeShiftId: string | null;
        };
    } & {
        id: string;
        provider: import(".prisma/client").$Enums.ProviderSite;
        externalId: string;
        displayName: string | null;
        credentialLogin: string | null;
        credentialPassword: string | null;
        profileId: string | null;
        status: import(".prisma/client").$Enums.ProfileStatus;
        lastActiveAt: Date | null;
        groupId: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    create(body: {
        groupId: string;
        provider: ProviderSite;
        displayName?: string;
        credentialLogin?: string;
        credentialPassword?: string;
    }, req: Request): Promise<{
        group: {
            id: string;
            name: string;
            agencyId: string;
            createdAt: Date;
            updatedAt: Date;
            activeShiftId: string | null;
        };
    } & {
        id: string;
        provider: import(".prisma/client").$Enums.ProviderSite;
        externalId: string;
        displayName: string | null;
        credentialLogin: string | null;
        credentialPassword: string | null;
        profileId: string | null;
        status: import(".prisma/client").$Enums.ProfileStatus;
        lastActiveAt: Date | null;
        groupId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, body: {
        displayName?: string;
        credentialLogin?: string;
        credentialPassword?: string;
        groupId?: string;
    }, req: Request): Promise<{
        group: {
            id: string;
            name: string;
            agencyId: string;
            createdAt: Date;
            updatedAt: Date;
            activeShiftId: string | null;
        };
    } & {
        id: string;
        provider: import(".prisma/client").$Enums.ProviderSite;
        externalId: string;
        displayName: string | null;
        credentialLogin: string | null;
        credentialPassword: string | null;
        profileId: string | null;
        status: import(".prisma/client").$Enums.ProfileStatus;
        lastActiveAt: Date | null;
        groupId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    delete(id: string, req: Request): Promise<{
        id: string;
        provider: import(".prisma/client").$Enums.ProviderSite;
        externalId: string;
        displayName: string | null;
        credentialLogin: string | null;
        credentialPassword: string | null;
        profileId: string | null;
        status: import(".prisma/client").$Enums.ProfileStatus;
        lastActiveAt: Date | null;
        groupId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    authenticateProfile(id: string, body: {
        login?: string;
        password: string;
    }, req: Request): Promise<{
        success: boolean;
        profileId: string | null;
        message: string;
    }>;
    getSessionStatus(id: string, req: Request): Promise<{
        authenticated: boolean;
        message: string;
        profileId?: undefined;
    } | {
        authenticated: boolean;
        profileId: string;
        message: string;
    }>;
    getSessionStatusBatch(body: {
        ids: string[];
    }, req: Request): Promise<{
        results: Record<string, {
            authenticated: boolean;
            message: string;
            profileId?: string;
        }>;
    }>;
    getProfileData(id: string, req: Request): Promise<{
        success: boolean;
        profileData?: any;
        error?: string;
    }>;
    getClientPhotos(id: string, clientId: string, req: Request): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getClientPublicProfile(id: string, clientId: string, req: Request): Promise<{
        success: boolean;
        error: string;
        profile?: undefined;
    } | {
        success: boolean;
        profile: any;
        error?: undefined;
    }>;
    getMyPublicProfile(id: string, req: Request): Promise<{
        success: boolean;
        profileData?: any;
        error?: string;
    }>;
    getMyPhotos(id: string, req: Request): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getGiftLimits(id: string, body: {
        clientId: number;
    }, req: Request): Promise<{
        success: boolean;
        data?: {
            limit: number;
            canSendWithoutLimit: boolean;
        };
        error?: string;
    }>;
    getGiftList(id: string, body: {
        clientId: number;
        cursor?: string;
        limit?: number;
    }, req: Request): Promise<{
        success: boolean;
        data?: {
            cursor: string;
            items: any[];
        };
        error?: string;
    }>;
    sendGift(id: string, body: {
        clientId: number;
        giftId: number;
        message?: string;
    }, req: Request): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
}
