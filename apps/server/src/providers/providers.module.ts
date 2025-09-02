import { Module } from '@nestjs/common';
import { TalkyTimesProvider } from './talkytimes/talkytimes.provider';
import { TalkyTimesSessionService } from './talkytimes/session.service';
import { TalkyTimesRTMService } from './talkytimes/rtm.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConnectionPoolService } from '../common/http/connection-pool.service';

export const TALKY_TIMES_BASE_URL = 'TALKY_TIMES_BASE_URL';
export const TALKY_TIMES_PROVIDER = 'TALKY_TIMES_PROVIDER';

@Module({
	imports: [PrismaModule],
	providers: [
		TalkyTimesSessionService,
		TalkyTimesRTMService,
		{ provide: TALKY_TIMES_BASE_URL, useValue: process.env.TT_BASE_URL ?? 'mock:dev' },
		{ 
			provide: TALKY_TIMES_PROVIDER, 
			useFactory: (baseUrl: string, sessionService: TalkyTimesSessionService, connectionPool: ConnectionPoolService) => 
				new TalkyTimesProvider(baseUrl, sessionService, connectionPool), 
			inject: [TALKY_TIMES_BASE_URL, TalkyTimesSessionService, ConnectionPoolService] 
		},
	],
	exports: [TALKY_TIMES_PROVIDER, TALKY_TIMES_BASE_URL, TalkyTimesSessionService, TalkyTimesRTMService],
})
export class ProvidersModule {}
