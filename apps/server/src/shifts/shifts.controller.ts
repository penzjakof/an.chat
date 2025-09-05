import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { Role } from '@prisma/client';
import { ShiftsService } from './shifts.service';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/shifts')
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService, private readonly prisma: PrismaService) {}

  @Roles(Role.OPERATOR)
  @Get('groups-status')
  async groupsStatus(@Req() req: Request) {
    return this.shifts.getGroupsStatusByOperator(req.auth!.userId);
  }

  @Roles(Role.OPERATOR)
  @Get('can-start')
  async canStart(@Req() req: Request) {
    return this.shifts.canStartShiftForOperator(req.auth!.userId);
  }

  @Roles(Role.OPERATOR)
  @Get('is-active')
  async isActive(@Req() req: Request) {
    return this.shifts.hasActiveShift(req.auth!.userId);
  }

  @Roles(Role.OPERATOR)
  @Post('start')
  async start(@Req() req: Request) {
    const user = await this.prisma.user.findUnique({ where: { id: req.auth!.userId } });
    return this.shifts.startShift(req.auth!.userId, user!.agencyId);
  }

  @Roles(Role.OPERATOR)
  @Post('end')
  async end(@Req() req: Request) {
    return this.shifts.endShift(req.auth!.userId);
  }

  @Roles(Role.OWNER)
  @Get('logs')
  async logs(@Req() req: Request) {
    const agency = await this.prisma.agency.findUnique({ where: { code: req.auth!.agencyCode } });
    const logs = await this.prisma.shiftLog.findMany({
      where: { agencyId: agency!.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { shift: { include: { operator: true } } },
    });
    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      createdAt: l.createdAt,
      operatorName: l.shift.operator.name,
      operatorId: l.operatorId,
      message: l.message,
    }));
  }

  @Roles(Role.OWNER)
  @Get('active')
  async activeShifts(@Req() req: Request) {
    return this.shifts.listActiveShiftsByAgency(req.auth!.agencyCode);
  }

  @Roles(Role.OWNER)
  @Post('force-end')
  async forceEnd(@Req() req: Request, @Body() body: { operatorId: string }) {
    return this.shifts.forceEndShiftForOperator(body.operatorId, req.auth!.agencyCode);
  }
}
