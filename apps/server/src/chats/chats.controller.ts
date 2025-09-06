import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SendPhotoDto } from './dto/send-photo.dto';
import { ActiveShiftGuard } from '../common/auth/auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard, ActiveShiftGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 запитів до чатів за хвилину
@Controller('api/chats')
export class ChatsController {
	constructor(private readonly chats: ChatsService) {}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs')
	async dialogs(@Req() req: Request, @Query() filters: { status?: string; search?: string; onlineOnly?: string; cursor?: string }) {
		try {
			console.log('🔍 ChatsController.dialogs called with auth:', {
				userId: req.auth?.userId,
				role: req.auth?.role,
				agencyCode: req.auth?.agencyCode,
				operatorCode: req.auth?.operatorCode
			});

			// Перетворюємо onlineOnly з string в boolean
			const processedFilters = {
				...filters,
				onlineOnly: filters.onlineOnly === 'true'
			};
			console.log('🔍 ChatsController.dialogs filters:', processedFilters);

			const result = await this.chats.fetchDialogs(req.auth!, processedFilters);
			console.log('✅ ChatsController.dialogs success:', {
				hasDialogs: (result as any)?.dialogs?.length > 0,
				dialogsCount: (result as any)?.dialogs?.length,
				hasProfiles: Object.keys((result as any)?.profiles || {}).length > 0
			});

			return result;
		} catch (error) {
			console.error('💥 ChatsController.dialogs error:', error);
			throw error;
		}
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
	@Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 текстових повідомлень за хвилину
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
	@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 фото за хвилину
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
	@Throttle({ default: { limit: 15, ttl: 60000 } }) // 15 стікерів за хвилину
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

	@Roles(Role.OWNER, Role.OPERATOR)
	@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 запитів за хвилину
	@Post('tt-restrictions')
	async getTtRestrictions(@Req() req: Request, @Body() body: { profileId: number; idInterlocutor: number }) {
		console.log('⚡ ChatsController.getTtRestrictions called:', body);
		return this.chats.getTtRestrictions(req.auth!, body.profileId, body.idInterlocutor);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 запитів за хвилину
	@Post('tt-forbidden-tags')
	async getForbiddenTags(@Req() req: Request, @Body() body: { profileId: number; idInterlocutor: number }) {
		console.log('⚠️ ChatsController.getForbiddenTags called:', body);
		return this.chats.getForbiddenCorrespondenceTags(req.auth!, body.profileId, body.idInterlocutor);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 листів за хвилину
	@Post('send-letter')
	async sendLetter(@Req() req: Request, @Body() body: { profileId: number; idUserTo: number; content: string; photoIds?: number[]; videoIds?: number[] }) {
		console.log('✉️ ChatsController.sendLetter called:', { profileId: body.profileId, idUserTo: body.idUserTo, textLen: body.content?.length, photos: body.photoIds?.length || 0, videos: body.videoIds?.length || 0 });
		return this.chats.sendLetter(req.auth!, body.profileId, body.idUserTo, { content: body.content, photoIds: body.photoIds, videoIds: body.videoIds });
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('tt-send-post')
	async sendExclusivePost(
		@Req() req: Request,
		@Body() body: { profileId: number; idRegularUser: number; idsGalleryPhotos: number[]; idsGalleryVideos: number[]; text: string }
	) {
		console.log('📝 ChatsController.sendExclusivePost called:', { profileId: body.profileId, idRegularUser: body.idRegularUser, photos: body.idsGalleryPhotos?.length || 0, videos: body.idsGalleryVideos?.length || 0, textLen: body.text?.length || 0 });
		return this.chats.sendExclusivePost(req.auth!, body);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('tt-post-details')
	async getPostDetails(@Req() req: Request, @Body() body: { idPost: number; idProfile: number; idInterlocutor: number }) {
		console.log('📄 ChatsController.getPostDetails called:', { idPost: body.idPost, idProfile: body.idProfile, idInterlocutor: body.idInterlocutor });
		console.log('🔐 Auth context:', { userId: req.auth?.userId, agencyCode: req.auth?.agencyCode, operatorCode: req.auth?.operatorCode });
		return this.chats.getPostDetails(req.auth!, body.idPost, body.idProfile, body.idInterlocutor);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('photo-original')
	getOriginalPhoto(@Req() req: Request, @Body() body: { profileId: string; idRegularUser: number; previewUrl: string }) {
		return this.chats.getOriginalPhotoUrl(req.auth!, body.profileId, body.idRegularUser, body.previewUrl);
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Post('connections')
	getConnections(@Req() req: Request, @Body() body: { profileId: number; idsInterlocutor: number[] }) {
		return this.chats.getConnections(req.auth!, body.profileId, body.idsInterlocutor);
	}
}
