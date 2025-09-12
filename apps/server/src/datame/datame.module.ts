import { Module } from '@nestjs/common';
import { DatameService } from './datame.service';
import { DatameController } from './datame.controller';
import { HttpModule } from '../common/http/http.module';

@Module({
  imports: [HttpModule],
  controllers: [DatameController],
  providers: [DatameService],
  exports: [DatameService],
})
export class DatameModule {}


