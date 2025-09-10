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
exports.ChatsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const roles_guard_1 = require("../common/auth/roles.guard");
const client_1 = require("@prisma/client");
const chats_service_1 = require("./chats.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const send_photo_dto_1 = require("./dto/send-photo.dto");
const auth_guard_1 = require("../common/auth/auth.guard");
let ChatsController = class ChatsController {
    chats;
    constructor(chats) {
        this.chats = chats;
    }
    async dialogs(req, filters) {
        try {
            console.log('🔍 ChatsController.dialogs called with auth:', {
                userId: req.auth?.userId,
                role: req.auth?.role,
                agencyCode: req.auth?.agencyCode,
                operatorCode: req.auth?.operatorCode
            });
            const processedFilters = {
                ...filters,
                onlineOnly: filters.onlineOnly === 'true'
            };
            console.log('🔍 ChatsController.dialogs filters:', processedFilters);
            const result = await this.chats.fetchDialogs(req.auth, processedFilters);
            console.log('✅ ChatsController.dialogs success:', {
                hasDialogs: result?.dialogs?.length > 0,
                dialogsCount: result?.dialogs?.length,
                hasProfiles: Object.keys(result?.profiles || {}).length > 0
            });
            return result;
        }
        catch (error) {
            console.error('💥 ChatsController.dialogs error:', error);
            throw error;
        }
    }
    searchDialog(req, query) {
        console.log('🔍 ChatsController.searchDialog called with:', query);
        return this.chats.searchDialogByPair(req.auth, query.profileId, query.clientId);
    }
    restrictions(req, id) {
        console.log('🔍 ChatsController.restrictions called for dialog:', id);
        return this.chats.fetchRestrictions(req.auth, id);
    }
    messages(req, id, cursor) {
        return this.chats.fetchMessages(req.auth, id, cursor);
    }
    sendText(req, id, body) {
        return this.chats.sendText(req.auth, id, body.text);
    }
    async getProfiles(ids, req) {
        if (!ids) {
            return { profiles: [] };
        }
        const userIds = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (userIds.length === 0) {
            return { profiles: [] };
        }
        const accessibleProfiles = await this.chats.getAccessibleProfiles(req.auth);
        const targetProfile = accessibleProfiles.find(p => p.profileId);
        if (!targetProfile || !targetProfile.profileId) {
            return { profiles: [] };
        }
        return this.chats.fetchUserProfiles(targetProfile.profileId, userIds);
    }
    async sendPhoto(req, sendPhotoDto) {
        console.log('📸 ChatsController.sendPhoto called with:', sendPhotoDto);
        return this.chats.sendPhoto(req.auth, sendPhotoDto);
    }
    async getStickers(req, body) {
        console.log('😀 ChatsController.getStickers called with interlocutor:', body.idInterlocutor);
        return this.chats.getStickers(req.auth, body.idInterlocutor);
    }
    async sendSticker(req, body) {
        console.log('😀 ChatsController.sendSticker called with:', body);
        if (!body.idProfile) {
            const dialogId = req.headers.referer?.toString().split('/').pop() || '';
            const [idProfile] = dialogId.split('_').map(Number);
            body.idProfile = idProfile;
        }
        return this.chats.sendSticker(req.auth, body);
    }
    async getTtRestrictions(req, body) {
        console.log('⚡ ChatsController.getTtRestrictions called:', body);
        return this.chats.getTtRestrictions(req.auth, body.profileId, body.idInterlocutor);
    }
    async getForbiddenTags(req, body) {
        console.log('⚠️ ChatsController.getForbiddenTags called:', body);
        return this.chats.getForbiddenCorrespondenceTags(req.auth, body.profileId, body.idInterlocutor);
    }
    async sendLetter(req, body) {
        console.log('✉️ ChatsController.sendLetter called:', { profileId: body.profileId, idUserTo: body.idUserTo, textLen: body.content?.length, photos: body.photoIds?.length || 0, videos: body.videoIds?.length || 0 });
        return this.chats.sendLetter(req.auth, body.profileId, body.idUserTo, { content: body.content, photoIds: body.photoIds, videoIds: body.videoIds });
    }
    async sendExclusivePost(req, body) {
        console.log('📝 ChatsController.sendExclusivePost called:', { profileId: body.profileId, idRegularUser: body.idRegularUser, photos: body.idsGalleryPhotos?.length || 0, videos: body.idsGalleryVideos?.length || 0, textLen: body.text?.length || 0 });
        return this.chats.sendExclusivePost(req.auth, body);
    }
    async getPostDetails(req, body) {
        console.log('📄 ChatsController.getPostDetails called:', { idPost: body.idPost, idProfile: body.idProfile, idInterlocutor: body.idInterlocutor });
        console.log('🔐 Auth context:', { userId: req.auth?.userId, agencyCode: req.auth?.agencyCode, operatorCode: req.auth?.operatorCode });
        return this.chats.getPostDetails(req.auth, body.idPost, body.idProfile, body.idInterlocutor);
    }
    getOriginalPhoto(req, body) {
        return this.chats.getOriginalPhotoUrl(req.auth, body.profileId, body.idRegularUser, body.previewUrl);
    }
    getConnections(req, body) {
        return this.chats.getConnections(req.auth, body.profileId, body.idsInterlocutor);
    }
};
exports.ChatsController = ChatsController;
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('dialogs'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "dialogs", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('search-dialog'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "searchDialog", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('dialogs/:id/restrictions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "restrictions", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('dialogs/:id/messages'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "messages", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60000 } }),
    (0, common_1.Post)('dialogs/:id/text'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "sendText", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Get)('profiles'),
    __param(0, (0, common_1.Query)('ids')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "getProfiles", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('send-photo'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, send_photo_dto_1.SendPhotoDto]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "sendPhoto", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)('stickers'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "getStickers", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, throttler_1.Throttle)({ default: { limit: 15, ttl: 60000 } }),
    (0, common_1.Post)('send-sticker'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "sendSticker", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.Post)('tt-restrictions'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "getTtRestrictions", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.Post)('tt-forbidden-tags'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "getForbiddenTags", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('send-letter'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "sendLetter", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)('tt-send-post'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "sendExclusivePost", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)('tt-post-details'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatsController.prototype, "getPostDetails", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)('photo-original'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getOriginalPhoto", null);
__decorate([
    (0, roles_guard_1.Roles)(client_1.Role.OWNER, client_1.Role.OPERATOR),
    (0, common_1.Post)('connections'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ChatsController.prototype, "getConnections", null);
exports.ChatsController = ChatsController = __decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, auth_guard_1.ActiveShiftGuard),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60000 } }),
    (0, common_1.Controller)('chats'),
    __metadata("design:paramtypes", [chats_service_1.ChatsService])
], ChatsController);
//# sourceMappingURL=chats.controller.js.map