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
var GalleryController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryController = void 0;
const common_1 = require("@nestjs/common");
const gallery_service_1 = require("./gallery.service");
const public_decorator_1 = require("../common/auth/public.decorator");
let GalleryController = GalleryController_1 = class GalleryController {
    galleryService;
    logger = new common_1.Logger(GalleryController_1.name);
    constructor(galleryService) {
        this.galleryService = galleryService;
    }
    async getPhotos(profileId, cursor, limit, tags, statuses, isTemporary) {
        try {
            const request = {
                cursor: cursor || '',
                limit: limit ? parseInt(limit) : 50,
            };
            if (tags) {
                request.tags = tags.split(',').map(tag => tag.trim());
            }
            if (statuses) {
                request.statuses = statuses.split(',').map(status => status.trim());
            }
            if (isTemporary !== undefined) {
                request.isTemporary = isTemporary === 'true';
            }
            const data = await this.galleryService.getPhotos(parseInt(profileId), request);
            return {
                success: true,
                data
            };
        }
        catch (error) {
            this.logger.error(`❌ Gallery error:`, error);
            return {
                success: false,
                data: { cursor: '', photos: [] },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getPhotosAdvanced(profileId, request) {
        this.logger.log(`📸 POST /gallery/${profileId}/photos`, request);
        try {
            const data = await this.galleryService.getPhotos(parseInt(profileId), request);
            return {
                success: true,
                data
            };
        }
        catch (error) {
            this.logger.error(`❌ Gallery POST error:`, error);
            return {
                success: false,
                data: { cursor: '', photos: [] },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getSpecialPhotos(profileId, cursor, limit) {
        this.logger.log(`✨ GET /gallery/${profileId}/photos/special`);
        try {
            const limitNum = limit ? parseInt(limit) : 50;
            const data = await this.galleryService.getSpecialPhotos(parseInt(profileId), cursor, limitNum);
            return {
                success: true,
                data
            };
        }
        catch (error) {
            this.logger.error(`❌ Gallery special error:`, error);
            return {
                success: false,
                data: { cursor: '', photos: [] },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getRegularPhotos(profileId, cursor, limit) {
        this.logger.log(`📷 GET /gallery/${profileId}/photos/regular`);
        try {
            const limitNum = limit ? parseInt(limit) : 50;
            const data = await this.galleryService.getRegularPhotos(parseInt(profileId), cursor, limitNum);
            return {
                success: true,
                data
            };
        }
        catch (error) {
            this.logger.error(`❌ Gallery regular error:`, error);
            return {
                success: false,
                data: { cursor: '', photos: [] },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async sendPhotos(body) {
        if (!body.idsGalleryPhotos || !Array.isArray(body.idsGalleryPhotos) || body.idsGalleryPhotos.length === 0) {
            return {
                success: false,
                error: 'idsGalleryPhotos is required and must be a non-empty array'
            };
        }
        if (!body.idRegularUser || !body.profileId) {
            return {
                success: false,
                error: 'idRegularUser and profileId are required'
            };
        }
        try {
            const result = await this.galleryService.sendPhotosToChat(body.idsGalleryPhotos, body.idRegularUser, body.profileId);
            return {
                success: true
            };
        }
        catch (error) {
            this.logger.error(`❌ Send photos error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async sendVideos(body) {
        if (!body.idsGalleryVideos || !Array.isArray(body.idsGalleryVideos) || body.idsGalleryVideos.length === 0) {
            return {
                success: false,
                error: 'idsGalleryVideos is required and must be a non-empty array'
            };
        }
        if (!body.idRegularUser || !body.profileId) {
            return {
                success: false,
                error: 'idRegularUser and profileId are required'
            };
        }
        try {
            const result = await this.galleryService.sendVideosToChat(body.idsGalleryVideos, body.idRegularUser, body.profileId);
            return {
                success: true,
                data: result
            };
        }
        catch (error) {
            this.logger.error(`❌ Send videos error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getVideos(profileId, cursor, limit, tags, statuses) {
        try {
            const request = {
                cursor: cursor || '',
                limit: limit ? parseInt(limit) : 100,
            };
            if (tags) {
                request.tags = tags.split(',').map(tag => tag.trim());
            }
            if (statuses) {
                request.statuses = statuses.split(',').map(status => status.trim());
            }
            const data = await this.galleryService.getVideos(parseInt(profileId), request);
            return {
                success: true,
                data
            };
        }
        catch (error) {
            this.logger.error(`❌ Video gallery error:`, error);
            return {
                success: false,
                data: { cursor: '', videos: [] },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getVideosAdvanced(profileId, request) {
        this.logger.log(`🎥 POST /gallery/${profileId}/videos`, request);
        try {
            const data = await this.galleryService.getVideos(parseInt(profileId), request);
            return {
                success: true,
                data
            };
        }
        catch (error) {
            this.logger.error(`❌ Video gallery POST error:`, error);
            return {
                success: false,
                data: { cursor: '', videos: [] },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getPhotoStatuses(body) {
        if (!body.idUser || !body.idsPhotos || !Array.isArray(body.idsPhotos) || body.idsPhotos.length === 0 || !body.profileId) {
            return { success: false, error: 'idUser, idsPhotos and profileId are required' };
        }
        try {
            const data = await this.galleryService.getPhotoStatuses(body.idUser, body.idsPhotos, body.profileId);
            return { success: true, data };
        }
        catch (error) {
            this.logger.error(`❌ Get photo statuses error:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    async getVideoStatuses(body) {
        if (!body.idUser || !body.idsVideos || !Array.isArray(body.idsVideos) || body.idsVideos.length === 0 || !body.profileId) {
            return { success: false, error: 'idUser, idsVideos and profileId are required' };
        }
        try {
            const data = await this.galleryService.getVideoStatuses(body.idUser, body.idsVideos, body.profileId);
            return { success: true, data };
        }
        catch (error) {
            this.logger.error(`❌ Get video statuses error:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    async getAudios(profileId, cursor, limit, statuses) {
        try {
            const parsedLimit = limit ? parseInt(limit, 10) : 50;
            const parsedStatuses = statuses ? statuses.split(',') : ['approved'];
            const data = await this.galleryService.getAudios(parseInt(profileId), {
                cursor: cursor || '',
                limit: parsedLimit,
                statuses: parsedStatuses
            });
            return { success: true, data };
        }
        catch (error) {
            this.logger.error(`❌ Get audios error:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    async getAudiosAdvanced(profileId, request) {
        try {
            const data = await this.galleryService.getAudios(parseInt(profileId), request);
            return { success: true, data };
        }
        catch (error) {
            this.logger.error(`❌ Get audios advanced error:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    async sendAudios(body) {
        if (!body.idsGalleryAudios || !Array.isArray(body.idsGalleryAudios) || body.idsGalleryAudios.length === 0) {
            return {
                success: false,
                error: 'idsGalleryAudios is required and must be a non-empty array'
            };
        }
        if (!body.idRegularUser || !body.profileId) {
            return {
                success: false,
                error: 'idRegularUser and profileId are required'
            };
        }
        try {
            const result = await this.galleryService.sendAudiosToChat(body.idsGalleryAudios, body.idRegularUser, body.profileId);
            return {
                success: true,
                data: result
            };
        }
        catch (error) {
            this.logger.error(`❌ Send audios error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getAudioStatuses(body) {
        if (!body.idUser || !body.idsAudios || !Array.isArray(body.idsAudios) || body.idsAudios.length === 0 || !body.profileId) {
            return { success: false, error: 'idUser, idsAudios and profileId are required' };
        }
        try {
            const data = await this.galleryService.getAudioStatuses(body.idUser, body.idsAudios, body.profileId);
            return { success: true, data };
        }
        catch (error) {
            this.logger.error(`❌ Get audio statuses error:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
};
exports.GalleryController = GalleryController;
__decorate([
    (0, common_1.Get)(':profileId/photos'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Query)('cursor')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('tags')),
    __param(4, (0, common_1.Query)('statuses')),
    __param(5, (0, common_1.Query)('isTemporary')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getPhotos", null);
__decorate([
    (0, common_1.Post)(':profileId/photos'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getPhotosAdvanced", null);
__decorate([
    (0, common_1.Get)(':profileId/photos/special'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Query)('cursor')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getSpecialPhotos", null);
__decorate([
    (0, common_1.Get)(':profileId/photos/regular'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Query)('cursor')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getRegularPhotos", null);
__decorate([
    (0, common_1.Post)('send-photos'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "sendPhotos", null);
__decorate([
    (0, common_1.Post)('send-videos'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "sendVideos", null);
__decorate([
    (0, common_1.Get)(':profileId/videos'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Query)('cursor')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('tags')),
    __param(4, (0, common_1.Query)('statuses')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getVideos", null);
__decorate([
    (0, common_1.Post)(':profileId/videos'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getVideosAdvanced", null);
__decorate([
    (0, common_1.Post)('photo-statuses'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getPhotoStatuses", null);
__decorate([
    (0, common_1.Post)('video-statuses'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getVideoStatuses", null);
__decorate([
    (0, common_1.Get)(':profileId/audios'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Query)('cursor')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('statuses')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getAudios", null);
__decorate([
    (0, common_1.Post)(':profileId/audios'),
    __param(0, (0, common_1.Param)('profileId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getAudiosAdvanced", null);
__decorate([
    (0, common_1.Post)('send-audios'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "sendAudios", null);
__decorate([
    (0, common_1.Post)('audio-statuses'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getAudioStatuses", null);
exports.GalleryController = GalleryController = GalleryController_1 = __decorate([
    (0, common_1.Controller)(['api/gallery', 'gallery']),
    (0, public_decorator_1.Public)(),
    __metadata("design:paramtypes", [gallery_service_1.GalleryService])
], GalleryController);
//# sourceMappingURL=gallery.controller.js.map