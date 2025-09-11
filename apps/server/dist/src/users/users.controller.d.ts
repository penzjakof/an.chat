import { UsersService } from './users.service';
import type { Request } from 'express';
export declare class UsersController {
    private readonly users;
    constructor(users: UsersService);
    list(req: Request): import(".prisma/client").Prisma.PrismaPromise<{
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
    createOwner(body: {
        agencyCode: string;
        username: string;
        name: string;
        password: string;
    }): Promise<any>;
    createOperator(body: {
        agencyCode: string;
        username: string;
        name: string;
        password: string;
        operatorCode: string;
    }): Promise<any>;
    listOperators(req: Request): Promise<({
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
    updateOperator(id: string, body: {
        username?: string;
        name?: string;
        password?: string;
        operatorCode?: string;
        groupId?: string;
    }, req: Request): Promise<{
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
    deleteOperator(id: string, req: Request): Promise<{
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
