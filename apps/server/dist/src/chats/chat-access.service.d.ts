import { ProfilesService } from '../profiles/profiles.service';
import type { RequestAuthContext } from '../common/auth/auth.types';
export declare class ChatAccessService {
    private readonly profiles;
    constructor(profiles: ProfilesService);
    getAccessibleProfiles(auth: RequestAuthContext): Promise<({
        group: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            agencyId: string;
            activeShiftId: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.ProfileStatus;
        groupId: string;
        provider: import("@prisma/client").$Enums.ProviderSite;
        externalId: string;
        displayName: string | null;
        credentialLogin: string | null;
        credentialPassword: string | null;
        profileId: string | null;
        lastActiveAt: Date | null;
    })[]>;
    canAccessProfile(profileId: string, auth: RequestAuthContext): Promise<boolean>;
    filterDialogsByAccess(dialogs: any, auth: RequestAuthContext): Promise<any>;
}
