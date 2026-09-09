import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientApp } from '../../entities/client-app.entity';

@Injectable()
export class ClientOriginPolicyService {
  private cachedOrigins = new Set<string>();
  private loadedAt = 0;
  private readonly ttlMs = 30_000;

  constructor(
    @InjectRepository(ClientApp)
    private readonly clientAppRepo: Repository<ClientApp>,
  ) {}

  async isAllowed(origin: string): Promise<boolean> {
    if (!this.isHttpOrigin(origin)) return false;
    const cacheExpired = Date.now() - this.loadedAt >= this.ttlMs;
    // 对缓存未命中的来源立即刷新，使刚注册的定制前端无需重启后端即可生效。
    if (cacheExpired || !this.cachedOrigins.has(origin)) await this.refresh();
    return this.cachedOrigins.has(origin);
  }

  async refresh(): Promise<void> {
    const clients = await this.clientAppRepo.find({ where: { status: 'active' } });
    this.cachedOrigins = new Set(
      clients.flatMap((client) => client.allowedOrigins || []).filter((origin) => this.isHttpOrigin(origin)),
    );
    this.loadedAt = Date.now();
  }

  invalidate(): void {
    this.loadedAt = 0;
  }

  private isHttpOrigin(origin: string): boolean {
    try {
      const parsed = new URL(origin);
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.origin === origin &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }
}
