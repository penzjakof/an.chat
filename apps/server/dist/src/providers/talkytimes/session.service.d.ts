import { PrismaService } from '../../prisma/prisma.service';
export interface TTSessionData {
    profileId: number;
    cookies: string;
    token?: string;
    refreshToken?: string;
    expiresAt: Date;
}
export declare class TalkyTimesSessionService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    saveSession(profileId: string, sessionData: {
        cookies: string;
        token?: string;
        refreshToken?: string;
        expiresAt?: Date;
    }): Promise<void>;
    getSession(profileId: string): Promise<TTSessionData | null>;
    removeSession(profileId: string): Promise<void>;
    authenticateProfile(profileId: string, cookies: string, token?: string, refreshToken?: string): Promise<TTSessionData>;
    validateSession(profileId: string): Promise<boolean>;
    getRequestHeaders(session: TTSessionData): Record<string, string>;
    getActiveSession(profileId: number): Promise<TTSessionData | null>;
    getAllActiveSessions(): Promise<TTSessionData[]>;
    cleanupExpiredSessions(): Promise<void>;
    getActiveOperatorRefForProfile(profileId: string): Promise<string | null>;
    hasActiveShiftForOperatorCode(operatorCode: string): Promise<boolean>;
}
