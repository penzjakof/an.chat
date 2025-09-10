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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const roles_guard_1 = require("../common/auth/roles.guard");
const client_1 = require("@prisma/client");
const jwt_guard_1 = require("../auth/jwt.guard");
let UsersController = class UsersController {
    users;
    constructor(users) {
        this.users = users;
    }
    list(req) {
        return this.users.findManyByAgencyCode(req.auth.agencyCode);
    }
    createOwner(body) {
        return this.users.createOwner(body);
    }
    createOperator(body) {
        return this.users.createOperator(body);
    }
    listOperators(req) {
        return this.users.findOperatorsByAgencyCode(req.auth.agencyCode);
    }
    updateOperator(id, body, req) {
        return this.users.updateOperator(id, body, req.auth.agencyCode);
    }
    deleteOperator(id, req) {
        return this.users.deleteOperator(id, req.auth.agencyCode);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "list", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Post)('owner'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "createOwner", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Post)('operator'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "createOperator", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Get)('operators'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "listOperators", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Put)('operators/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "updateOperator", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER),
    (0, common_1.Delete)('operators/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "deleteOperator", null);
exports.UsersController = UsersController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map