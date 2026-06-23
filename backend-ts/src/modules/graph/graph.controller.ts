import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GraphService } from './graph.service';
import { GraphEnhancedService } from '../../services/graph-enhanced.service';
import { GraphImportService } from '../../services/graph-import.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

@Controller('user')
@UseGuards(AuthGuard)
export class GraphController {
  constructor(
    private readonly graphService: GraphService,
    private readonly graphEnhanced: GraphEnhancedService,
    private readonly graphImport: GraphImportService,
  ) {}

  /** POST /api/user/graph/rebuild — 从 MySQL 重建知识图谱（§19 数据导入） */
  @Post('graph/rebuild')
  async rebuild() {
    const stats = await this.graphImport.rebuildFromMySQL();
    return success(stats);
  }

  /** GET /api/user/graph — 查询图谱 */
  @Get('graph')
  async getGraph(
    @Query('skill') skill?: string,
    @Query('job_id') jobId?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.graphService.getGraph({
      skill,
      jobId: jobId ? Number(jobId) : undefined,
      limit: limit ? Number(limit) : 50,
    });
    return success(result);
  }

  /** GET /api/user/graph/my — 查询用户技能图谱 */
  @Get('graph/my')
  async getMyGraph(@CurrentUser() user: any, @Query('limit') limit?: string) {
    const result = await this.graphEnhanced.getGraph({
      userId: user.sub,
      limit: limit ? Number(limit) : 50,
    });
    return success(result);
  }

  /** GET /api/user/graph/skill/:skillId/dependencies — 获取技能依赖链 */
  @Get('graph/skill/:skillId/dependencies')
  async getSkillDependencies(@Query('skillId') skillId: string) {
    const result = await this.graphEnhanced.getSkillDependencies(skillId);
    return success(result);
  }

  /** GET /api/user/graph/job/:jobId/skills — 获取岗位技能 */
  @Get('graph/job/:jobId/skills')
  async getJobSkills(@Query('jobId') jobId: string) {
    const result = await this.graphEnhanced.getJobRequiredSkills(jobId);
    return success(result);
  }
}
