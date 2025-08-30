import { Body, Controller, Get, Param, Post, Put, Delete, Req, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { ProviderSite, Role } from '@prisma/client';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { Request } from 'express';

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
	authenticateProfile(@Param('id') id: string, @Body() body: { password: string }, @Req() req: Request) {
		return this.profiles.authenticateProfile(id, body.password, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post(':id/session/status')
	getSessionStatus(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getProfileSessionStatus(id, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get(':id/profile-data')
	getProfileData(@Param('id') id: string, @Req() req: Request) {
		return this.profiles.getProfileData(id, req.auth!.agencyCode);
	}
}
