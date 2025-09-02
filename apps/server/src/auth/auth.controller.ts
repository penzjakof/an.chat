import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../common/auth/public.decorator';

@Controller('auth')
export class AuthController {
	constructor(private readonly auth: AuthService) {}

	@Public()
	@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 спроб входу за хвилину
	@Post('login')
	login(@Body() body: { username: string; password: string }) {
		return this.auth.validateAndLogin(body.username, body.password);
	}
}
