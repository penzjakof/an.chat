import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DatameService } from './datame.service';
import { DatameImportService } from './datame.import.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';
// Глобальний префікс вже 'api' у main.ts, тому тут тільки 'datame'
@Controller('datame')
@UseGuards(JwtAuthGuard)
@Roles(Role.OWNER)
export class DatameController {
  // Для простоти — в cookieHeader передаємо повний Cookie рядок з tld-token, user, _csrf
  constructor(
    private readonly datame: DatameService,
    private readonly importer: DatameImportService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string; cookieHeader?: string }, @Req() req: Request) {
    const { email, password, cookieHeader } = body;
    const res = await this.datame.login(email, password, cookieHeader);
    // зберігаємо сесію для агенції
    const agencyCode = (req as any)?.auth?.agencyCode || 'default';
    const joined = [cookieHeader, res.cookieHeader].filter(Boolean).join('; ');
    if (joined) this.datame.setAgencyCookie(agencyCode, joined);
    // best-effort збереження підключення адмін-панелі
    try {
      const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
      if (agency) {
        await this.prisma.adminPanelConnection.upsert({
          where: { agencyId_platform_email: { agencyId: agency.id, platform: 'TALKYTIMES', email } },
          update: { status: 'connected', lastUpdatedAt: new Date(), passwordEnc: password /* TODO: encrypt */ },
          create: { agencyId: agency.id, platform: 'TALKYTIMES' as any, email, status: 'connected', lastUpdatedAt: new Date(), count: 0, passwordEnc: password /* TODO: encrypt */ },
        });
      }
    } catch (e) {
      // ігноруємо, якщо таблиці немає (ще не мігрували)
      console.warn('AdminPanelConnection save failed (non-fatal):', (e as any)?.message);
    }
    return { success: true };
  }

  @Post('collection')
  async collection(@Body() body: { status?: string; limit?: number; id_last?: number | string; cookieHeader?: string }, @Req() req: Request) {
    const agencyCode = (req as any)?.auth?.agencyCode || 'default';
    const cookie = body.cookieHeader || this.datame.getAgencyCookie(agencyCode) || '';
    const data = await this.datame.collection({ status: body.status, limit: body.limit, id_last: body.id_last }, cookie);
    return data;
  }

  @Post('form-data')
  async formData(@Body() body: { id: number; cookieHeader?: string }, @Req() req: Request) {
    const agencyCode = (req as any)?.auth?.agencyCode || 'default';
    const cookie = body.cookieHeader || this.datame.getAgencyCookie(agencyCode) || '';
    const data = await this.datame.formData(body.id, cookie);
    return data;
  }

  @Post('female')
  async female(@Body() body: { id: number; cookieHeader?: string }, @Req() req: Request) {
    const agencyCode = (req as any)?.auth?.agencyCode || 'default';
    const cookie = body.cookieHeader || this.datame.getAgencyCookie(agencyCode) || '';
    const data = await this.datame.getFemale(body.id, cookie);
    return data;
  }
}

// Імпорт у БД з урахуванням дублікатів
@Controller('datame-import')
@UseGuards(JwtAuthGuard)
@Roles(Role.OWNER)
export class DatameImportController {
  constructor(private readonly importer: DatameImportService) {}

  @Post('check-duplicates')
  async check(@Body() body: { items: Array<{ id: number; email?: string }>; agencyCode?: string }, @Req() req: Request) {
    const agencyCode = body.agencyCode || (req as any)?.auth?.agencyCode || 'default';
    return this.importer.findDuplicates(agencyCode, body.items || []);
  }

  @Post('import')
  async import(@Body() body: { groupId?: string; items: Array<{ id: number; email: string; name?: string }>; mode: 'new_only' | 'replace_all' | 'skip'; agencyCode?: string }, @Req() req: Request) {
    try {
      const agencyCode = body.agencyCode || (req as any)?.auth?.agencyCode || 'default';
      return await this.importer.importItems(agencyCode, body.groupId, body.items || [], body.mode || 'new_only');
    } catch (e: any) {
      console.error('datame-import/import error:', e?.message, e);
      throw new BadRequestException(e?.message || 'Import failed');
    }
  }
}


