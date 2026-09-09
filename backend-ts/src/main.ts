import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { ClientOriginPolicyService } from './platform/client-experience/client-origin-policy.service';

console.log('[BOOT] Starting ZhiPath backend...');

async function bootstrap() {
  console.log('[BOOT] bootstrap() called');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(
    configuredOrigins.length
      ? configuredOrigins
      : [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:5180',
          'http://127.0.0.1:5180',
        ],
  );
  const clientOriginPolicy = app.get(ClientOriginPolicyService);

  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      void clientOriginPolicy
        .isAllowed(origin)
        .then((allowed) => callback(allowed ? null : new Error(`CORS origin is not allowed: ${origin}`), allowed))
        .catch(() => callback(new Error(`CORS origin policy unavailable for: ${origin}`), false));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Client-App',
      'X-Client-Version',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Client-App', 'X-Request-Id', 'Deprecation', 'Sunset', 'Link'],
  });

  // 公开视频文件端点（无需鉴权）—— 默认与 VideoRenderService.outputDir 保持同源
  const videoDir = process.env.VIDEO_OUTPUT_DIR || path.join(process.cwd(), 'output', 'video');
  app.use('/api/video/:filename', (req: any, res: any) => {
    const filePath = path.join(videoDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 404, message: '视频文件不存在' });
      return;
    }
    const stat = fs.statSync(filePath);
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  // 全局前缀 /api
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ZhiPath Platform API')
    .setDescription('智途 ZhiPath 与 CodeNova 共享平台 API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Client-App' }, 'client-app')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, openApiDocument, {
    jsonDocumentUrl: 'api/docs-json',
  });

  const port = process.env.APP_PORT || 3000;
  const host = process.env.APP_HOST || '0.0.0.0';

  await app.listen(port, host);
  console.log(`[ZhiPath] API running on http://${host}:${port}`);
}
bootstrap();
