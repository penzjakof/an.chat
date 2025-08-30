import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TTModule } from './talkytimes/tt.module';
import { ChatsModule } from './chats/chats.module';
import { BackupModule } from './backup/backup.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { EncryptionValidatorService } from './profiles/encryption-validator.service';

@Module({
	imports: [PrismaModule, UsersModule, GroupsModule, ProfilesModule, TTModule, ChatsModule, BackupModule, AuthModule],
	controllers: [AppController],
	providers: [
		AppService,
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: RolesGuard },
	],
})
export class AppModule implements OnModuleInit {
	constructor(private readonly encryptionValidator: EncryptionValidatorService) {}

	async onModuleInit() {
		// Автоматично перевіряємо і виправляємо шифрування при старті
		await this.encryptionValidator.validateAndFixProfiles();
	}
}
