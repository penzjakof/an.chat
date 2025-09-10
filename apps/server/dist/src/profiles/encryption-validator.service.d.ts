import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
export declare class EncryptionValidatorService {
    private readonly prisma;
    private readonly encryption;
    private readonly logger;
    private readonly KNOWN_PASSWORDS;
    constructor(prisma: PrismaService, encryption: EncryptionService);
    validateAndFixProfiles(): Promise<void>;
    validateProfile(profileId: string): Promise<boolean>;
}
