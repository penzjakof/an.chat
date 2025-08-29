import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
	private getKey(): Buffer {
		const key = process.env.ENCRYPTION_KEY;
		if (!key || key.length < 32) {
			// 32 bytes (256-bit) key expected; for dev fallback to fixed-length pad
			return Buffer.from((key ?? 'dev-encryption-key').padEnd(32, '0').slice(0, 32));
		}
		return Buffer.from(key.slice(0, 32));
	}

	encrypt(plaintext: string | undefined): string | undefined {
		if (!plaintext) return undefined;
		const key = this.getKey();
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
		cipher.setAAD(Buffer.from('anchat-profile-creds'));
		let enc = cipher.update(plaintext, 'utf8');
		enc = Buffer.concat([enc, cipher.final()]);
		const tag = cipher.getAuthTag();
		return Buffer.concat([iv, tag, enc]).toString('base64');
	}

	decrypt(ciphertext: string | undefined): string | undefined {
		if (!ciphertext) return undefined;
		try {
			const key = this.getKey();
			const data = Buffer.from(ciphertext, 'base64');
			const iv = data.subarray(0, 16);
			const tag = data.subarray(16, 32);
			const enc = data.subarray(32);
			const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
			decipher.setAAD(Buffer.from('anchat-profile-creds'));
			decipher.setAuthTag(tag);
			let dec = decipher.update(enc);
			dec = Buffer.concat([dec, decipher.final()]);
			return dec.toString('utf8');
		} catch {
			return undefined;
		}
	}
}
