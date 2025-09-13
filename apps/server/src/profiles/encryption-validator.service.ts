import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class EncryptionValidatorService {
  private readonly logger = new Logger(EncryptionValidatorService.name);
  
  // Відомі паролі для профілів (для автоматичного виправлення)
  private readonly KNOWN_PASSWORDS: Record<string, string> = {
    'aoshlatyyy@gmail.com': 'aoshlatyyy',
    'aaallonnno44ka03@gmail.com': 'aaallonnno44ka03'
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService
  ) {}

  /**
   * Перевіряє і автоматично виправляє зламані паролі профілів
   */
  async validateAndFixProfiles(): Promise<void> {
    this.logger.log('🔍 Перевіряю шифрування профілів...');
    
    const profiles = await this.prisma.profile.findMany({
      where: {
        provider: 'TALKYTIMES',
        credentialPassword: { not: null }
      },
      // Вибираємо лише необхідні колонки, щоб не чіпати відсутні в БД
      select: {
        id: true,
        displayName: true,
        credentialLogin: true,
        credentialPassword: true,
      }
    });

    let fixedCount = 0;
    
    for (const profile of profiles) {
      try {
        // Спробуємо дешифрувати пароль
        const decrypted = this.encryption.decrypt(profile.credentialPassword!);
        
        if (!decrypted) {
          this.logger.warn(`❌ Профіль ${profile.displayName} має зламаний пароль`);
          
          // Спробуємо виправити з відомим паролем
          const knownPassword = this.KNOWN_PASSWORDS[profile.credentialLogin!];
          if (knownPassword) {
            this.logger.log(`🔧 Виправляю пароль для ${profile.displayName}...`);
            
            const newEncrypted = this.encryption.encrypt(knownPassword);
            await this.prisma.profile.update({
              where: { id: profile.id },
              data: { credentialPassword: newEncrypted }
            });
            
            fixedCount++;
            this.logger.log(`✅ Пароль виправлено для ${profile.displayName}`);
          } else {
            this.logger.error(`❌ Невідомий пароль для ${profile.displayName} (${profile.credentialLogin})`);
          }
        } else {
          this.logger.debug(`✅ Профіль ${profile.displayName} має правильний пароль`);
        }
      } catch (error) {
        this.logger.error(`❌ Помилка перевірки профілю ${profile.displayName}:`, error);
      }
    }
    
    if (fixedCount > 0) {
      this.logger.log(`🎉 Виправлено ${fixedCount} профілів`);
    } else {
      this.logger.log(`✅ Всі профілі мають правильні паролі`);
    }
  }

  /**
   * Перевіряє конкретний профіль
   */
  async validateProfile(profileId: string): Promise<boolean> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId }
    });

    if (!profile?.credentialPassword) {
      return false;
    }

    try {
      const decrypted = this.encryption.decrypt(profile.credentialPassword);
      return !!decrypted;
    } catch {
      return false;
    }
  }
}
