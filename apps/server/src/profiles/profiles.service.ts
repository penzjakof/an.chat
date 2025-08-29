import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderSite, ProfileStatus } from '@prisma/client';
import { TalkyTimesProvider } from '../providers/talkytimes/talkytimes.provider';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import { EncryptionService } from '../common/encryption/encryption.service';



@Injectable()
export class ProfilesService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(TALKY_TIMES_PROVIDER) private readonly talkyTimesProvider: TalkyTimesProvider,
		private readonly encryption: EncryptionService
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
		let platformProfileId: string | undefined;
		if (provider === ProviderSite.TALKYTIMES && credentialLogin && credentialPassword) {
			const validation = await this.talkyTimesProvider.validateCredentials(credentialLogin, credentialPassword);
			if (!validation.success) {
				throw new BadRequestException(`Не вдалось залогінитись на TalkyTimes: ${validation.error || 'Невірні облікові дані'}`);
			}
			platformProfileId = validation.profileId;
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
				credentialPassword: this.encryption.encrypt(credentialPassword),
				profileId: platformProfileId,
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
			updateData.credentialPassword = this.encryption.encrypt(updates.credentialPassword);
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
