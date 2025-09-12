import { Module } from '@nestjs/common';
import { DatameService } from './datame.service';
import { DatameController } from './datame.controller';
import { HttpModule } from '../common/http/http.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { DatameImportService } from './datame.import.service';

@Module({
  imports: [HttpModule, PrismaModule, EncryptionModule],
  controllers: [DatameController],
  providers: [DatameService, DatameImportService],
  exports: [DatameService, DatameImportService],
})
export class DatameModule {}


