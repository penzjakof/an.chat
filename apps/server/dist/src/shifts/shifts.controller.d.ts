import type { Request } from 'express';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class ShiftsController {
    private readonly shifts;
    private readonly prisma;
    constructor(shifts: ShiftsService, prisma: PrismaService);
    groupsStatus(req: Request): Promise<{
        id: string;
        name: string;
        busy: boolean;
        operatorName: string | null;
        operatorId: string | null;
    }[]>;
    canStart(req: Request): Promise<{
        canStart: boolean;
        busyGroups: {
            id: string;
            name: string;
        }[];
    }>;
    isActive(req: Request): Promise<{
        active: boolean;
    }>;
    start(req: Request): Promise<{
        id: string;
        agencyId: string;
        operatorId: string;
        startedAt: Date;
        endedAt: Date | null;
    }>;
    end(req: Request): Promise<{
        id: string;
        agencyId: string;
        operatorId: string;
        startedAt: Date;
        endedAt: Date | null;
    }>;
    logs(req: Request): Promise<{
        id: string;
        action: import("@prisma/client").$Enums.ShiftAction;
        createdAt: Date;
        operatorName: string;
        operatorId: string;
        message: string | null;
    }[]>;
    activeShifts(req: Request): Promise<{
        shiftId: string;
        operatorId: string;
        operatorName: string;
        startedAt: Date;
        groupsCount: any;
    }[]>;
    forceEnd(req: Request, body: {
        operatorId: string;
    }): Promise<{
        id: string;
        agencyId: string;
        operatorId: string;
        startedAt: Date;
        endedAt: Date | null;
    }>;
}
