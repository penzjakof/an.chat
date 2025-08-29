import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
	constructor(private readonly prisma: PrismaService) {}

	async create(agencyCode: string, name: string) {
		const agency = await this.prisma.agency.findUniqueOrThrow({ where: { code: agencyCode } });
		return this.prisma.group.create({ data: { agencyId: agency.id, name } });
	}

	listByAgencyCode(agencyCode: string) {
		return this.prisma.group.findMany({ where: { agency: { code: agencyCode } }, include: { profiles: true, operators: true } });
	}

	assignOperator(groupId: string, operatorId: string) {
		return this.prisma.operatorGroup.create({ data: { groupId, operatorId } });
	}
}
