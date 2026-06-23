import { Controller, Get } from '@nestjs/common';
import { success } from './common/api-response';

@Controller()
export class AppController {
  /** 健康检查 — 对齐 Python GET /api/health */
  @Get('health')
  health() {
    return success({ status: 'ok', service: 'ZhiPath API', version: '3.0.0' });
  }
}
