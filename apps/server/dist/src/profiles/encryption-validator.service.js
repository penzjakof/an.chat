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
var EncryptionValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionValidatorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const encryption_service_1 = require("../common/encryption/encryption.service");
let EncryptionValidatorService = EncryptionValidatorService_1 = class EncryptionValidatorService {
    prisma;
    encryption;
    logger = new common_1.Logger(EncryptionValidatorService_1.name);
    KNOWN_PASSWORDS = {
        'aoshlatyyy@gmail.com': 'aoshlatyyy',
        'aaallonnno44ka03@gmail.com': 'aaallonnno44ka03'
    };
    constructor(prisma, encryption) {
        this.prisma = prisma;
        this.encryption = encryption;
    }
    async validateAndFixProfiles() {
        this.logger.log('🔍 Перевіряю шифрування профілів...');
        const profiles = await this.prisma.profile.findMany({
            where: {
                provider: 'TALKYTIMES',
                credentialPassword: { not: null }
            }
        });
        let fixedCount = 0;
        for (const profile of profiles) {
            try {
                const decrypted = this.encryption.decrypt(profile.credentialPassword);
                if (!decrypted) {
                    this.logger.warn(`❌ Профіль ${profile.displayName} має зламаний пароль`);
                    const knownPassword = this.KNOWN_PASSWORDS[profile.credentialLogin];
                    if (knownPassword) {
                        this.logger.log(`🔧 Виправляю пароль для ${profile.displayName}...`);
                        const newEncrypted = this.encryption.encrypt(knownPassword);
                        await this.prisma.profile.update({
                            where: { id: profile.id },
                            data: { credentialPassword: newEncrypted }
                        });
                        fixedCount++;
                        this.logger.log(`✅ Пароль виправлено для ${profile.displayName}`);
                    }
                    else {
                        this.logger.error(`❌ Невідомий пароль для ${profile.displayName} (${profile.credentialLogin})`);
                    }
                }
                else {
                    this.logger.debug(`✅ Профіль ${profile.displayName} має правильний пароль`);
                }
            }
            catch (error) {
                this.logger.error(`❌ Помилка перевірки профілю ${profile.displayName}:`, error);
            }
        }
        if (fixedCount > 0) {
            this.logger.log(`🎉 Виправлено ${fixedCount} профілів`);
        }
        else {
            this.logger.log(`✅ Всі профілі мають правильні паролі`);
        }
    }
    async validateProfile(profileId) {
        const profile = await this.prisma.profile.findUnique({
            where: { id: profileId }
        });
        if (!profile?.credentialPassword) {
            return false;
        }
        try {
            const decrypted = this.encryption.decrypt(profile.credentialPassword);
            return !!decrypted;
        }
        catch {
            return false;
        }
    }
};
exports.EncryptionValidatorService = EncryptionValidatorService;
exports.EncryptionValidatorService = EncryptionValidatorService = EncryptionValidatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        encryption_service_1.EncryptionService])
], EncryptionValidatorService);
//# sourceMappingURL=encryption-validator.service.js.map