import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
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

	@Get(':operatorId/force-end')
	@Roles(Role.OWNER)
	forceEnd(@Param('operatorId') operatorId: string, @Req() req: Request) {
		return this.shifts.forceEndShiftForOperator(operatorId, req.auth!.agencyCode);
	}
}
