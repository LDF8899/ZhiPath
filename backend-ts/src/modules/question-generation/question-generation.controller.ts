import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, error } from '../../common/api-response';
import { QuestionGenerationService } from './question-generation.service';

@Controller('user/question-generation')
@UseGuards(AuthGuard)
export class QuestionGenerationController {
  constructor(private readonly service: QuestionGenerationService) {}

  @Get('tasks')
  async list(@CurrentUser('sub') userId: number, @Query('limit') limit?: string) {
    return success(await this.service.listTasks(userId, limit ? Number(limit) : 20));
  }

  @Post('tasks')
  async create(@CurrentUser('sub') userId: number, @Body() body: any) {
    try { return success(await this.service.createTask(userId, body), '任务已创建'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Post('tasks/:taskId/start')
  async start(@CurrentUser('sub') userId: number, @Param('taskId') taskId: string) {
    try { return success(await this.service.startTask(userId, Number(taskId)), '后台生成已启动'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Get('tasks/:taskId/snapshot')
  async snapshot(@CurrentUser('sub') userId: number, @Param('taskId') taskId: string) {
    try { return success(await this.service.getSnapshot(userId, Number(taskId))); }
    catch (e: any) { return error(404, e.message); }
  }

  @Put('tasks/:taskId/snapshot')
  async saveSnapshot(@CurrentUser('sub') userId: number, @Param('taskId') taskId: string, @Body() body: { questions: any[]; config?: any; reviewStatuses?: string[] }) {
    try { return success(await this.service.saveSnapshot(userId, Number(taskId), body.questions, body.config, body.reviewStatuses)); }
    catch (e: any) { return error(400, e.message); }
  }

  @Post('tasks/:taskId/questions/batch')
  async persistDrafts(@CurrentUser('sub') userId: number, @Param('taskId') taskId: string, @Body() body: { questions: any[] }) {
    try { return success(await this.service.persistDrafts(userId, Number(taskId), body.questions), '草稿已保存'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Patch('tasks/:taskId/questions/approve')
  async approve(@CurrentUser('sub') userId: number, @Param('taskId') taskId: string, @Body() body: { questionIds: number[]; questionsMap?: Record<string, any> }) {
    try { return success(await this.service.approve(userId, Number(taskId), body.questionIds, body.questionsMap), '题目已批准'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Patch('tasks/:taskId/questions/:questionId')
  async updateDraft(@CurrentUser('sub') userId: number, @Param('taskId') taskId: string, @Param('questionId') questionId: string, @Body() body: { question: any }) {
    try { return success(await this.service.updateDraft(userId, Number(taskId), Number(questionId), body.question)); }
    catch (e: any) { return error(400, e.message); }
  }

  @Delete('tasks/:taskId')
  async remove(@CurrentUser('sub') userId: number, @Param('taskId') taskId: string) {
    try { return success(await this.service.deleteTask(userId, Number(taskId)), '任务已删除'); }
    catch (e: any) { return error(400, e.message); }
  }
}
