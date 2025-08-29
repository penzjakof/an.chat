import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { ProvidersModule } from '../providers/providers.module';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [ProvidersModule, AuthModule],
	controllers: [ChatsController],
	providers: [ChatsService, ChatsGateway],
	exports: [ChatsService],
})
export class ChatsModule {}
