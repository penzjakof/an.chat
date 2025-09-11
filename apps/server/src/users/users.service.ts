import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/auth/auth.types';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
	constructor(private readonly prisma: PrismaService) {}

	async createOwner(params: { agencyCode: string; username: string; name: string; password: string }): Promise<any> {
		const { agencyCode, username, name, password } = params;
		const agency = await this.prisma.agency.findUniqueOrThrow({ where: { code: agencyCode } });
		const passwordHash = await bcrypt.hash(password, 10);
		return this.prisma.user.create({ data: { agencyId: agency.id, username: username.toLowerCase(), name, role: Role.OWNER, status: true, passwordHash } });
	}

	async createOperator(params: { agencyCode: string; username: string; name: string; password: string; operatorCode: string }): Promise<any> {
		const { agencyCode, username, name, password, operatorCode } = params;
		const agency = await this.prisma.agency.findUniqueOrThrow({ where: { code: agencyCode } });
		const passwordHash = await bcrypt.hash(password, 10);
		return this.prisma.user.create({ data: { agencyId: agency.id, username: username.toLowerCase(), name, role: Role.OPERATOR, operatorCode, status: true, passwordHash } });
	}

	findManyByAgencyCode(agencyCode: string) {
		return this.prisma.user.findMany({ where: { agency: { code: agencyCode } } });
	}

	blockUser(userId: string) {
		return this.prisma.user.update({ where: { id: userId }, data: { status: false } });
	}

	async findOperatorsByAgencyCode(agencyCode: string) {
		return this.prisma.user.findMany({
			where: { 
				agency: { code: agencyCode },
				role: Role.OPERATOR
			},
			include: {
				operatorLinks: {
					include: {
						group: true
					}
				}
			}
		});
	}

	async updateOperator(
		operatorId: string, 
		updates: { username?: string; name?: string; password?: string; operatorCode?: string; groupId?: string },
		agencyCode: string
	) {
		// Перевіряємо, що оператор належить до агенції
		const operator = await this.prisma.user.findFirst({
			where: { 
				id: operatorId, 
				role: Role.OPERATOR,
				agency: { code: agencyCode }
			}
		});

		if (!operator) {
			throw new NotFoundException('Operator not found');
		}

		const updateData: any = {};
		
		if (updates.username) {
			updateData.username = updates.username.toLowerCase();
		}
		if (updates.name) {
			updateData.name = updates.name;
		}
		if (updates.password) {
			updateData.passwordHash = await bcrypt.hash(updates.password, 10);
		}
		if (updates.operatorCode) {
			updateData.operatorCode = updates.operatorCode;
		}

		const updatedOperator = await this.prisma.user.update({
			where: { id: operatorId },
			data: updateData,
			include: {
				operatorLinks: {
					include: {
						group: true
					}
				}
			}
		});

		// Якщо передано groupId, оновлюємо зв'язок з групою
		if (updates.groupId) {
			// Спочатку видаляємо старі зв'язки
			await this.prisma.operatorGroup.deleteMany({
				where: { operatorId: operatorId }
			});

			// Додаємо новий зв'язок, якщо groupId не порожній
			if (updates.groupId !== '') {
				await this.prisma.operatorGroup.create({
					data: {
						operatorId: operatorId,
						groupId: updates.groupId
					}
				});
			}
		}

		return updatedOperator;
	}

	async deleteOperator(operatorId: string, agencyCode: string) {
		// Перевіряємо, що оператор належить до агенції
		const operator = await this.prisma.user.findFirst({
			where: { 
				id: operatorId, 
				role: Role.OPERATOR,
				agency: { code: agencyCode }
			}
		});

		if (!operator) {
			throw new NotFoundException('Operator not found');
		}

		// Видаляємо зв'язки з групами
		await this.prisma.operatorGroup.deleteMany({
			where: { operatorId: operatorId }
		});

		// Видаляємо оператора
		return this.prisma.user.delete({
			where: { id: operatorId }
		});
	}

	async me(userId: string) {
		return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, name: true, role: true, status: true, operatorCode: true } });
	}
}
