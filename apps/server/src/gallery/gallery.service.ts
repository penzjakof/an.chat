import { Injectable, Logger, Inject } from '@nestjs/common';
import { TALKY_TIMES_PROVIDER } from '../providers/providers.module';
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
  isTemporary?: boolean; // Новий параметр для temporary фото
}

export interface VideoGalleryRequest {
  cursor?: string;
  statuses?: string[];
  tags?: string[];
  limit?: number;
  excludeTags?: string[];
}

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    @Inject(TALKY_TIMES_PROVIDER) private readonly talkyTimesProvider: SiteProvider,
    private readonly sessionService: TalkyTimesSessionService,
  ) {}

  /**
   * Отримує список фото з галереї профілю
   */
  async getPhotos(profileId: number, request: GalleryRequest = {}): Promise<GalleryResponse> {
    this.logger.log(`📸 Fetching photos for profile ${profileId}`);

    try {
      // Перевіряємо чи є активна сесія для профілю
      const session = await this.sessionService.getActiveSession(profileId);
      if (!session) {
        // М'яка відповідь: повертаємо порожні дані замість помилки
        return { cursor: '', photos: [] } as GalleryResponse;
      }

      // Підготовуємо параметри запиту
      const requestBody = {
        cursor: request.cursor || '',
        statuses: request.statuses || ['approved', 'approved_by_ai'],
        tags: request.tags || [],
        limit: request.limit || 50,
        idAlbum: request.idAlbum || null,
        idAlbumExcluded: request.idAlbumExcluded || null,
        isTemporary: request.isTemporary || false, // Додаємо новий параметр
      };

      this.logger.log(`📋 Gallery request for profile ${profileId}:`, requestBody);

      // Відправляємо запит до TalkyTimes
      if (!this.talkyTimesProvider.makeRequest) {
        throw new Error('Provider does not support makeRequest method');
      }

      const response = await this.talkyTimesProvider.makeRequest!({
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
        // Повертаємо порожні дані при помилці
        return { cursor: '', photos: [] } as GalleryResponse;
      }

      return response.data as GalleryResponse;

    } catch (error) {
      this.logger.error(`❌ Failed to fetch photos for profile ${profileId}:`, error);
      
      // Повертаємо пусту відповідь замість викидання помилки для кращого UX
      return { cursor: '', photos: [] } as GalleryResponse;
    }
  }

  /**
   * Отримує фото з пагінацією
   */
  async getPhotosWithPagination(
    profileId: number,
    cursor?: string,
    limit: number = 50
  ): Promise<GalleryResponse> {
    return this.getPhotos(profileId, {
      cursor,
      limit,
      statuses: ['approved', 'approved_by_ai'],
    });
  }

  /**
   * Отримує фото за тегами
   */
  async getPhotosByTags(
    profileId: number,
    tags: string[],
    cursor?: string,
    limit: number = 50
  ): Promise<GalleryResponse> {
    return this.getPhotos(profileId, {
      cursor,
      limit,
      tags,
      statuses: ['approved', 'approved_by_ai'],
    });
  }

  /**
   * Отримує тільки спеціальні фото
   */
  async getSpecialPhotos(
    profileId: number,
    cursor?: string,
    limit: number = 50
  ): Promise<GalleryResponse> {
    return this.getPhotosByTags(profileId, ['special', 'special_plus'], cursor, limit);
  }

  /**
   * Отримує звичайні фото (без спеціальних тегів)
   */
  async getRegularPhotos(
    profileId: number,
    cursor?: string,
    limit: number = 50
  ): Promise<GalleryResponse> {
    const allPhotos = await this.getPhotos(profileId, {
      cursor,
      limit,
      statuses: ['approved', 'approved_by_ai'],
    });

    // Фільтруємо фото без спеціальних тегів
    const regularPhotos = allPhotos.photos.filter(photo => 
      !photo.tags.some(tag => ['special', 'special_plus'].includes(tag.code))
    );

    return {
      cursor: allPhotos.cursor,
      photos: regularPhotos,
    };
  }

  /**
   * Отримує список відео з галереї профілю
   */
  async getVideos(profileId: number, request: VideoGalleryRequest = {}): Promise<VideoGalleryResponse> {
    this.logger.log(`🎥 Fetching videos for profile ${profileId}`);

    try {
      // Перевіряємо чи є активна сесія для профілю
      const session = await this.sessionService.getActiveSession(profileId);
      if (!session) {
        return { cursor: '', videos: [] } as VideoGalleryResponse;
      }

      // Підготовуємо параметри запиту
      const requestBody = {
        cursor: request.cursor || '',
        statuses: request.statuses || ['approved'],
        tags: request.tags || [],
        limit: request.limit || 100,
        excludeTags: request.excludeTags || [],
      };

      this.logger.log(`📋 Video gallery request for profile ${profileId}:`, requestBody);

      // Відправляємо запит до TalkyTimes
      if (!this.talkyTimesProvider.makeRequest) {
        throw new Error('Provider does not support makeRequest method');
      }

      const response = await this.talkyTimesProvider.makeRequest!({
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
        return { cursor: '', videos: [] } as VideoGalleryResponse;
      }

      return response.data as VideoGalleryResponse;

    } catch (error) {
      this.logger.error(`❌ Failed to fetch videos for profile ${profileId}:`, error);
      
      // Повертаємо пусту відповідь замість викидання помилки для кращого UX
      return { cursor: '', videos: [] } as VideoGalleryResponse;
    }
  }

  /**
   * Отримує відео з пагінацією
   */
  async getVideosWithPagination(
    profileId: number,
    cursor?: string,
    limit: number = 100
  ): Promise<VideoGalleryResponse> {
    return this.getVideos(profileId, {
      cursor,
      limit,
      statuses: ['approved'],
    });
  }

  /**
   * Відправляє відео в чат
   */
  async sendVideosToChat(idsGalleryVideos: number[], idRegularUser: number, profileId: number): Promise<any> {
    this.logger.log(`🎥 Sending ${idsGalleryVideos.length} videos to chat for profile ${profileId}`);

    // Відправляємо запит до TalkyTimes
    if (!this.talkyTimesProvider.makeRequest) {
      throw new Error('Provider does not support makeRequest method');
    }

    const results: any[] = [];
    
    // Відправляємо кожне відео окремим запитом
    for (const idGalleryVideo of idsGalleryVideos) {
      try {
        const response = await this.talkyTimesProvider.makeRequest!({
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
      } catch (error) {
        this.logger.error(`❌ Error sending video ${idGalleryVideo}:`, error);
        throw error;
      }
    }

    return { messages: results };
  }

  /**
   * Відправляє фото в чат
   */
  async sendPhotosToChat(idsGalleryPhotos: number[], idRegularUser: number, profileId: number): Promise<any> {

    // Відправляємо запит до TalkyTimes
    if (!this.talkyTimesProvider.makeRequest) {
      throw new Error('Provider does not support makeRequest method');
    }

    const response = await this.talkyTimesProvider.makeRequest!({
      method: 'POST',
      url: '/platform/chat/send/gallery-photos',
      data: {
        idsGalleryPhotos,
        idRegularUser
      },
      profileId, // Передаємо правильний ID профілю
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

  /**
   * Отримує статуси фото (accessed/sent/null)
   */
  async getPhotoStatuses(idUser: number, idsPhotos: number[], profileId: number): Promise<any> {
    this.logger.log(`📊 Getting photo statuses for user ${idUser}, photos: ${idsPhotos.length}, profile: ${profileId}`);

    if (!this.talkyTimesProvider.makeRequest) {
      return { cursor: '', items: [] } as AudioGalleryResponse;
    }

    const response = await this.talkyTimesProvider.makeRequest({
      method: 'POST',
      url: '/platform/gallery/photo/connection/list',
      data: {
        idUser,
        idsPhotos
      },
      profileId, // Використовуємо правильний profileId
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

  /**
   * Отримує статуси відео (accessed/sent/null)
   */
  async getVideoStatuses(idUser: number, idsVideos: number[], profileId: number): Promise<any> {
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

  /**
   * Отримує список аудіо профілю з пагінацією
   */
  async getAudios(profileId: number, request: AudioGalleryRequest = {}): Promise<AudioGalleryResponse> {
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
      return { cursor: '', items: [] } as AudioGalleryResponse;
    }

    return response.data;
  }

  /**
   * Отримує аудіо з пагінацією (wrapper метод)
   */
  async getAudiosWithPagination(profileId: number, cursor?: string, limit: number = 50): Promise<AudioGalleryResponse> {
    return this.getAudios(profileId, {
      cursor,
      limit,
      statuses: ['approved'],
    });
  }

  /**
   * Відправляє аудіо в чат
   */
  async sendAudiosToChat(idsGalleryAudios: number[], idRegularUser: number, profileId: number): Promise<any> {
    this.logger.log(`🎵 Sending ${idsGalleryAudios.length} audios to chat for profile ${profileId}`);

    if (!this.talkyTimesProvider.makeRequest) {
      throw new Error('Provider does not support makeRequest method');
    }

    const results: any[] = [];
    
    // Відправляємо кожне аудіо окремим запитом
    for (const idGalleryAudio of idsGalleryAudios) {
      try {
        const response = await this.talkyTimesProvider.makeRequest!({
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
      } catch (error) {
        this.logger.error(`❌ Error sending audio ${idGalleryAudio}:`, error);
        throw error;
      }
    }

    return { messages: results };
  }

  /**
   * Отримує статуси аудіо (accessed/sent/null)
   */
  async getAudioStatuses(idUser: number, idsAudios: number[], profileId: number): Promise<any> {
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
}
