"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const crypto = __importStar(require("crypto"));
const prisma = new client_1.PrismaClient();
function encrypt(plaintext) {
    const keyString = process.env.ENCRYPTION_KEY;
    let key;
    if (!keyString || keyString.length < 32) {
        key = Buffer.from((keyString ?? 'dev-encryption-key').padEnd(32, '0').slice(0, 32));
    }
    else {
        key = Buffer.from(keyString.slice(0, 32));
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('anchat-profile-creds'));
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}
async function main() {
    const agency = await prisma.agency.upsert({ where: { code: 'AG' }, create: { code: 'AG', name: 'Demo Agency' }, update: {} });
    const ownerPass = await bcrypt.hash('owner123', 10);
    await prisma.user.upsert({
        where: { username: 'owner' },
        create: { username: 'owner', name: 'Owner', role: client_1.Role.OWNER, status: client_1.UserStatus.ACTIVE, agencyId: agency.id, passwordHash: ownerPass },
        update: { passwordHash: ownerPass, name: 'Owner' },
    });
    const operatorPass = await bcrypt.hash('operator123', 10);
    const operator = await prisma.user.upsert({
        where: { username: 'operator' },
        create: { username: 'operator', name: 'Operator', role: client_1.Role.OPERATOR, operatorCode: 'OP', status: client_1.UserStatus.ACTIVE, agencyId: agency.id, passwordHash: operatorPass },
        update: { passwordHash: operatorPass, name: 'Operator' },
    });
    const group = await prisma.group.upsert({ where: { agencyId_name: { agencyId: agency.id, name: 'Group 1' } }, create: { agencyId: agency.id, name: 'Group 1' }, update: {} });
    await prisma.operatorGroup.upsert({ where: { operatorId_groupId: { operatorId: operator.id, groupId: group.id } }, create: { operatorId: operator.id, groupId: group.id }, update: {} });
    await prisma.profile.upsert({
        where: { provider_externalId: { provider: client_1.ProviderSite.TALKYTIMES, externalId: 'aoshlatyyy@gmail.com' } },
        create: { provider: client_1.ProviderSite.TALKYTIMES, externalId: 'aoshlatyyy@gmail.com', displayName: 'TT A', credentialLogin: 'aoshlatyyy@gmail.com', credentialPassword: encrypt('aoshlatyyy'), profileId: '7162437', groupId: group.id },
        update: { groupId: group.id, credentialLogin: 'aoshlatyyy@gmail.com', credentialPassword: encrypt('aoshlatyyy'), profileId: '7162437' },
    });
    await prisma.profile.upsert({
        where: { provider_externalId: { provider: client_1.ProviderSite.TALKYTIMES, externalId: 'aaallonnno44ka03@gmail.com' } },
        create: { provider: client_1.ProviderSite.TALKYTIMES, externalId: 'aaallonnno44ka03@gmail.com', displayName: 'TT B', credentialLogin: 'aaallonnno44ka03@gmail.com', credentialPassword: encrypt('aaallonnno44ka03'), profileId: '117326723', groupId: group.id },
        update: { groupId: group.id, credentialLogin: 'aaallonnno44ka03@gmail.com', credentialPassword: encrypt('aaallonnno44ka03'), profileId: '117326723' },
    });
    console.log('Seed completed with usernames: owner/operator');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
//# sourceMappingURL=seed.js.map