import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, pageSuccess } from '../../common/api-response';

@Controller('user')
@UseGuards(AuthGuard)
export class LearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  /** GET /api/user/learning-paths */
  @Get('learning-paths')
  async getPaths(
    @CurrentUser() user: any,
    @Query('user_id') userIdStr?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = userIdStr ? Number(userIdStr) : user.sub;
    const result = await this.learningPathsService.getPaths(
      userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  /** GET /api/user/learning-paths/:pathId */
  @Get('learning-paths/:pathId')
  async getPath(@Param('pathId') pathId: string) {
    const path = await this.learningPathsService.getPath(Number(pathId));
    return success(path);
  }

  /** POST /api/user/learning-paths */
  @Post('learning-paths')
  async createPath(@CurrentUser() user: any, @Body() body: { target_job_id?: number }) {
    const path = await this.learningPathsService.createPath(user.sub, body.target_job_id);
    return success(path);
  }

  /** GET /api/user/learning-paths/knowledge/:skill */
  @Get('learning-paths/knowledge/:skill')
  async getSkillContent(@CurrentUser('sub') userId: number, @Param('skill') skill: string) {
    const result = await this.learningPathsService.getSkillContent(decodeURIComponent(skill), userId);
    return success(result);
  }
}
