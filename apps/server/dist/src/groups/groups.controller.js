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
exports.GroupsController = void 0;
const common_1 = require("@nestjs/common");
const groups_service_1 = require("./groups.service");
const roles_guard_1 = require("../common/auth/roles.guard");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../auth/jwt.guard");
let GroupsController = class GroupsController {
    groups;
    constructor(groups) {
        this.groups = groups;
    }
    list(req) {
        return this.groups.listByAgencyCode(req.auth.agencyCode);
    }
    create(req, body) {
        return this.groups.create(req.auth.agencyCode, body.name);
    }
    assign(groupId, operatorId) {
        return this.groups.assignOperator(groupId, operatorId);
    }
};
exports.GroupsController = GroupsController;
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "list", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "create", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Post)(':groupId/assign/:operatorId'),
    __param(0, (0, common_1.Param)('groupId')),
    __param(1, (0, common_1.Param)('operatorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], GroupsController.prototype, "assign", null);
exports.GroupsController = GroupsController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('groups'),
    __metadata("design:paramtypes", [groups_service_1.GroupsService])
], GroupsController);
//# sourceMappingURL=groups.controller.js.map