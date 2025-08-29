import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
	constructor(private readonly groups: GroupsService) {}

	@Roles(Role.OWNER)
	@Get()
	list(@Req() req: Request) {
		return this.groups.listByAgencyCode(req.auth!.agencyCode);
	}

	@Roles(Role.OWNER)
	@Post()
	create(@Req() req: Request, @Body() body: { name: string }) {
		return this.groups.create(req.auth!.agencyCode, body.name);
	}

	@Roles(Role.OWNER)
	@Post(':groupId/assign/:operatorId')
	assign(@Param('groupId') groupId: string, @Param('operatorId') operatorId: string) {
		return this.groups.assignOperator(groupId, operatorId);
	}
}
