import { Module } from '@nestjs/common';
import { TalkyTimesProvider } from './talkytimes/talkytimes.provider';

export const TALKY_TIMES_BASE_URL = 'TALKY_TIMES_BASE_URL';
export const TALKY_TIMES_PROVIDER = 'TALKY_TIMES_PROVIDER';

@Module({
	providers: [
		{ provide: TALKY_TIMES_BASE_URL, useValue: process.env.TT_BASE_URL ?? 'mock:' },
		{ provide: TALKY_TIMES_PROVIDER, useFactory: (baseUrl: string) => new TalkyTimesProvider(baseUrl), inject: [TALKY_TIMES_BASE_URL] },
	],
	exports: [TALKY_TIMES_PROVIDER, TALKY_TIMES_BASE_URL],
})
export class ProvidersModule {}
