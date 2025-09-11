import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/auth/public.decorator';
import { readGitCommitShort } from './common/version/version.util';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('version')
  @Header('Cache-Control', 'no-store')
  version() {
    const commit = readGitCommitShort();
    return { commit };
  }

}
