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
    findManyByAgencyCode(agencyCode: string): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        passwordHash: string;
        role: import("@prisma/client").$Enums.Role;
        status: import("@prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
    }[]>;
    blockUser(userId: string): import("@prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        passwordHash: string;
        role: import("@prisma/client").$Enums.Role;
        status: import("@prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findOperatorsByAgencyCode(agencyCode: string): Promise<({
        operatorLinks: ({
            group: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                agencyId: string;
                activeShiftId: string | null;
            };
        } & {
            operatorId: string;
            groupId: string;
            assignedAt: Date;
        })[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        passwordHash: string;
        role: import("@prisma/client").$Enums.Role;
        status: import("@prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
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
                createdAt: Date;
                updatedAt: Date;
                agencyId: string;
                activeShiftId: string | null;
            };
        } & {
            operatorId: string;
            groupId: string;
            assignedAt: Date;
        })[];
    } & {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        passwordHash: string;
        role: import("@prisma/client").$Enums.Role;
        status: import("@prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
    }>;
    deleteOperator(operatorId: string, agencyCode: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        passwordHash: string;
        role: import("@prisma/client").$Enums.Role;
        status: import("@prisma/client").$Enums.UserStatus;
        operatorCode: string | null;
        agencyId: string;
    }>;
}
