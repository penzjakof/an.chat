// dotenv не потрібен: ConfigModule.forRoot читає .env самостійно
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { readGitCommitShort } from './common/version/version.util';

// Перевіряємо чи завантажилися змінні
console.log('🔧 Config initialized');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // CORS налаштування тільки для HTTP, WebSocket налаштовується окремо
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV');
  const port = config.get<number>('PORT', 4000);
  const allowedOrigins = nodeEnv === 'production'
    ? ['https://anchat.me', 'https://www.anchat.me'] // Тільки дозволені домени на продакшені
    : ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000']; // Для розробки

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });

  // Віддаємо X-Commit заголовок для всіх відповідей
  const commit = readGitCommitShort();
  app.use((req, res, next) => {
    if (commit) res.setHeader('X-Commit', commit);
    next();
  });

  await app.listen(port);
}
bootstrap().catch((error: unknown) => {
  console.error('Bootstrap failed', error);
  process.exit(1);
});
