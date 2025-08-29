import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderSite, ProfileStatus } from '@prisma/client';
import { TalkyTimesProvider } from '../providers/talkytimes/talkytimes.provider';
import * as crypto from 'crypto';

function getKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key || key.length < 32) {
		// 32 bytes (256-bit) key expected; for dev fallback to fixed-length pad
		return Buffer.from((key ?? 'dev-encryption-key').padEnd(32, '0').slice(0, 32));
	}
	return Buffer.from(key.slice(0, 32));
}

function encrypt(plaintext: string | undefined): string | undefined {
	if (!plaintext) return undefined;
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
	const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]).toString('base64');
}

@Injectable()
export class ProfilesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly talkyTimesProvider: TalkyTimesProvider
	) {}

	async create(params: { groupId: string; provider: ProviderSite; displayName?: string; credentialLogin?: string; credentialPassword?: string }, agencyCode: string) {
		const { groupId, provider, displayName, credentialLogin, credentialPassword } = params;
		
		// Перевіряємо, що група належить до агенції
		const group = await this.prisma.group.findFirst({
			where: { id: groupId, agency: { code: agencyCode } }
		});
		
		if (!group) {
			throw new NotFoundException('Group not found');
		}

		// Валідація облікових даних для TalkyTimes
		if (provider === ProviderSite.TALKYTIMES && credentialLogin && credentialPassword) {
			const validation = await this.talkyTimesProvider.validateCredentials(credentialLogin, credentialPassword);
			if (!validation.success) {
				throw new BadRequestException(`Не вдалось залогінитись на TalkyTimes: ${validation.error || 'Невірні облікові дані'}`);
			}
		}

		// Генеруємо унікальний externalId для профілю
		const externalId = `${provider.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		return this.prisma.profile.create({
			data: {
				groupId,
				provider,
				externalId,
				displayName,
				credentialLogin,
				credentialPassword: encrypt(credentialPassword),
				status: ProfileStatus.ACTIVE,
			},
			include: {
				group: true
			}
		});
	}

	listByGroup(groupId: string) {
		return this.prisma.profile.findMany({ 
			where: { groupId },
			include: { group: true }
		});
	}

	listByAgencyCode(agencyCode: string) {
		return this.prisma.profile.findMany({
			where: {
				group: {
					agency: { code: agencyCode }
				}
			},
			include: {
				group: true
			}
		});
	}

	async update(profileId: string, updates: { displayName?: string; credentialLogin?: string; credentialPassword?: string; groupId?: string }, agencyCode: string) {
		// Перевіряємо, що профіль належить до агенції
		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: { agency: { code: agencyCode } }
			}
		});

		if (!profile) {
			throw new NotFoundException('Profile not found');
		}

		const updateData: any = {};

		if (updates.displayName !== undefined) {
			updateData.displayName = updates.displayName;
		}
		if (updates.credentialLogin !== undefined) {
			updateData.credentialLogin = updates.credentialLogin;
		}
		if (updates.credentialPassword !== undefined) {
			updateData.credentialPassword = encrypt(updates.credentialPassword);
		}
		if (updates.groupId) {
			// Перевіряємо, що нова група також належить до агенції
			const newGroup = await this.prisma.group.findFirst({
				where: { id: updates.groupId, agency: { code: agencyCode } }
			});
			if (!newGroup) {
				throw new NotFoundException('New group not found');
			}
			updateData.groupId = updates.groupId;
		}

		return this.prisma.profile.update({
			where: { id: profileId },
			data: updateData,
			include: { group: true }
		});
	}

	async delete(profileId: string, agencyCode: string) {
		// Перевіряємо, що профіль належить до агенції
		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: { agency: { code: agencyCode } }
			}
		});

		if (!profile) {
			throw new NotFoundException('Profile not found');
		}

		return this.prisma.profile.delete({
			where: { id: profileId }
		});
	}
}
