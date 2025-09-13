import { Module } from '@nestjs/common';
import { DatameService } from './datame.service';
import { DatameController } from './datame.controller';
import { DatameImportController } from './datame.controller';
import { HttpModule } from '../common/http/http.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../common/encryption/encryption.module';
import { DatameImportService } from './datame.import.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [HttpModule, PrismaModule, EncryptionModule, AuthModule],
  controllers: [DatameController, DatameImportController],
  providers: [DatameService, DatameImportService],
  exports: [DatameService, DatameImportService],
})
export class DatameModule {}


