import { Controller, Post, Body, Req, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import type { SiteProvider } from '../providers/site-provider.interface';
import { TalkyTimesRTMService } from '../providers/talkytimes/rtm.service';

// Сумісний контролер для середовищ, де /api префікс не зрізається Nginx-ом
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('api/tt')
export class TTCompatController {
  constructor(
    @Inject(TALKY_TIMES_PROVIDER) private readonly tt: SiteProvider,
    private readonly rtmService: TalkyTimesRTMService
  ) {}

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

  @Post('emails-history')
  async emailsHistory(
    @Req() _req: Request,
    @Body() body: { page?: number; limit?: number; id_correspondence: string; id_interlocutor: string; id_user: string; without_translation?: boolean }
  ) {
    try {
      const result = await (this.tt as any).getEmailHistory(
        body.id_user,
        parseInt(body.id_interlocutor),
        body.id_correspondence,
        body.page || 1,
        body.limit || 10
      );
      if (!result?.success) {
        return { success: false, error: result?.error || 'Failed to fetch email history' };
      }
      return result;
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }
}


