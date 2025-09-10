"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../common/auth/roles.guard");
const client_1 = require("@prisma/client");
const shifts_service_1 = require("./shifts.service");
const prisma_service_1 = require("../prisma/prisma.service");
let ShiftsController = class ShiftsController {
    shifts;
    prisma;
    constructor(shifts, prisma) {
        this.shifts = shifts;
        this.prisma = prisma;
    }
    async groupsStatus(req) {
        return this.shifts.getGroupsStatusByOperator(req.auth.userId);
    }
    async canStart(req) {
        return this.shifts.canStartShiftForOperator(req.auth.userId);
    }
    async isActive(req) {
        if (req.auth.role === 'OWNER') {
            return { active: false };
        }
        return this.shifts.hasActiveShift(req.auth.userId);
    }
    async start(req) {
        const user = await this.prisma.user.findUnique({ where: { id: req.auth.userId } });
        return this.shifts.startShift(req.auth.userId, user.agencyId);
    }
    async end(req) {
        return this.shifts.endShift(req.auth.userId);
    }
    async logs(req) {
        const agency = await this.prisma.agency.findUnique({ where: { code: req.auth.agencyCode } });
        const logs = await this.prisma.shiftLog.findMany({
            where: { agencyId: agency.id },
            orderBy: { createdAt: 'desc' },
            take: 200,
            include: { shift: { include: { operator: true } } },
        });
        return logs.map((l) => ({
            id: l.id,
            action: l.action,
            createdAt: l.createdAt,
            operatorName: l.shift.operator.name,
            operatorId: l.operatorId,
            message: l.message,
        }));
    }
    async activeShifts(req) {
        return this.shifts.listActiveShiftsByAgency(req.auth.agencyCode);
    }
    async forceEnd(req, body) {
        return this.shifts.forceEndShiftForOperator(body.operatorId, req.auth.agencyCode);
    }
};
exports.ShiftsController = ShiftsController;
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OPERATOR),
    (0, common_1.Get)('groups-status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "groupsStatus", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OPERATOR),
    (0, common_1.Get)('can-start'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "canStart", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OPERATOR, client_1.Role.OWNER),
    (0, common_1.Get)('is-active'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "isActive", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OPERATOR),
    (0, common_1.Post)('start'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "start", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OPERATOR),
    (0, common_1.Post)('end'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "end", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Get)('logs'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "logs", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Get)('active'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "activeShifts", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Post)('force-end'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ShiftsController.prototype, "forceEnd", null);
exports.ShiftsController = ShiftsController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('shifts'),
    __metadata("design:paramtypes", [shifts_service_1.ShiftsService, prisma_service_1.PrismaService])
], ShiftsController);
//# sourceMappingURL=shifts.controller.js.map