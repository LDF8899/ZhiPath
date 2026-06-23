import { Module } from '@nestjs/common';
import { MultimodalController } from './multimodal.controller';
import { MultimodalService } from '../../services/multimodal.service';
import { LlmService } from '../../services/llm.service';
import { XunfeiAvatarService } from '../../services/xunfei-avatar.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

/**
 * 多模态智能体模块 — T5
 *
 * 复用 KnowledgeModule 的 KnowledgeBaseService（MongoDB 持久化）
 * 导出 MultimodalService 供 ChatModule 的 ActionExecutor 调用
 * XunfeiAvatarService：讯飞数字人 API 客户端
 */
@Module({
  imports: [KnowledgeModule],
  controllers: [MultimodalController],
  providers: [MultimodalService, LlmService, XunfeiAvatarService],
  exports: [MultimodalService, XunfeiAvatarService],
})
export class MultimodalModule {}
