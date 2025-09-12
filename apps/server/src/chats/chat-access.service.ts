import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatAccessService {
	constructor(private readonly prisma: PrismaService) {}

	async getAccessibleProfiles(auth: { agencyCode: string; userId: string; role: any }) {
		// Повертаємо профілі в межах агенції, доступні користувачу
		return this.prisma.profile.findMany({
			where: { group: { agency: { code: auth.agencyCode } } },
			select: { id: true, profileId: true, displayName: true, provider: true, credentialLogin: true },
		});
	}

	async canAccessProfile(profileId: string, auth: { agencyCode: string; userId: string; role: any }): Promise<boolean> {
		if (auth.role === 'OWNER') {
			// Owner може отримати доступ до будь-якого профілю своєї агенції
			const profiles = await this.prisma.profile.findMany({
				where: { group: { agency: { code: auth.agencyCode } } },
				select: { id: true, profileId: true },
			});
			return profiles.some(p => p.profileId === profileId);
		} else if (auth.role === 'OPERATOR') {
			// Operator може отримати доступ тільки до профілів своїх груп
			return this.prisma.profile.findFirst({
				where: { id: profileId, group: { agency: { code: auth.agencyCode } } },
			}) !== null;
		}
		return false;
	}

	async filterDialogsByAccess(dialogs: any, auth: { agencyCode: string; userId: string; role: any }): Promise<any> {
		// Якщо це не структура TalkyTimes з діалогами, повертаємо як є
		if (!dialogs || typeof dialogs !== 'object') {
			return dialogs;
		}

		// Якщо це помилка TalkyTimes, повертаємо як є
		if (dialogs.status === 'error') {
			return dialogs;
		}

		// Якщо немає масиву діалогів, повертаємо як є
		if (!dialogs.dialogs || !Array.isArray(dialogs.dialogs)) {
			return dialogs;
		}

		if (auth.role === 'OWNER') {
			// Owner бачить всі діалоги
			return dialogs;
		}

		// Для операторів фільтруємо діалоги на основі доступних профілів
		const accessibleProfiles = await this.getAccessibleProfiles(auth);
		const accessibleProfileIds = accessibleProfiles.map(p => p.profileId).filter(Boolean);
		
		// Фільтруємо діалоги за idUser (це profileId з нашої бази)
		const filteredDialogs = dialogs.dialogs.filter((dialog: any) => {
			// dialog.idUser відповідає profileId з нашої бази даних
			return accessibleProfileIds.includes(dialog.idUser?.toString());
		});

		return {
			...dialogs,
			dialogs: filteredDialogs
		};
	}
}
