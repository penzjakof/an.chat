import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
	constructor(private readonly users: UsersService) {}

	@Get('me')
	@Roles(Role.OWNER, Role.OPERATOR)
	me(@Req() req: Request) {
		return this.users.me(req.auth!.userId);
	}
}
