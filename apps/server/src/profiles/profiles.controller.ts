import { Controller, Get, Post, Param, Req, UseGuards, Body } from '@nestjs/common';
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

	@Post(':id/authenticate')
	@Roles(Role.OWNER, Role.OPERATOR)
	authenticateProfile(@Param('id') id: string, @Body() body: { login?: string; password: string }, @Req() req: Request) {
		return this.profiles.authenticateProfile(id, body.login, body.password, req.auth!.agencyCode);
	}
}
