import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get<string>('database.url') || 'file:/opt/anchat/db/anchat.db',
        },
      },
    });
  }
	async onModuleInit(): Promise<void> {
		try {
			await this.$connect();
		} catch (error) {
			console.error('Prisma connect failed (non-fatal during bootstrap):', (error as any)?.message || error);
		}
	}

	async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}

	async enableShutdownHooks(app: INestApplication): Promise<void> {
		process.on('beforeExit', async () => {
			await app.close();
		});
	}
}
