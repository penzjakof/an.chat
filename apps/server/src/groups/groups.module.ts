import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [AuthModule],
	controllers: [GroupsController],
	providers: [GroupsService],
	exports: [GroupsService],
})
export class GroupsModule {}
