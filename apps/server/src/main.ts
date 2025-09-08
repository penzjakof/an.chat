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

  // CORS налаштування тільки для HTTP, WebSocket налаштовується окремо
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://anchat.me', 'https://www.anchat.me'] // Тільки дозволені домени на продакшені
    : ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000']; // Для розробки

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap().catch((error: unknown) => {
  console.error('Bootstrap failed', error);
  process.exit(1);
});
