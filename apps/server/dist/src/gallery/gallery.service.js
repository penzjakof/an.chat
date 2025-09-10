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
var GalleryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryService = void 0;
const common_1 = require("@nestjs/common");
const providers_module_1 = require("../providers/providers.module");
const session_service_1 = require("../providers/talkytimes/session.service");
let GalleryService = GalleryService_1 = class GalleryService {
    talkyTimesProvider;
    sessionService;
    logger = new common_1.Logger(GalleryService_1.name);
    constructor(talkyTimesProvider, sessionService) {
        this.talkyTimesProvider = talkyTimesProvider;
        this.sessionService = sessionService;
    }
    async getPhotos(profileId, request = {}) {
        this.logger.log(`📸 Fetching photos for profile ${profileId}`);
        try {
            const session = await this.sessionService.getActiveSession(profileId);
            if (!session) {
                return { cursor: '', photos: [] };
            }
            const requestBody = {
                cursor: request.cursor || '',
                statuses: request.statuses || ['approved', 'approved_by_ai'],
                tags: request.tags || [],
                limit: request.limit || 50,
                idAlbum: request.idAlbum || null,
                idAlbumExcluded: request.idAlbumExcluded || null,
                isTemporary: request.isTemporary || false,
            };
            this.logger.log(`📋 Gallery request for profile ${profileId}:`, requestBody);
            if (!this.talkyTimesProvider.makeRequest) {
                throw new Error('Provider does not support makeRequest method');
            }
            const response = await this.talkyTimesProvider.makeRequest({
                method: 'POST',
                url: '/platform/gallery/photo/list',
                data: requestBody,
                profileId,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });
            if (!response.success) {
                this.logger.error(`❌ TalkyTimes API failed:`, response.error);
                return { cursor: '', photos: [] };
            }
            return response.data;
        }
        catch (error) {
            this.logger.error(`❌ Failed to fetch photos for profile ${profileId}:`, error);
            return { cursor: '', photos: [] };
        }
    }
    async getPhotosWithPagination(profileId, cursor, limit = 50) {
        return this.getPhotos(profileId, {
            cursor,
            limit,
            statuses: ['approved', 'approved_by_ai'],
        });
    }
    async getPhotosByTags(profileId, tags, cursor, limit = 50) {
        return this.getPhotos(profileId, {
            cursor,
            limit,
            tags,
            statuses: ['approved', 'approved_by_ai'],
        });
    }
    async getSpecialPhotos(profileId, cursor, limit = 50) {
        return this.getPhotosByTags(profileId, ['special', 'special_plus'], cursor, limit);
    }
    async getRegularPhotos(profileId, cursor, limit = 50) {
        const allPhotos = await this.getPhotos(profileId, {
            cursor,
            limit,
            statuses: ['approved', 'approved_by_ai'],
        });
        const regularPhotos = allPhotos.photos.filter(photo => !photo.tags.some(tag => ['special', 'special_plus'].includes(tag.code)));
        return {
            cursor: allPhotos.cursor,
            photos: regularPhotos,
        };
    }
    async getVideos(profileId, request = {}) {
        this.logger.log(`🎥 Fetching videos for profile ${profileId}`);
        try {
            const session = await this.sessionService.getActiveSession(profileId);
            if (!session) {
                return { cursor: '', videos: [] };
            }
            const requestBody = {
                cursor: request.cursor || '',
                statuses: request.statuses || ['approved'],
                tags: request.tags || [],
                limit: request.limit || 100,
                excludeTags: request.excludeTags || [],
            };
            this.logger.log(`📋 Video gallery request for profile ${profileId}:`, requestBody);
            if (!this.talkyTimesProvider.makeRequest) {
                throw new Error('Provider does not support makeRequest method');
            }
            const response = await this.talkyTimesProvider.makeRequest({
                method: 'POST',
                url: '/platform/gallery/video/list',
                data: requestBody,
                profileId,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });
            if (!response.success) {
                this.logger.error(`❌ TalkyTimes video API failed:`, response.error);
                return { cursor: '', videos: [] };
            }
            return response.data;
        }
        catch (error) {
            this.logger.error(`❌ Failed to fetch videos for profile ${profileId}:`, error);
            return { cursor: '', videos: [] };
        }
    }
    async getVideosWithPagination(profileId, cursor, limit = 100) {
        return this.getVideos(profileId, {
            cursor,
            limit,
            statuses: ['approved'],
        });
    }
    async sendVideosToChat(idsGalleryVideos, idRegularUser, profileId) {
        this.logger.log(`🎥 Sending ${idsGalleryVideos.length} videos to chat for profile ${profileId}`);
        if (!this.talkyTimesProvider.makeRequest) {
            throw new Error('Provider does not support makeRequest method');
        }
        const results = [];
        for (const idGalleryVideo of idsGalleryVideos) {
            try {
                const response = await this.talkyTimesProvider.makeRequest({
                    method: 'POST',
                    url: '/platform/chat/send/gallery-video',
                    data: {
                        idGalleryVideo,
                        idRegularUser
                    },
                    profileId,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                });
                if (!response.success) {
                    this.logger.error(`❌ TalkyTimes send video ${idGalleryVideo} failed:`, response.error);
                    throw new Error(`Failed to send video ${idGalleryVideo}: ${response.error}`);
                }
                results.push(response.data);
                this.logger.log(`✅ Video ${idGalleryVideo} sent successfully, message ID: ${response.data?.idMessage}`);
            }
            catch (error) {
                this.logger.error(`❌ Error sending video ${idGalleryVideo}:`, error);
                throw error;
            }
        }
        return { messages: results };
    }
    async sendPhotosToChat(idsGalleryPhotos, idRegularUser, profileId) {
        if (!this.talkyTimesProvider.makeRequest) {
            throw new Error('Provider does not support makeRequest method');
        }
        const response = await this.talkyTimesProvider.makeRequest({
            method: 'POST',
            url: '/platform/chat/send/gallery-photos',
            data: {
                idsGalleryPhotos,
                idRegularUser
            },
            profileId,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        if (!response.success) {
            this.logger.error(`❌ TalkyTimes send photos failed:`, response.error);
            throw new Error(`Failed to send photos: ${response.error}`);
        }
        return response.data;
    }
    async getPhotoStatuses(idUser, idsPhotos, profileId) {
        this.logger.log(`📊 Getting photo statuses for user ${idUser}, photos: ${idsPhotos.length}, profile: ${profileId}`);
        if (!this.talkyTimesProvider.makeRequest) {
            return { cursor: '', items: [] };
        }
        const response = await this.talkyTimesProvider.makeRequest({
            method: 'POST',
            url: '/platform/gallery/photo/connection/list',
            data: {
                idUser,
                idsPhotos
            },
            profileId,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        if (!response.success) {
            this.logger.error(`❌ TalkyTimes get photo statuses failed:`, response.error);
            throw new Error(`Failed to get photo statuses: ${response.error}`);
        }
        return response.data;
    }
    async getVideoStatuses(idUser, idsVideos, profileId) {
        this.logger.log(`🎥 Getting video statuses for user ${idUser}, videos: ${idsVideos.length}, profile: ${profileId}`);
        if (!this.talkyTimesProvider.makeRequest) {
            throw new Error('makeRequest method is not available on TalkyTimes provider');
        }
        const response = await this.talkyTimesProvider.makeRequest({
            method: 'POST',
            url: '/platform/gallery/video/connection/list',
            data: {
                idUser,
                idsVideos
            },
            profileId,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        if (!response.success) {
            this.logger.error(`❌ TalkyTimes get video statuses failed:`, response.error);
            throw new Error(`Failed to get video statuses: ${response.error}`);
        }
        return response.data;
    }
    async getAudios(profileId, request = {}) {
        this.logger.log(`🎵 Getting audios for profile ${profileId} with cursor: ${request.cursor || 'none'}`);
        if (!this.talkyTimesProvider.makeRequest) {
            throw new Error('makeRequest method is not available on TalkyTimes provider');
        }
        const response = await this.talkyTimesProvider.makeRequest({
            method: 'POST',
            url: '/platform/gallery/audio/list',
            data: {
                cursor: request.cursor || '',
                limit: request.limit || 50,
                statuses: request.statuses || ['approved']
            },
            profileId,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        if (!response.success) {
            this.logger.error(`❌ TalkyTimes get audios failed:`, response.error);
            return { cursor: '', items: [] };
        }
        return response.data;
    }
    async getAudiosWithPagination(profileId, cursor, limit = 50) {
        return this.getAudios(profileId, {
            cursor,
            limit,
            statuses: ['approved'],
        });
    }
    async sendAudiosToChat(idsGalleryAudios, idRegularUser, profileId) {
        this.logger.log(`🎵 Sending ${idsGalleryAudios.length} audios to chat for profile ${profileId}`);
        if (!this.talkyTimesProvider.makeRequest) {
            throw new Error('Provider does not support makeRequest method');
        }
        const results = [];
        for (const idGalleryAudio of idsGalleryAudios) {
            try {
                const response = await this.talkyTimesProvider.makeRequest({
                    method: 'POST',
                    url: '/platform/chat/send/gallery-audio',
                    data: {
                        idGalleryAudio,
                        idRegularUser
                    },
                    profileId,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                });
                if (!response.success) {
                    this.logger.error(`❌ TalkyTimes send audio ${idGalleryAudio} failed:`, response.error);
                    throw new Error(`Failed to send audio ${idGalleryAudio}: ${response.error}`);
                }
                results.push(response.data);
                this.logger.log(`✅ Audio ${idGalleryAudio} sent successfully, message ID: ${response.data?.idMessage}`);
            }
            catch (error) {
                this.logger.error(`❌ Error sending audio ${idGalleryAudio}:`, error);
                throw error;
            }
        }
        return { messages: results };
    }
    async getAudioStatuses(idUser, idsAudios, profileId) {
        this.logger.log(`🎵 Getting audio statuses for user ${idUser}, audios: ${idsAudios.length}, profile: ${profileId}`);
        if (!this.talkyTimesProvider.makeRequest) {
            throw new Error('makeRequest method is not available on TalkyTimes provider');
        }
        const response = await this.talkyTimesProvider.makeRequest({
            method: 'POST',
            url: '/platform/gallery/audio/connection/list',
            data: {
                idUser,
                idsAudios
            },
            profileId,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });
        if (!response.success) {
            this.logger.error(`❌ TalkyTimes get audio statuses failed:`, response.error);
            throw new Error(`Failed to get audio statuses: ${response.error}`);
        }
        return response.data;
    }
};
exports.GalleryService = GalleryService;
exports.GalleryService = GalleryService = GalleryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(providers_module_1.TALKY_TIMES_PROVIDER)),
    __metadata("design:paramtypes", [Object, session_service_1.TalkyTimesSessionService])
], GalleryService);
//# sourceMappingURL=gallery.service.js.map