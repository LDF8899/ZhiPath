import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceChunk } from '../../entities/evidence-chunk.entity';
import { EvidenceRagService } from '../../services/evidence-rag.service';
import { ChromaService } from '../../services/chroma.service';
import { EvidenceController } from './evidence.controller';

/**
 * Evidence RAG 模块 — 个人证据召回闭环（P0）
 *
 * GET /api/user/evidence/search — 检索个人证据
 * POST /api/user/evidence/reindex — 重建证据索引
 */
@Module({
  imports: [TypeOrmModule.forFeature([EvidenceChunk])],
  controllers: [EvidenceController],
  providers: [EvidenceRagService, ChromaService],
  exports: [EvidenceRagService, ChromaService],
})
export class EvidenceModule {}
