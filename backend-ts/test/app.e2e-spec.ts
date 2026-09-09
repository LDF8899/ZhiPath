import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from './../src/app.controller';
import { RequestContextModule } from './../src/platform/request-context/request-context.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RequestContextModule],
      controllers: [AppController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .set('X-Client-App', 'zhipath-web')
      .expect('X-Client-App', 'zhipath-web')
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
