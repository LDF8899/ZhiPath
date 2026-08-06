import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { GeneratedResource } from '../../entities/generated-resource.entity';
import { Resume } from '../../entities/resume.entity';
import { TaskSchedulerService } from '../../services/task-scheduler.service';
import { MatchAgentService } from '../../services/match-agent.service';
import { SkillService } from '../../services/skill.service';
import { EvidenceRagService } from '../../services/evidence-rag.service';
import { EvaluationResult } from '../../entities/evaluation-result.entity';
import { LearningCommit } from '../../entities/learning-commit.entity';

/**
 * Dashboard 服务 — 聚合 Dashboard 页所需全部数据
 *
 * 返回结构对齐前端 DashboardData 类型：
 * { student, target_job, plans, learning_path, stats, today_tasks, recent_news }
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(LearningPlan) private learningPathRepo: Repository<LearningPlan>,
    @InjectRepository(LearningTask) private taskRepo: Repository<LearningTask>,
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    @InjectRepository(News) private newsRepo: Repository<News>,
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    @InjectRepository(JobApplication) private jobAppRepo: Repository<JobApplication>,
    @InjectRepository(GeneratedResource) private resourceRepo: Repository<GeneratedResource>,
    @InjectRepository(Resume) private resumeRepo: Repository<Resume>,
    @InjectRepository(EvaluationResult) private evalResultRepo: Repository<EvaluationResult>,
    @InjectRepository(LearningCommit) private commitRepo: Repository<LearningCommit>,
    private taskScheduler: TaskSchedulerService,
    private matchAgent: MatchAgentService,
    private skillService: SkillService,
    private evidenceRag: EvidenceRagService,
  ) {}

  /** GET /api/user/dashboard */
  async getDashboard(userId: number) {
    const today = new Date().toISOString().slice(0, 10);

    // 1. 学生信息
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    const studentData = student
      ? {
          id: student.id,
          userId: student.userId,
          name: student.name || '',
          school: student.school || '',
          studentNo: student.studentNo || '',
          major: student.major || '',
          grade: student.grade || '',
          targetJobId: student.targetJobId || null,
          dailyHours: Number(student.dailyHours) || 0,
          interests: student.interests || [],
          skills: student.skills || [],
          projects: student.projects || [],
          onboardingCompleted: student.onboardingCompleted || 0,
        }
      : null;

    // 2. 目标岗位（使用 5 因子匹配度算法）
    let targetJob = null;
    if (student?.targetJobId) {
      const job = await this.jobRepo.findOne({ where: { id: student.targetJobId, status: 1 } });
      if (job) {
        let matchScore = 0;
        try {
          const matchResult = await this.matchAgent.calculateMatch(userId, Number(job.id));
          matchScore = matchResult.totalScore;
        } catch (e) {
          // 匹配度计算失败时降级为简单技能命中
          const requiredSkills = job.requiredSkills || [];
          const studentSkills = (student.skills || []).map((s) => s.name);
          const matched = requiredSkills.filter((s: any) => studentSkills.includes(typeof s === 'string' ? s : s.name));
          matchScore = requiredSkills.length > 0
            ? Math.round((matched.length / requiredSkills.length) * 100)
            : 0;
        }

        targetJob = {
          id: job.id,
          title: job.title,
          company: job.company || '',
          location: job.location || '',
          salaryRange: job.salaryRange || '',
          level: job.level || 'junior',
          requiredSkills: job.requiredSkills || [],
          preferredSkills: job.preferredSkills || [],
          matchScore: matchScore,
          deliveryThreshold: job.deliveryThreshold || 60,
          source: job.source || 'manual',
        };
      }
    }

    // 3. 所有学习计划（用于计划切换器）
    const plans = await this.learningPathRepo.find({
      where: { userId, status: 1 },
      order: { planType: 'ASC', createTime: 'DESC' },
    });

    const plansList = plans.map((p) => ({
      id: p.id,
      planName: p.planName,
      planType: p.planType,
      currentPhase: p.currentPhase,
      estimatedDate: p.estimatedDate || '',
      totalSkills: (p.pathData?.phases || []).reduce((sum: number, ph: any) => sum + (ph.skills?.length || 0), 0),
    }));

    // 4. 当前学习路径（取主线最新的）
    const currentPlan = plans.find((p) => p.planType === 'main') || plans[0] || null;

    let learningPath = null;
    if (currentPlan) {
      const pathData = currentPlan.pathData || {};
      learningPath = {
        id: currentPlan.id,
        userId: currentPlan.userId,
        planName: currentPlan.planName,
        targetJobId: currentPlan.targetJobId,
        currentPhase: currentPlan.currentPhase,
        matchScore: Number(currentPlan.matchScore) || 0,
        estimatedDate: currentPlan.estimatedDate || '',
        dailyHours: Number(currentPlan.dailyHours) || 0,
        pathData: { phases: pathData.phases || [] },
        status: currentPlan.status,
        createTime: currentPlan.createTime ? new Date(currentPlan.createTime).getTime() : Date.now(),
      };
    }

    // 5. 今日任务（通过 TaskScheduler 获取）
    let todayTasks: any[] = [];
    try {
      const schedulerResult = await this.taskScheduler.getTodayTasks(userId);
      const allTasks = [...schedulerResult.mainTasks, ...schedulerResult.sideTasks];
      todayTasks = allTasks.map((t) => ({
        id: t.id,
        title: t.skillName,
        taskType: t.taskType,
        estimatedMin: t.estimatedMin || 30,
        status: t.taskStatus,
        planDate: t.planDate || '',
      }));
    } catch (e) {
      // fallback 到直接查询
      const tasks = await this.taskRepo.find({
        where: [
          { userId, planDate: today, isActive: 1 },
          { userId, taskStatus: 'pending', isActive: 1 },
          { userId, taskStatus: 'in_progress', isActive: 1 },
        ],
        order: { sortOrder: 'ASC', priority: 'DESC' },
        take: 10,
      });

      const seenTaskIds = new Set<number>();
      todayTasks = tasks
        .filter((t) => {
          if (seenTaskIds.has(t.id)) return false;
          seenTaskIds.add(t.id);
          return true;
        })
        .map((t) => ({
          id: t.id,
          title: t.skillName,
          taskType: t.taskType,
          estimatedMin: t.estimatedMin || 30,
          status: t.taskStatus,
          planDate: t.planDate || '',
        }));
    }

    // 6. 资讯
    const newsItems = await this.newsRepo.find({
      where: { status: 1 },
      order: { publishTime: 'DESC' },
      take: 5,
    });
    const news = newsItems.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content || '',
      image: n.image || '',
      type: n.type || 'industry',
      source: n.source || '',
      sourceUrl: n.sourceUrl || '',
      publishTime: n.publishTime ? Number(n.publishTime) : 0,
    }));

    // 7. 统计
    const [examCount, jobCount, resourceSuccessCount, resumeCount] = await Promise.all([
      this.examRepo.count({ where: { userId, status: 1 } }),
      this.jobAppRepo.count({ where: { userId, status: 1 } }),
      this.resourceRepo.count({ where: { userId, status: 1, resourceStatus: 'success' } }),
      this.resumeRepo.count({ where: { userId, status: 1 } }),
    ]);

    // 从 pathData 统计总技能数和已完成数
    let totalSkills = 0;
    let doneSkills = 0;
    for (const plan of plans) {
      const phases = plan.pathData?.phases || [];
      for (const phase of phases) {
        for (const skill of phase.skills || []) {
          totalSkills++;
          if (skill.status === 'done') doneSkills++;
        }
      }
    }

    // 累计学习时长（从已完成任务的 estimatedMin 估算）
    const completedTasks = await this.taskRepo.find({
      where: { userId, isActive: 1 },
      select: { id: true, actualMin: true, estimatedMin: true, taskStatus: true, planDate: true },
    });
    let totalLearnedMin = 0;
    for (const t of completedTasks) {
      if (['lecture_done', 'practice_done', 'code_done', 'exam_done', 'done'].includes(t.taskStatus)) {
        totalLearnedMin += t.actualMin || t.estimatedMin || 0;
      }
    }

    // 连续学习天数（简化：计算有任务完成的不同日期数）
    const activeDays = new Set(
      completedTasks
        .filter((t) => ['done', 'exam_done'].includes(t.taskStatus))
        .map((t) => t.planDate)
        .filter(Boolean),
    );
    const goldenPath = this.buildGoldenPath({
      student: studentData,
      targetJob,
      learningPath,
      todayTasks,
      totalSkills,
      doneSkills,
      examCount,
      resourceSuccessCount,
      resumeCount,
    });

    return {
      student: studentData,
      target_job: targetJob,
      plans: plansList,
      learning_path: learningPath,
      stats: {
        total_skills: totalSkills,
        done_skills: doneSkills,
        exam_count: examCount,
        job_count: jobCount,
        total_learned_hours: Math.round(totalLearnedMin / 60 * 10) / 10,
        active_days: activeDays.size,
      },
      today_tasks: todayTasks,
      recent_news: news,
      golden_path: goldenPath,
    };
  }

  /**
   * 今日行动推荐 — GET /api/user/today-actions（P0-2）
   *
   * 对齐《ZhiPath_产品业务升级方案》P0-2 / §6.3：
   *  - 返回 1 个主任务（main）+ 最多 2 个辅助任务（subs）
   *  - 每个任务带推荐原因（reason）、预计影响（estimatedImpact）、证据沉淀说明
   *  - 规则优先级：岗位必备缺口 > 未完成任务 > 测评薄弱点 > 项目证据 > 复习
   *  - 新用户兜底：无目标岗位 → 引导选择岗位；无计划 → 引导创建计划
   *
   * 任务来源先用规则排序，不依赖大模型（方案 §9.2）。
   */
  async getTodayActions(userId: number) {
    // ── 兜底 1：没有目标岗位 → 主任务引导选岗 ──
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    const targetJobId = student?.targetJobId || null;

    if (!targetJobId) {
      return {
        main: {
          id: 0,
          title: '选择目标岗位，开始差距分析',
          taskType: 'onboarding',
          estimatedMin: 5,
          reason: '有了目标岗位，系统才能告诉你差什么、先补什么。',
          estimatedImpact: 0,
          impactLabel: '',
          evidence: '绑定后生成岗位差距卡和今日任务',
          path: '/user/jobs',
        },
        subs: [],
      };
    }

    const job = await this.jobRepo.findOne({ where: { id: targetJobId, status: 1 } });
    if (!job) {
      return {
        main: {
          id: 0,
          title: '重新选择目标岗位',
          taskType: 'onboarding',
          estimatedMin: 5,
          reason: '原目标岗位已下架，重新选定后继续差距分析。',
          estimatedImpact: 0,
          impactLabel: '',
          evidence: '绑定后生成岗位差距卡和今日任务',
          path: '/user/jobs',
        },
        subs: [],
      };
    }

    // ── 有效技能画像（用于缺口计算，失败时降级为空画像）──
    let effectiveSkills: Array<{ name: string; masteryPct: number }> = [];
    try {
      effectiveSkills = await this.skillService.getEffectiveSkills(userId);
    } catch {
      effectiveSkills = [];
    }
    const skillMap = new Map(
      effectiveSkills.map((s) => [s.name.toLowerCase(), s.masteryPct || 0]),
    );

    // ── 岗位必备缺口（按缺口深度排序：掌握度/门槛 最小者优先）──
    const required = (job.requiredSkills || []).map((s: any) => ({
      name: typeof s === 'string' ? s : s.name || '',
      minLevel: Number(typeof s === 'string' ? 60 : s.minLevel ?? 60) || 60,
    }));
    const preferred = (job.preferredSkills || []).map((s: any) =>
      typeof s === 'string' ? s : s.name || '',
    );
    const gaps = required
      .filter((s) => s.name && !((skillMap.get(s.name.toLowerCase()) ?? 0) >= s.minLevel))
      .map((s) => ({
        name: s.name,
        minLevel: s.minLevel,
        mastery: skillMap.get(s.name.toLowerCase()) ?? 0,
      }))
      .sort((a, b) => {
        const gapA = (a.minLevel - a.mastery) / Math.max(1, a.minLevel);
        const gapB = (b.minLevel - b.mastery) / Math.max(1, b.minLevel);
        return gapB - gapA;
      });

    const mainGap = gaps[0] || null;
    const subCandidates: any[] = [];

    // ── 辅助候选 1：学习计划中未完成的任务（继续推进）──
    let pendingTodayTask: { id: number; title: string; taskType: string; status: string; estimatedMin: number } | null = null;
    try {
      const schedulerResult = await this.taskScheduler.getTodayTasks(userId);
      const allTasks = [...schedulerResult.mainTasks, ...schedulerResult.sideTasks];
      const pending =
        allTasks.find((t) => !['done', 'exam_done', 'lecture_done', 'practice_done', 'code_done'].includes(t.taskStatus)) || null;
      pendingTodayTask = pending
        ? {
            id: pending.id,
            title: pending.skillName,
            taskType: pending.taskType,
            status: pending.taskStatus,
            estimatedMin: pending.estimatedMin || 25,
          }
        : null;
    } catch {
      pendingTodayTask = null;
    }
    if (pendingTodayTask) {
      subCandidates.push({
        id: pendingTodayTask.id,
        title: pendingTodayTask.title,
        taskType: 'continue',
        estimatedMin: pendingTodayTask.estimatedMin || 25,
        reason: '学习计划中的未完成任务，继续推进保持节奏。',
        estimatedImpact: 1,
        impactLabel: '匹配度预计 +1%',
        evidence: '完成后更新任务状态并记录学习 commit',
        path: '/user/learning',
      });
    }

    // ── 辅助候选 2：最近测评薄弱点（速测验证）──
    let weakPoint: { skill: string; score: number } | null = null;
    try {
      const recentResults = await this.evalResultRepo.find({
        where: { userId },
        order: { createTime: 'DESC' },
        take: 30,
      });
      // 优先取最近失败项，其次取任意低分项
      const weak =
        recentResults.find(
          (r) => r.skillName && r.passed === 0 && Number(r.normalizedScore ?? 0) < 60,
        ) ||
        recentResults.find(
          (r) => r.skillName && Number(r.normalizedScore ?? 0) < 60,
        );
      if (weak) weakPoint = { skill: weak.skillName, score: Number(weak.normalizedScore) };
    } catch {
      weakPoint = null;
    }
    if (weakPoint && !subCandidates.some((s) => s.title.includes(weakPoint!.skill))) {
      subCandidates.push({
        id: 0,
        title: `速测验证 ${weakPoint.skill}`,
        taskType: 'quick-test',
        estimatedMin: 10,
        reason: `上次测评中 ${weakPoint.skill} 表现偏弱（${weakPoint.score} 分），建议速测验证是否掌握。`,
        estimatedImpact: 2,
        impactLabel: '匹配度预计 +2%',
        evidence: '完成后测评结果进入技能证据链',
        path: '/user/quick-test',
      });
    }

    // ── 主任务：最低掌握度的必备缺口 → 学习；无缺口 → 项目/复习兜底 ──
    let main: any;
    if (mainGap) {
      const gapPct = mainGap.minLevel - mainGap.mastery;
      const impact = Math.min(5, Math.max(1, Math.round(gapPct / 20)));
      // P1-3 / §8.4：推荐理由引用证据覆盖状态
      let evidenceNote = '';
      try {
        const hits = await this.evidenceRag.search(userId, mainGap.name, { skill: mainGap.name, limit: 1 });
        evidenceNote =
          hits.length > 0
            ? `已有 ${hits.length} 条相关证据（${hits[0].title}），完成本任务后可直接强化该证据表达。`
            : '暂无相关证据，完成学习后可保存项目或测评补上证据。';
      } catch {
        evidenceNote = '';
      }
      main = {
        id: 0,
        title: `学习 ${mainGap.name} 并完成练习`,
        taskType: 'learning',
        estimatedMin: 25,
        reason: `目标岗位要求 ${mainGap.name}（门槛 ${mainGap.minLevel}%），你当前掌握度 ${mainGap.mastery}%。${evidenceNote}`,
        estimatedImpact: impact,
        impactLabel: `匹配度预计 +${impact}%`,
        evidence: '完成后生成学习 commit 和技能 delta',
        path: '/user/learning',
      };
    } else {
      // 必备已覆盖：优先补加分项 → 项目证据
      const preferredGap = preferred.find(
        (s: string) => !skillMap.has(s.toLowerCase()),
      );
      if (preferredGap) {
        main = {
          id: 0,
          title: `做一个小项目：体现 ${preferredGap}`,
          taskType: 'project',
          estimatedMin: 45,
          reason: `必备技能已覆盖，用项目补齐加分项 ${preferredGap} 并沉淀简历证据。`,
          estimatedImpact: 4,
          impactLabel: '匹配度预计 +4%',
          evidence: '完成后项目经历可绑定技能并写入简历',
          path: '/user/projects',
        };
      } else {
        main = {
          id: 0,
          title: '复习已学技能并做一次速测',
          taskType: 'review',
          estimatedMin: 15,
          reason: '核心技能已达标，低成本复习保持学习活跃度与匹配度。',
          estimatedImpact: 1,
          impactLabel: '匹配度预计 +1%',
          evidence: '完成后刷新学习活跃度并记录 commit',
          path: '/user/quick-test',
        };
      }
    }

    return { main, subs: subCandidates.slice(0, 2) };
  }

  /**
   * 阶段成长报告 — GET /api/user/growth-report?days=7|30（P2-2）
   *
   * 对齐《ZhiPath_产品业务升级方案》P2-2：
   *   - 近 N 天学习记录（commit 时间线、任务完成、学习时长）
   *   - 技能变化（从 commit delta 聚合）
   *   - 测评表现（次数 / 达标率 / 平均分 / 趋势）
   *   - 岗位匹配变化（窗口内 delta + 当前最佳匹配）
   *   - 下一步建议（规则生成，不依赖大模型）
   *
   * 先做页面报告，不急于 PDF。
   */
  async getGrowthReport(userId: number, days: number) {
    const daysNum = days === 7 ? 7 : 30;
    const since = Date.now() - daysNum * 86400000;
    const sinceDate = new Date(since).toISOString().slice(0, 10);

    // ── 1. commits（近 N 天，非 baseline）──
    const commits = await this.commitRepo.find({
      where: { userId, status: 1 },
      order: { createTime: 'DESC' },
    });
    const recentCommits = commits.filter(
      (c) => Number(c.createTime || 0) >= since && c.commitType !== 'baseline',
    );

    // ── 2. 任务统计（近 N 天按 planDate）──
    const allTasks = await this.taskRepo.find({ where: { userId, isActive: 1 } });
    const recentTasks = allTasks.filter((t) => t.planDate && t.planDate >= sinceDate);
    const DONE = ['done', 'exam_done', 'lecture_done', 'practice_done', 'code_done'];
    const doneTasks = recentTasks.filter((t) => DONE.includes(t.taskStatus));
    const learnedMin = doneTasks.reduce((sum, t) => sum + (t.actualMin || t.estimatedMin || 0), 0);
    const learningDays = new Set(doneTasks.map((t) => t.planDate).filter(Boolean)).size;

    // ── 3. 技能变化（commit deltaJson 聚合，按首末 after-before）──
    const skillAgg = new Map<string, { from: number; to: number }>();
    for (const c of recentCommits) {
      const changes = (c.deltaJson?.skillChanges || []) as Array<Record<string, any>>;
      for (const ch of changes) {
        const name = String(ch.name || '').trim();
        if (!name) continue;
        const cur = skillAgg.get(name) || { from: Number(ch.before) || 0, to: Number(ch.before) || 0 };
        cur.to = Number(ch.after) || cur.to;
        skillAgg.set(name, cur);
      }
    }
    const skillChanges = [...skillAgg.entries()]
      .map(([skill, v]) => ({
        skill,
        from: Math.round(v.from * 10) / 10,
        to: Math.round(v.to * 10) / 10,
        delta: Math.round((v.to - v.from) * 10) / 10,
      }))
      .filter((s) => Math.abs(s.delta) > 0.01)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);

    // ── 4. 测评表现（近 N 天）──
    const evalResults = await this.evalResultRepo.find({
      where: { userId, status: 1 },
      order: { createTime: 'DESC' },
    });
    const recentEvals = evalResults.filter((r) => Number(r.createTime || 0) >= since);
    const evalPassed = recentEvals.filter(
      (r) => r.passed === 1 || Number(r.normalizedScore ?? r.score ?? 0) >= 60,
    ).length;
    const avgExamScore =
      recentEvals.length > 0
        ? Math.round(
            recentEvals.reduce((sum, r) => sum + Number(r.normalizedScore ?? r.score ?? 0), 0) /
              recentEvals.length *
              10,
          ) / 10
        : 0;
    const examTrend = recentEvals.slice(0, 10).map((r) => ({
      date: new Date(Number(r.createTime)).toISOString().slice(0, 10),
      skillName: r.skillName,
      score: Number(r.normalizedScore ?? r.score ?? 0),
      passed: r.passed === 1 || Number(r.normalizedScore ?? r.score ?? 0) >= 60,
    }));

    // ── 5. 岗位匹配变化 ──
    let matchDelta = 0;
    for (const c of recentCommits) {
      matchDelta += Number(c.deltaJson?.metricsChange?.matchScore || 0);
    }
    matchDelta = Math.round(matchDelta * 10) / 10;
    let matchNow = 0;
    let jobTitle = '';
    try {
      const best = await this.matchAgent.getBestMatch(userId);
      if (best) {
        matchNow = Math.round(best.matchScore * 10) / 10;
        jobTitle = best.jobTitle || '';
      }
    } catch {
      matchNow = 0;
    }
    const matchBefore = Math.round((matchNow - matchDelta) * 10) / 10;

    // ── 6. commit 时间线（最近 10 条）──
    const commitTimeline = recentCommits.slice(0, 10).map((c) => ({
      commitId: c.id,
      type: c.commitType,
      message: c.message,
      skillName: c.skillName,
      delta: (() => {
        const changes = (c.deltaJson?.skillChanges || []) as Array<Record<string, any>>;
        const skillChange = changes.find((ch) => ch.name === c.skillName) || changes[0];
        return skillChange ? Math.round(Number(skillChange.delta || 0) * 10) / 10 : 0;
      })(),
      time: Number(c.createTime || 0),
    }));

    // ── 7. 下一步建议（规则生成）──
    const recommendations: string[] = [];
    const taskRate = recentTasks.length > 0 ? Math.round((doneTasks.length / recentTasks.length) * 100) : 0;
    const evalPassRate = recentEvals.length > 0 ? Math.round((evalPassed / recentEvals.length) * 100) : 0;

    if (recentCommits.length === 0 && recentTasks.length === 0) {
      recommendations.push(`近 ${daysNum} 天还没有学习记录，先完成今日 1 个任务重新进入节奏。`);
    }
    if (skillChanges.length > 0) {
      const top = skillChanges
        .filter((s) => s.delta > 0)
        .slice(0, 3)
        .map((s) => `${s.skill}+${s.delta}%`)
        .join('、');
      if (top) recommendations.push(`技能提升集中在 ${top}，建议继续保持当前学习节奏。`);
      const decl = skillChanges.filter((s) => s.delta < 0).slice(0, 2);
      if (decl.length > 0) {
        recommendations.push(`${decl.map((s) => s.skill).join('、')} 掌握度下降，建议安排一次复习和速测巩固。`);
      }
    } else if (recentCommits.length > 0) {
      recommendations.push('学习有推进但技能数据变化不明显，建议做一次测评把学习成果沉淀为证据。');
    }
    if (recentEvals.length > 0 && evalPassRate < 60) {
      recommendations.push(`近期测评达标率偏低（${evalPassRate}%），建议先针对薄弱技能速测验证，再进入新主题。`);
    }
    if (recentTasks.length >= 3 && taskRate < 50) {
      recommendations.push(`任务完成率 ${taskRate}%，建议在计划设置中调低每日任务量，减少并行任务。`);
    }
    if (matchDelta !== 0) {
      recommendations.push(
        matchDelta > 0
          ? `${jobTitle || '目标岗位'}匹配度提升 ${matchDelta >= 0 ? '+' : ''}${matchDelta}%（${matchBefore}% → ${matchNow}%），可更新岗位版简历表达。`
          : `匹配度下降 ${Math.abs(matchDelta)}%（${matchBefore}% → ${matchNow}%），优先补齐岗位必备技能缺口。`,
      );
    } else if (matchNow > 0) {
      recommendations.push(`匹配度保持 ${matchNow}%（${jobTitle || '目标岗位'}），下一步建议补项目证据或优化简历表达。`);
    }
    if (recommendations.length === 0) {
      recommendations.push(`近 ${daysNum} 天数据较少，先完成画像、选择目标岗位并开始第一个学习任务。`);
    }

    return {
      days: daysNum,
      period: {
        start: new Date(since).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
      },
      summary: {
        learningDays,
        commits: recentCommits.length,
        tasksDone: doneTasks.length,
        totalTasks: recentTasks.length,
        taskRate,
        learnedMin,
        examCount: recentEvals.length,
        examPassRate: evalPassRate,
        avgExamScore,
        matchDelta,
        matchBefore,
        matchNow,
        jobTitle,
      },
      skillChanges,
      examTrend,
      commitTimeline,
      recommendations: recommendations.slice(0, 5),
    };
  }

  private buildGoldenPath(input: {
    student: any;
    targetJob: any;
    learningPath: any;
    todayTasks: any[];
    totalSkills: number;
    doneSkills: number;
    examCount: number;
    resourceSuccessCount: number;
    resumeCount: number;
  }) {
    const hasTargetJob = Boolean(input.targetJob);
    const hasLearningPlan = Boolean(input.learningPath);
    const hasSkillProgress = input.doneSkills > 0 || input.examCount > 0;
    const steps = [
      {
        key: 'onboarding',
        label: 'Onboarding',
        path: '/onboarding',
        completed: Boolean(input.student?.onboardingCompleted),
        summary: input.student?.onboardingCompleted ? '基础画像已建立' : '先补齐专业、方向、技能和学习时间',
      },
      {
        key: 'target_job',
        label: '目标岗位',
        path: '/user/jobs',
        completed: hasTargetJob,
        summary: hasTargetJob ? input.targetJob.title : '选择一个岗位作为学习主线',
      },
      {
        key: 'gap_analysis',
        label: '差距分析',
        path: hasTargetJob ? `/user/jobs/${input.targetJob.id}` : '/user/jobs',
        completed: hasTargetJob,
        summary: hasTargetJob ? `当前匹配度 ${Math.round(Number(input.targetJob.matchScore || 0))}%` : '选定岗位后查看技能差距',
      },
      {
        key: 'learning_plan',
        label: '学习计划',
        path: hasLearningPlan ? '/user/learning' : '/plan/create',
        completed: hasLearningPlan,
        summary: hasLearningPlan ? `${input.learningPath.planName} · ${input.totalSkills} 个能力点` : '围绕目标岗位生成主线计划',
      },
      {
        key: 'generate_resource',
        label: '生成资源',
        path: '/user/agent-office',
        completed: input.resourceSuccessCount > 0,
        summary: input.resourceSuccessCount > 0 ? `已生成 ${input.resourceSuccessCount} 个资源` : '用智能体生成讲义、题目或代码案例',
      },
      {
        key: 'assessment',
        label: '测评',
        path: '/user/quick-test',
        completed: input.examCount > 0,
        summary: input.examCount > 0 ? `已完成 ${input.examCount} 次测评` : '完成一次速测建立能力证据',
      },
      {
        key: 'profile_change',
        label: '画像变化',
        path: '/user/progress',
        completed: hasSkillProgress,
        summary: hasSkillProgress ? `已掌握 ${input.doneSkills}/${input.totalSkills} 个能力点` : '测评或学习完成后沉淀画像变化',
      },
      {
        key: 'match_change',
        label: '岗位匹配变化',
        path: hasTargetJob ? `/user/jobs/${input.targetJob.id}` : '/user/jobs',
        completed: hasTargetJob && hasSkillProgress,
        summary: hasTargetJob && hasSkillProgress ? '画像变化已进入岗位匹配计算' : '画像更新后复查岗位匹配度',
      },
      {
        key: 'resume_advice',
        label: '简历建议',
        path: '/user/resume',
        completed: input.resumeCount > 0,
        summary: input.resumeCount > 0 ? `已有 ${input.resumeCount} 份简历版本` : '把目标岗位差距转成简历优化建议',
      },
    ];
    const current = steps.find((step) => !step.completed) || null;
    const completedCount = steps.filter((step) => step.completed).length;
    return {
      steps: steps.map((step) => ({ ...step, current: current?.key === step.key })),
      completedCount,
      totalCount: steps.length,
      completionRate: percent(completedCount, steps.length),
      currentKey: current?.key || null,
      nextAction: current
        ? { label: current.label, path: current.path, summary: current.summary }
        : { label: '复盘并投递', path: '/user/jobs', summary: '黄金路径已完成，可以进入岗位投递和面试准备' },
    };
  }
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}
