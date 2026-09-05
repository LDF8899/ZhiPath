import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeIngestionController } from './knowledge-ingestion.controller';
import { KnowledgeIngestionTask } from '../../entities/knowledge-ingestion-task.entity';
import { News } from '../../entities/news.entity';
import { KnowledgeIngestionService } from '../../services/knowledge-ingestion.service';
import { KnowledgeCuratorAgentService } from '../../services/agents/knowledge-curator-agent.service';
import { KnowledgeInspectorAgentService } from '../../services/agents/knowledge-inspector-agent.service';
import { LlmService } from '../../services/llm.service';
import { SearchStackService } from '../../services/search-stack.service';
import { NewsModule } from '../news/news.module';
import { EvidenceModule } from '../evidence/evidence.module';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeIngestionTask, News]), NewsModule, EvidenceModule],
  controllers: [KnowledgeIngestionController],
  providers: [KnowledgeIngestionService, KnowledgeCuratorAgentService, KnowledgeInspectorAgentService, LlmService, SearchStackService],
  exports: [KnowledgeIngestionService, KnowledgeCuratorAgentService, KnowledgeInspectorAgentService],
})
export class KnowledgeIngestionModule {}
