import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule, JwtModule],
  controllers: [GalleryController],
  providers: [GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}
