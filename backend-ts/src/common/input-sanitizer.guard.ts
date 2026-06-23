import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InputSanitizer } from './input-sanitizer';

/**
 * 全局输入安全 Guard
 *
 * 自动检查 HTTP 请求的 body / query / params，发现 SQL注入 / XSS / 日志注入风险时：
 *   1. 记录警告日志（含 IP、路径、风险详情）
 *   2. 拒绝请求，返回 400
 *
 * 注册方式（main.ts 全局注册）：
 *   app.useGlobalGuards(new InputSanitizerGuard(new InputSanitizer()));
 *
 * 或在 app.module.ts 中通过 APP_GUARD 注册：
 *   { provide: APP_GUARD, useClass: InputSanitizerGuard }
 *
 * 跳过检查：
 *   - 文件上传（multipart/form-data）不检查 body
 *   - GET 请求只检查 query + params
 */
@Injectable()
export class InputSanitizerGuard implements CanActivate {
  private readonly logger = new Logger(InputSanitizerGuard.name);

  constructor(private readonly sanitizer: InputSanitizer) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url || request.originalUrl || '';
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'unknown';

    // 跳过文件上传的 body 检查
    const contentType = request.headers?.['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');

    // ── 检查 query params ──
    if (request.query && typeof request.query === 'object') {
      if (!this.sanitizer.validateParams(request.query)) {
        this.logger.warn(
          `[BLOCKED] ${method} ${url} | source=query | ip=${ip}`,
        );
        throw new BadRequestException('请求参数包含不安全内容');
      }
    }

    // ── 检查 route params ──
    if (request.params && typeof request.params === 'object') {
      if (!this.sanitizer.validateParams(request.params)) {
        this.logger.warn(
          `[BLOCKED] ${method} ${url} | source=params | ip=${ip}`,
        );
        throw new BadRequestException('请求参数包含不安全内容');
      }
    }

    // ── 检查 body（跳过 multipart 和 GET/HEAD） ──
    if (
      !isMultipart &&
      method !== 'GET' &&
      method !== 'HEAD' &&
      request.body &&
      typeof request.body === 'object'
    ) {
      if (!this.sanitizer.validateParams(request.body)) {
        this.logger.warn(
          `[BLOCKED] ${method} ${url} | source=body | ip=${ip}`,
        );
        throw new BadRequestException('请求体包含不安全内容');
      }
    }

    return true;
  }
}
