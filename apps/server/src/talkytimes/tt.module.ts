import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { TTController } from './tt.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [ProvidersModule, AuthModule],
	controllers: [TTController],
})
export class TTModule {}
