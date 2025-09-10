import type { SiteProvider } from '../providers/site-provider.interface';
import { TalkyTimesSessionService } from '../providers/talkytimes/session.service';
export interface PhotoTag {
    code: string;
    description: string;
}
export interface PhotoUrls {
    urlOriginal: string;
    urlPreview: string;
    urlStandard: string;
}
export interface VideoUrls {
    urlMp4Hd: string;
    urlMp4Sd: string;
    urlThumbnail: string;
}
export interface PhotoStatus {
    code: string;
    description: string;
}
export interface Photo {
    idPhoto: number;
    idUser: number;
    status: PhotoStatus;
    tags: PhotoTag[];
    declineReasons: string[];
    comment: string;
    urls: PhotoUrls;
    canDisagree: boolean;
}
export interface Video {
    idVideo: number;
    idUser: number;
    status: PhotoStatus;
    tags: PhotoTag[];
    declineReasons: string[];
    comment: string;
    urls: VideoUrls;
    duration: number;
}
export interface GalleryResponse {
    cursor: string;
    photos: Photo[];
}
export interface VideoGalleryResponse {
    cursor: string;
    videos: Video[];
}
export interface AudioUrls {
    mp3: string;
    ogg: string;
}
export interface Audio {
    id: number;
    idUser: number;
    status: string;
    title: string;
    duration: number;
    dateCreated: string;
    dateUpdated: string;
    declineReasons: string[];
    urls: AudioUrls;
}
export interface AudioGalleryResponse {
    cursor: string;
    items: Audio[];
}
export interface AudioGalleryRequest {
    cursor?: string;
    limit?: number;
    statuses?: string[];
}
export interface GalleryRequest {
    cursor?: string;
    statuses?: string[];
    tags?: string[];
    limit?: number;
    idAlbum?: number | null;
    idAlbumExcluded?: number | null;
    isTemporary?: boolean;
}
export interface VideoGalleryRequest {
    cursor?: string;
    statuses?: string[];
    tags?: string[];
    limit?: number;
    excludeTags?: string[];
}
export declare class GalleryService {
    private readonly talkyTimesProvider;
    private readonly sessionService;
    private readonly logger;
    constructor(talkyTimesProvider: SiteProvider, sessionService: TalkyTimesSessionService);
    getPhotos(profileId: number, request?: GalleryRequest): Promise<GalleryResponse>;
    getPhotosWithPagination(profileId: number, cursor?: string, limit?: number): Promise<GalleryResponse>;
    getPhotosByTags(profileId: number, tags: string[], cursor?: string, limit?: number): Promise<GalleryResponse>;
    getSpecialPhotos(profileId: number, cursor?: string, limit?: number): Promise<GalleryResponse>;
    getRegularPhotos(profileId: number, cursor?: string, limit?: number): Promise<GalleryResponse>;
    getVideos(profileId: number, request?: VideoGalleryRequest): Promise<VideoGalleryResponse>;
    getVideosWithPagination(profileId: number, cursor?: string, limit?: number): Promise<VideoGalleryResponse>;
    sendVideosToChat(idsGalleryVideos: number[], idRegularUser: number, profileId: number): Promise<any>;
    sendPhotosToChat(idsGalleryPhotos: number[], idRegularUser: number, profileId: number): Promise<any>;
    getPhotoStatuses(idUser: number, idsPhotos: number[], profileId: number): Promise<any>;
    getVideoStatuses(idUser: number, idsVideos: number[], profileId: number): Promise<any>;
    getAudios(profileId: number, request?: AudioGalleryRequest): Promise<AudioGalleryResponse>;
    getAudiosWithPagination(profileId: number, cursor?: string, limit?: number): Promise<AudioGalleryResponse>;
    sendAudiosToChat(idsGalleryAudios: number[], idRegularUser: number, profileId: number): Promise<any>;
    getAudioStatuses(idUser: number, idsAudios: number[], profileId: number): Promise<any>;
}
