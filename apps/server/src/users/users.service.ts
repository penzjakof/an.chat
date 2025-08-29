import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	async createOwner(params: { agencyCode: string; username: string; name: string; password: string }): Promise<any> {
		const { agencyCode, username, name, password } = params;
		const agency = await this.prisma.agency.findUniqueOrThrow({ where: { code: agencyCode } });
		const passwordHash = await bcrypt.hash(password, 10);
		return this.prisma.user.create({ data: { agencyId: agency.id, username: username.toLowerCase(), name, role: Role.OWNER, status: UserStatus.ACTIVE, passwordHash } });
	}

	async createOperator(params: { agencyCode: string; username: string; name: string; password: string; operatorCode: string }): Promise<any> {
		const { agencyCode, username, name, password, operatorCode } = params;
		const agency = await this.prisma.agency.findUniqueOrThrow({ where: { code: agencyCode } });
		const passwordHash = await bcrypt.hash(password, 10);
		return this.prisma.user.create({ data: { agencyId: agency.id, username: username.toLowerCase(), name, role: Role.OPERATOR, operatorCode, status: UserStatus.ACTIVE, passwordHash } });
	}

	findManyByAgencyCode(agencyCode: string) {
		return this.prisma.user.findMany({ where: { agency: { code: agencyCode } } });
	}

	blockUser(userId: string) {
		return this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.BLOCKED } });
	}
}
