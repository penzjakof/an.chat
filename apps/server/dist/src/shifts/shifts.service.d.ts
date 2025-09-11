import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class ShiftsService {
    private readonly prisma;
    private readonly events;
    constructor(prisma: PrismaService, events: EventEmitter2);
    getOperatorGroups(operatorId: string): Promise<({
        activeShift: ({
            operator: {
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
            };
        } & {
            id: string;
            operatorId: string;
            agencyId: string;
            startedAt: Date;
            endedAt: Date | null;
        }) | null;
    } & {
        id: string;
        name: string;
        agencyId: string;
        createdAt: Date;
        updatedAt: Date;
        activeShiftId: string | null;
    })[]>;
    getGroupsStatusByOperator(operatorId: string): Promise<{
        id: string;
        name: string;
        busy: boolean;
        operatorName: string | null;
        operatorId: string | null;
    }[]>;
    canStartShiftForOperator(operatorId: string): Promise<{
        canStart: boolean;
        busyGroups: {
            id: string;
            name: string;
        }[];
    }>;
    hasActiveShift(operatorId: string): Promise<{
        active: boolean;
    }>;
    startShift(operatorId: string, agencyId: string): Promise<{
        id: string;
        operatorId: string;
        agencyId: string;
        startedAt: Date;
        endedAt: Date | null;
    }>;
    endShift(operatorId: string): Promise<{
        id: string;
        operatorId: string;
        agencyId: string;
        startedAt: Date;
        endedAt: Date | null;
    }>;
    listActiveShiftsByAgency(agencyCode: string): Promise<{
        shiftId: string;
        operatorId: string;
        operatorName: string;
        startedAt: Date;
        groupsCount: any;
    }[]>;
    forceEndShiftForOperator(operatorId: string, agencyCode: string): Promise<{
        id: string;
        operatorId: string;
        agencyId: string;
        startedAt: Date;
        endedAt: Date | null;
    }>;
}
