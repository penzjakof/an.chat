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

export interface GalleryResponse {
  cursor: string;
  photos: Photo[];
}

export interface GalleryRequest {
  cursor?: string;
  statuses?: string[];
  tags?: string[];
  limit?: number;
  idAlbum?: number | null;
  idAlbumExcluded?: number | null;
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
        throw new Error(`No active session found for profile ${profileId}`);
      }

      // Підготовуємо параметри запиту
      const requestBody: GalleryRequest = {
        cursor: request.cursor || '',
        statuses: request.statuses || ['approved', 'approved_by_ai'],
        tags: request.tags || [],
        limit: request.limit || 50,
        idAlbum: request.idAlbum || null,
        idAlbumExcluded: request.idAlbumExcluded || null,
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
        throw new Error(`Failed to fetch photos: ${response.error}`);
      }

      return response.data as GalleryResponse;

    } catch (error) {
      this.logger.error(`❌ Failed to fetch photos for profile ${profileId}:`, error);
      
      // Повертаємо пусту відповідь замість викидання помилки для кращого UX
      if (error instanceof Error && error.message.includes('Network')) {
        throw new Error('Мережева помилка. Перевірте з\'єднання з інтернетом.');
      }
      
      throw error;
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
}
