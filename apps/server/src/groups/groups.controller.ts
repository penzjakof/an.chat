import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
	constructor(private readonly groups: GroupsService) {}

	@Get()
	@Roles(Role.OWNER, Role.OPERATOR)
	getGroups(@Req() req: Request) {
		return this.groups.listByAgencyCode(req.auth!.agencyCode);
	}

	@Get(':id/profiles')
	@Roles(Role.OWNER, Role.OPERATOR)
	getGroupProfiles(@Param('id') id: string, @Req() req: Request) {
		return this.groups.listByAgencyCode(req.auth!.agencyCode); // simplify: same list; implement specific call later
	}
}
