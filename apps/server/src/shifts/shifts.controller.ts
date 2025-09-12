import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
	constructor(private readonly shifts: ShiftsService) {}

	@Get('active')
	@Roles(Role.OWNER, Role.OPERATOR)
	getActive(@Req() req: Request) {
		return this.shifts.listActiveShiftsByAgency(req.auth!.agencyCode);
	}

	@Get('is-active')
	@Roles(Role.OWNER, Role.OPERATOR)
	getIsActive(@Req() req: Request) {
		return this.shifts.hasActiveShift(req.auth!.userId);
	}

	@Get('groups-status')
	@Roles(Role.OPERATOR)
	getGroupsStatus(@Req() req: Request) {
		return this.shifts.getGroupsStatusByOperator(req.auth!.userId);
	}

	@Get('can-start')
	@Roles(Role.OPERATOR)
	canStart(@Req() req: Request) {
		return this.shifts.canStartShiftForOperator(req.auth!.userId);
	}

	@Get('logs')
	@Roles(Role.OWNER)
	getLogs(@Req() req: Request) {
		return this.shifts.listLogsByAgency(req.auth!.agencyCode);
	}

	@Post('force-end')
	@Roles(Role.OWNER)
	forceEnd(@Body() body: { operatorId: string }, @Req() req: Request) {
		return this.shifts.forceEndShiftForOperator(body.operatorId, req.auth!.agencyCode);
	}

	@Post('start')
	@Roles(Role.OPERATOR)
	start(@Req() req: Request) {
		return this.shifts.startShift(req.auth!.userId, (req as any).auth!.agencyCode);
	}

	@Post('end')
	@Roles(Role.OPERATOR)
	end(@Req() req: Request) {
		return this.shifts.endShift(req.auth!.userId);
	}
}
