import { PrismaClient, ProviderSite, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
	const agency = await prisma.agency.upsert({ where: { code: 'AG' }, create: { code: 'AG', name: 'Demo Agency' }, update: {} });

	const ownerPass = await bcrypt.hash('owner123', 10);
	await prisma.user.upsert({
		where: { username: 'owner' },
		create: { username: 'owner', name: 'Owner', role: Role.OWNER, status: UserStatus.ACTIVE, agencyId: agency.id, passwordHash: ownerPass },
		update: { passwordHash: ownerPass, name: 'Owner' },
	});

	const operatorPass = await bcrypt.hash('operator123', 10);
	const operator = await prisma.user.upsert({
		where: { username: 'operator' },
		create: { username: 'operator', name: 'Operator', role: Role.OPERATOR, operatorCode: 'OP', status: UserStatus.ACTIVE, agencyId: agency.id, passwordHash: operatorPass },
		update: { passwordHash: operatorPass, name: 'Operator' },
	});

	const group = await prisma.group.upsert({ where: { agencyId_name: { agencyId: agency.id, name: 'Group 1' } }, create: { agencyId: agency.id, name: 'Group 1' }, update: {} });
	await prisma.operatorGroup.upsert({ where: { operatorId_groupId: { operatorId: operator.id, groupId: group.id } }, create: { operatorId: operator.id, groupId: group.id }, update: {} });

	await prisma.profile.upsert({
		where: { provider_externalId: { provider: ProviderSite.TALKYTIMES, externalId: 'aoshlatyyy@gmail.com' } },
		create: { provider: ProviderSite.TALKYTIMES, externalId: 'aoshlatyyy@gmail.com', displayName: 'TT A', credentialLogin: 'aoshlatyyy@gmail.com', credentialPassword: 'aoshlatyyy', profileId: '7162437', groupId: group.id },
		update: { groupId: group.id, credentialLogin: 'aoshlatyyy@gmail.com', credentialPassword: 'aoshlatyyy', profileId: '7162437' },
	});
	await prisma.profile.upsert({
		where: { provider_externalId: { provider: ProviderSite.TALKYTIMES, externalId: 'aaallonnno44ka03@gmail.com' } },
		create: { provider: ProviderSite.TALKYTIMES, externalId: 'aaallonnno44ka03@gmail.com', displayName: 'TT B', credentialLogin: 'aaallonnno44ka03@gmail.com', credentialPassword: 'aaallonnno44ka03', profileId: '7162438', groupId: group.id },
		update: { groupId: group.id, credentialLogin: 'aaallonnno44ka03@gmail.com', credentialPassword: 'aaallonnno44ka03', profileId: '7162438' },
	});

	console.log('Seed completed with usernames: owner/operator');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
