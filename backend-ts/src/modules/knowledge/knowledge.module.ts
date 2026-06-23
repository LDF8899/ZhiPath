import { Module } from '@nestjs/common';
import { KnowledgeBaseService } from '../../services/knowledge-base.service';
import { ResourceAgentService } from '../../services/resource-agent.service';
import { LlmService } from '../../services/llm.service';

/**
 * 知识库模块 — Phase 8
 *
 * MongoDB knowledge_base 集合的 CRUD + LLM 资源生成
 * 全局可用（讲义、习题、编程题）
 */
@Module({
  providers: [KnowledgeBaseService, ResourceAgentService, LlmService],
  exports: [KnowledgeBaseService, ResourceAgentService],
})
export class KnowledgeModule {}
