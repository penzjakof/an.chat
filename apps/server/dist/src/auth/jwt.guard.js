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
var JwtAuthGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const public_decorator_1 = require("../common/auth/public.decorator");
let JwtAuthGuard = JwtAuthGuard_1 = class JwtAuthGuard {
    jwt;
    reflector;
    logger = new common_1.Logger(JwtAuthGuard_1.name);
    constructor(jwt, reflector) {
        this.jwt = jwt;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic)
            return true;
        const req = context.switchToHttp().getRequest();
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
            this.logger.warn(`🚨 JWT Guard: Missing authorization header for ${req.method} ${req.url}`);
            throw new common_1.UnauthorizedException();
        }
        const token = auth.slice('Bearer '.length);
        try {
            const payload = await this.jwt.verifyAsync(token);
            req.auth = { agencyCode: payload.agencyCode, role: payload.role, userId: payload.sub, operatorCode: payload.operatorCode };
            return true;
        }
        catch (error) {
            this.logger.warn(`🚨 JWT Guard: Token verification failed for ${req.method} ${req.url}: ${error.message}`);
            throw new common_1.UnauthorizedException();
        }
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = JwtAuthGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, core_1.Reflector])
], JwtAuthGuard);
//# sourceMappingURL=jwt.guard.js.map