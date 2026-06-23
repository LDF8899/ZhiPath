import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { AgentProcessor } from './agent.processor';
import { ResourceProcessor } from './resource.processor';
import { QueueService } from './queue.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AgentsModule } from '../agents/agents.module';
import { EventsModule } from '../events/events.module';

/**
 * BullMQ 异步任务模块
 *
 * 功能：
 *   - Agent 任务队列（讲义/阅读/代码/路径/评估）
 *   - 资源生成队列
 *   - 任务优先级和重试
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port: config.get('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD', ''),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'agent-tasks', prefix: 'zhipath' },
      { name: 'resource-tasks', prefix: 'zhipath' },
    ),
    KnowledgeModule,
    AgentsModule,
    EventsModule,
  ],
  providers: [AgentProcessor, ResourceProcessor, QueueService],
  exports: [QueueService],
})
export class QueueModule {}
