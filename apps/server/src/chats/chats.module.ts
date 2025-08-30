import { Module } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { ChatAccessService } from './chat-access.service';
import { ProvidersModule } from '../providers/providers.module';
import { AuthModule } from '../auth/auth.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
	imports: [ProvidersModule, AuthModule, ProfilesModule],
	controllers: [ChatsController],
	providers: [ChatsService, ChatsGateway, ChatAccessService],
	exports: [ChatsService],
})
export class ChatsModule {}
