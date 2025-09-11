import { ProfilesService } from '../profiles/profiles.service';
import type { RequestAuthContext } from '../common/auth/auth.types';
export declare class ChatAccessService {
    private readonly profiles;
    constructor(profiles: ProfilesService);
    getAccessibleProfiles(auth: RequestAuthContext): Promise<({
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
    canAccessProfile(profileId: string, auth: RequestAuthContext): Promise<boolean>;
    filterDialogsByAccess(dialogs: any, auth: RequestAuthContext): Promise<any>;
}
