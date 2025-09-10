"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const event_emitter_1 = require("@nestjs/event-emitter");
let ShiftsService = class ShiftsService {
    prisma;
    events;
    constructor(prisma, events) {
        this.prisma = prisma;
        this.events = events;
    }
    async getOperatorGroups(operatorId) {
        const links = await this.prisma.operatorGroup.findMany({
            where: { operatorId },
            include: { group: { include: { activeShift: { include: { operator: true } } } } },
        });
        return links.map((l) => l.group);
    }
    async getGroupsStatusByOperator(operatorId) {
        const groups = await this.getOperatorGroups(operatorId);
        return groups.map((g) => ({
            id: g.id,
            name: g.name,
            busy: !!g.activeShiftId,
            operatorName: g.activeShift?.operator?.name ?? null,
            operatorId: g.activeShift?.operatorId ?? null,
        }));
    }
    async canStartShiftForOperator(operatorId) {
        const groups = await this.getOperatorGroups(operatorId);
        const busyGroups = groups.filter((g) => g.activeShiftId);
        return { canStart: busyGroups.length === 0, busyGroups: busyGroups.map((g) => ({ id: g.id, name: g.name })) };
    }
    async hasActiveShift(operatorId) {
        const shift = await this.prisma.shift.findFirst({ where: { operatorId, endedAt: null } });
        return { active: !!shift };
    }
    async startShift(operatorId, agencyId) {
        const { canStart, busyGroups } = await this.canStartShiftForOperator(operatorId);
        if (!canStart) {
            throw new common_1.ForbiddenException(`Групи зайняті: ${busyGroups.map((g) => g.name).join(', ')}`);
        }
        return this.prisma.$transaction(async (tx) => {
            const shift = await tx.shift.create({ data: { operatorId, agencyId } });
            const links = await tx.operatorGroup.findMany({ where: { operatorId } });
            if (links.length > 0) {
                const res = await tx.group.updateMany({
                    where: { id: { in: links.map((l) => l.groupId) }, activeShiftId: null },
                    data: { activeShiftId: shift.id },
                });
                if (res.count !== links.length) {
                    throw new common_1.ForbiddenException('Деякі групи стали зайняті. Спробуйте ще раз.');
                }
            }
            await tx.shiftLog.create({
                data: { shiftId: shift.id, operatorId, agencyId, action: client_1.ShiftAction.START, message: 'Shift started' },
            });
            return shift;
        });
    }
    async endShift(operatorId) {
        const shift = await this.prisma.shift.findFirst({ where: { operatorId, endedAt: null } });
        if (!shift)
            throw new common_1.NotFoundException('Активна зміна не знайдена');
        return this.prisma.$transaction(async (tx) => {
            await tx.group.updateMany({ where: { activeShiftId: shift.id }, data: { activeShiftId: null } });
            const closed = await tx.shift.update({ where: { id: shift.id }, data: { endedAt: new Date() } });
            await tx.shiftLog.create({
                data: { shiftId: shift.id, operatorId, agencyId: shift.agencyId, action: client_1.ShiftAction.END, message: 'Shift ended' },
            });
            try {
                this.events.emit('shift.ended', { operatorId });
            }
            catch { }
            return closed;
        });
    }
    async listActiveShiftsByAgency(agencyCode) {
        const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
        if (!agency)
            return [];
        const shifts = await this.prisma.shift.findMany({
            where: { agencyId: agency.id, endedAt: null },
            include: { operator: true, _count: { select: { groups: true } } }
        });
        return shifts.map(s => ({
            shiftId: s.id,
            operatorId: s.operatorId,
            operatorName: s.operator.name,
            startedAt: s.startedAt,
            groupsCount: s._count?.groups ?? 0,
        }));
    }
    async forceEndShiftForOperator(operatorId, agencyCode) {
        const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
        if (!agency)
            throw new common_1.NotFoundException('Агенцію не знайдено');
        const shift = await this.prisma.shift.findFirst({ where: { operatorId, agencyId: agency.id, endedAt: null } });
        if (!shift)
            throw new common_1.NotFoundException('Активна зміна не знайдена');
        return this.prisma.$transaction(async (tx) => {
            await tx.group.updateMany({ where: { activeShiftId: shift.id }, data: { activeShiftId: null } });
            const closed = await tx.shift.update({ where: { id: shift.id }, data: { endedAt: new Date() } });
            await tx.shiftLog.create({
                data: { shiftId: shift.id, operatorId, agencyId: shift.agencyId, action: client_1.ShiftAction.END, message: 'Force ended by owner' },
            });
            try {
                this.events.emit('shift.ended', { operatorId });
            }
            catch { }
            return closed;
        });
    }
};
exports.ShiftsService = ShiftsService;
exports.ShiftsService = ShiftsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, event_emitter_1.EventEmitter2])
], ShiftsService);
//# sourceMappingURL=shifts.service.js.map