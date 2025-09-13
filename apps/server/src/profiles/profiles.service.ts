import { Injectable, BadRequestException, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class ProfilesService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(TALKY_TIMES_PROVIDER) private readonly talkyTimesProvider: any,
		private readonly encryption: EncryptionService
	) {}

	async getAvailableMedia(profileId: string, agencyCode: string) {
		// Повертаємо список фото з галереї як "доступні медіа" через універсальний makeRequest
		try {
			const pid = parseInt(profileId);
			if (!Number.isFinite(pid)) {
				return { cursor: '', photos: [] } as any;
			}
			const provider: any = this.talkyTimesProvider as any;
			if (!provider?.makeRequest) {
				return { cursor: '', photos: [] } as any;
			}
			const response = await provider.makeRequest({
				method: 'POST',
				url: '/platform/gallery/photo/list',
				data: {
					cursor: '',
					statuses: ['approved', 'approved_by_ai'],
					tags: [],
					limit: 50,
					idAlbum: null,
					idAlbumExcluded: null,
					isTemporary: false,
				},
				profileId: pid,
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
			});
			if (!response?.success) {
				return { cursor: '', photos: [] } as any;
			}
			return response.data;
		} catch {
			return { cursor: '', photos: [] } as any;
		}
	}

	async authenticateProfile(profileId: string, loginOverride: string | undefined, password: string, agencyCode: string) {
		try {
			const profile = await this.prisma.profile.findUnique({ where: { id: profileId } });
			if (!profile) throw new BadRequestException('Profile not found');

			const decryptedPassword = this.encryption.decrypt(profile.credentialPassword ?? undefined);
			const loginToUse = loginOverride || profile.credentialLogin;
			if (!loginToUse) {
				throw new BadRequestException('Profile login credentials not found');
			}

			const result = await this.talkyTimesProvider.validateCredentials(loginToUse, password);

			const passwordsMatch = decryptedPassword === password;
			const updateData: Partial<typeof profile> = {} as any;
			if (loginOverride && loginOverride !== profile.credentialLogin) {
				(updateData as any).credentialLogin = loginOverride;
			}
			if (!passwordsMatch) {
				(updateData as any).credentialPassword = this.encryption.encrypt(password);
			}
			if (Object.keys(updateData).length > 0) {
				await this.prisma.profile.update({ where: { id: profileId }, data: updateData });
			}

			return result;
		} catch (e: any) {
			// Не ламаємо UI 500-кою, повертаємо контрольовану помилку
			throw new BadRequestException(e?.message || 'Помилка автентифікації');
		}
	}

	// ===== CRUD для профілів =====

	async listMine(agencyCode: string, role: 'OWNER' | 'OPERATOR', userId: string) {
		const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
		if (!agency) return [] as Array<{ id: string; credentialLogin: string | null; displayName: string | null; profileId?: string | null }>;

		if (role === 'OWNER') {
			return this.prisma.profile.findMany({
				where: {
					OR: [
						{ group: { agencyId: agency.id } },
						{ groupId: null } // показувати профілі без групи
					]
				},
				select: { id: true, credentialLogin: true, displayName: true, profileId: true },
				orderBy: { createdAt: 'desc' }
			});
		}

		// OPERATOR: профілі лише призначених груп
		const links = await this.prisma.operatorGroup.findMany({ where: { operatorId: userId } });
		if (links.length === 0) return [] as Array<{ id: string; credentialLogin: string | null; displayName: string | null; profileId?: string | null }>;
		const groupIds = links.map(l => l.groupId);
		return this.prisma.profile.findMany({
			where: { groupId: { in: groupIds } },
			select: { id: true, credentialLogin: true, displayName: true, profileId: true },
			orderBy: { createdAt: 'desc' }
		});
	}
	async listByAgencyCode(agencyCode: string) {
		try {
			const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
			if (!agency) return [] as any[];
			return await this.prisma.profile.findMany({
				where: {
					OR: [
						{ group: { agencyId: agency.id } },
						{ groupId: null }
					]
				},
				select: {
					id: true,
					displayName: true,
					credentialLogin: true,
					profileId: true,
					provider: true,
					status: true,
					createdAt: true,
					group: {
						select: {
							id: true,
							name: true
						}
					}
				},
				orderBy: { createdAt: 'desc' }
			});
		} catch (e) {
			console.error('profiles.listByAgencyCode failed:', (e as any)?.message);
			return [] as any[];
		}
	}

	async createProfile(data: { displayName: string; credentialLogin: string; credentialPassword?: string; provider: string; groupId: string }, agencyCode: string) {
		const group = await this.prisma.group.findUnique({ where: { id: data.groupId }, include: { agency: true } });
		if (!group || group.agency.code !== agencyCode) throw new ForbiddenException('Група не належить вашій агенції');
		const encrypted = data.credentialPassword ? this.encryption.encrypt(data.credentialPassword) : undefined;
		const externalId = data.credentialLogin || data.displayName || `profile_${Date.now()}`;
		return this.prisma.profile.create({
			data: {
				provider: (data.provider as any) || (Prisma as any).ProviderSite.TALKYTIMES,
				externalId,
				displayName: data.displayName || null,
				credentialLogin: data.credentialLogin || null,
				credentialPassword: encrypted || null,
				status: (Prisma as any).ProfileStatus.ACTIVE,
				groupId: group.id,
			},
			include: { group: true }
		});
	}

	async updateProfile(id: string, data: { displayName?: string; credentialLogin?: string; credentialPassword?: string; provider?: string; groupId?: string }, agencyCode: string) {
		const profile = await this.prisma.profile.findUnique({ where: { id }, include: { group: { include: { agency: true } } } });
		if (!profile) throw new NotFoundException('Профіль не знайдено');
		// Дозволяємо OWNER оновлювати профілі своєї агенції або профілі без групи
		const allowed = !!profile && (profile.group?.agency?.code === agencyCode || profile.groupId == null);
		if (!allowed) throw new ForbiddenException('Доступ заборонено');
		let targetGroupId = profile.groupId;
		if (data.groupId && data.groupId !== profile.groupId) {
			const newGroup = await this.prisma.group.findUnique({ where: { id: data.groupId }, include: { agency: true } });
			if (!newGroup || newGroup.agency.code !== agencyCode) throw new ForbiddenException('Група не належить вашій агенції');
			targetGroupId = newGroup.id;
		}
		const encrypted = data.credentialPassword ? this.encryption.encrypt(data.credentialPassword) : undefined;
		return this.prisma.profile.update({
			where: { id },
			data: {
				displayName: data.displayName ?? profile.displayName,
				credentialLogin: data.credentialLogin ?? profile.credentialLogin,
				credentialPassword: encrypted !== undefined ? encrypted : profile.credentialPassword,
				provider: (data.provider as any) || (profile as any).provider,
				groupId: targetGroupId,
			},
			include: { group: true }
		});
	}

	async deleteProfile(id: string, agencyCode: string) {
		const profile = await this.prisma.profile.findUnique({ where: { id }, include: { group: { include: { agency: true } } } });
		if (!profile) throw new NotFoundException('Профіль не знайдено');
		const allowed = !!profile && (profile.group?.agency?.code === agencyCode || profile.groupId == null);
		if (!allowed) throw new ForbiddenException('Доступ заборонено');
		await this.prisma.profile.delete({ where: { id } });
		return { success: true };
	}

	async getProfileDataById(id: string, agencyCode: string) {
		const profile = await this.prisma.profile.findUnique({ where: { id }, include: { group: { include: { agency: true } } } });
		if (!profile) throw new NotFoundException('Профіль не знайдено');
		const allowed = !!profile && (profile.group?.agency?.code === agencyCode || profile.groupId == null);
		if (!allowed) throw new ForbiddenException('Доступ заборонено');
		try {
			const pid = parseInt(profile.profileId || '');
			if (!Number.isFinite(pid)) {
				return { success: false, profileData: null } as any;
			}
			const provider2: any = this.talkyTimesProvider as any;
			if (!provider2?.fetchMyPublicProfile) {
				return { success: false, profileData: null } as any;
			}
			const res = await provider2.fetchMyPublicProfile(String(pid));
			if (res?.success) {
				return { success: true, profileData: res.profileData } as any;
			}
			return { success: false, profileData: null } as any;
		} catch {
			return { success: false, profileData: null } as any;
		}
	}

	async getClientPublicProfile(id: string, clientId: number, agencyCode: string) {
		const profile = await this.prisma.profile.findUnique({ where: { id }, include: { group: { include: { agency: true } } } });
		if (!profile) throw new NotFoundException('Профіль не знайдено');
		const allowed = !!profile && (profile.group?.agency?.code === agencyCode || profile.groupId == null);
		if (!allowed) throw new ForbiddenException('Доступ заборонено');
		const pid = parseInt(profile.profileId || '');
		if (!Number.isFinite(pid)) return { success: false, error: 'Немає profileId' } as any;
		const provider: any = this.talkyTimesProvider as any;
		if (!provider?.fetchProfiles) return { success: false, error: 'Сервіс профілів недоступний' } as any;
		try {
			const resp = await provider.fetchProfiles(String(pid), [clientId]);
			if (resp?.success && Array.isArray(resp.profiles) && resp.profiles.length > 0) {
				return { success: true, profile: resp.profiles[0] } as any;
			}
			return { success: false, error: 'Профіль не знайдено' } as any;
		} catch (e: any) {
			return { success: false, error: e?.message || 'Unknown error' } as any;
		}
	}

	async getClientPhotos(id: string, clientId: number, agencyCode: string) {
		const profile = await this.prisma.profile.findUnique({ where: { id }, include: { group: { include: { agency: true } } } });
		if (!profile) throw new NotFoundException('Профіль не знайдено');
		const allowed = !!profile && (profile.group?.agency?.code === agencyCode || profile.groupId == null);
		if (!allowed) throw new ForbiddenException('Доступ заборонено');
		const pid = parseInt(profile.profileId || '');
		if (!Number.isFinite(pid)) return { success: false, error: 'Немає profileId' } as any;
		const provider: any = this.talkyTimesProvider as any;
		if (!provider?.fetchClientPhotos) return { success: false, error: 'Сервіс фото недоступний' } as any;
		try {
			return await provider.fetchClientPhotos(String(pid), clientId);
		} catch (e: any) {
			return { success: false, error: e?.message || 'Unknown error' } as any;
		}
	}

	async getSessionsStatusBatch(ids: string[], agencyCode: string) {
		const result: Record<string, { authenticated: boolean; message: string }> = {};
		for (const id of ids) {
			try {
				const profile = await this.prisma.profile.findUnique({ where: { id }, include: { group: { include: { agency: true } } } });
				const allowed = !!profile && (profile.group?.agency?.code === agencyCode || profile.groupId == null);
				if (!allowed) {
					result[id] = { authenticated: false, message: 'Профіль не знайдено' };
					continue;
				}
				const pid = parseInt(profile.profileId || '');
				if (!Number.isFinite(pid)) {
					result[id] = { authenticated: false, message: 'Немає profileId' };
					continue;
				}
				const sessionService = (this.talkyTimesProvider as any)?.sessionService as undefined | { getSession: (profileId: string | number) => Promise<any> };
				if (!sessionService) {
					result[id] = { authenticated: false, message: 'Сервіс сесій недоступний' };
					continue;
				}
				const session = await sessionService.getSession(String(pid));
				result[id] = { authenticated: !!session, message: session ? 'Активна сесія' : 'Немає сесії' };
			} catch {
				result[id] = { authenticated: false, message: 'Помилка' };
			}
		}
		return { results: result };
	}

	async getGiftLimits(id: string, clientId: number, agencyCode: string) {
		if (!Number.isFinite(clientId)) {
			throw new BadRequestException('clientId is required');
		}
		const profile = await this.prisma.profile.findUnique({ where: { id }, include: { group: { include: { agency: true } } } });
		if (!profile) throw new NotFoundException('Профіль не знайдено');
		const allowed = !!profile && (profile.group?.agency?.code === agencyCode || profile.groupId == null);
		if (!allowed) throw new ForbiddenException('Доступ заборонено');
		const pid = parseInt(profile.profileId || '');
		if (!Number.isFinite(pid)) {
			return { success: false, error: 'Немає profileId для TalkyTimes' } as any;
		}
		const provider3: any = this.talkyTimesProvider as any;
		if (!provider3?.getVirtualGiftLimits) {
			return { success: false, error: 'Сервіс подарунків недоступний' } as any;
		}
		return await provider3.getVirtualGiftLimits(String(pid), clientId);
	}
}
