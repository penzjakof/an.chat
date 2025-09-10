"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TalkyTimesSessionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let TalkyTimesSessionService = class TalkyTimesSessionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async saveSession(profileId, sessionData) {
        const expiresAt = sessionData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
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
        try {
            await this.prisma.profile.updateMany({
                where: { profileId },
                data: { lastActiveAt: new Date() }
            });
        }
        catch (error) {
            console.warn(`Failed to update profile ${profileId}:`, error);
        }
    }
    async getSession(profileId) {
        try {
            const session = await this.prisma.talkyTimesSession.findUnique({
                where: { profileId }
            });
            if (!session) {
                console.log(`❌ No session found for profile ${profileId}`);
                return null;
            }
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
        }
        catch (error) {
            console.error(`Error getting session for profile ${profileId}:`, error);
            return null;
        }
    }
    async removeSession(profileId) {
        try {
            await this.prisma.talkyTimesSession.delete({
                where: { profileId }
            });
            console.log(`🗑️ Session removed for profile ${profileId}`);
        }
        catch (error) {
            console.warn(`Failed to remove session for profile ${profileId}:`, error);
        }
    }
    async authenticateProfile(profileId, cookies, token, refreshToken) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const session = {
            profileId: parseInt(profileId),
            cookies,
            token,
            refreshToken,
            expiresAt
        };
        await this.saveSession(profileId, session);
        return session;
    }
    async validateSession(profileId) {
        const session = await this.getSession(profileId);
        if (!session) {
            console.log(`❌ Session not found for profile ${profileId}`);
            return false;
        }
        if (!session.cookies.includes('tld-token=')) {
            console.log(`❌ No tld-token found in cookies for profile ${profileId}`);
            return false;
        }
        if (session.expiresAt < new Date()) {
            console.log(`❌ Session expired for profile ${profileId}`);
            return false;
        }
        console.log(`✅ Session valid for profile ${profileId}`);
        return true;
    }
    getRequestHeaders(session) {
        return {
            'accept': 'application/json',
            'content-type': 'application/json',
            'cookie': session.cookies
        };
    }
    async getActiveSession(profileId) {
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
        }
        catch (error) {
            console.error(`Error getting active session for profile ${profileId}:`, error);
            return null;
        }
    }
    async getAllActiveSessions() {
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
        }
        catch (error) {
            console.error('Error getting active sessions:', error);
            return [];
        }
    }
    async cleanupExpiredSessions() {
        try {
            const result = await this.prisma.talkyTimesSession.deleteMany({
                where: {
                    expiresAt: {
                        lt: new Date()
                    }
                }
            });
            console.log(`🧹 Cleaned up ${result.count} expired sessions`);
        }
        catch (error) {
            console.error('Error cleaning up expired sessions:', error);
        }
    }
    async getActiveOperatorRefForProfile(profileId) {
        try {
            const profile = await this.prisma.profile.findFirst({
                where: { provider: 'TALKYTIMES', profileId },
                include: {
                    group: {
                        include: {
                            activeShift: {
                                include: { operator: true }
                            }
                        }
                    }
                }
            });
            const operatorCode = profile?.group?.activeShift?.operator?.operatorCode;
            return operatorCode ?? null;
        }
        catch (error) {
            console.warn('getActiveOperatorRefForProfile failed:', error);
            return null;
        }
    }
    async hasActiveShiftForOperatorCode(operatorCode) {
        try {
            const user = await this.prisma.user.findUnique({ where: { operatorCode } });
            if (!user)
                return false;
            const shift = await this.prisma.shift.findFirst({ where: { operatorId: user.id, endedAt: null } });
            return !!shift;
        }
        catch (error) {
            console.warn('hasActiveShiftForOperatorCode failed:', error);
            return false;
        }
    }
};
exports.TalkyTimesSessionService = TalkyTimesSessionService;
exports.TalkyTimesSessionService = TalkyTimesSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TalkyTimesSessionService);
//# sourceMappingURL=session.service.js.map