import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderSite, ProfileStatus } from '@prisma/client';
import * as crypto from 'crypto';

function getKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key || key.length < 32) {
		// 32 bytes (256-bit) key expected; for dev fallback to fixed-length pad
		return Buffer.from((key ?? 'dev-encryption-key').padEnd(32, '0').slice(0, 32));
	}
	return Buffer.from(key.slice(0, 32));
}

function encrypt(plaintext: string | undefined): string | undefined {
	if (!plaintext) return undefined;
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
	const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]).toString('base64');
}

@Injectable()
export class ProfilesService {
	constructor(private readonly prisma: PrismaService) {}

	create(params: { groupId: string; provider: ProviderSite; externalId: string; displayName?: string; credentialLogin?: string; credentialPassword?: string }) {
		const { groupId, provider, externalId, displayName, credentialLogin, credentialPassword } = params;
		return this.prisma.profile.create({
			data: {
				groupId,
				provider,
				externalId,
				displayName,
				credentialLogin,
				credentialPassword: encrypt(credentialPassword),
				status: ProfileStatus.ACTIVE,
			},
		});
	}

	listByGroup(groupId: string) {
		return this.prisma.profile.findMany({ where: { groupId } });
	}
}
