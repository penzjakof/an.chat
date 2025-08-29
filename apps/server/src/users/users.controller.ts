import { Body, Controller, Get, Post, Put, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
	constructor(private readonly users: UsersService) {}

	@Roles(Role.OWNER)
	@Get()
	list(@Req() req: Request) {
		return this.users.findManyByAgencyCode(req.auth!.agencyCode);
	}

	@Roles(Role.OWNER)
	@Post('owner')
	createOwner(@Body() body: { agencyCode: string; username: string; name: string; password: string }) {
		return this.users.createOwner(body);
	}

	@Roles(Role.OWNER)
	@Post('operator')
	createOperator(
		@Body()
		body: { agencyCode: string; username: string; name: string; password: string; operatorCode: string },
	) {
		return this.users.createOperator(body);
	}

	@Roles(Role.OWNER)
	@Get('operators')
	listOperators(@Req() req: Request) {
		return this.users.findOperatorsByAgencyCode(req.auth!.agencyCode);
	}

	@Roles(Role.OWNER)
	@Put('operators/:id')
	updateOperator(
		@Param('id') id: string,
		@Body() body: { username?: string; name?: string; password?: string; operatorCode?: string; groupId?: string },
		@Req() req: Request,
	) {
		return this.users.updateOperator(id, body, req.auth!.agencyCode);
	}

	@Roles(Role.OWNER)
	@Delete('operators/:id')
	deleteOperator(@Param('id') id: string, @Req() req: Request) {
		return this.users.deleteOperator(id, req.auth!.agencyCode);
	}
}
