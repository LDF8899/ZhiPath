import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('ZhiPath Platform API')
    .setDescription('智途 ZhiPath、CodeNova 与后续定制客户端共享平台 API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Client-App' }, 'client-app')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(process.cwd(), '../packages/api-client/openapi.json');
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
  process.stdout.write(`OpenAPI exported to ${outputPath} (${Object.keys(document.paths || {}).length} paths)\n`);
  // BullMQ worker handles can survive Nest shutdown in this application. This
  // is a one-shot export command, so terminate after stdout has flushed.
  setTimeout(() => process.exit(0), 50);
}

void exportOpenApi().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
