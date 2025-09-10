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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createOwner(params) {
        const { agencyCode, username, name, password } = params;
        const agency = await this.prisma.agency.findUniqueOrThrow({ where: { code: agencyCode } });
        const passwordHash = await bcrypt.hash(password, 10);
        return this.prisma.user.create({ data: { agencyId: agency.id, username: username.toLowerCase(), name, role: client_1.Role.OWNER, status: client_1.UserStatus.ACTIVE, passwordHash } });
    }
    async createOperator(params) {
        const { agencyCode, username, name, password, operatorCode } = params;
        const agency = await this.prisma.agency.findUniqueOrThrow({ where: { code: agencyCode } });
        const passwordHash = await bcrypt.hash(password, 10);
        return this.prisma.user.create({ data: { agencyId: agency.id, username: username.toLowerCase(), name, role: client_1.Role.OPERATOR, operatorCode, status: client_1.UserStatus.ACTIVE, passwordHash } });
    }
    findManyByAgencyCode(agencyCode) {
        return this.prisma.user.findMany({ where: { agency: { code: agencyCode } } });
    }
    blockUser(userId) {
        return this.prisma.user.update({ where: { id: userId }, data: { status: client_1.UserStatus.BLOCKED } });
    }
    async findOperatorsByAgencyCode(agencyCode) {
        return this.prisma.user.findMany({
            where: {
                agency: { code: agencyCode },
                role: client_1.Role.OPERATOR
            },
            include: {
                operatorLinks: {
                    include: {
                        group: true
                    }
                }
            }
        });
    }
    async updateOperator(operatorId, updates, agencyCode) {
        const operator = await this.prisma.user.findFirst({
            where: {
                id: operatorId,
                role: client_1.Role.OPERATOR,
                agency: { code: agencyCode }
            }
        });
        if (!operator) {
            throw new common_1.NotFoundException('Operator not found');
        }
        const updateData = {};
        if (updates.username) {
            updateData.username = updates.username.toLowerCase();
        }
        if (updates.name) {
            updateData.name = updates.name;
        }
        if (updates.password) {
            updateData.passwordHash = await bcrypt.hash(updates.password, 10);
        }
        if (updates.operatorCode) {
            updateData.operatorCode = updates.operatorCode;
        }
        const updatedOperator = await this.prisma.user.update({
            where: { id: operatorId },
            data: updateData,
            include: {
                operatorLinks: {
                    include: {
                        group: true
                    }
                }
            }
        });
        if (updates.groupId) {
            await this.prisma.operatorGroup.deleteMany({
                where: { operatorId: operatorId }
            });
            if (updates.groupId !== '') {
                await this.prisma.operatorGroup.create({
                    data: {
                        operatorId: operatorId,
                        groupId: updates.groupId
                    }
                });
            }
        }
        return updatedOperator;
    }
    async deleteOperator(operatorId, agencyCode) {
        const operator = await this.prisma.user.findFirst({
            where: {
                id: operatorId,
                role: client_1.Role.OPERATOR,
                agency: { code: agencyCode }
            }
        });
        if (!operator) {
            throw new common_1.NotFoundException('Operator not found');
        }
        await this.prisma.operatorGroup.deleteMany({
            where: { operatorId: operatorId }
        });
        return this.prisma.user.delete({
            where: { id: operatorId }
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map