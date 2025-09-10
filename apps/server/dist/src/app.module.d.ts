import { OnModuleInit } from '@nestjs/common';
import { EncryptionValidatorService } from './profiles/encryption-validator.service';
export declare class AppModule implements OnModuleInit {
    private readonly encryptionValidator;
    constructor(encryptionValidator: EncryptionValidatorService);
    onModuleInit(): Promise<void>;
}
