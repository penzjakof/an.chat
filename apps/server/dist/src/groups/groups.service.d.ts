import { PrismaService } from '../prisma/prisma.service';
export declare class GroupsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(agencyCode: string, name: string): Promise<{
        id: string;
        name: string;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
        activeShiftId: string | null;
    }>;
    listByAgencyCode(agencyCode: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    assignOperator(groupId: string, operatorId: string): import(".prisma/client").Prisma.Prisma__OperatorGroupClient<{
        operatorId: string;
        groupId: string;
        assignedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
