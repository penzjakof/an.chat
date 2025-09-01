import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderSite, ProfileStatus } from '@prisma/client';
import { TalkyTimesProvider } from '../providers/talkytimes/talkytimes.provider';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import { EncryptionService } from '../common/encryption/encryption.service';
import { TalkyTimesSessionService } from '../providers/talkytimes/session.service';



@Injectable()
export class ProfilesService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(TALKY_TIMES_PROVIDER) private readonly talkyTimesProvider: TalkyTimesProvider,
		private readonly encryption: EncryptionService,
		private readonly sessionService: TalkyTimesSessionService
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
			},
			orderBy: { createdAt: 'desc' }
		});
	}

	async listByOperatorAccess(operatorId: string, agencyCode: string) {
		// Отримуємо профілі з груп, до яких має доступ оператор
		return this.prisma.profile.findMany({
			where: {
				group: {
					agency: { code: agencyCode },
					operators: {
						some: {
							operatorId: operatorId
						}
					}
				}
			},
			include: {
				group: true
			},
			orderBy: { createdAt: 'desc' }
		});
	}

	async hasAccessToProfile(profileId: string, operatorId: string, agencyCode: string): Promise<boolean> {
		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: {
					agency: { code: agencyCode },
					operators: {
						some: {
							operatorId: operatorId
						}
					}
				}
			}
		});
		return !!profile;
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

	async authenticateProfile(profileId: string, password: string, agencyCode: string) {
		console.log(`🔐 Authenticating profile ${profileId} with agencyCode ${agencyCode}`);
		
		// Знаходимо профіль
		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: {
					agency: { code: agencyCode }
				}
			}
		});

		if (!profile) {
			console.log(`❌ Profile ${profileId} not found for agency ${agencyCode}`);
			throw new NotFoundException('Profile not found');
		}
		
		console.log(`✅ Profile found: ${profile.displayName}, credentialLogin: ${profile.credentialLogin}`);

		// Перевіряємо, що є облікові дані
		if (!profile.credentialPassword || !profile.credentialLogin) {
			throw new BadRequestException('Profile credentials not found');
		}

		// Розшифровуємо пароль
		const decryptedPassword = this.encryption.decrypt(profile.credentialPassword);
		console.log(`🔓 Decrypted password matches provided: ${decryptedPassword === password}`);
		
		// Перевіряємо пароль
		if (decryptedPassword !== password) {
			console.log(`❌ Password mismatch for profile ${profileId}`);
			throw new BadRequestException('Invalid password');
		}

		// Автентифікуємо профіль через провайдер
		console.log(`🚀 Calling TalkyTimes validateCredentials for ${profile.credentialLogin}`);
		const result = await this.talkyTimesProvider.validateCredentials(profile.credentialLogin, password);
		
		console.log(`📥 TalkyTimes auth result:`, { success: result.success, error: result.error, profileId: result.profileId });
		
		if (!result.success) {
			console.log(`❌ TalkyTimes authentication failed: ${result.error}`);
			throw new BadRequestException(result.error || 'Authentication failed');
		}

		// Оновлюємо профіль з новим profileId якщо потрібно
		if (result.profileId && result.profileId !== profile.profileId) {
			console.log(`🔄 Updating profileId from ${profile.profileId} to ${result.profileId}`);
			await this.prisma.profile.update({
				where: { id: profileId },
				data: { profileId: result.profileId }
			});
		}

		console.log(`✅ Profile authenticated successfully: ${result.profileId || profile.profileId}`);
		return {
			success: true,
			profileId: result.profileId || profile.profileId,
			message: 'Profile authenticated successfully'
		};
	}

	async getProfileSessionStatus(profileId: string, agencyCode: string) {
		// Знаходимо профіль
		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: {
					agency: { code: agencyCode }
				}
			}
		});

		if (!profile) {
			throw new NotFoundException('Profile not found');
		}

		if (!profile.profileId) {
			return {
				authenticated: false,
				message: 'Profile not authenticated'
			};
		}

		// Перевіряємо статус сесії
		const isValid = await this.sessionService.validateSession(profile.profileId);
		
		return {
			authenticated: isValid,
			profileId: profile.profileId,
			message: isValid ? 'Session is active' : 'Session expired'
		};
	}

	async getProfileData(profileId: string, agencyCode: string) {
		const profile = await this.prisma.profile.findFirst({
			where: { id: profileId, group: { agency: { code: agencyCode } } }
		});

		if (!profile || !profile.profileId) {
			return { success: false, error: 'Profile not found or not authenticated' };
		}

		if (!this.talkyTimesProvider.fetchProfileData) {
			return { success: false, error: 'Profile data fetching not supported' };
		}

		return this.talkyTimesProvider.fetchProfileData(profile.profileId);
	}

	async getGiftLimits(profileId: string, clientId: number, agencyCode: string) {
		console.log(`🎁 Getting gift limits for profile ${profileId}, client ${clientId}, agency ${agencyCode}`);

		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: {
					agency: { code: agencyCode }
				}
			}
		});

		if (!profile) {
			throw new NotFoundException('Profile not found');
		}

		if (!profile.profileId) {
			throw new BadRequestException('Profile not authenticated');
		}

		// Викликаємо метод отримання лімітів з TalkyTimes провайдера
		return this.talkyTimesProvider.getVirtualGiftLimits(profile.profileId, clientId);
	}

	async getGiftList(profileId: string, clientId: number, cursor: string = '', limit: number = 30, agencyCode: string) {
		console.log(`🎁 Getting gift list for profile ${profileId}, client ${clientId}, cursor=${cursor}, limit=${limit}, agency ${agencyCode}`);

		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: {
					agency: { code: agencyCode }
				}
			}
		});

		if (!profile) {
			throw new NotFoundException('Profile not found');
		}

		if (!profile.profileId) {
			throw new BadRequestException('Profile not authenticated');
		}

		// Викликаємо метод отримання списку подарунків з TalkyTimes провайдера
		const result = await this.talkyTimesProvider.getVirtualGiftList(profile.profileId, clientId, cursor, limit);

		// Логуємо результат для діагностики
		if (result.success && result.data) {
			console.log(`🎁 ProfilesService returning ${result.data.items?.length || 0} gifts`);
			result.data.items?.slice(0, 2).forEach((item, index) => {
				console.log(`🎁 Gift ${index + 1}: ${item.name}, imageSrc: ${item.imageSrc}`);
			});
		}

		return result;
	}

	async sendGift(profileId: string, clientId: number, giftId: number, message: string = '', agencyCode: string) {
		console.log(`🎁 Sending gift ${giftId} from profile ${profileId} to client ${clientId}, message: "${message}"`);

		const profile = await this.prisma.profile.findFirst({
			where: {
				id: profileId,
				group: {
					agency: { code: agencyCode }
				}
			}
		});

		if (!profile) {
			throw new NotFoundException('Profile not found');
		}

		if (!profile.profileId) {
			throw new BadRequestException('Profile not authenticated');
		}

		const result = await this.talkyTimesProvider.sendVirtualGift(profile.profileId, clientId, giftId, message);

		console.log(`🎁 Gift send result:`, result);
		return result;
	}
}
