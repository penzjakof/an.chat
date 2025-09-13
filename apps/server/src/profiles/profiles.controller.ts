import { Controller, Get, Post, Param, Req, UseGuards, Body, Put, Delete } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
	constructor(private readonly profiles: ProfilesService) {}

	@Get(':id/available-media')
	@Roles(Role.OWNER, Role.OPERATOR)
	getAvailableMedia(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getAvailableMedia(id, req.auth!.agencyCode);
	}

	@Get('my')
	@Roles(Role.OWNER, Role.OPERATOR)
	listMine(@Req() req: Request) {
		return this.profiles.listMine(req.auth!.agencyCode, req.auth!.role as any, req.auth!.userId);
	}

	@Post(':id/authenticate')
	@Roles(Role.OWNER, Role.OPERATOR)
	authenticateProfile(@Param('id') id: string, @Body() body: { login?: string; password: string }, @Req() req: Request) {
		return this.profiles.authenticateProfile(id, body.login, body.password, req.auth!.agencyCode);
	}

	@Get(':id/profile-data')
	@Roles(Role.OWNER, Role.OPERATOR)
	getProfileData(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getProfileDataById(id, req.auth!.agencyCode);
	}

	// Публічний профіль клієнта (TalkyTimes)
	@Get(':id/client/:clientId/public')
	@Roles(Role.OWNER, Role.OPERATOR)
	getClientPublicProfile(@Param('id') id: string, @Param('clientId') clientId: string, @Req() req: Request) {
		return this.profiles.getClientPublicProfile(id, Number(clientId), req.auth!.agencyCode);
	}

	// Фото клієнта (TalkyTimes)
	@Post(':id/client/:clientId/photos')
	@Roles(Role.OWNER, Role.OPERATOR)
	getClientPhotos(@Param('id') id: string, @Param('clientId') clientId: string, @Req() req: Request) {
		return this.profiles.getClientPhotos(id, Number(clientId), req.auth!.agencyCode);
	}

	@Post('session/status/batch')
	@Roles(Role.OWNER, Role.OPERATOR)
	getSessionStatusBatch(@Body() body: { ids: string[] }, @Req() req: Request) {
		return this.profiles.getSessionsStatusBatch(body.ids || [], req.auth!.agencyCode);
	}

	@Post(':id/gift-limits')
	@Roles(Role.OWNER, Role.OPERATOR)
	getGiftLimits(@Param('id') id: string, @Body() body: { clientId?: number }, @Req() req: Request) {
		const clientId = Number(body?.clientId);
		return this.profiles.getGiftLimits(id, clientId, req.auth!.agencyCode);
	}

	// ===== CRUD =====
	@Get()
	@Roles(Role.OWNER)
	list(@Req() req: Request) {
		return this.profiles.listByAgencyCode(req.auth!.agencyCode);
	}

	@Post()
	@Roles(Role.OWNER)
	create(@Body() body: { displayName: string; credentialLogin: string; credentialPassword?: string; provider: string; groupId: string }, @Req() req: Request) {
		return this.profiles.createProfile(body, req.auth!.agencyCode);
	}

	@Put(':id')
	@Roles(Role.OWNER)
	async update(@Param('id') id: string, @Body() body: { displayName?: string; credentialLogin?: string; credentialPassword?: string; provider?: string; groupId?: string }, @Req() req: Request) {
		try {
			return await this.profiles.updateProfile(id, body, req.auth!.agencyCode);
		} catch (e: any) {
			// Повертати зрозуміле 4xx замість 500, щоб UI міг показати причину
			throw new (require('@nestjs/common').BadRequestException)(e?.message || 'Помилка оновлення профілю');
		}
	}

	@Delete(':id')
	@Roles(Role.OWNER)
	remove(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.deleteProfile(id, req.auth!.agencyCode);
	}
}
