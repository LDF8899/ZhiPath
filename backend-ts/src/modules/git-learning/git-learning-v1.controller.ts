import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { BranchService } from '../../services/branch.service';
import { LearningCommitService, CommitSkillAction } from '../../services/learning-commit.service';
import { SkillSnapshotService } from '../../services/skill-snapshot.service';

@ApiTags('v1 git learning')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/git')
@UseGuards(AuthGuard, ScopesGuard)
export class GitLearningV1Controller {
  constructor(
    private readonly branches: BranchService,
    private readonly commits: LearningCommitService,
    private readonly snapshots: SkillSnapshotService,
  ) {}

  @Get('branches')
  @RequireScopes('learning:read')
  async listBranches(@Req() request: PlatformRequest) { return apiV1Success(request, await this.branches.listBranches(this.userId(request), this.tenantId(request))); }

  @Post('branches')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async createBranch(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Body() body: { branchName?: string; branchType?: 'main' | 'plan' | 'side' | 'experiment'; sourceBranchId?: number; planId?: number }) {
    this.key(key);
    return apiV1Success(request, await this.branches.createBranch(this.userId(request), body, this.tenantId(request)));
  }

  @Get('branches/:branchId/log')
  @RequireScopes('learning:read')
  async branchLog(@Req() request: PlatformRequest, @Param('branchId') id: string, @Query('limit') limit?: string) {
    return apiV1Success(request, await this.commits.listLog(this.userId(request), this.id(id), this.range(limit, 50, 100), this.tenantId(request)));
  }

  @Post('branches/:branchId/commit')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async commit(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Param('branchId') id: string, @Body() body: CommitSkillAction) {
    this.key(key);
    return apiV1Success(request, await this.commits.commitSkill(this.userId(request), this.id(id), body, this.tenantId(request)));
  }

  @Get('commits/:commitId')
  @RequireScopes('learning:read')
  async getCommit(@Req() request: PlatformRequest, @Param('commitId') id: string) { return apiV1Success(request, await this.branches.getCommitDetail(this.userId(request), this.id(id), this.tenantId(request))); }

  @Post('commits/:commitId/rollback')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async rollback(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Param('commitId') id: string) {
    this.key(key);
    return apiV1Success(request, await this.branches.rollback(this.userId(request), this.id(id), this.tenantId(request)));
  }

  @Get('snapshots')
  @RequireScopes('learning:read')
  async listSnapshots(@Req() request: PlatformRequest, @Query('branchId') branchId?: string, @Query('limit') limit?: string) {
    return apiV1Success(request, await this.snapshots.listSnapshots(this.userId(request), branchId ? this.id(branchId) : undefined, this.range(limit, 30, 100), this.tenantId(request)));
  }

  @Get('snapshots/compare')
  @RequireScopes('learning:read')
  async compareSnapshots(@Req() request: PlatformRequest, @Query('snapshotA') a: string, @Query('snapshotB') b: string) {
    const before = await this.snapshots.getSnapshot(this.userId(request), this.id(a), this.tenantId(request));
    const after = await this.snapshots.getSnapshot(this.userId(request), this.id(b), this.tenantId(request));
    return apiV1Success(request, before && after ? this.snapshots.compareSnapshots(before, after) : null);
  }

  @Get('branches/compare')
  @RequireScopes('learning:read')
  async compareBranches(@Req() request: PlatformRequest, @Query('source') source: string, @Query('target') target: string) {
    return apiV1Success(request, await this.branches.compareBranches(this.userId(request), this.id(source), this.id(target), this.tenantId(request)));
  }

  @Post('branches/:branchId/merge')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async merge(@Req() request: PlatformRequest, @Headers('idempotency-key') key: string, @Param('branchId') branchId: string, @Body() body: { targetBranchId?: number }) {
    this.key(key);
    return apiV1Success(request, await this.branches.mergeBranch(this.userId(request), this.id(branchId), body?.targetBranchId, this.tenantId(request)));
  }

  private userId(request: PlatformRequest) { return Number(request.user?.sub || request.user?.id); }
  private tenantId(request: PlatformRequest) { const id = Number(request.user?.tenantId); if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文'); return id; }
  private id(value: string) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException('ID 无效'); return parsed; }
  private range(value: string | undefined, fallback: number, max: number) { if (!value) return fallback; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new BadRequestException('limit 无效'); return parsed; }
  private key(value: string) { if (!value || value.length > 200) throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符'); }
}
