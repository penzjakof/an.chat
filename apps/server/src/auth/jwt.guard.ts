import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Role } from '../common/auth/auth.types';
import { IS_PUBLIC_KEY } from '../common/auth/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
	private readonly logger = new Logger(JwtAuthGuard.name);
	
	constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}
	
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
		if (isPublic) return true;
		
		const req = context.switchToHttp().getRequest<Request>();
		const auth = req.headers.authorization;
		
		if (!auth || !auth.startsWith('Bearer ')) {
			this.logger.warn(`🚨 JWT Guard: Missing authorization header for ${req.method} ${req.url}`);
			throw new UnauthorizedException();
		}
		
		const token = auth.slice('Bearer '.length);
		
		try {
			const payload = await this.jwt.verifyAsync<{ sub: string; role: Role; agencyCode: string; operatorCode?: string }>(token);
			req.auth = { agencyCode: payload.agencyCode, role: payload.role, userId: payload.sub, operatorCode: payload.operatorCode } as any;
			return true;
		} catch (error: any) {
			this.logger.warn(`🚨 JWT Guard: Token verification failed for ${req.method} ${req.url}: ${error.message}`);
			throw new UnauthorizedException();
		}
	}
}
