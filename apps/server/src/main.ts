import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Завантажуємо змінні середовища з .env файлу
dotenv.config();

// Перевіряємо чи завантажилися змінні
console.log('🔧 Environment variables loaded:');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? 'Present' : 'Missing');
console.log('  TT_BASE_URL:', process.env.TT_BASE_URL || 'Not set');
console.log('  PORT:', process.env.PORT || 'Not set');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*', credentials: false });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap().catch((error: unknown) => {
  console.error('Bootstrap failed', error);
  process.exit(1);
});
