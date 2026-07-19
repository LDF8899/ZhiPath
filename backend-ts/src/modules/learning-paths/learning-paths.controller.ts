import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, pageSuccess } from '../../common/api-response';
import { StudentService } from '../student/student.service';

@Controller('user')
@UseGuards(AuthGuard)
export class LearningPathsController {
  constructor(
    private readonly learningPathsService: LearningPathsService,
    private readonly studentService: StudentService,
  ) {}

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
  async getPath(@CurrentUser('sub') userId: number, @Param('pathId') pathId: string) {
    const path = await this.learningPathsService.getPath(userId, Number(pathId));
    return success(path);
  }

  /** POST /api/user/learning-paths */
  @Post('learning-paths')
  async createPath(@CurrentUser() user: any, @Body() body: any) {
    const path = await this.studentService.createPlan(user.sub, {
      ...body,
      targetJobId: body.targetJobId || body.target_job_id,
    });
    return success(path);
  }

  @Post('learning-paths/:pathId/skills')
  async addSkill(
    @CurrentUser('sub') userId: number,
    @Param('pathId') pathId: string,
    @Body() body: { skillName?: string; estimatedMin?: number },
  ) {
    return success(await this.learningPathsService.addSkill(userId, Number(pathId), body));
  }

  @Patch('learning-paths/:pathId/status')
  async setPlanStatus(
    @CurrentUser('sub') userId: number,
    @Param('pathId') pathId: string,
    @Body() body: { planStatus: 'active' | 'paused' | 'archived' },
  ) {
    return success(await this.learningPathsService.setPlanStatus(userId, Number(pathId), body.planStatus));
  }

  @Post('learning-paths/:pathId/merge')
  async mergePlan(@CurrentUser('sub') userId: number, @Param('pathId') pathId: string) {
    return success(await this.learningPathsService.mergePlan(userId, Number(pathId)));
  }

  /** GET /api/user/learning-paths/knowledge/:skill */
  @Get('learning-paths/knowledge/:skill')
  async getSkillContent(@CurrentUser('sub') userId: number, @Param('skill') skill: string) {
    const result = await this.learningPathsService.getSkillContent(decodeURIComponent(skill), userId);
    return success(result);
  }
}
