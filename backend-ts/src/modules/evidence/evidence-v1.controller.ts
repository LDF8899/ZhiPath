import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { EvidenceRagService } from '../../services/evidence-rag.service';
import { Student } from '../../entities/student.entity';

@Controller('v1/evidence')
@UseGuards(AuthGuard, ScopesGuard)
export class EvidenceV1Controller {
  constructor(private readonly rag: EvidenceRagService, @InjectRepository(Student) private readonly students: Repository<Student>) {}
  @Get('graph') @RequireScopes('learning:read') async graph(@Req() req: PlatformRequest, @Query('limit') limit?: string) { return apiV1Success(req, await this.rag.getGraphSnapshot(this.userId(req), Number(limit) || 120, this.tenantId(req))); }
  @Get('summary') @RequireScopes('learning:read') async summary(@Req() req: PlatformRequest) { return apiV1Success(req, await this.rag.getSummary(this.userId(req), this.tenantId(req))); }
  @Post('reindex') @RequireScopes('learning:write') async reindex(@Req() req: PlatformRequest) {
    const student = await this.students.findOne({ where: { userId: this.userId(req), tenantId: this.tenantId(req), status: 1 } as any });
    const count = await this.rag.reindexFromProjects(this.userId(req), (student?.projects || []) as Array<Record<string, any>>, this.tenantId(req));
    return apiV1Success(req, { reindexed: count });
  }
  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) { const id = Number(req.user?.tenantId); if (!id) throw new Error('访问令牌缺少有效租户上下文'); return id; }
}
