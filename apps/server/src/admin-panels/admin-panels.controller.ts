import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';

@Controller('admin-panels')
@UseGuards(JwtAuthGuard)
export class AdminPanelsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(Role.OWNER)
  async list(@Req() req: Request) {
    try {
      const agency = await this.prisma.agency.findUnique({ where: { code: req.auth!.agencyCode } });
      if (!agency) return [];
      return this.prisma.adminPanelConnection.findMany({
        where: { agencyId: agency.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, platform: true, email: true, status: true, lastUpdatedAt: true, count: true },
      });
    } catch (e) {
      // Якщо таблиці немає або інша БД-помилка — не блокуємо UI
      return [];
    }
  }
}


