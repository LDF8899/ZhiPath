import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

console.log('[BOOT] Starting ZhiPath backend...');

async function bootstrap() {
  console.log('[BOOT] bootstrap() called');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // CORS — 对齐 Python 后端
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: '*',
    allowedHeaders: '*',
  });

  // 公开视频文件端点（无需鉴权）
  const videoDir = process.env.VIDEO_OUTPUT_DIR || 'D:/tmp/zhipath/video';
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

  const port = process.env.APP_PORT || 3000;
  const host = process.env.APP_HOST || '0.0.0.0';

  await app.listen(port, host);
  console.log(`[ZhiPath] API running on http://${host}:${port}`);
}
bootstrap();
