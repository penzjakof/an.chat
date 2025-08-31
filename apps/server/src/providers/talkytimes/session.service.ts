import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface TTSessionData {
	profileId: number;
	cookies: string;
	token?: string;
	refreshToken?: string;
	expiresAt: Date;
}

@Injectable()
export class TalkyTimesSessionService {
	constructor(private readonly prisma: PrismaService) {}

	async saveSession(profileId: string, sessionData: {
		cookies: string;
		token?: string;
		refreshToken?: string;
		expiresAt?: Date;
	}): Promise<void> {
		const expiresAt = sessionData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 години за замовчуванням

		// Зберігаємо сесію в базі даних
		await this.prisma.talkyTimesSession.upsert({
			where: { profileId },
			update: {
				cookies: sessionData.cookies,
				token: sessionData.token,
				refreshToken: sessionData.refreshToken,
				expiresAt,
				updatedAt: new Date()
			},
			create: {
				profileId,
				cookies: sessionData.cookies,
				token: sessionData.token,
				refreshToken: sessionData.refreshToken,
				expiresAt
			}
		});

		console.log(`💾 Session saved for profile ${profileId}, expires at ${expiresAt}`);

		// Оновлюємо lastActiveAt в профілі
		try {
			await this.prisma.profile.updateMany({
				where: { profileId },
				data: { lastActiveAt: new Date() }
			});
		} catch (error) {
			console.warn(`Failed to update profile ${profileId}:`, error);
		}
	}

	async getSession(profileId: string): Promise<TTSessionData | null> {
		try {
			const session = await this.prisma.talkyTimesSession.findUnique({
				where: { profileId }
			});

			if (!session) {
				console.log(`❌ No session found for profile ${profileId}`);
				return null;
			}

			// Перевіряємо, чи не закінчилася сесія
			if (session.expiresAt < new Date()) {
				console.log(`⏰ Session expired for profile ${profileId}`);
				await this.removeSession(profileId);
				return null;
			}

			console.log(`✅ Session found for profile ${profileId}, expires at ${session.expiresAt}`);
			return {
				profileId: parseInt(session.profileId),
				cookies: session.cookies,
				token: session.token || undefined,
				refreshToken: session.refreshToken || undefined,
				expiresAt: session.expiresAt
			};
		} catch (error) {
			console.error(`Error getting session for profile ${profileId}:`, error);
			return null;
		}
	}

	async removeSession(profileId: string): Promise<void> {
		try {
			await this.prisma.talkyTimesSession.delete({
				where: { profileId }
			});
			console.log(`🗑️ Session removed for profile ${profileId}`);
		} catch (error) {
			// Ігноруємо помилки видалення неіснуючих сесій
			console.warn(`Failed to remove session for profile ${profileId}:`, error);
		}
	}

	async authenticateProfile(profileId: string, cookies: string, token?: string, refreshToken?: string): Promise<TTSessionData> {
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 години
		const session: TTSessionData = {
			profileId: parseInt(profileId),
			cookies,
			token,
			refreshToken,
			expiresAt
		};

		await this.saveSession(profileId, session);
		return session;
	}

	async validateSession(profileId: string): Promise<boolean> {
		const session = await this.getSession(profileId);
		return session !== null;
	}

	// Метод для отримання заголовків з cookies для запитів
	getRequestHeaders(session: TTSessionData): Record<string, string> {
		// ВИПРАВЛЕННЯ: використовуємо тільки мінімальні необхідні headers
		// Додаткові headers ламають TT API!
		// ВАЖЛИВО: використовуємо точно такий же case як в робочому прикладі
		return {
			'accept': 'application/json',
			'content-type': 'application/json',
			'cookie': session.cookies
		};
	}

	// Метод для отримання активної сесії конкретного профілю
	async getActiveSession(profileId: number): Promise<TTSessionData | null> {
		try {
			const session = await this.prisma.talkyTimesSession.findFirst({
				where: {
					profileId: profileId.toString(),
					expiresAt: {
						gt: new Date()
					}
				}
			});

			if (!session) {
				return null;
			}

			return {
				profileId: parseInt(session.profileId),
				cookies: session.cookies,
				token: session.token || undefined,
				refreshToken: session.refreshToken || undefined,
				expiresAt: session.expiresAt
			};
		} catch (error) {
			console.error(`Error getting active session for profile ${profileId}:`, error);
			return null;
		}
	}

	// Метод для отримання всіх активних сесій
	async getAllActiveSessions(): Promise<TTSessionData[]> {
		try {
			const sessions = await this.prisma.talkyTimesSession.findMany({
				where: {
					expiresAt: {
						gt: new Date()
					}
				}
			});

					return sessions.map(session => ({
			profileId: parseInt(session.profileId),
			cookies: session.cookies,
			token: session.token || undefined,
			refreshToken: session.refreshToken || undefined,
			expiresAt: session.expiresAt
		}));
		} catch (error) {
			console.error('Error getting active sessions:', error);
			return [];
		}
	}

	// Метод для очищення застарілих сесій
	async cleanupExpiredSessions(): Promise<void> {
		try {
			const result = await this.prisma.talkyTimesSession.deleteMany({
				where: {
					expiresAt: {
						lt: new Date()
					}
				}
			});
			console.log(`🧹 Cleaned up ${result.count} expired sessions`);
		} catch (error) {
			console.error('Error cleaning up expired sessions:', error);
		}
	}
}