import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { MatchAgentService } from '../../services/match-agent.service';
import { SkillService } from '../../services/skill.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, pageSuccess } from '../../common/api-response';

@Controller('user')
@UseGuards(AuthGuard)
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly matchAgent: MatchAgentService,
    private readonly skillService: SkillService,
  ) {}

  /** GET /api/user/exams */
  @Get('exams')
  async getExams(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('exam_type') examType?: string,
  ) {
    const result = await this.examsService.getExams(
      user.sub,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      examType ? Number(examType) : undefined,
    );
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  /** GET /api/user/exams/wrong-answers — 错题本（静态路由须在 :examId 之前） */
  @Get('exams/wrong-answers')
  async getWrongAnswers(
    @CurrentUser() user: any,
    @Query('skillName') skillName?: string,
  ) {
    const result = await this.examsService.getWrongAnswers(user.sub, skillName);
    return success(result);
  }

  /** GET /api/user/exams/stats — 题库统计（静态路由须在 :examId 之前） */
  @Get('exams/stats')
  async getQuestionBankStats(@Query('skillName') skillName?: string) {
    const result = await this.examsService.getQuestionBankStats(skillName);
    return success(result);
  }

  /** POST /api/user/exams/submit */
  @Post('exams/submit')
  async submitExam(@CurrentUser() user: any, @Body() body: any) {
    const result = await this.examsService.submitExam(user.sub, body);
    // 考试提交后触发匹配度重算（事件驱动，异步不阻塞）
    this.matchAgent.recalculateOnSkillChange(user.sub);
    // 如果考试关联了技能，升级该技能的信任度到 exam(1.0)
    if (body.skillName) {
      this.skillService.upgradeTrust(user.sub, body.skillName, 'exam', 1.0).catch(() => {});
    }
    return success(result);
  }

  /** GET /api/user/exams/:examId/take — 开始考试：随机抽题+选项乱序（§24.1） */
  @Get('exams/:examId/take')
  async startExam(
    @CurrentUser() user: any,
    @Param('examId') examId: string,
    @Query('count') count?: string,
  ) {
    const result = await this.examsService.getExamForTake(
      user.sub,
      Number(examId),
      count ? Number(count) : 10,
    );
    return success(result);
  }

  /** GET /api/user/exams/retryable — 获取可重试的考试（静态路由须在 :examId 之前） */
  @Get('exams/retryable')
  async getRetryableExams(@CurrentUser() user: any) {
    const result = await this.examsService.getRetryableExams(user.sub);
    return success(result);
  }

  /** GET /api/user/exams/:examId */
  @Get('exams/:examId')
  async getExam(@Param('examId') examId: string) {
    const exam = await this.examsService.getExam(Number(examId));
    return success(exam);
  }

  /** POST /api/user/exams/:examId/retry — 调度重试 */
  @Post('exams/:examId/retry')
  async scheduleRetry(@CurrentUser() user: any, @Param('examId') examId: string) {
    const result = await this.examsService.scheduleRetry(+examId, user.sub);
    return success(result);
  }
}
