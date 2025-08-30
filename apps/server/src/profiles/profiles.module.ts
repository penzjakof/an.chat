import { Module } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { EncryptionValidatorService } from './encryption-validator.service';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { EncryptionModule } from '../common/encryption/encryption.module';

@Module({
	imports: [AuthModule, ProvidersModule, EncryptionModule],
	controllers: [ProfilesController],
	providers: [ProfilesService, EncryptionValidatorService],
	exports: [ProfilesService, EncryptionValidatorService],
})
export class ProfilesModule {}
