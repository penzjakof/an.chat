import { PrismaService } from '../prisma/prisma.service';
import { ProviderSite } from '@prisma/client';
import { TalkyTimesProvider } from '../providers/talkytimes/talkytimes.provider';
import { EncryptionService } from '../common/encryption/encryption.service';
import { TalkyTimesSessionService } from '../providers/talkytimes/session.service';
export declare class ProfilesService {
    private readonly prisma;
    private readonly talkyTimesProvider;
    private readonly encryption;
    private readonly sessionService;
    constructor(prisma: PrismaService, talkyTimesProvider: TalkyTimesProvider, encryption: EncryptionService, sessionService: TalkyTimesSessionService);
    create(params: {
        groupId: string;
        provider: ProviderSite;
        displayName?: string;
        credentialLogin?: string;
        credentialPassword?: string;
    }, agencyCode: string): Promise<{
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
    listByGroup(groupId: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    listByAgencyCode(agencyCode: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    listByOperatorAccess(operatorId: string, agencyCode: string): Promise<({
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
    hasAccessToProfile(profileId: string, operatorId: string, agencyCode: string): Promise<boolean>;
    update(profileId: string, updates: {
        displayName?: string;
        credentialLogin?: string;
        credentialPassword?: string;
        groupId?: string;
    }, agencyCode: string): Promise<{
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
    delete(profileId: string, agencyCode: string): Promise<{
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
    authenticateProfile(profileId: string, password: string, agencyCode: string, loginOverride?: string): Promise<{
        success: boolean;
        profileId: string | null;
        message: string;
    }>;
    getProfileSessionStatus(profileId: string, agencyCode: string): Promise<{
        authenticated: boolean;
        message: string;
        profileId?: undefined;
    } | {
        authenticated: boolean;
        profileId: string;
        message: string;
    }>;
    getProfileData(profileId: string, agencyCode: string): Promise<{
        success: boolean;
        profileData?: any;
        error?: string;
    }>;
    getClientPhotos(profileId: string, clientId: number, agencyCode: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getMyPublicProfile(profileId: string, agencyCode: string): Promise<{
        success: boolean;
        profileData?: any;
        error?: string;
    }>;
    getMyPhotos(profileId: string, agencyCode: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getClientPublicProfile(profileId: string, clientId: number, agencyCode: string): Promise<{
        success: boolean;
        error: string;
        profile?: undefined;
    } | {
        success: boolean;
        profile: any;
        error?: undefined;
    }>;
    getGiftLimits(profileId: string, clientId: number, agencyCode: string): Promise<{
        success: boolean;
        data?: {
            limit: number;
            canSendWithoutLimit: boolean;
        };
        error?: string;
    }>;
    getGiftList(profileId: string, clientId: number, cursor: string | undefined, limit: number | undefined, agencyCode: string): Promise<{
        success: boolean;
        data?: {
            cursor: string;
            items: any[];
        };
        error?: string;
    }>;
    sendGift(profileId: string, clientId: number, giftId: number, message: string | undefined, agencyCode: string): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
}
