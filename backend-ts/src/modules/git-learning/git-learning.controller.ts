import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { BranchService } from '../../services/branch.service';
import { LearningCommitService, CommitSkillAction } from '../../services/learning-commit.service';
import { SkillSnapshotService } from '../../services/skill-snapshot.service';

@Controller('user/git')
@UseGuards(AuthGuard)
export class GitLearningController {
  constructor(
    private readonly branchService: BranchService,
    private readonly commitService: LearningCommitService,
    private readonly snapshotService: SkillSnapshotService,
  ) {}

  @Get('branches')
  async listBranches(@CurrentUser('sub') userId: number) {
    return success(await this.branchService.listBranches(userId));
  }

  @Post('branches')
  async createBranch(
    @CurrentUser('sub') userId: number,
    @Body() body: { branchName?: string; branchType?: 'main' | 'plan' | 'side' | 'experiment'; sourceBranchId?: number; planId?: number },
  ) {
    return success(await this.branchService.createBranch(userId, body));
  }

  @Get('branches/:branchId/log')
  async branchLog(
    @CurrentUser('sub') userId: number,
    @Param('branchId') branchId: string,
    @Query('limit') limit?: string,
  ) {
    return success(await this.commitService.listLog(userId, Number(branchId), limit ? Number(limit) : 50));
  }

  @Post('branches/:branchId/commit')
  async commit(
    @CurrentUser('sub') userId: number,
    @Param('branchId') branchId: string,
    @Body() body: CommitSkillAction,
  ) {
    return success(await this.commitService.commitSkill(userId, Number(branchId), body));
  }

  @Get('commits/:commitId')
  async getCommit(@CurrentUser('sub') userId: number, @Param('commitId') commitId: string) {
    return success(await this.branchService.getCommitDetail(userId, Number(commitId)));
  }

  @Post('commits/:commitId/rollback')
  async rollback(@CurrentUser('sub') userId: number, @Param('commitId') commitId: string) {
    return success(await this.branchService.rollback(userId, Number(commitId)));
  }

  @Get('snapshots')
  async listSnapshots(
    @CurrentUser('sub') userId: number,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: string,
  ) {
    return success(await this.snapshotService.listSnapshots(userId, branchId ? Number(branchId) : undefined, limit ? Number(limit) : 30));
  }

  @Get('snapshots/compare')
  async compareSnapshots(
    @CurrentUser('sub') userId: number,
    @Query('snapshotA') snapshotA: string,
    @Query('snapshotB') snapshotB: string,
  ) {
    const before = await this.snapshotService.getSnapshot(userId, Number(snapshotA));
    const after = await this.snapshotService.getSnapshot(userId, Number(snapshotB));
    if (!before || !after) return success(null, 'snapshot not found');
    return success(this.snapshotService.compareSnapshots(before, after));
  }

  @Get('branches/compare')
  async compareBranches(
    @CurrentUser('sub') userId: number,
    @Query('source') source: string,
    @Query('target') target: string,
  ) {
    return success(await this.branchService.compareBranches(userId, Number(source), Number(target)));
  }

  @Post('branches/:branchId/merge')
  async mergeBranch(
    @CurrentUser('sub') userId: number,
    @Param('branchId') branchId: string,
    @Body() body: { targetBranchId?: number },
  ) {
    return success(await this.branchService.mergeBranch(userId, Number(branchId), body?.targetBranchId));
  }
}
