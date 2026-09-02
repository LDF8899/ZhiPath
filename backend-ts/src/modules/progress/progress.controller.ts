import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { LearningPlan } from '../../entities/learning.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { SkillService } from '../../services/skill.service';
import { NotificationService } from '../../services/notification.service';
import { LearningProgressService } from '../../services/learning-progress.service';
import { LearningCommitService } from '../../services/learning-commit.service';
import { EvaluationService, EvaluationDimensionInput } from '../../services/evaluation.service';
import { BranchService } from '../../services/branch.service';
import { LearningAssessmentContextService, LearningAssessmentContext } from '../../domains/learning-assessment-context.service';

/**
 * 学习进度控制器 — 对齐 Python api/user/progress.py
 *
 * POST /api/user/progress/read    — 阅读讲义完成
 * POST /api/user/progress/quiz    — 习题完成
 * POST /api/user/progress/complete — 技能完成
 * GET  /api/user/progress/summary — 进度汇总
 * GET  /api/user/progress/restore — §17.2 进度恢复（三层降级）
 */
@Controller('user/progress')
@UseGuards(AuthGuard)
export class ProgressController {
  constructor(
    @InjectRepository(LearningPlan) private pathRepo: Repository<LearningPlan>,
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    private readonly skillService: SkillService,
    private readonly notificationService: NotificationService,
    private readonly progressStore: LearningProgressService,
    private readonly learningCommitService: LearningCommitService,
    private readonly evaluationService: EvaluationService,
    private readonly branchService: BranchService,
    private readonly assessmentContext: LearningAssessmentContextService,
  ) {}

  /**
   * 掌握度权重配置
   *
   * 读完讲义      → +30%  (基础完成，可推进)
   * 选择题通过    → +25%  (进阶完成)
   * 编程题通过    → +25%  (深度完成)
   * 阶段考试通过  → +20%  (确认掌握)
   * 总计 100%
   */
  private static readonly MASTERY_WEIGHTS = {
    lecture: 30,
    quiz: 25,
    code: 25,
    exam: 20,
  };

  /**
   * 把学习闭环算出的掌握度回写到 user_skills_v3。
   * 能力雷达、知识盲区、岗位匹配都从这张表取数；此前学习闭环只更新 git 快照，
   * 从不写这里，导致那些页面看到的一直是 0。
   */
  private async syncMastery(userId: number, skill: string, masteryPct: number): Promise<void> {
    try {
      await this.skillService.setMastery(userId, skill, masteryPct);
    } catch (e: any) {
      console.warn(`[Progress] 掌握度回写失败: ${skill} → ${e.message}`);
    }
  }

  /**
   * 按完成项累加掌握度。幂等 —— 重做测验、重复提交都不会叠加。
   * git 快照的 mastery 是逐次 delta 累加的，用户重做一遍就会虚高，
   * 所以对外一律以这个为准。
   */
  private checklistMastery(path: LearningPlan, skill: string): number {
    const w = ProgressController.MASTERY_WEIGHTS;
    let node: any = null;
    for (const phase of (path?.pathData?.phases || [])) {
      for (const s of (phase.skills || [])) {
        if (s.name === skill) { node = s; break; }
      }
    }
    if (!node) return 0;
    return (
      (node.read_at ? w.lecture : 0) +
      (node.quiz_passed ? w.quiz : 0) +
      (node.code_done ? w.code : 0) +
      (node.exam_done ? w.exam : 0)
    );
  }

  /** POST /api/user/progress/read — 标记讲义阅读完成 */
  @Post('read')
  async markReadComplete(
    @CurrentUser('sub') userId: number,
    @Body() body: { skill: string; path_id?: number },
  ) {
    const path = await this.getActivePath(userId, body.path_id);
    if (!path) return success(null, '暂无学习路径');
    const context = this.assessmentContext.fromPlan(path);

    const skillNode = this.updateSkillProgress(path, body.skill, 'read');
    await this.pathRepo.save(path);

    // §17 热层：记录当前技能 + 阅读位置（讲义读完=100%）
    await this.progressStore.setCurrentSkill(userId, body.skill, 100);

    // 联动更新技能掌握度：+30%
    const delta = ProgressController.MASTERY_WEIGHTS.lecture;
    const branch = await this.branchService.ensurePlanBranch(userId, path);
    const git = await this.learningCommitService.commitSkill(userId, branch.id, {
      type: 'lecture_read',
      skillName: body.skill,
      delta,
      message: `lecture read: ${body.skill}`,
      payload: { pathId: path.id },
    });

    // 获取当前掌握度
    const current = (git.snapshot.skillsJson || []).find((skill: any) => skill.name === body.skill);
    const masteryPct = this.checklistMastery(path, body.skill);
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'progress_read',
      sourceType: 'progress_commit',
      sourceId: git.commit.id,
      skillName: body.skill,
      ...this.evaluationContract(context, 'progress_read'),
      score: 100,
      passed: true,
      confidence: 0.65,
      summary: `${body.skill}讲义阅读完成。`,
      evidenceSummary: `${body.skill} · ${context.evidenceTypes.join('、')}`,
      evidence: { pathId: path.id, action: 'read', lecturePosition: 100, domainId: context.domainId, evidenceTypes: context.evidenceTypes },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, 100, context),
      nextActions: [{ type: 'quiz', label: '完成随堂练习', skillName: body.skill }],
    });

    await this.syncMastery(userId, body.skill, masteryPct || delta);

    return success({
      skill: body.skill,
      status: 'lecture_done',
      masteryPct,
      delta,
      commit: git.commit,
      snapshot: git.snapshot,
      gitDelta: git.delta,
      branch: git.branch,
      matchSummary: git.matchSummary,
      evaluation,
      message: `讲义已读完，掌握度 +${delta}% → ${masteryPct}%`,
    });
  }

  /** GET /api/user/progress/restore — §17.2 恢复学习进度（Redis热→MongoDB温→MySQL冷） */
  @Get('restore')
  async restore(
    @CurrentUser('sub') userId: number,
    @Query('planId') planId?: string,
  ) {
    const result = await this.progressStore.restoreProgress(
      userId,
      planId ? Number(planId) : undefined,
    );
    return success(result);
  }

  /** POST /api/user/progress/heartbeat — §17 上报学习时长心跳（热层累计） */
  @Post('heartbeat')
  async heartbeat(
    @CurrentUser('sub') userId: number,
    @Body() body: { deltaMs?: number; skill?: string; lecturePosition?: number },
  ) {
    if (body.deltaMs) await this.progressStore.addStudyTime(userId, body.deltaMs);
    if (body.skill) await this.progressStore.setCurrentSkill(userId, body.skill, body.lecturePosition || 0);
    return success({ ok: true });
  }

  /** POST /api/user/progress/quiz — 标记习题完成 */
  @Post('quiz')
  async markQuizComplete(
    @CurrentUser('sub') userId: number,
    @Body() body: { skill: string; total: number; correct: number; path_id?: number },
  ) {
    const path = await this.getActivePath(userId, body.path_id);
    if (!path) return success(null, '暂无学习路径');
    const context = this.assessmentContext.fromPlan(path);

    const score = Math.round((body.correct / Math.max(body.total, 1)) * 100);
    const passScore = context.passScore;
    const passed = score >= passScore;

    this.updateSkillProgress(path, body.skill, 'quiz', score, passed);
    await this.pathRepo.save(path);

    let masteryPct = 0;
    let delta = 0;
    let git: any = null;

    if (passed) {
      delta = ProgressController.MASTERY_WEIGHTS.quiz;
      const branch = await this.branchService.ensurePlanBranch(userId, path);
      git = await this.learningCommitService.commitSkill(userId, branch.id, {
        type: 'quiz_passed',
        skillName: body.skill,
        delta,
        message: `quiz passed: ${body.skill}`,
        payload: { pathId: path.id, total: body.total, correct: body.correct, score, passScore, domainId: context.domainId },
      });
      const current = (git.snapshot.skillsJson || []).find((skill: any) => skill.name === body.skill);
      masteryPct = this.checklistMastery(path, body.skill);
    } else {
      const branch = await this.branchService.ensurePlanBranch(userId, path);
      git = await this.learningCommitService.commitSkill(userId, branch.id, {
        type: 'quiz_failed',
        skillName: body.skill,
        delta: 0,
        message: `quiz failed: ${body.skill}`,
        payload: { pathId: path.id, total: body.total, correct: body.correct, score, passScore, domainId: context.domainId },
      });
    }

    // 同步创建考试记录（供错题本使用）
    let examRecord: ExamRecord | null = null;
    try {
      examRecord = await this.examRepo.save({
        userId,
        examType: 1,  // 技能考试
        skillName: body.skill,
        score,
        passed: passed ? 1 : 0,
        answers: {
          total: body.total,
          correct: body.correct,
          wrong: body.total - body.correct,
          source: 'knowledge_quiz',
        },
        wrongAnalysis: passed ? null : {
          weakPoints: [{
            skill: body.skill,
            question: `${body.skill} 测验未通过（${body.correct}/${body.total}）`,
            userAnswer: `${body.correct}/${body.total}`,
            correctAnswer: `需 ≥${passScore}%（当前 ${score}%）`,
            type: 'quiz_failed',
          }],
        },
        retryCount: 0,
        createTime: Date.now(),
        updateTime: Date.now(),
        status: 1,
      });
    } catch (e: any) {
      console.warn('[Progress] Failed to create exam record for quiz:', e.message);
    }
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'progress_quiz',
      sourceType: 'exam_record',
      sourceId: examRecord?.id || git?.commit?.id,
      skillName: body.skill,
      ...this.evaluationContract(context, 'progress_quiz'),
      score,
      passed,
      confidence: passed ? 0.82 : 0.72,
      summary: `${context.domainName}练习${passed ? '通过' : '未通过'}：${body.skill} ${body.correct}/${body.total}。`,
      evidenceSummary: `${body.skill} · ${context.evidenceTypes.join('、')}`,
      evidence: {
        pathId: path.id,
        total: body.total,
        correct: body.correct,
        score,
        passed,
        passScore,
        domainId: context.domainId,
        assessmentModes: context.assessmentModes,
        evidenceTypes: context.evidenceTypes,
      },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, score, context),
      nextActions: passed
        ? [{ type: 'practice', label: context.domainId === 'software-engineering' ? '进入编程实战' : '进入领域实践', skillName: body.skill }]
        : [{ type: 'review', label: '复盘薄弱项', skillName: body.skill }],
    });

    await this.syncMastery(userId, body.skill, masteryPct || (passed ? delta : 0));

    return success({
      skill: body.skill,
      score,
      passed,
      masteryPct,
      delta: passed ? delta : 0,
      commit: git?.commit,
      snapshot: git?.snapshot,
      gitDelta: git?.delta,
      branch: git?.branch,
      matchSummary: git?.matchSummary,
      evaluation,
      message: passed ? `习题通过！掌握度 +${delta}% → ${masteryPct}%` : `未通过（需 ≥${passScore}%），建议复习后重试`,
    });
  }

  /** POST /api/user/progress/code — 标记编程题完成 */
  @Post('code')
  async markCodeComplete(
    @CurrentUser('sub') userId: number,
    @Body() body: { skill: string; path_id?: number },
  ) {
    const path = await this.getActivePath(userId, body.path_id);
    if (!path) return success(null, '暂无学习路径');
    const context = this.assessmentContext.fromPlan(path);

    this.updateSkillProgress(path, body.skill, 'code');
    await this.pathRepo.save(path);

    const delta = ProgressController.MASTERY_WEIGHTS.code;
    const branch = await this.branchService.ensurePlanBranch(userId, path);
    const git = await this.learningCommitService.commitSkill(userId, branch.id, {
      type: 'code_done',
      skillName: body.skill,
      delta,
      message: `code done: ${body.skill}`,
      payload: { pathId: path.id },
    });

    const current = (git.snapshot.skillsJson || []).find((skill: any) => skill.name === body.skill);
    const masteryPct = this.checklistMastery(path, body.skill);
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'progress_code',
      sourceType: 'progress_commit',
      sourceId: git.commit.id,
      skillName: body.skill,
      ...this.evaluationContract(context, 'progress_code'),
      score: 100,
      passed: true,
      confidence: 0.78,
      summary: `${body.skill}${context.domainId === 'software-engineering' ? '编程实战' : '领域实践'}完成。`,
      evidenceSummary: `${body.skill} · ${context.evidenceTypes.join('、')}`,
      evidence: { pathId: path.id, action: 'practice_done', domainId: context.domainId, evidenceTypes: context.evidenceTypes },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, 100, context),
      nextActions: [{ type: 'complete', label: '确认能力项完成', skillName: body.skill }],
    });

    await this.syncMastery(userId, body.skill, masteryPct);

    return success({
      skill: body.skill,
      status: 'code_done',
      masteryPct,
      delta,
      commit: git.commit,
      snapshot: git.snapshot,
      gitDelta: git.delta,
      branch: git.branch,
      matchSummary: git.matchSummary,
      evaluation,
      message: `${context.domainId === 'software-engineering' ? '编程实战' : '领域实践'}完成！掌握度 +${delta}% → ${masteryPct}%`,
    });
  }

  /** POST /api/user/progress/complete — 手动标记技能完成 */
  @Post('complete')
  async markSkillComplete(
    @CurrentUser('sub') userId: number,
    @Body() body: { skill: string; path_id?: number },
  ) {
    const path = await this.getActivePath(userId, body.path_id);
    if (!path) return success(null, '暂无学习路径');
    const context = this.assessmentContext.fromPlan(path);

    this.updateSkillProgress(path, body.skill, 'done');
    const phaseDone = this.checkPhaseCompletion(path);
    await this.pathRepo.save(path);

    const branch = await this.branchService.ensurePlanBranch(userId, path);
    const git = await this.learningCommitService.commitSkill(userId, branch.id, {
      type: 'skill_complete',
      skillName: body.skill,
      delta: 0,
      message: `skill learning complete: ${body.skill}`,
      payload: { pathId: path.id, phaseDone, requiresVerification: true },
    });
    const current = (git.snapshot.skillsJson || []).find((skill: any) => skill.name === body.skill);
    const masteryPct = this.checklistMastery(path, body.skill);

    await this.notificationService.notifyProgress(userId, body.skill, 100);

    // §17 热层：归档今日进度到 MongoDB 温层（技能完成是会话里程碑）
    await this.progressStore.archiveToWarm(userId, path.id);
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'skill_complete',
      sourceType: 'progress_commit',
      sourceId: git.commit.id,
      skillName: body.skill,
      ...this.evaluationContract(context, 'skill_complete'),
      score: 100,
      passed: true,
      confidence: 0.75,
      summary: `${body.skill}能力项完成确认。`,
      evidenceSummary: `${body.skill} · ${context.evidenceTypes.join('、')}`,
      evidence: { pathId: path.id, phaseDone, action: 'ability_complete', domainId: context.domainId, evidenceTypes: context.evidenceTypes },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, 100, context),
      nextActions: phaseDone ? [{ type: 'exam', label: '参加阶段测评', skillName: body.skill }] : [],
    });

    await this.syncMastery(userId, body.skill, 100);

    return success({
      skill: body.skill,
      status: 'done',
      masteryPct: 100,
      phase_completed: phaseDone,
      commit: git.commit,
      snapshot: git.snapshot,
      gitDelta: git.delta,
      branch: git.branch,
      matchSummary: git.matchSummary,
      evaluation,
      message: phaseDone ? '阶段完成！可以参加阶段考试了' : '技能已掌握',
    });
  }

  /** GET /api/user/progress/mastery/:skill — 获取技能掌握度明细 */
  @Get('mastery/:skill')
  async getMasteryBreakdown(
    @CurrentUser('sub') userId: number,
    @Param('skill') skill: string,
  ) {
    const skills = await this.skillService.getEffectiveSkills(userId);
    const current = skills.find(s => s.name === decodeURIComponent(skill));

    // 从学习路径中获取完成状态
    const path = await this.getActivePath(userId);
    const context = path ? this.assessmentContext.fromPlan(path) : null;
    let skillNode: any = null;
    if (path?.pathData?.phases) {
      for (const phase of path.pathData.phases) {
        for (const s of phase.skills || []) {
          if (s.name === decodeURIComponent(skill)) {
            skillNode = s;
            break;
          }
        }
      }
    }

    const w = ProgressController.MASTERY_WEIGHTS;
    const lectureDone = !!skillNode?.read_at;
    const quizPassed = !!skillNode?.quiz_passed;
    const codeDone = !!skillNode?.code_done;
    const examDone = !!skillNode?.exam_done;

    // 掌握度必须和下面四个权重项自洽。此前直接读 user_skills_v3，
    // 而那张表在学习闭环里从不写入（commitSkill 只更新 git 快照），
    // 结果就是"测验已完成 +25%"但掌握度始终 0%。有路径节点时按完成项累加。
    const byChecklist =
      (lectureDone ? w.lecture : 0) +
      (quizPassed ? w.quiz : 0) +
      (codeDone ? w.code : 0) +
      (examDone ? w.exam : 0);
    const masteryPct = skillNode ? byChecklist : (current?.masteryPct ?? 0);

    return success({
      skill: decodeURIComponent(skill),
      masteryPct,
      trustWeight: current?.trustWeight ?? 0.3,
      source: current?.source ?? 'self_report',
      breakdown: {
        lecture: { done: lectureDone, weight: w.lecture, label: '讲义阅读' },
        quiz: { done: quizPassed, weight: w.quiz, label: '习题练习' },
        code: { done: codeDone, weight: w.code, label: context?.domainId === 'software-engineering' ? '编程实战' : '领域实践' },
        exam: { done: examDone, weight: w.exam, label: '阶段测评' },
      },
    });
  }

  /** GET /api/user/progress/summary — 进度汇总 */
  @Get('summary')
  async getProgressSummary(@CurrentUser('sub') userId: number) {
    const paths = await this.pathRepo.find({
      where: { userId: userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 5,
    });

    if (!paths.length) return success({ message: '暂无学习路径', paths: [] });

    const summaries = paths.map((path) => {
      const pathData = path.pathData || {};
      const phases = pathData.phases || [];
      let totalSkills = 0, doneSkills = 0, readSkills = 0, quizPassed = 0;

      for (const phase of phases) {
        for (const skill of phase.skills || []) {
          if (typeof skill === 'object') {
            totalSkills++;
            if (skill.status === 'done') doneSkills++;
            if (skill.read_at) readSkills++;
            if (skill.quiz_passed) quizPassed++;
          }
        }
      }

      return {
        path_id: path.id,
        targetJobId: path.targetJobId,
        total_skills: totalSkills,
        done_skills: doneSkills,
        read_skills: readSkills,
        quiz_passed: quizPassed,
        currentPhase: path.currentPhase || 0,
        matchScore: Number(path.matchScore || 0),
        estimatedDate: path.estimatedDate || '',
      };
    });

    return success({ paths: summaries });
  }

  // ── 内部方法 ──

  private async getActivePath(userId: number, pathId?: number): Promise<LearningPlan | null> {
    if (pathId) {
      return this.pathRepo.findOne({ where: { id: pathId, status: 1 } });
    }
    const paths = await this.pathRepo.find({
      where: { userId: userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 1,
    });
    return paths[0] || null;
  }

  private updateSkillProgress(path: LearningPlan, skillName: string, action: string, score?: number, passed?: boolean) {
    const pathData = JSON.parse(JSON.stringify(path.pathData || {}));
    const phases = pathData.phases || [];
    const now = Date.now();
    let updated = false;
    let skillNode: any = null;

    for (const phase of phases) {
      for (const skill of phase.skills || []) {
        if (typeof skill === 'object' && skill.name === skillName) {
          if (action === 'read') {
            skill.read_at = now;
            skill.lecture_done = true;
          } else if (action === 'quiz') {
            skill.quiz_score = score;
            skill.quiz_passed = passed;
            skill.quiz_at = now;
          } else if (action === 'code') {
            skill.code_done = true;
            skill.code_at = now;
          } else if (action === 'exam') {
            skill.exam_done = true;
            skill.exam_at = now;
          } else if (action === 'done') {
            skill.status = 'done';
            skill.completed_at = now;
          }
          skillNode = skill;
          updated = true;
          break;
        }
      }
    }

    if (updated) {
      // 检查当前阶段是否全部完成
      const currentPhase = path.currentPhase || 0;
      if (currentPhase < phases.length) {
        const phaseSkills = phases[currentPhase].skills || [];
        const allDone = phaseSkills.every((s: any) => typeof s === 'object' && s.status === 'done');
        if (allDone) {
          pathData.phases[currentPhase].status = 'done';
        }
      }
      path.pathData = pathData;
    }
  }

  private checkPhaseCompletion(path: LearningPlan): boolean {
    const pathData = JSON.parse(JSON.stringify(path.pathData || {}));
    const phases = pathData.phases || [];
    const currentPhase = path.currentPhase || 0;

    if (currentPhase >= phases.length) return false;

    const phaseSkills = phases[currentPhase].skills || [];
    const allDone = phaseSkills.every((s: any) => typeof s === 'object' && s.status === 'done');

    if (allDone) {
      pathData.phases[currentPhase].status = 'done';
      path.pathData = pathData;
    }

    return allDone;
  }

  private dimensionsFromGit(
    git: any,
    fallbackSkill?: string,
    fallbackScore?: number,
    context?: LearningAssessmentContext | null,
  ): EvaluationDimensionInput[] {
    const changes = git?.delta?.radarChanges || [];
    if (Array.isArray(changes) && changes.length > 0) {
      return changes.map((change: any) => ({
        name: change.dimension,
        score: Number.isFinite(Number(change.after)) ? Number(change.after) : fallbackScore ?? 0,
        maxScore: 100,
        trend: Number(change.delta || 0) > 0 ? 'up' : Number(change.delta || 0) < 0 ? 'down' : 'stable',
        detail: `Radar ${change.dimension}: ${change.before ?? 0} -> ${change.after ?? 0}`,
      }));
    }
    const domainDimension = this.assessmentContext.dimensionForSkill(context || null, fallbackSkill);
    return fallbackSkill
      ? [{
          key: domainDimension?.id,
          name: domainDimension?.name || fallbackSkill,
          score: fallbackScore ?? 100,
          maxScore: 100,
          weight: domainDimension?.weight || 1,
          trend: 'stable',
          detail: context ? `${context.domainName} · ${context.assessmentModes.join('、')}` : undefined,
        }]
      : [];
  }

  private evaluationContract(context: LearningAssessmentContext, attemptType: string) {
    return {
      goal: context.goalTitle,
      rubricKey: this.assessmentContext.rubricKey(context, attemptType),
      rubricName: `${context.domainName}${context.terminology.assessment || '能力测评'}`,
      rubricDimensions: context.radarDimensions.map((dimension) => ({
        key: dimension.id,
        name: dimension.name,
        assessmentModes: context.assessmentModes,
      })),
      rubricWeights: Object.fromEntries(context.radarDimensions.map((dimension) => [dimension.id, dimension.weight])),
      passScore: context.passScore,
      metadata: {
        planId: context.planId,
        domainId: context.domainId,
        domainName: context.domainName,
        goalType: context.goalType,
        goalTitle: context.goalTitle,
      },
    };
  }
}
