import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import type { GalleryRequest, GalleryResponse, VideoGalleryRequest, VideoGalleryResponse, AudioGalleryRequest, AudioGalleryResponse } from './gallery.service';
import { Public } from '../common/auth/public.decorator';

@Controller(['api/gallery', 'gallery'])
@Public() // Галерея використовує TalkyTimes API напряму, не потребує JWT
export class GalleryController {
  private readonly logger = new Logger(GalleryController.name);

  constructor(private readonly galleryService: GalleryService) {}

  /**
   * GET /api/gallery/:profileId/photos
   * Отримує список фото профілю з пагінацією
   */
  @Get(':profileId/photos')
  async getPhotos(
    @Param('profileId') profileId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('tags') tags?: string,
    @Query('statuses') statuses?: string,
    @Query('isTemporary') isTemporary?: string,
  ): Promise<{ success: boolean; data: GalleryResponse; error?: string }> {


    try {
      const request: GalleryRequest = {
        cursor: cursor || '',
        limit: limit ? parseInt(limit) : 50,
      };

      // Парсимо теги якщо передані
      if (tags) {
        request.tags = tags.split(',').map(tag => tag.trim());
      }

      // Парсимо статуси якщо передані
      if (statuses) {
        request.statuses = statuses.split(',').map(status => status.trim());
      }

      // Парсимо isTemporary якщо переданий
      if (isTemporary !== undefined) {
        request.isTemporary = isTemporary === 'true';
      }

      const data = await this.galleryService.getPhotos(parseInt(profileId), request);
      
      return {
        success: true,
        data
      };
    } catch (error) {
      this.logger.error(`❌ Gallery error:`, error);
      return {
        success: false,
        data: { cursor: '', photos: [] },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * POST /api/gallery/:profileId/photos
   * Отримує список фото з детальними параметрами
   */
  @Post(':profileId/photos')
  async getPhotosAdvanced(
    @Param('profileId') profileId: string,
    @Body() request: GalleryRequest,
  ): Promise<{ success: boolean; data: GalleryResponse; error?: string }> {
    this.logger.log(`📸 POST /gallery/${profileId}/photos`, request);

    try {
      const data = await this.galleryService.getPhotos(parseInt(profileId), request);
      return {
        success: true,
        data
      };
    } catch (error) {
      this.logger.error(`❌ Gallery POST error:`, error);
      return {
        success: false,
        data: { cursor: '', photos: [] },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * GET /api/gallery/:profileId/photos/special
   * Отримує тільки спеціальні фото
   */
  @Get(':profileId/photos/special')
  async getSpecialPhotos(
    @Param('profileId') profileId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: GalleryResponse; error?: string }> {
    this.logger.log(`✨ GET /gallery/${profileId}/photos/special`);

    try {
      const limitNum = limit ? parseInt(limit) : 50;
      const data = await this.galleryService.getSpecialPhotos(parseInt(profileId), cursor, limitNum);
      return {
        success: true,
        data
      };
    } catch (error) {
      this.logger.error(`❌ Gallery special error:`, error);
      return {
        success: false,
        data: { cursor: '', photos: [] },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * GET /api/gallery/:profileId/photos/regular
   * Отримує звичайні фото (без спеціальних тегів)
   */
  @Get(':profileId/photos/regular')
  async getRegularPhotos(
    @Param('profileId') profileId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: boolean; data: GalleryResponse; error?: string }> {
    this.logger.log(`📷 GET /gallery/${profileId}/photos/regular`);

    try {
      const limitNum = limit ? parseInt(limit) : 50;
      const data = await this.galleryService.getRegularPhotos(parseInt(profileId), cursor, limitNum);
      return {
        success: true,
        data
      };
    } catch (error) {
      this.logger.error(`❌ Gallery regular error:`, error);
      return {
        success: false,
        data: { cursor: '', photos: [] },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * POST /api/gallery/send-photos
   * Відправляє вибрані фото в чат
   */
  @Post('send-photos')
  async sendPhotos(
    @Body() body: { idsGalleryPhotos: number[]; idRegularUser: number; profileId: number }
  ): Promise<{ success: boolean; error?: string }> {
    // Валідація вхідних даних
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
    } catch (error) {
      this.logger.error(`❌ Send photos error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * POST /api/gallery/send-videos
   * Відправляє вибрані відео в чат
   */
  @Post('send-videos')
  async sendVideos(
    @Body() body: { idsGalleryVideos: number[]; idRegularUser: number; profileId: number }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Валідація вхідних даних
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
    } catch (error) {
      this.logger.error(`❌ Send videos error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * GET /api/gallery/:profileId/videos
   * Отримує список відео профілю з пагінацією
   */
  @Get(':profileId/videos')
  async getVideos(
    @Param('profileId') profileId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('tags') tags?: string,
    @Query('statuses') statuses?: string,
  ): Promise<{ success: boolean; data: VideoGalleryResponse; error?: string }> {
    try {
      const request: VideoGalleryRequest = {
        cursor: cursor || '',
        limit: limit ? parseInt(limit) : 100,
      };

      // Парсимо теги якщо передані
      if (tags) {
        request.tags = tags.split(',').map(tag => tag.trim());
      }

      // Парсимо статуси якщо передані
      if (statuses) {
        request.statuses = statuses.split(',').map(status => status.trim());
      }

      const data = await this.galleryService.getVideos(parseInt(profileId), request);
      
      return {
        success: true,
        data
      };
    } catch (error) {
      this.logger.error(`❌ Video gallery error:`, error);
      return {
        success: false,
        data: { cursor: '', videos: [] },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * POST /api/gallery/:profileId/videos
   * Отримує список відео з детальними параметрами
   */
  @Post(':profileId/videos')
  async getVideosAdvanced(
    @Param('profileId') profileId: string,
    @Body() request: VideoGalleryRequest,
  ): Promise<{ success: boolean; data: VideoGalleryResponse; error?: string }> {
    this.logger.log(`🎥 POST /gallery/${profileId}/videos`, request);

    try {
      const data = await this.galleryService.getVideos(parseInt(profileId), request);
      return {
        success: true,
        data
      };
    } catch (error) {
      this.logger.error(`❌ Video gallery POST error:`, error);
      return {
        success: false,
        data: { cursor: '', videos: [] },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * POST /api/gallery/photo-statuses
   * Отримує статуси фото (accessed/sent/null)
   */
  @Post('photo-statuses')
  async getPhotoStatuses(
    @Body() body: { idUser: number; idsPhotos: number[]; profileId: number }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!body.idUser || !body.idsPhotos || !Array.isArray(body.idsPhotos) || body.idsPhotos.length === 0 || !body.profileId) {
      return { success: false, error: 'idUser, idsPhotos and profileId are required' };
    }
    try {
      const data = await this.galleryService.getPhotoStatuses(body.idUser, body.idsPhotos, body.profileId);
      return { success: true, data };
    } catch (error) {
      this.logger.error(`❌ Get photo statuses error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * POST /api/gallery/video-statuses
   * Отримує статуси відео (accessed/sent/null)
   */
  @Post('video-statuses')
  async getVideoStatuses(
    @Body() body: { idUser: number; idsVideos: number[]; profileId: number }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!body.idUser || !body.idsVideos || !Array.isArray(body.idsVideos) || body.idsVideos.length === 0 || !body.profileId) {
      return { success: false, error: 'idUser, idsVideos and profileId are required' };
    }
    try {
      const data = await this.galleryService.getVideoStatuses(body.idUser, body.idsVideos, body.profileId);
      return { success: true, data };
    } catch (error) {
      this.logger.error(`❌ Get video statuses error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * GET /api/gallery/:profileId/audios
   * Отримує список аудіо профілю з пагінацією
   */
  @Get(':profileId/audios')
  async getAudios(
    @Param('profileId') profileId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('statuses') statuses?: string
  ): Promise<{ success: boolean; data?: AudioGalleryResponse; error?: string }> {
    try {
      const parsedLimit = limit ? parseInt(limit, 10) : 50;
      const parsedStatuses = statuses ? statuses.split(',') : ['approved'];
      
      const data = await this.galleryService.getAudios(parseInt(profileId), {
        cursor: cursor || '',
        limit: parsedLimit,
        statuses: parsedStatuses
      });
      
      return { success: true, data };
    } catch (error) {
      this.logger.error(`❌ Get audios error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * POST /api/gallery/:profileId/audios
   * Отримує список аудіо профілю з розширеними параметрами
   */
  @Post(':profileId/audios')
  async getAudiosAdvanced(
    @Param('profileId') profileId: string,
    @Body() request: AudioGalleryRequest
  ): Promise<{ success: boolean; data?: AudioGalleryResponse; error?: string }> {
    try {
      const data = await this.galleryService.getAudios(parseInt(profileId), request);
      return { success: true, data };
    } catch (error) {
      this.logger.error(`❌ Get audios advanced error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * POST /api/gallery/send-audios
   * Відправляє вибрані аудіо в чат
   */
  @Post('send-audios')
  async sendAudios(
    @Body() body: { idsGalleryAudios: number[]; idRegularUser: number; profileId: number }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Валідація вхідних даних
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
    } catch (error) {
      this.logger.error(`❌ Send audios error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * POST /api/gallery/audio-statuses
   * Отримує статуси аудіо (accessed/sent/null)
   */
  @Post('audio-statuses')
  async getAudioStatuses(
    @Body() body: { idUser: number; idsAudios: number[]; profileId: number }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!body.idUser || !body.idsAudios || !Array.isArray(body.idsAudios) || body.idsAudios.length === 0 || !body.profileId) {
      return { success: false, error: 'idUser, idsAudios and profileId are required' };
    }
    try {
      const data = await this.galleryService.getAudioStatuses(body.idUser, body.idsAudios, body.profileId);
      return { success: true, data };
    } catch (error) {
      this.logger.error(`❌ Get audio statuses error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
