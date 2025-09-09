import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { TTController } from './tt.controller';
import { TTCompatController } from './tt.compat.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [ProvidersModule, AuthModule],
	controllers: [TTController, TTCompatController],
	exports: [ProvidersModule], // Експортуємо ProvidersModule щоб TalkyTimesRTMService був доступний
})
export class TTModule {}
