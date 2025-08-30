import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
	dialogs(@Req() req: Request, @Query() filters: { status?: string; search?: string; onlineOnly?: string }) {
		// Перетворюємо onlineOnly з string в boolean
		const processedFilters = {
			...filters,
			onlineOnly: filters.onlineOnly === 'true'
		};
		console.log('🔍 ChatsController.dialogs called with filters:', processedFilters);
		return this.chats.fetchDialogs(req.auth!, processedFilters);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs/:id/messages')
	messages(@Req() req: Request, @Param('id') id: string, @Query('cursor') cursor?: string) {
		return this.chats.fetchMessages(req.auth!, id, cursor);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('dialogs/:id/text')
	sendText(@Req() req: Request, @Param('id') id: string, @Body() body: { text: string }) {
		return this.chats.sendText(req.auth!, id, body.text);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('profiles')
	async getProfiles(@Query('ids') ids: string, @Req() req: Request) {
		if (!ids) {
			return { profiles: [] };
		}
		
		const userIds = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
		if (userIds.length === 0) {
			return { profiles: [] };
		}

		// Знаходимо доступні профілі
		const accessibleProfiles = await this.chats.getAccessibleProfiles(req.auth!);
		
		// Беремо перший доступний профіль для запиту
		const targetProfile = accessibleProfiles.find(p => p.profileId);
		if (!targetProfile || !targetProfile.profileId) {
			return { profiles: [] };
		}

		return this.chats.fetchUserProfiles(targetProfile.profileId, userIds);
	}
}
