import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 连接模块（ioredis）
 *
 * 用于：对话缓存、Session、任务队列、活跃用户标记
 * 提供 REDIS_CLIENT 供注入使用
 */
const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        try {
          const client = new Redis({
            host: config.get('REDIS_HOST', '127.0.0.1'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get('REDIS_PASSWORD', '') || undefined,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
          });
          await client.connect();
          console.log('[Redis] Connected to', config.get('REDIS_HOST'), config.get('REDIS_PORT'));
          return client;
        } catch (err: any) {
          console.warn('[Redis] Connection failed, cache features disabled:', err.message);
          return null;
        }
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}

export { REDIS_CLIENT };
