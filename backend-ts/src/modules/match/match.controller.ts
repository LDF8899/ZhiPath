import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { MatchAgentService } from '../../services/match-agent.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

/**
 * 匹配度控制器 — MatchAgent API
 *
 * 注意：静态路由（match/best, match-all）必须在参数路由（match/:jobId）之前，
 * 否则 NestJS 会把 'best' 当作 :jobId 参数匹配。
 */
@Controller('user')
@UseGuards(AuthGuard)
export class MatchController {
  constructor(private readonly matchAgent: MatchAgentService) {}

  /** 获取用户最佳匹配岗位（Dashboard 用）— 必须在 match/:jobId 之前 */
  @Get('match/best')
  async getBestMatch(@CurrentUser() user: any) {
    const result = await this.matchAgent.getBestMatch(user.sub);
    return success(result);
  }

  /** 计算用户与所有岗位的匹配度 */
  @Get('match-all')
  async calculateForAllJobs(@CurrentUser() user: any) {
    const results = await this.matchAgent.calculateForAllJobs(user.sub);
    return success(results);
  }

  /** 技能变化后重新计算匹配度 */
  @Post('match/recalculate')
  async recalculate(@CurrentUser() user: any) {
    await this.matchAgent.recalculateOnSkillChange(user.sub);
    return success({ message: '重新计算中' });
  }

  /** 计算用户与岗位的匹配度 */
  @Get('match/:jobId')
  async calculateMatch(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    const result = await this.matchAgent.calculateMatch(user.sub, parseInt(jobId, 10));
    return success(result);
  }

  /** 获取匹配度趋势 */
  @Get('match/trend/:jobId')
  async getMatchTrend(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
    @Query('days') days?: string,
  ) {
    const result = await this.matchAgent.getMatchTrend(
      user.sub,
      parseInt(jobId, 10),
      days ? parseInt(days, 10) : 30,
    );
    return success(result);
  }
}
