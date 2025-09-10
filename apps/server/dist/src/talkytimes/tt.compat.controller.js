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
exports.TTCompatController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const common_2 = require("@nestjs/common");
const providers_module_1 = require("../providers/providers.module");
const rtm_service_1 = require("../providers/talkytimes/rtm.service");
let TTCompatController = class TTCompatController {
    tt;
    rtmService;
    constructor(tt, rtmService) {
        this.tt = tt;
        this.rtmService = rtmService;
    }
    async getRtmStatus() {
        const status = this.rtmService.getConnectionStatus();
        const connectedProfiles = Object.keys(status).filter(profileId => status[parseInt(profileId)]);
        return {
            status: connectedProfiles.length > 0 ? 'connected' : 'disconnected',
            connectedProfiles: connectedProfiles.map(id => parseInt(id)),
            totalProfiles: Object.keys(status).length,
            timestamp: new Date().toISOString()
        };
    }
    async emailsHistory(_req, body) {
        try {
            const result = await this.tt.getEmailHistory(body.id_user, parseInt(body.id_interlocutor), body.id_correspondence, body.page || 1, body.limit || 10);
            if (!result?.success) {
                return { success: false, error: result?.error || 'Failed to fetch email history' };
            }
            return result;
        }
        catch (error) {
            return { success: false, error: error?.message || 'Unknown error' };
        }
    }
};
exports.TTCompatController = TTCompatController;
__decorate([
    (0, common_1.Get)('rtm-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TTCompatController.prototype, "getRtmStatus", null);
__decorate([
    (0, common_1.Post)('emails-history'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TTCompatController.prototype, "emailsHistory", null);
exports.TTCompatController = TTCompatController = __decorate([
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.Controller)('api/tt'),
    __param(0, (0, common_2.Inject)(providers_module_1.TALKY_TIMES_PROVIDER)),
    __metadata("design:paramtypes", [Object, rtm_service_1.TalkyTimesRTMService])
], TTCompatController);
//# sourceMappingURL=tt.compat.controller.js.map