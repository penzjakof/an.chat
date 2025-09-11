"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
console.log('🔧 Environment variables loaded:');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? 'Present' : 'Missing');
console.log('  TT_BASE_URL:', process.env.TT_BASE_URL || 'Not set');
console.log('  PORT:', process.env.PORT || 'Not set');
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const allowedOrigins = process.env.NODE_ENV === 'production'
        ? ['https://anchat.me', 'https://www.anchat.me']
        : ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000'];
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    });
    await app.listen(process.env.PORT ?? 4000);
}
bootstrap().catch((error) => {
    console.error('Bootstrap failed', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map