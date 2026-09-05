import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { EvidenceRagService } from '../../services/evidence-rag.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';

/**
 * Evidence RAG 控制器 — 个人证据检索（P0）
 */
@Controller('user')
@UseGuards(AuthGuard)
export class EvidenceController {
  constructor(
    private readonly evidenceRag: EvidenceRagService,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
  ) {}

  /**
   * 搜索个人证据
   * GET /api/user/evidence/search?query=React项目经验&skill=React&sourceType=project&limit=5
   */
  @Get('evidence/search')
  async search(
    @CurrentUser() user: any,
    @Query('query') query?: string,
    @Query('q') q?: string,
    @Query('skill') skill?: string,
    @Query('sourceType') sourceType?: string,
    @Query('jobTargetId') jobTargetId?: string,
    @Query('limit') limit?: string,
    @Query('explain') explain?: string,
  ) {
    const queryText = query || q || '';
    const items = await this.evidenceRag.search(user.sub, queryText, {
      skill,
      sourceType,
      jobTargetId: jobTargetId ? Number(jobTargetId) : undefined,
      limit: limit ? Number(limit) : 5,
      explain: explain === '1' || explain === 'true',
    });
    return success({
      query: queryText,
      total: items.length,
      items,
    });
  }

  /** RAG 可视化图谱快照（供知识库 3D 数据引擎使用） */
  @Get('evidence/graph')
  async graph(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const result = await this.evidenceRag.getGraphSnapshot(user.sub, limit ? Number(limit) : 120);
    return success(result);
  }

  /** 手动重建证据索引（补历史项目 / Chroma 恢复） */
  @Post('evidence/reindex')
  async reindex(@CurrentUser() user: any) {
    const student = await this.studentRepo.findOne({ where: { userId: user.sub, status: 1 } });
    const projects = (student?.projects || []) as Array<Record<string, any>>;
    const count = await this.evidenceRag.reindexFromProjects(user.sub, projects);
    return success({ reindexed: count }, '重建完成');
  }

  /** 证据索引状态汇总（Projects 页展示 已索引/待索引/失败） */
  @Get('evidence/summary')
  async summary(@CurrentUser() user: any) {
    const result = await this.evidenceRag.getSummary(user.sub);
    return success(result);
  }
}
