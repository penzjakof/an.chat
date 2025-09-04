import { Controller, Get, Param, Post, Query, Req, UseGuards, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles, RolesGuard } from '../common/auth/roles.guard';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import type { SiteProvider } from '../providers/site-provider.interface';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';

//@UseGuards(JwtAuthGuard, RolesGuard) // Тимчасово відключили для тестування
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 запитів до TT API за хвилину
@Controller('api/tt')
export class TTController {
	constructor(
		@Inject(TALKY_TIMES_PROVIDER) private readonly tt: SiteProvider,
		private readonly rtmService: TalkyTimesRTMService
	) {}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs')
	async dialogs(@Req() req: Request, @Query('search') search?: string, @Query('status') status?: string) {
		return this.tt.fetchDialogs({ agencyCode: req.auth!.agencyCode, operatorCode: req.auth!.operatorCode }, { search, status });
	}

	@Roles(Role.OWNER, Role.OPERATOR)
	@Get('dialogs/:id/messages')
	async messages(@Req() req: Request, @Param('id') id: string, @Query('cursor') cursor?: string) {
		return this.tt.fetchMessages({ agencyCode: req.auth!.agencyCode, operatorCode: req.auth!.operatorCode }, id, cursor);
	}

	//@Roles(Role.OWNER, Role.OPERATOR) // Тимчасово відключили для тестування
	@Post('emails-history')
	async emailsHistory(@Req() req: Request, @Body() body: { page?: number; limit?: number; id_correspondence: string; id_interlocutor: string; id_user: string; without_translation?: boolean }) {
		console.log('📧 TTController.emailsHistory called with:', body);

		const result = await (this.tt as any).getEmailHistory(
			body.id_user,
			parseInt(body.id_interlocutor),
			body.id_correspondence,
			body.page || 1,
			body.limit || 10
		);

		if (!result.success) {
			console.error('❌ Failed to fetch email history:', result.error);
			return { success: false, error: result.error };
		}

		return result;
	}

	@Get('rtm-status')
	async getRtmStatus() {
		const status = this.rtmService.getConnectionStatus();
		const connectedProfiles = Object.keys(status).filter(profileId => status[parseInt(profileId)]);
		return {
			status: connectedProfiles.length > 0 ? 'connected' : 'disconnected',
			connectedProfiles: connectedProfiles.map(id => parseInt(id)),
			totalProfiles: Object.keys(status).length,
			timestamp: new Date().toISOString()
		};
	}

	@Get('sessions')
	async getActiveSessions() {
		// Тимчасовий endpoint для діагностики сесій
		const status = this.rtmService.getConnectionStatus();
		return {
			connections: status,
			timestamp: new Date().toISOString()
		};
	}

	@Post('test-toast')
	async testToast(@Body() body: { idUserFrom: number; idUserTo: number; message?: string }) {
		// Тестовий endpoint для симуляції RTM повідомлення
		const testData = {
			messageId: Date.now(),
			idUserFrom: body.idUserFrom || 126965361,
			idUserTo: body.idUserTo || 7162437,
			dateCreated: new Date().toISOString(),
			content: { message: body.message || 'Test message' }
		};

		// Емітимо подію як RTM (тимчасово відключено)
		// this.rtmService.simulateRTMMessage(testData);
		
		return { success: true, testData };
	}
}
