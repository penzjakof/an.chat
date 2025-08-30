import { Module } from '@nestjs/common';
import { TalkyTimesProvider } from './talkytimes/talkytimes.provider';
import { TalkyTimesSessionService } from './talkytimes/session.service';
import { PrismaModule } from '../prisma/prisma.module';

export const TALKY_TIMES_BASE_URL = 'TALKY_TIMES_BASE_URL';
export const TALKY_TIMES_PROVIDER = 'TALKY_TIMES_PROVIDER';

@Module({
	imports: [PrismaModule],
	providers: [
		TalkyTimesSessionService,
		{ provide: TALKY_TIMES_BASE_URL, useValue: process.env.TT_BASE_URL ?? 'mock:dev' },
		{ 
			provide: TALKY_TIMES_PROVIDER, 
			useFactory: (baseUrl: string, sessionService: TalkyTimesSessionService) => 
				new TalkyTimesProvider(baseUrl, sessionService), 
			inject: [TALKY_TIMES_BASE_URL, TalkyTimesSessionService] 
		},
	],
	exports: [TALKY_TIMES_PROVIDER, TALKY_TIMES_BASE_URL, TalkyTimesSessionService],
})
export class ProvidersModule {}
