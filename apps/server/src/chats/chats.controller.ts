import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/chats')
export class ChatsController {
	constructor(private readonly chats: ChatsService) {}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs')
	dialogs(@Req() req: Request, ) {
		return this.chats.fetchDialogs(req.auth!);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs/:id/messages')
	messages(@Req() req: Request, @Param('id') id: string, @Body('cursor') cursor?: string) {
		return this.chats.fetchMessages(req.auth!, id, cursor);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('dialogs/:id/text')
	sendText(@Req() req: Request, @Param('id') id: string, @Body() body: { text: string }) {
		return this.chats.sendText(req.auth!, id, body.text);
	}
}
