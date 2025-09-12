import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DatameService } from './datame.service';

@Controller('api/datame')
export class DatameController {
  // Для простоти — в cookieHeader передаємо повний Cookie рядок з tld-token, user, _csrf
  constructor(private readonly datame: DatameService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string; cookieHeader?: string }) {
    const { email, password, cookieHeader } = body;
    const res = await this.datame.login(email, password, cookieHeader);
    return { success: true, ...res };
  }

  @Post('collection')
  async collection(@Body() body: { status?: string; limit?: number; id_last?: number | string; cookieHeader: string }) {
    const data = await this.datame.collection({ status: body.status, limit: body.limit, id_last: body.id_last }, body.cookieHeader);
    return data;
  }

  @Post('form-data')
  async formData(@Body() body: { id: number; cookieHeader: string }) {
    const data = await this.datame.formData(body.id, body.cookieHeader);
    return data;
  }

  @Post('female')
  async female(@Body() body: { id: number; cookieHeader: string }) {
    const data = await this.datame.getFemale(body.id, body.cookieHeader);
    return data;
  }
}


