import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BackupService {
	private readonly logger = new Logger(BackupService.name);

	@Cron(CronExpression.EVERY_DAY_AT_1AM)
	async dailyBackup(): Promise<void> {
		try {
			const dbPath = path.resolve(process.cwd(), 'dev.db');
			const backupsDir = path.resolve(process.cwd(), 'backups');
			await fs.promises.mkdir(backupsDir, { recursive: true });
			const stamp = new Date().toISOString().substring(0, 10);
			const target = path.join(backupsDir, `backup-${stamp}.db`);
			await fs.promises.copyFile(dbPath, target);
			this.logger.log(`Backup created: ${target}`);
		} catch (error) {
			this.logger.error('Backup failed', error as Error);
			throw error;
		}
	}
}
