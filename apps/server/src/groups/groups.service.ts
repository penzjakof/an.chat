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
		// Легша відповідь для списку груп: без важких include, лише id+name
		return this.prisma.group.findMany({
			where: { agency: { code: agencyCode } },
			select: { id: true, name: true },
			orderBy: { createdAt: 'desc' }
		});
	}

	assignOperator(groupId: string, operatorId: string) {
		return this.prisma.operatorGroup.create({ data: { groupId, operatorId } });
	}
}
