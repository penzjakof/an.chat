import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/auth/roles.guard';
import { Role } from '../common/auth/auth.types';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import type { SiteProvider } from '../providers/site-provider.interface';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';

@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('tt')
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
		const status = this.rtmService.getConnectionStatus();
		return {
			connections: status,
			timestamp: new Date().toISOString()
		};
	}

	@Post('test-toast')
	async testToast(@Body() body: { idUserFrom: number; idUserTo: number; message?: string }) {
		const testData = {
			messageId: Date.now(),
			idUserFrom: body.idUserFrom || 126965361,
			idUserTo: body.idUserTo || 7162437,
			dateCreated: new Date().toISOString(),
			content: { message: body.message || 'Test message' }
		};
		return { success: true, testData };
	}

	@Get('profiles/:profileId/details/:idPost/interlocutor/:idInterlocutor')
	@Roles(Role.OWNER, Role.OPERATOR)
	getPostDetails(@Param('profileId') profileId: string, @Param('idPost') idPost: string, @Param('idInterlocutor') idInterlocutor: string, @Req() req: Request) {
		return (this.tt as any).getPostDetails(Number(idPost), Number(profileId), Number(idInterlocutor), { agencyCode: req.auth!.agencyCode, operatorCode: req.auth!.operatorCode });
	}
}
