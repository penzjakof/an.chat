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
exports.ProfilesController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const profiles_service_1 = require("./profiles.service");
const client_1 = require("@prisma/client");
const roles_guard_1 = require("../common/auth/roles.guard");
const jwt_guard_1 = require("../auth/jwt.guard");
let ProfilesController = class ProfilesController {
    profiles;
    constructor(profiles) {
        this.profiles = profiles;
    }
    listAll(req) {
        return this.profiles.listByAgencyCode(req.auth.agencyCode);
    }
    listMy(req) {
        if (req.auth.role === 'OWNER') {
            return this.profiles.listByAgencyCode(req.auth.agencyCode);
        }
        else {
            return this.profiles.listByOperatorAccess(req.auth.userId, req.auth.agencyCode);
        }
    }
    list(groupId) {
        return this.profiles.listByGroup(groupId);
    }
    create(body, req) {
        return this.profiles.create(body, req.auth.agencyCode);
    }
    update(id, body, req) {
        return this.profiles.update(id, body, req.auth.agencyCode);
    }
    delete(id, req) {
        return this.profiles.delete(id, req.auth.agencyCode);
    }
    authenticateProfile(id, body, req) {
        return this.profiles.authenticateProfile(id, body.password, req.auth.agencyCode);
    }
    getSessionStatus(id, req) {
        return this.profiles.getProfileSessionStatus(id, req.auth.agencyCode);
    }
    async getSessionStatusBatch(body, req) {
        const ids = Array.isArray(body?.ids) ? body.ids : [];
        if (ids.length === 0)
            return { results: {} };
        const results = {};
        await Promise.all(ids.map(async (pid) => {
            try {
                const res = await this.profiles.getProfileSessionStatus(pid, req.auth.agencyCode);
                results[pid] = { authenticated: !!res.authenticated, message: res.message, profileId: res.profileId };
            }
            catch (e) {
                results[pid] = { authenticated: false, message: 'Error checking status' };
            }
        }));
        return { results };
    }
    getProfileData(id, req) {
        return this.profiles.getProfileData(id, req.auth.agencyCode);
    }
    getClientPhotos(id, clientId, req) {
        return this.profiles.getClientPhotos(id, parseInt(clientId), req.auth.agencyCode);
    }
    getClientPublicProfile(id, clientId, req) {
        console.log(`🔍 DEBUG Controller getClientPublicProfile called: id=${id}, clientId=${clientId}`);
        return this.profiles.getClientPublicProfile(id, parseInt(clientId), req.auth.agencyCode);
    }
    getMyPublicProfile(id, req) {
        return this.profiles.getMyPublicProfile(id, req.auth.agencyCode);
    }
    getMyPhotos(id, req) {
        return this.profiles.getMyPhotos(id, req.auth.agencyCode);
    }
    getGiftLimits(id, body, req) {
        return this.profiles.getGiftLimits(id, body.clientId, req.auth.agencyCode);
    }
    getGiftList(id, body, req) {
        return this.profiles.getGiftList(id, body.clientId, body.cursor, body.limit || 30, req.auth.agencyCode);
    }
    sendGift(id, body, req) {
        return this.profiles.sendGift(id, body.clientId, body.giftId, body.message, req.auth.agencyCode);
    }
};
exports.ProfilesController = ProfilesController;
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "listAll", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('my'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "listMy", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Get)('group/:groupId'),
    __param(0, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "list", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "create", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "update", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "delete", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/authenticate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "authenticateProfile", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/session/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getSessionStatus", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, throttler_1.Throttle)({ default: { limit: 100, ttl: 1000 } }),
    (0, common_1.Post)('session/status/batch'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ProfilesController.prototype, "getSessionStatusBatch", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)(':id/profile-data'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getProfileData", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/client/:clientId/photos'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('clientId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getClientPhotos", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)(':id/client/:clientId/public'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('clientId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getClientPublicProfile", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/my-public-profile'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getMyPublicProfile", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/my-photos'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getMyPhotos", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/gift-limits'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getGiftLimits", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/gift-list'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getGiftList", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)(':id/send-gift'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "sendGift", null);
exports.ProfilesController = ProfilesController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('profiles'),
    __metadata("design:paramtypes", [profiles_service_1.ProfilesService])
], ProfilesController);
//# sourceMappingURL=profiles.controller.js.map