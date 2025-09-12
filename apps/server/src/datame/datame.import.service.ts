import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';

@Injectable()
export class DatameImportService {
  constructor(private prisma: PrismaService, private enc: EncryptionService) {}

  async findDuplicates(agencyCode: string, items: Array<{ id: number; email?: string }>): Promise<{
    byEmail: Record<string, string>;
    byProfileId: Record<string, string>;
  }> {
    // Отримуємо agencyId
    const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
    if (!agency) return { byEmail: {}, byProfileId: {} };

    const emails = items.map(i => i.email).filter(Boolean) as string[];
    const ids = items.map(i => String(i.id));

    const profiles = await this.prisma.profile.findMany({
      where: {
        group: { agencyId: agency.id },
        OR: [
          { credentialLogin: { in: emails.length ? emails : ['__none__'] } },
          { profileId: { in: ids } },
        ],
      },
      select: { id: true, credentialLogin: true, profileId: true },
    });

    const byEmail: Record<string, string> = {};
    const byProfileId: Record<string, string> = {};
    for (const p of profiles) {
      if (p.credentialLogin) byEmail[p.credentialLogin] = p.id;
      if (p.profileId) byProfileId[p.profileId] = p.id;
    }
    return { byEmail, byProfileId };
  }

  async importItems(agencyCode: string, groupId: string, items: Array<{ id: number; email: string; name?: string }>, mode: 'new_only' | 'replace_all' | 'skip') {
    const agency = await this.prisma.agency.findUnique({ where: { code: agencyCode } });
    if (!agency) throw new Error('Agency not found');
    const group = await this.prisma.group.findUnique({ where: { id: groupId, agencyId: agency.id } as any });
    if (!group) throw new Error('Group not found for agency');

    const dup = await this.findDuplicates(agencyCode, items);
    const results: Array<{ id: number; status: 'created' | 'skipped' | 'replaced'; profileId?: string }> = [];

    for (const it of items) {
      const existingByEmail = it.email ? dup.byEmail[it.email] : undefined;
      const existingByPid = dup.byProfileId[String(it.id)];
      const existing = existingByEmail || existingByPid;

      if (existing && mode === 'skip') {
        results.push({ id: it.id, status: 'skipped', profileId: existing });
        continue;
      }

      if (existing && mode === 'replace_all') {
        await this.prisma.profile.update({
          where: { id: existing },
          data: {
            displayName: it.name || null,
            credentialLogin: it.email,
            credentialPassword: it.email ? this.enc.encrypt(it.email) : null,
            provider: 'TALKYTIMES' as any,
            profileId: String(it.id),
            externalId: String(it.id),
            groupId: group.id,
          },
        });
        results.push({ id: it.id, status: 'replaced', profileId: existing });
        continue;
      }

      if (!existing) {
        const created = await this.prisma.profile.create({
          data: {
            provider: 'TALKYTIMES' as any,
            externalId: String(it.id),
            displayName: it.name || null,
            credentialLogin: it.email || null,
            credentialPassword: it.email ? this.enc.encrypt(it.email) : null,
            profileId: String(it.id),
            status: 'ACTIVE' as any,
            groupId: group.id,
          },
          select: { id: true },
        });
        results.push({ id: it.id, status: 'created', profileId: created.id });
      } else {
        // existing but replace_all not selected -> new_only
        results.push({ id: it.id, status: 'skipped', profileId: existing });
      }
    }

    return { results };
  }
}


