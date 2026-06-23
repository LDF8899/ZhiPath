import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, pageSuccess } from '../../common/api-response';

@Controller('user')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** GET /api/user/jobs */
  @Get('jobs')
  async getJobs(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('company') company?: string,
    @Query('location') location?: string,
    @Query('level') level?: string,
  ) {
    const result = await this.jobsService.getJobs(user.sub, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      keyword,
      company,
      location,
      level,
    });
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  /** GET /api/user/jobs/:jobId */
  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.jobsService.getJob(Number(jobId));
    return success(job);
  }

  /** GET /api/user/jobs/:jobId/match */
  @Get('jobs/:jobId/match')
  async getJobMatch(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    const result = await this.jobsService.getJobMatch(user.sub, Number(jobId));
    return success(result);
  }

  /** POST /api/user/jobs/:jobId/apply */
  @Post('jobs/:jobId/apply')
  async applyJob(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    const result = await this.jobsService.applyJob(user.sub, Number(jobId));
    return success(result);
  }

  /** POST /api/user/jobs/:jobId/import-skills — 将缺少技能导入计划 */
  @Post('jobs/:jobId/import-skills')
  async importSkills(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
    @Body() body: { target?: 'main' | 'side' },
  ) {
    const result = await this.jobsService.importSkills(user.sub, Number(jobId), body?.target);
    return success(result);
  }
}
