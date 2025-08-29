import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { ProviderSite, Role } from '@prisma/client';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profiles')
export class ProfilesController {
	constructor(private readonly profiles: ProfilesService) {}

	@Roles(Role.OWNER)
	@Get('group/:groupId')
	list(@Param('groupId') groupId: string) {
		return this.profiles.listByGroup(groupId);
	}

	@Roles(Role.OWNER)
	@Post()
	create(@Body() body: { groupId: string; provider: ProviderSite; externalId: string; displayName?: string; credentialLogin?: string; credentialPassword?: string }) {
		return this.profiles.create(body);
	}
}
