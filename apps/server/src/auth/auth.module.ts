import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
	imports: [JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret', signOptions: { expiresIn: '7d' } })],
	controllers: [AuthController],
	providers: [AuthService],
	exports: [JwtModule, AuthService],
})
export class AuthModule {}
