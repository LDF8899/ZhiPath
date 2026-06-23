import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosition } from '../entities/job.entity';
import { LearningPlan } from '../entities/learning.entity';
import { LearningTask } from '../entities/learning-tasks.entity';
import { Student } from '../entities/student.entity';
import { SkillService } from './skill.service';
import { getPlanTemplate } from '../modules/student/plan-templates';
import { QueueService } from '../modules/queue/queue.service';

/**
 * PlannerAgent — 学习路径 LLM 生成服务
 *
 * 对齐 CONSTITUTION.md §4 学习路径生成：
 *   1. 获取目标岗位必须技能（MySQL job_positions_v3）
 *   2. 获取用户已掌握技能（user_skills_v3）
 *   3. 计算技能差距
 *   4. 按依赖拓扑排序
 *   5. 按每日时长分配到阶段
 *   6. 生成日程表
 *   7. 写入 learning_plans_v3 + learning_tasks_v3
 *   8. 异步提交资源生成任务（§5.2 计划创建时异步生成）
 */
@Injectable()
export class PlannerAgentService {
  constructor(
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    @InjectRepository(LearningTask) private taskRepo: Repository<LearningTask>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private skillService: SkillService,
    private queueService: QueueService,
  ) {}

  /**
   * §5.2 计划创建后，异步提交资源生成任务到队列。
   * 队列不可用（Redis 故障）时不阻塞、不抛错，仅告警。
   */
  private async enqueuePathResources(userId: number, pathData: Record<string, any>): Promise<void> {
    try {
      await this.queueService.addResourceTask(userId, 'path_resources', { pathData });
    } catch (e: any) {
      console.warn('[PlannerAgent] enqueue path_resources failed (resources will lazy-generate):', e.message);
    }
  }

  /**
   * 生成学习路径（核心方法）
   *
   * @param userId 用户ID
   * @param targetJobId 目标岗位ID（可选，不传则从学生记录获取）
   * @param dailyHours 每日学习时长（可选，不传则从学生记录获取）
   * @returns 创建的计划 + 任务列表
   */
  async generatePath(
    userId: number,
    targetJobId?: number,
    dailyHours?: number,
  ): Promise<{ plan: LearningPlan; tasks: LearningTask[]; gapSkills: string[] }> {
    const now = Date.now();

    // 1. 获取学生信息
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    if (!student) throw new Error('用户未完成 Onboarding');

    const effectiveDailyHours = dailyHours || student.dailyHours || 2;
    const effectiveJobId = targetJobId || student.targetJobId;

    // 2. 获取目标岗位技能
    let requiredSkills: Array<{ name: string; weight?: number }> = [];
    let preferredSkills: Array<{ name: string; weight?: number }> = [];
    let jobTitle = '';
    let direction = student.interests?.[0] || 'frontend';

    if (effectiveJobId) {
      const job = await this.jobRepo.findOne({ where: { id: effectiveJobId, status: 1 } });
      if (job) {
        requiredSkills = job.requiredSkills || [];
        preferredSkills = job.preferredSkills || [];
        jobTitle = job.title || '';
        // 尝试从岗位标题推断方向
        direction = this.inferDirection(jobTitle);
      }
    }

    // 如果岗位没有技能数据，使用模板
    if (requiredSkills.length === 0) {
      const template = getPlanTemplate(direction);
      requiredSkills = template.phases.flatMap((p) => p.skills.map((s) => ({ name: s.name, weight: s.priority / 10 })));
      if (!jobTitle) jobTitle = template.targetJobTitle;
    }

    // 3. 获取用户已掌握技能
    const userSkills = await this.skillService.getEffectiveSkills(userId);
    const masteredSkills = new Set(
      userSkills.filter((s) => s.masteryPct >= 80).map((s) => s.name.toLowerCase()),
    );

    // 4. 计算技能差距
    const gapSkills: string[] = [];
    const gapWithWeight: Array<{ name: string; weight: number; isRequired: boolean }> = [];

    for (const skill of requiredSkills) {
      if (!masteredSkills.has(skill.name.toLowerCase())) {
        gapSkills.push(skill.name);
        gapWithWeight.push({ name: skill.name, weight: skill.weight || 0.8, isRequired: true });
      }
    }

    for (const skill of preferredSkills) {
      if (!masteredSkills.has(skill.name.toLowerCase())) {
        gapWithWeight.push({ name: skill.name, weight: skill.weight || 0.4, isRequired: false });
      }
    }

    // 5. 按依赖拓扑排序（简化版：按权重降序 + 必须技能优先）
    const sortedSkills = this.topologicalSort(gapWithWeight);

    // 6. 按每日时长分配到阶段
    const availableMinutesPerDay = effectiveDailyHours * 60;
    const mainRatio = 0.8; // 主线占比 80%
    const mainMinutesPerDay = availableMinutesPerDay * mainRatio;
    const sideMinutesPerDay = availableMinutesPerDay * (1 - mainRatio);

    const phases = this.allocateToPhases(sortedSkills, mainMinutesPerDay);

    // 7. 生成日程表
    const totalDays = this.estimateTotalDays(phases, mainMinutesPerDay);
    const estimatedDate = new Date(now + totalDays * 86400000).toISOString().slice(0, 10);

    // 8. 构建 pathData
    const pathData = {
      direction,
      jobTitle,
      gapSkills,
      phases: phases.map((phase, idx) => ({
        name: phase.name,
        index: idx,
        skills: phase.skills.map((sk) => ({
          name: sk.name,
          estimatedMin: sk.estimatedMin,
          priority: sk.priority,
          isRequired: sk.isRequired,
          status: 'pending',
        })),
      })),
    };

    // 9. 写入 learning_plans_v3
    const plan = await this.planRepo.save({
      userId,
      planName: `${jobTitle || direction}学习计划`,
      planType: 'main',
      targetJobId: effectiveJobId || null,
      pathData,
      currentPhase: 0,
      dailyHours: effectiveDailyHours,
      mainRatio: 80,
      matchScore: 0,
      estimatedDate,
      createTime: now,
      updateTime: now,
      status: 1,
    });

    // 10. 生成第一天的学习任务
    const tasks = await this.generateDailyTasks(plan.id, userId, phases, mainMinutesPerDay, now);

    // 11. §5.2 异步提交资源生成任务（讲义/题目/编程题）
    await this.enqueuePathResources(userId, pathData);

    return { plan, tasks, gapSkills };
  }

  /**
   * 调整学习路径（日时长/主线比例变化）
   */
  async adjustPath(
    planId: number,
    newDailyHours?: number,
    newMainRatio?: number,
  ): Promise<{ plan: LearningPlan; changes: string[] }> {
    const now = Date.now();
    const plan = await this.planRepo.findOne({ where: { id: planId, status: 1 } });
    if (!plan) throw new Error('计划不存在');

    const changes: string[] = [];
    const oldDailyHours = Number(plan.dailyHours) || 2;
    const oldMainRatio = Number(plan.mainRatio) || 80;

    const effectiveDailyHours = newDailyHours || oldDailyHours;
    const effectiveMainRatio = newMainRatio || oldMainRatio;

    if (newDailyHours && newDailyHours !== oldDailyHours) {
      changes.push(`每日学习时长：${oldDailyHours}h → ${newDailyHours}h`);
    }
    if (newMainRatio && newMainRatio !== oldMainRatio) {
      changes.push(`主线占比：${oldMainRatio}% → ${newMainRatio}%`);
    }

    // 重新计算日程
    const availableMinutesPerDay = effectiveDailyHours * 60;
    const mainMinutesPerDay = availableMinutesPerDay * (effectiveMainRatio / 100);
    const pathData = plan.pathData || {};
    const phases = pathData.phases || [];

    // 重新估算总天数
    const totalDays = this.estimateTotalDaysFromPathData(phases, mainMinutesPerDay);
    const estimatedDate = new Date(now + totalDays * 86400000).toISOString().slice(0, 10);

    if (estimatedDate !== plan.estimatedDate) {
      changes.push(`预计完成日期：${plan.estimatedDate} → ${estimatedDate}`);
    }

    // 更新计划
    plan.dailyHours = effectiveDailyHours;
    plan.mainRatio = effectiveMainRatio;
    plan.estimatedDate = estimatedDate;
    plan.updateTime = now;
    await this.planRepo.save(plan);

    return { plan, changes };
  }

  // ── 内部方法 ──────────────────────────────────

  /** 从岗位标题推断学习方向 */
  private inferDirection(jobTitle: string): string {
    const title = jobTitle.toLowerCase();
    if (title.includes('前端') || title.includes('frontend') || title.includes('react') || title.includes('vue')) return 'frontend';
    if (title.includes('后端') || title.includes('backend') || title.includes('java') || title.includes('spring')) return 'backend';
    if (title.includes('全栈') || title.includes('fullstack')) return 'fullstack';
    if (title.includes('移动') || title.includes('mobile') || title.includes('android') || title.includes('ios')) return 'mobile';
    if (title.includes('ai') || title.includes('机器学习') || title.includes('深度学习')) return 'ai';
    if (title.includes('数据') || title.includes('data') || title.includes('分析')) return 'data';
    if (title.includes('devops') || title.includes('运维')) return 'devops';
    if (title.includes('设计') || title.includes('ui') || title.includes('ux')) return 'design';
    return 'frontend'; // 默认
  }

  /** 拓扑排序（简化版：按权重降序 + 必须技能优先） */
  private topologicalSort(
    skills: Array<{ name: string; weight: number; isRequired: boolean }>,
  ): Array<{ name: string; weight: number; isRequired: boolean; priority: number }> {
    // 按必须技能优先 + 权重降序排序
    const sorted = [...skills].sort((a, b) => {
      if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
      return b.weight - a.weight;
    });

    // 分配优先级 1-10
    return sorted.map((s, i) => ({
      ...s,
      priority: Math.max(1, 10 - Math.floor((i / sorted.length) * 10)),
    }));
  }

  /** 将技能分配到阶段 */
  private allocateToPhases(
    skills: Array<{ name: string; weight: number; isRequired: boolean; priority: number }>,
    mainMinutesPerDay: number,
  ): Array<{ name: string; skills: Array<{ name: string; estimatedMin: number; priority: number; isRequired: boolean }> }> {
    if (skills.length === 0) return [];

    // 按每阶段 3-5 个技能分组
    const phaseSize = Math.max(3, Math.min(5, Math.ceil(skills.length / 3)));
    const phases: Array<{ name: string; skills: Array<{ name: string; estimatedMin: number; priority: number; isRequired: boolean }> }> = [];

    for (let i = 0; i < skills.length; i += phaseSize) {
      const phaseSkills = skills.slice(i, i + phaseSize);
      const phaseIndex = phases.length + 1;

      // 根据优先级估算时长（高优先级 = 更多时间）
      const phaseSkillsWithTime = phaseSkills.map((s) => ({
        name: s.name,
        estimatedMin: this.estimateSkillMinutes(s.priority, s.weight),
        priority: s.priority,
        isRequired: s.isRequired,
      }));

      phases.push({
        name: `阶段${phaseIndex}：${this.getPhaseName(phaseSkills, phaseIndex)}`,
        skills: phaseSkillsWithTime,
      });
    }

    return phases;
  }

  /** 根据优先级估算技能学习时长（分钟） */
  private estimateSkillMinutes(priority: number, weight: number): number {
    // 基础时长：60-300 分钟，按优先级缩放
    const base = 120;
    const priorityFactor = 0.5 + (priority / 10) * 1.5; // 0.5-2.0
    const weightFactor = 0.8 + weight * 0.4; // 0.8-1.2
    return Math.round(base * priorityFactor * weightFactor / 30) * 30; // 取整到30分钟
  }

  /** 生成阶段名称 */
  private getPhaseName(skills: Array<{ name: string }>, index: number): string {
    if (skills.length === 0) return `基础阶段`;
    const names = skills.slice(0, 2).map((s) => s.name);
    return `${names.join('+')}等${skills.length}项`;
  }

  /** 估算总天数 */
  private estimateTotalDays(
    phases: Array<{ name: string; skills: Array<{ estimatedMin: number }> }>,
    mainMinutesPerDay: number,
  ): number {
    let totalMinutes = 0;
    for (const phase of phases) {
      for (const skill of phase.skills) {
        totalMinutes += skill.estimatedMin;
      }
    }
    return Math.max(7, Math.ceil(totalMinutes / mainMinutesPerDay));
  }

  /** 从 pathData 估算总天数 */
  private estimateTotalDaysFromPathData(
    phases: Array<{ skills: Array<{ estimatedMin: number; status: string }> }>,
    mainMinutesPerDay: number,
  ): number {
    let remainingMinutes = 0;
    for (const phase of phases) {
      for (const skill of phase.skills) {
        if (skill.status !== 'done') {
          remainingMinutes += skill.estimatedMin || 120;
        }
      }
    }
    return Math.max(7, Math.ceil(remainingMinutes / mainMinutesPerDay));
  }

  /** 生成每日学习任务 */
  private async generateDailyTasks(
    planId: number,
    userId: number,
    phases: Array<{ name: string; skills: Array<{ name: string; estimatedMin: number; priority: number; isRequired: boolean }> }>,
    mainMinutesPerDay: number,
    now: number,
  ): Promise<LearningTask[]> {
    if (phases.length === 0) return [];

    const firstPhase = phases[0];
    const tasks: Partial<LearningTask>[] = [];
    let usedMinutes = 0;

    for (let i = 0; i < firstPhase.skills.length; i++) {
      const sk = firstPhase.skills[i];
      if (usedMinutes + sk.estimatedMin > mainMinutesPerDay && tasks.length > 0) break;

      tasks.push({
        userId,
        planId,
        skillName: sk.name,
        taskType: 'main',
        taskStatus: 'pending',
        estimatedMin: sk.estimatedMin,
        priority: sk.priority,
        sortOrder: i,
        planDate: new Date().toISOString().slice(0, 10),
        isActive: 1,
        status: 1,
        createTime: now,
        updateTime: now,
      });

      usedMinutes += sk.estimatedMin;
    }

    if (tasks.length === 0) return [];

    return this.taskRepo.save(tasks);
  }
}
