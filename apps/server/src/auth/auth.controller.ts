import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/auth/public.decorator';

@Controller('auth')
export class AuthController {
	constructor(private readonly auth: AuthService) {}

	@Public()
	@Post('login')
	login(@Body() body: { username: string; password: string }) {
		return this.auth.validateAndLogin(body.username, body.password);
	}
}
