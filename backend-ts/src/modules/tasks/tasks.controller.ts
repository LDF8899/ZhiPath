import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TaskSchedulerService } from '../../services/task-scheduler.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, error } from '../../common/api-response';

@Controller('user')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskScheduler: TaskSchedulerService,
  ) {}

  /** 异步任务列表（Redis） */
  @Get('tasks')
  async listTasks(@CurrentUser() user: any) {
    const tasks = await this.tasksService.listTasks(user.sub);
    return success(tasks);
  }

  /** 异步任务详情（Redis） */
  @Get('tasks/:taskId')
  async getTask(@Param('taskId') taskId: string) {
    const task = await this.tasksService.getTask(taskId);
    return success(task);
  }

  /** 获取今日学习任务 */
  @Get('learning-tasks/today')
  async getTodayTasks(@CurrentUser() user: any, @Query('planId') planId?: string) {
    const result = await this.taskScheduler.getTodayTasks(
      user.sub,
      planId ? parseInt(planId, 10) : undefined,
    );
    return success(result);
  }

  /** 更新学习任务状态 */
  @Post('learning-tasks/:taskId/status')
  async updateTaskStatus(
    @Param('taskId') taskId: string,
    @Body() body: { status: string },
    @CurrentUser() user: any,
  ) {
    const result = await this.taskScheduler.updateTaskStatus(
      parseInt(taskId, 10),
      body.status as any,
      user.sub,
    );
    if (result.success) {
      return success(result.task);
    }
    return error(400, result.error || '更新失败');
  }

  /** 调整学习速度 */
  @Post('learning-tasks/adjust-speed')
  async adjustForSpeed(@CurrentUser() user: any, @Body() body: { planId: number }) {
    const result = await this.taskScheduler.adjustForSpeed(user.sub, body.planId);
    return success(result);
  }
}
