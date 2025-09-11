import { Body, Controller, Get, Param, Post, Put, Delete, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProfilesService } from './profiles.service';
import { ProviderSite } from '@prisma/client';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { Request } from 'express';
import { Role } from '../common/auth/auth.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class ProfilesController {
	constructor(private readonly profiles: ProfilesService) {}

	@Roles(Role.OWNER)
	@Get()
	listAll(@Req() req: Request) {
		return this.profiles.listByAgencyCode(req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('my')
	listMy(@Req() req: Request) {
		// Owner отримує всі профілі агенції, Operator - тільки свої
		if (req.auth!.role === 'OWNER') {
			return this.profiles.listByAgencyCode(req.auth!.agencyCode);
		} else {
			return this.profiles.listByOperatorAccess(req.auth!.userId, req.auth!.agencyCode);
		}
	}

	@Roles(Role.OWNER)
	@Get('group/:groupId')
	list(@Param('groupId') groupId: string) {
		return this.profiles.listByGroup(groupId);
	}

	@Roles(Role.OWNER)
	@Post()
	create(@Body() body: { groupId: string; provider: ProviderSite; displayName?: string; credentialLogin?: string; credentialPassword?: string }, @Req() req: Request) {
		return this.profiles.create(body, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER)
	@Put(':id')
	update(@Param('id') id: string, @Body() body: { displayName?: string; credentialLogin?: string; credentialPassword?: string; groupId?: string }, @Req() req: Request) {
		return this.profiles.update(id, body, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER)
	@Delete(':id')
	delete(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.delete(id, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/authenticate')
	authenticateProfile(@Param('id') id: string, @Body() body: { login?: string; password: string }, @Req() req: Request) {
		return this.profiles.authenticateProfile(id, body.password, req.auth!.agencyCode, body.login);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/session/status')
	getSessionStatus(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getProfileSessionStatus(id, req.auth!.agencyCode);
	}

	// Батчова перевірка статусів сесій, щоб уникнути 429 при великій кількості профілів
	@Roles(Role.OWNER, Role.OPERATOR)
	@Throttle({ default: { limit: 100, ttl: 1000 } })
	@Post('session/status/batch')
	async getSessionStatusBatch(@Body() body: { ids: string[] }, @Req() req: Request) {
		const ids = Array.isArray(body?.ids) ? body.ids : [];
		if (ids.length === 0) return { results: {} };
		const results: Record<string, { authenticated: boolean; message: string; profileId?: string }> = {};
		await Promise.all(ids.map(async (pid) => {
			try {
				const res = await this.profiles.getProfileSessionStatus(pid, req.auth!.agencyCode);
				results[pid] = { authenticated: !!res.authenticated, message: res.message, profileId: res.profileId };
			} catch (e) {
				results[pid] = { authenticated: false, message: 'Error checking status' };
			}
		}));
		return { results };
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get(':id/profile-data')
	getProfileData(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getProfileData(id, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/client/:clientId/photos')
	getClientPhotos(@Param('id') id: string, @Param('clientId') clientId: string, @Req() req: Request) {
		return this.profiles.getClientPhotos(id, parseInt(clientId), req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get(':id/client/:clientId/public')
	getClientPublicProfile(@Param('id') id: string, @Param('clientId') clientId: string, @Req() req: Request) {
console.log(`🔍 DEBUG Controller getClientPublicProfile called: id=${id}, clientId=${clientId}`);
		return this.profiles.getClientPublicProfile(id, parseInt(clientId), req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/my-public-profile')
	getMyPublicProfile(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getMyPublicProfile(id, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/my-photos')
	getMyPhotos(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getMyPhotos(id, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/gift-limits')
	getGiftLimits(@Param('id') id: string, @Body() body: { clientId: number }, @Req() req: Request) {
		return this.profiles.getGiftLimits(id, body.clientId, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/gift-list')
	getGiftList(@Param('id') id: string, @Body() body: { clientId: number; cursor?: string; limit?: number }, @Req() req: Request) {
		return this.profiles.getGiftList(id, body.clientId, body.cursor, body.limit || 30, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/send-gift')
	sendGift(@Param('id') id: string, @Body() body: { clientId: number; giftId: number; message?: string }, @Req() req: Request) {
		return this.profiles.sendGift(id, body.clientId, body.giftId, body.message, req.auth!.agencyCode);
	}

	@Get(':id/available-media')
	@Roles(Role.OWNER, Role.OPERATOR)
	getAvailableMedia(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getAvailableMedia(id, req.auth!.agencyCode);
	}

	@Post(':id/authenticate')
	@Roles(Role.OWNER, Role.OPERATOR)
	authenticateProfile(@Param('id') id: string, @Body() body: { login?: string; password: string }, @Req() req: Request) {
		return this.profiles.authenticateProfile(id, body.login, body.password, req.auth!.agencyCode);
	}
}
