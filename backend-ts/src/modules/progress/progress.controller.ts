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

  /** POST /api/user/progress/read — 标记讲义阅读完成 */
  @Post('read')
  async markReadComplete(
    @CurrentUser('sub') userId: number,
    @Body() body: { skill: string; path_id?: number },
  ) {
    const path = await this.getActivePath(userId, body.path_id);
    if (!path) return success(null, '暂无学习路径');

    const skillNode = this.updateSkillProgress(path, body.skill, 'read');
    await this.pathRepo.save(path);

    // §17 热层：记录当前技能 + 阅读位置（讲义读完=100%）
    await this.progressStore.setCurrentSkill(userId, body.skill, 100);

    // 联动更新技能掌握度：+30%
    const delta = ProgressController.MASTERY_WEIGHTS.lecture;
    const git = await this.learningCommitService.commitSkill(userId, undefined, {
      type: 'lecture_read',
      skillName: body.skill,
      delta,
      message: `lecture read: ${body.skill}`,
      payload: { pathId: path.id },
    });

    // 获取当前掌握度
    const skills = await this.skillService.getEffectiveSkills(userId);
    const current = skills.find(s => s.name === body.skill);
    const masteryPct = current?.masteryPct ?? delta;
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'progress_read',
      sourceType: 'progress_commit',
      sourceId: git.commit.id,
      skillName: body.skill,
      score: 100,
      passed: true,
      confidence: 0.65,
      summary: `Lecture read completed for ${body.skill}.`,
      evidence: { pathId: path.id, action: 'read', lecturePosition: 100 },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, 100),
      nextActions: [{ type: 'quiz', label: 'Take quiz', skillName: body.skill }],
    });

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

    const score = Math.round((body.correct / Math.max(body.total, 1)) * 100);
    const passed = score >= 70; // 阈值从 60 提高到 70

    this.updateSkillProgress(path, body.skill, 'quiz', score, passed);
    await this.pathRepo.save(path);

    let masteryPct = 0;
    let delta = 0;
    let git: any = null;

    if (passed) {
      delta = ProgressController.MASTERY_WEIGHTS.quiz;
      git = await this.learningCommitService.commitSkill(userId, undefined, {
        type: 'quiz_passed',
        skillName: body.skill,
        delta,
        message: `quiz passed: ${body.skill}`,
        payload: { pathId: path.id, total: body.total, correct: body.correct, score },
      });
      const skills = await this.skillService.getEffectiveSkills(userId);
      const current = skills.find(s => s.name === body.skill);
      masteryPct = current?.masteryPct ?? 0;
    } else {
      git = await this.learningCommitService.commitSkill(userId, undefined, {
        type: 'quiz_failed',
        skillName: body.skill,
        delta: 0,
        message: `quiz failed: ${body.skill}`,
        payload: { pathId: path.id, total: body.total, correct: body.correct, score },
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
            correctAnswer: `需 ≥70%（当前 ${score}%）`,
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
      score,
      passed,
      confidence: passed ? 0.82 : 0.72,
      summary: passed
        ? `Quiz passed for ${body.skill}: ${body.correct}/${body.total}.`
        : `Quiz failed for ${body.skill}: ${body.correct}/${body.total}.`,
      evidence: { pathId: path.id, total: body.total, correct: body.correct, score, passed },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, score),
      nextActions: passed
        ? [{ type: 'code', label: 'Practice with code', skillName: body.skill }]
        : [{ type: 'review', label: 'Review weak points', skillName: body.skill }],
    });

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
      message: passed ? `习题通过！掌握度 +${delta}% → ${masteryPct}%` : '未通过（需 ≥70%），建议复习后重试',
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

    this.updateSkillProgress(path, body.skill, 'code');
    await this.pathRepo.save(path);

    const delta = ProgressController.MASTERY_WEIGHTS.code;
    const git = await this.learningCommitService.commitSkill(userId, undefined, {
      type: 'code_done',
      skillName: body.skill,
      delta,
      message: `code done: ${body.skill}`,
      payload: { pathId: path.id },
    });

    const skills = await this.skillService.getEffectiveSkills(userId);
    const current = skills.find(s => s.name === body.skill);
    const masteryPct = current?.masteryPct ?? 0;
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'progress_code',
      sourceType: 'progress_commit',
      sourceId: git.commit.id,
      skillName: body.skill,
      score: 100,
      passed: true,
      confidence: 0.78,
      summary: `Code practice completed for ${body.skill}.`,
      evidence: { pathId: path.id, action: 'code_done' },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, 100),
      nextActions: [{ type: 'complete', label: 'Confirm skill completion', skillName: body.skill }],
    });

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
      message: `编程题通过！掌握度 +${delta}% → ${masteryPct}%`,
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

    this.updateSkillProgress(path, body.skill, 'done');
    const phaseDone = this.checkPhaseCompletion(path);
    await this.pathRepo.save(path);

    // 获取当前掌握度（不强制设100，保留分层累加的结果）
    const skills = await this.skillService.getEffectiveSkills(userId);
    const current = skills.find(s => s.name === body.skill);
    const masteryPct = current?.masteryPct ?? 0;
    let git: any = null;

    // 如果掌握度不足100%，补足到100%（用户手动确认完成）
    if (masteryPct < 100) {
      git = await this.learningCommitService.commitSkill(userId, undefined, {
        type: 'skill_complete',
        skillName: body.skill,
        masteryPct: 100,
        message: `skill complete: ${body.skill}`,
        payload: { pathId: path.id, phaseDone },
      });
    }
    if (!git) {
      git = await this.learningCommitService.commitSkill(userId, undefined, {
        type: 'skill_complete',
        skillName: body.skill,
        masteryPct: 100,
        message: `skill complete: ${body.skill}`,
        payload: { pathId: path.id, phaseDone },
      });
    }

    await this.notificationService.notifyProgress(userId, body.skill, 100);

    // §17 热层：归档今日进度到 MongoDB 温层（技能完成是会话里程碑）
    await this.progressStore.archiveToWarm(userId, path.id);
    const evaluation = await this.evaluationService.record({
      userId,
      attemptType: 'skill_complete',
      sourceType: 'progress_commit',
      sourceId: git.commit.id,
      skillName: body.skill,
      score: 100,
      passed: true,
      confidence: 0.75,
      summary: `Skill completion confirmed for ${body.skill}.`,
      evidence: { pathId: path.id, phaseDone, action: 'skill_complete' },
      commitOutcome: git,
      dimensions: this.dimensionsFromGit(git, body.skill, 100),
      nextActions: phaseDone ? [{ type: 'exam', label: 'Take phase exam', skillName: body.skill }] : [],
    });

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

    return success({
      skill: decodeURIComponent(skill),
      masteryPct: current?.masteryPct ?? 0,
      trustWeight: current?.trustWeight ?? 0.3,
      source: current?.source ?? 'self_report',
      breakdown: {
        lecture: { done: lectureDone, weight: w.lecture, label: '讲义阅读' },
        quiz: { done: quizPassed, weight: w.quiz, label: '习题练习' },
        code: { done: codeDone, weight: w.code, label: '编程实战' },
        exam: { done: examDone, weight: w.exam, label: '阶段考试' },
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

  private dimensionsFromGit(git: any, fallbackSkill?: string, fallbackScore?: number): EvaluationDimensionInput[] {
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
    return fallbackSkill
      ? [{ name: fallbackSkill, score: fallbackScore ?? 100, maxScore: 100, trend: 'stable' }]
      : [];
  }
}
