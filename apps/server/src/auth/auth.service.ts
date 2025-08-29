import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
	constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

	async validateAndLogin(username: string, password: string): Promise<{ accessToken: string }>
	{
		const user = await this.prisma.user.findUnique({
			where: { username: username.toLowerCase() },
			include: { agency: true },
		});
		if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) throw new UnauthorizedException('Invalid credentials');
		const payload = {
			sub: user.id,
			role: user.role,
			agencyCode: user.agency.code,
			operatorCode: user.operatorCode ?? undefined,
		};
		const accessToken = await this.jwt.signAsync(payload, { expiresIn: '1d' });
		return { accessToken };
	}
}
