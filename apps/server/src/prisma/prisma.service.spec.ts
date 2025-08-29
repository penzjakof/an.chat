import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
	it('connects and disconnects', async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [PrismaService],
		}).compile();

		const prisma = moduleRef.get(PrismaService);
		await prisma.$connect();
		await prisma.$disconnect();
	});

	it('creates Agency and enforces unique code', async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [PrismaService],
		}).compile();

		const prisma = moduleRef.get(PrismaService);
		await prisma.$transaction(async (tx) => {
			await tx.agency.deleteMany();
		});

		const a1 = await prisma.agency.create({ data: { name: 'A', code: 'AG-1' } });
		expect(a1.code).toBe('AG-1');

		await expect(
			prisma.agency.create({ data: { name: 'A2', code: 'AG-1' } }),
		).rejects.toBeDefined();
	});
});
