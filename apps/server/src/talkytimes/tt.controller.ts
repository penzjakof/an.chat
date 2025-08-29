import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import type { SiteProvider } from '../providers/site-provider.interface';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/tt')
export class TTController {
	constructor(@Inject(TALKY_TIMES_PROVIDER) private readonly tt: SiteProvider) {}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs')
	async dialogs(@Req() req: Request, @Query('search') search?: string, @Query('status') status?: string) {
		return this.tt.fetchDialogs({ agencyCode: req.auth!.agencyCode, operatorCode: req.auth!.operatorCode }, { search, status });
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs/:id/messages')
	async messages(@Req() req: Request, @Param('id') id: string, @Query('cursor') cursor?: string) {
		return this.tt.fetchMessages({ agencyCode: req.auth!.agencyCode, operatorCode: req.auth!.operatorCode }, id, cursor);
	}
}
