import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import type { GalleryRequest, GalleryResponse } from './gallery.service';
import { Public } from '../common/auth/public.decorator';

@Controller('api/gallery')
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
}
