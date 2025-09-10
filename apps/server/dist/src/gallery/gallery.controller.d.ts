import { GalleryService } from './gallery.service';
import type { GalleryRequest, GalleryResponse, VideoGalleryRequest, VideoGalleryResponse, AudioGalleryRequest, AudioGalleryResponse } from './gallery.service';
export declare class GalleryController {
    private readonly galleryService;
    private readonly logger;
    constructor(galleryService: GalleryService);
    getPhotos(profileId: string, cursor?: string, limit?: string, tags?: string, statuses?: string, isTemporary?: string): Promise<{
        success: boolean;
        data: GalleryResponse;
        error?: string;
    }>;
    getPhotosAdvanced(profileId: string, request: GalleryRequest): Promise<{
        success: boolean;
        data: GalleryResponse;
        error?: string;
    }>;
    getSpecialPhotos(profileId: string, cursor?: string, limit?: string): Promise<{
        success: boolean;
        data: GalleryResponse;
        error?: string;
    }>;
    getRegularPhotos(profileId: string, cursor?: string, limit?: string): Promise<{
        success: boolean;
        data: GalleryResponse;
        error?: string;
    }>;
    sendPhotos(body: {
        idsGalleryPhotos: number[];
        idRegularUser: number;
        profileId: number;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    sendVideos(body: {
        idsGalleryVideos: number[];
        idRegularUser: number;
        profileId: number;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getVideos(profileId: string, cursor?: string, limit?: string, tags?: string, statuses?: string): Promise<{
        success: boolean;
        data: VideoGalleryResponse;
        error?: string;
    }>;
    getVideosAdvanced(profileId: string, request: VideoGalleryRequest): Promise<{
        success: boolean;
        data: VideoGalleryResponse;
        error?: string;
    }>;
    getPhotoStatuses(body: {
        idUser: number;
        idsPhotos: number[];
        profileId: number;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getVideoStatuses(body: {
        idUser: number;
        idsVideos: number[];
        profileId: number;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getAudios(profileId: string, cursor?: string, limit?: string, statuses?: string): Promise<{
        success: boolean;
        data?: AudioGalleryResponse;
        error?: string;
    }>;
    getAudiosAdvanced(profileId: string, request: AudioGalleryRequest): Promise<{
        success: boolean;
        data?: AudioGalleryResponse;
        error?: string;
    }>;
    sendAudios(body: {
        idsGalleryAudios: number[];
        idRegularUser: number;
        profileId: number;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    getAudioStatuses(body: {
        idUser: number;
        idsAudios: number[];
        profileId: number;
    }): Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
}
