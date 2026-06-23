import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { TaskSchedulerService } from '../../services/task-scheduler.service';
import { MatchAgentService } from '../../services/match-agent.service';

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
    private taskScheduler: TaskSchedulerService,
    private matchAgent: MatchAgentService,
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
    const examCount = await this.examRepo.count({ where: { userId, status: 1 } });
    const jobCount = await this.jobAppRepo.count({ where: { userId, status: 1 } });

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
    };
  }
}
