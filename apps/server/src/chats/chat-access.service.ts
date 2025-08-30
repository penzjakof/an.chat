import { Injectable } from '@nestjs/common';
import { ProfilesService } from '../profiles/profiles.service';
import { Role } from '@prisma/client';
import type { RequestAuthContext } from '../common/auth/auth.types';

@Injectable()
export class ChatAccessService {
	constructor(private readonly profiles: ProfilesService) {}

	async getAccessibleProfiles(auth: RequestAuthContext) {
		if (auth.role === Role.OWNER) {
			// Owner має доступ до всіх профілів агенції
			return this.profiles.listByAgencyCode(auth.agencyCode);
		} else if (auth.role === Role.OPERATOR) {
			// Operator має доступ тільки до профілів своїх груп
			return this.profiles.listByOperatorAccess(auth.userId, auth.agencyCode);
		}
		return [];
	}

	async canAccessProfile(profileId: string, auth: RequestAuthContext): Promise<boolean> {
		if (auth.role === Role.OWNER) {
			// Owner може отримати доступ до будь-якого профілю своєї агенції
			const profiles = await this.profiles.listByAgencyCode(auth.agencyCode);
			return profiles.some(p => p.id === profileId);
		} else if (auth.role === Role.OPERATOR) {
			// Operator може отримати доступ тільки до профілів своїх груп
			return this.profiles.hasAccessToProfile(profileId, auth.userId, auth.agencyCode);
		}
		return false;
	}

	async filterDialogsByAccess(dialogs: any, auth: RequestAuthContext): Promise<any> {
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

		if (auth.role === Role.OWNER) {
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
