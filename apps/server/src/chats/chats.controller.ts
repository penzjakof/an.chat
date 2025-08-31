import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SendPhotoDto } from './dto/send-photo.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/chats')
export class ChatsController {
	constructor(private readonly chats: ChatsService) {}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs')
	dialogs(@Req() req: Request, @Query() filters: { status?: string; search?: string; onlineOnly?: string; cursor?: string }) {
		// Перетворюємо onlineOnly з string в boolean
		const processedFilters = {
			...filters,
			onlineOnly: filters.onlineOnly === 'true'
		};
		console.log('🔍 ChatsController.dialogs called with filters:', processedFilters);
		return this.chats.fetchDialogs(req.auth!, processedFilters);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('search-dialog')
	searchDialog(@Req() req: Request, @Query() query: { profileId: string; clientId: string }) {
		console.log('🔍 ChatsController.searchDialog called with:', query);
		return this.chats.searchDialogByPair(req.auth!, query.profileId, query.clientId);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs/:id/restrictions')
	restrictions(@Req() req: Request, @Param('id') id: string) {
		console.log('🔍 ChatsController.restrictions called for dialog:', id);
		return this.chats.fetchRestrictions(req.auth!, id);
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

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('send-photo')
	async sendPhoto(@Req() req: Request, @Body() sendPhotoDto: SendPhotoDto) {
		console.log('📸 ChatsController.sendPhoto called with:', sendPhotoDto);
		return this.chats.sendPhoto(req.auth!, sendPhotoDto);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('stickers')
	async getStickers(@Req() req: Request, @Body() body: { idInterlocutor: number }) {
		console.log('😀 ChatsController.getStickers called with interlocutor:', body.idInterlocutor);
		return this.chats.getStickers(req.auth!, body.idInterlocutor);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('send-sticker')
	async sendSticker(@Req() req: Request, @Body() body: { idProfile?: number; idRegularUser: number; stickerId: number; stickerUrl?: string }) {
		console.log('😀 ChatsController.sendSticker called with:', body);

		// Якщо немає idProfile, то використовуємо поточний профіль з діалогу
		if (!body.idProfile) {
			// Парсимо dialogId для отримання idUser (який є idProfile)
			const dialogId = req.headers.referer?.toString().split('/').pop() || '';
			const [idProfile] = dialogId.split('_').map(Number);
			body.idProfile = idProfile;
		}

		return this.chats.sendSticker(req.auth!, body as { idProfile: number; idRegularUser: number; stickerId: number; stickerUrl: string });
	}
}
