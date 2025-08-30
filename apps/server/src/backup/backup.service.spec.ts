import { Test } from '@nestjs/testing';
import { BackupService } from './backup.service';
import * as fs from 'fs';

describe('BackupService', () => {
	it('creates backup file', async () => {
		const moduleRef = await Test.createTestingModule({ providers: [BackupService] }).compile();
		const svc = moduleRef.get(BackupService);

		jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined as any); // mkdir returns void | PathLike
		jest.spyOn(fs.promises, 'copyFile').mockResolvedValue(undefined as unknown as void);

		await expect(svc.dailyBackup()).resolves.toBeUndefined();
	});
});
