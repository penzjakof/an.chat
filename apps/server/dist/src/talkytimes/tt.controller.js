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
exports.TTController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const roles_guard_1 = require("../common/auth/roles.guard");
const client_1 = require("@prisma/client");
const common_2 = require("@nestjs/common");
const providers_module_1 = require("../providers/providers.module");
const rtm_service_1 = require("../providers/talkytimes/rtm.service");
let TTController = class TTController {
    tt;
    rtmService;
    constructor(tt, rtmService) {
        this.tt = tt;
        this.rtmService = rtmService;
    }
    async dialogs(req, search, status) {
        return this.tt.fetchDialogs({ agencyCode: req.auth.agencyCode, operatorCode: req.auth.operatorCode }, { search, status });
    }
    async messages(req, id, cursor) {
        return this.tt.fetchMessages({ agencyCode: req.auth.agencyCode, operatorCode: req.auth.operatorCode }, id, cursor);
    }
    async emailsHistory(req, body) {
        console.log('📧 TTController.emailsHistory called with:', body);
        const result = await this.tt.getEmailHistory(body.id_user, parseInt(body.id_interlocutor), body.id_correspondence, body.page || 1, body.limit || 10);
        if (!result.success) {
            console.error('❌ Failed to fetch email history:', result.error);
            return { success: false, error: result.error };
        }
        return result;
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
    async getActiveSessions() {
        const status = this.rtmService.getConnectionStatus();
        return {
            connections: status,
            timestamp: new Date().toISOString()
        };
    }
    async testToast(body) {
        const testData = {
            messageId: Date.now(),
            idUserFrom: body.idUserFrom || 126965361,
            idUserTo: body.idUserTo || 7162437,
            dateCreated: new Date().toISOString(),
            content: { message: body.message || 'Test message' }
        };
        return { success: true, testData };
    }
};
exports.TTController = TTController;
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('dialogs'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], TTController.prototype, "dialogs", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('dialogs/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], TTController.prototype, "messages", null);
__decorate([
    (0, common_1.Post)('emails-history'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TTController.prototype, "emailsHistory", null);
__decorate([
    (0, common_1.Get)('rtm-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TTController.prototype, "getRtmStatus", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TTController.prototype, "getActiveSessions", null);
__decorate([
    (0, common_1.Post)('test-toast'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TTController.prototype, "testToast", null);
exports.TTController = TTController = __decorate([
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.Controller)('tt'),
    __param(0, (0, common_2.Inject)(providers_module_1.TALKY_TIMES_PROVIDER)),
    __metadata("design:paramtypes", [Object, rtm_service_1.TalkyTimesRTMService])
], TTController);
//# sourceMappingURL=tt.controller.js.map