import { GroupsService } from './groups.service';
import type { Request } from 'express';
export declare class GroupsController {
    private readonly groups;
    constructor(groups: GroupsService);
    list(req: Request): import(".prisma/client").Prisma.PrismaPromise<({
        operators: {
            operatorId: string;
            groupId: string;
            assignedAt: Date;
        }[];
        profiles: {
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
        }[];
    } & {
        id: string;
        name: string;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
        activeShiftId: string | null;
    })[]>;
    create(req: Request, body: {
        name: string;
    }): Promise<{
        id: string;
        name: string;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
        activeShiftId: string | null;
    }>;
    assign(groupId: string, operatorId: string): import(".prisma/client").Prisma.Prisma__OperatorGroupClient<{
        operatorId: string;
        groupId: string;
        assignedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
