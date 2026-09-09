import { Controller, Get, Req, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { success } from './common/api-response';
import { apiV1Success } from './platform/api-v1/api-v1-response';
import { PlatformRequest } from './platform/request-context/request-context.types';

@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 健康检查。
   * `/api/health` 保持历史兼容，`/api/v1/health` 供新客户端和部署探针使用。
   */
  @Get(['health', 'v1/health'])
  health() {
    return success({ status: 'ok', service: 'ZhiPath API', version: '3.0.0' });
  }

  /**
   * Liveness 只回答进程是否还活着，不触碰外部依赖，供容器重启探针使用。
   */
  @Get('v1/health/live')
  live(@Req() request: PlatformRequest) {
    return apiV1Success(request, { status: 'ok', service: 'ZhiPath API', version: '3.0.0' });
  }

  /**
   * Readiness 检查真正的事务依赖。数据库不可用时明确返回 503，避免前端
   * 把“后端进程在运行”误判成“业务已经可用”。
   */
  @Get('v1/health/ready')
  async ready(@Req() request: PlatformRequest) {
    const checkedAt = new Date().toISOString();
    try {
      await this.dataSource.query('SELECT 1 AS ok');
      let migrationsApplied: number | null = null;
      try {
        const migrations = await this.dataSource.query(
          'SELECT COUNT(*) AS applied FROM `typeorm_migrations`',
        );
        migrationsApplied = Number(migrations[0]?.applied || 0);
      } catch {
        // Older installations may not have TypeORM's bookkeeping table yet;
        // that should not make an otherwise reachable database unready.
      }
      return apiV1Success(request, {
        status: 'ready',
        service: 'ZhiPath API',
        version: '3.0.0',
        dependencies: {
          mysql: 'ok',
          migrationsApplied,
        },
        checkedAt,
      });
    } catch (error: any) {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: '核心数据库暂不可用',
        details: { mysql: 'unavailable', checkedAt },
      });
    }
  }
}
