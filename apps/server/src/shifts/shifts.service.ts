import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftAction } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  async getOperatorGroups(operatorId: string) {
    const links = await this.prisma.operatorGroup.findMany({
      where: { operatorId },
      include: { group: { include: { activeShift: { include: { operator: true } } } } },
    });
    return links.map((l) => l.group);
  }

  async getGroupsStatusByOperator(operatorId: string) {
    const groups = await this.getOperatorGroups(operatorId);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      busy: !!g.activeShiftId,
      operatorName: g.activeShift?.operator?.name ?? null,
      operatorId: g.activeShift?.operatorId ?? null,
    }));
  }

  async canStartShiftForOperator(operatorId: string) {
    const groups = await this.getOperatorGroups(operatorId);
    const busyGroups = groups.filter((g) => g.activeShiftId);
    return { canStart: busyGroups.length === 0, busyGroups: busyGroups.map((g) => ({ id: g.id, name: g.name })) };
  }

  async hasActiveShift(operatorId: string) {
    const shift = await this.prisma.shift.findFirst({ where: { operatorId, endedAt: null } });
    return { active: !!shift };
  }

  async startShift(operatorId: string, agencyId: string) {
    const { canStart, busyGroups } = await this.canStartShiftForOperator(operatorId);
    if (!canStart) {
      throw new ForbiddenException(`Групи зайняті: ${busyGroups.map((g) => g.name).join(', ')}`);
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
          throw new ForbiddenException('Деякі групи стали зайняті. Спробуйте ще раз.');
        }
      }

      await tx.shiftLog.create({
        data: { shiftId: shift.id, operatorId, agencyId, action: ShiftAction.START, message: 'Shift started' },
      });

      return shift;
    });
  }

  async endShift(operatorId: string) {
    const shift = await this.prisma.shift.findFirst({ where: { operatorId, endedAt: null } });
    if (!shift) throw new NotFoundException('Активна зміна не знайдена');

    return this.prisma.$transaction(async (tx) => {
      await tx.group.updateMany({ where: { activeShiftId: shift.id }, data: { activeShiftId: null } });
      const closed = await tx.shift.update({ where: { id: shift.id }, data: { endedAt: new Date() } });
      await tx.shiftLog.create({
        data: { shiftId: shift.id, operatorId, agencyId: shift.agencyId, action: ShiftAction.END, message: 'Shift ended' },
      });
      // Сповіщаємо про завершення зміни (для миттєвого редіректу оператора)
      try { this.events.emit('shift.ended', { operatorId }); } catch {}
      return closed;
    });
  }

  async listActiveShiftsByAgency(agencyCode: string) {
    const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
    if (!agency) return [] as Array<{ shiftId: string; operatorId: string; operatorName: string; startedAt: Date; groupsCount: number }>;
    const shifts = await this.prisma.shift.findMany({
      where: { agencyId: agency.id, endedAt: null },
      include: { operator: true, _count: { select: { groups: true } } }
    });
    return shifts.map(s => ({
      shiftId: s.id,
      operatorId: s.operatorId,
      operatorName: s.operator.name,
      startedAt: s.startedAt,
      groupsCount: (s as any)._count?.groups ?? 0,
    }));
  }

  async forceEndShiftForOperator(operatorId: string, agencyCode: string) {
    const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
    if (!agency) throw new NotFoundException('Агенцію не знайдено');
    const shift = await this.prisma.shift.findFirst({ where: { operatorId, agencyId: agency.id, endedAt: null } });
    if (!shift) throw new NotFoundException('Активна зміна не знайдена');

    return this.prisma.$transaction(async (tx) => {
      await tx.group.updateMany({ where: { activeShiftId: shift.id }, data: { activeShiftId: null } });
      const closed = await tx.shift.update({ where: { id: shift.id }, data: { endedAt: new Date() } });
      await tx.shiftLog.create({
        data: { shiftId: shift.id, operatorId, agencyId: shift.agencyId, action: ShiftAction.END, message: 'Force ended by owner' },
      });
      try { this.events.emit('shift.ended', { operatorId }); } catch {}
      return closed;
    });
  }
}
