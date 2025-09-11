import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderSite, ProfileStatus } from '@prisma/client';
import { TalkyTimesProvider } from '../providers/talkytimes/talkytimes.provider';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class ProfilesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly talkyTimesProvider: TalkyTimesProvider,
		private readonly encryption: EncryptionService
	) {}

	async getAvailableMedia(profileId: string, agencyCode: string) {
		return this.talkyTimesProvider.getGallery(profileId, agencyCode);
	}

	async authenticateProfile(profileId: string, loginOverride: string | undefined, password: string, agencyCode: string) {
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
	}
}
