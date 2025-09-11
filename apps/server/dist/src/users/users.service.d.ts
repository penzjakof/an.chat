import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createOwner(params: {
        agencyCode: string;
        username: string;
        name: string;
        password: string;
    }): Promise<any>;
    createOperator(params: {
        agencyCode: string;
        username: string;
        name: string;
        password: string;
        operatorCode: string;
    }): Promise<any>;
    findManyByAgencyCode(agencyCode: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        status: import(".prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    blockUser(userId: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        status: import(".prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findOperatorsByAgencyCode(agencyCode: string): Promise<({
        operatorLinks: ({
            group: {
                id: string;
                name: string;
                agencyId: string;
                createdAt: Date;
                updatedAt: Date;
                activeShiftId: string | null;
            };
        } & {
            operatorId: string;
            groupId: string;
            assignedAt: Date;
        })[];
    } & {
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        status: import(".prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    updateOperator(operatorId: string, updates: {
        username?: string;
        name?: string;
        password?: string;
        operatorCode?: string;
        groupId?: string;
    }, agencyCode: string): Promise<{
        operatorLinks: ({
            group: {
                id: string;
                name: string;
                agencyId: string;
                createdAt: Date;
                updatedAt: Date;
                activeShiftId: string | null;
            };
        } & {
            operatorId: string;
            groupId: string;
            assignedAt: Date;
        })[];
    } & {
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        status: import(".prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteOperator(operatorId: string, agencyCode: string): Promise<{
        id: string;
        username: string;
        passwordHash: string;
        name: string;
        role: import(".prisma/client").$Enums.Role;
        status: import(".prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
