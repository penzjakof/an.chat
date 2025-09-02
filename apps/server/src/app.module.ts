import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TTModule } from './talkytimes/tt.module';
import { ChatsModule } from './chats/chats.module';
import { BackupModule } from './backup/backup.module';
import { GalleryModule } from './gallery/gallery.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { EncryptionValidatorService } from './profiles/encryption-validator.service';
import { HttpModule } from './common/http/http.module';

@Module({
	imports: [
		EventEmitterModule.forRoot(),
		// Rate limiting конфігурація
		ThrottlerModule.forRoot([
			{
				name: 'short',
				ttl: 1000, // 1 секунда
				limit: 10, // 10 запитів за секунду
			},
			{
				name: 'medium',
				ttl: 60000, // 1 хвилина
				limit: 100, // 100 запитів за хвилину
			},
			{
				name: 'long',
				ttl: 3600000, // 1 година
				limit: 1000, // 1000 запитів за годину
			}
		]),
		HttpModule,
		PrismaModule, 
		UsersModule, 
		GroupsModule, 
		ProfilesModule, 
		TTModule, 
		ChatsModule, 
		BackupModule, 
		GalleryModule,
		AuthModule
	],
	controllers: [AppController],
	providers: [
		AppService,
		// Rate limiting guard (глобальний)
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		// Тимчасово відключили для тестування
		// { provide: APP_GUARD, useClass: JwtAuthGuard },
		// { provide: APP_GUARD, useClass: RolesGuard },
	],
})
export class AppModule implements OnModuleInit {
	constructor(private readonly encryptionValidator: EncryptionValidatorService) {}

	async onModuleInit() {
		// Автоматично перевіряємо і виправляємо шифрування при старті
		await this.encryptionValidator.validateAndFixProfiles();
	}
}
