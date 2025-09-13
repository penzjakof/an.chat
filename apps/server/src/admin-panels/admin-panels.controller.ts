import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';
import { DatameService } from '../datame/datame.service';

@Controller('admin-panels')
@UseGuards(JwtAuthGuard)
export class AdminPanelsController {
  constructor(private readonly prisma: PrismaService, private readonly datame: DatameService) {}

  @Get()
  @Roles(Role.OWNER)
  async list(@Req() req: Request) {
    try {
      const agencyCode = (req as any)?.auth?.agencyCode;
      if (!agencyCode) return [];
      const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
      if (!agency) return [];
      const rows = await this.prisma.adminPanelConnection.findMany({
        where: { agencyId: agency.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, platform: true, email: true, status: true, lastUpdatedAt: true, count: true },
      });
      return rows;
    } catch (e) {
      // Якщо таблиці немає або інша БД-помилка — не блокуємо UI
      return [];
    }
  }

  @Post('update')
  @Roles(Role.OWNER)
  async update(@Req() req: Request, @Body() body: { email: string; count?: number; status?: string }) {
    try {
      const agency = await this.prisma.agency.findUnique({ where: { code: req.auth!.agencyCode } });
      if (!agency || !body?.email) return { success: false };
      await this.prisma.adminPanelConnection.updateMany({
        where: { agencyId: agency.id, email: body.email },
        data: { count: typeof body.count === 'number' ? body.count : undefined, status: body.status || undefined, lastUpdatedAt: new Date() },
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  @Delete()
  @Roles(Role.OWNER)
  async remove(@Req() req: Request, @Body() body: { email: string }) {
    try {
      const agency = await this.prisma.agency.findUnique({ where: { code: req.auth!.agencyCode } });
      if (!agency || !body?.email) return { success: false };
      await this.prisma.adminPanelConnection.deleteMany({ where: { agencyId: agency.id, email: body.email } });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  @Post('relogin')
  @Roles(Role.OWNER)
  async relogin(@Req() req: Request, @Body() body: { email: string }) {
    const agencyCode = (req as any)?.auth?.agencyCode;
    if (!agencyCode || !body?.email) return { success: false };
    try {
      const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
      if (!agency) return { success: false };
      const conn = await this.prisma.adminPanelConnection.findFirst({
        where: { agencyId: agency.id, platform: 'TALKYTIMES' as any, email: body.email },
      });
      if (!conn?.passwordEnc) return { success: false };
      const res = await this.datame.login(conn.email, conn.passwordEnc);
      const joined = res.cookieHeader || '';
      if (joined) this.datame.setAgencyCookie(agencyCode, joined);
      await this.prisma.adminPanelConnection.update({
        where: { agencyId_platform_email: { agencyId: agency.id, platform: 'TALKYTIMES' as any, email: conn.email } },
        data: { status: 'connected', lastUpdatedAt: new Date() },
      });
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
}


