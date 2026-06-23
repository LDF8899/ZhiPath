import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { UserSkill } from '../../entities/user-skills.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { LearningTask } from '../../entities/learning-tasks.entity';
import { JobPosition } from '../../entities/job.entity';
import { ProfileService } from '../../services/profile.service';
import { SkillService } from '../../services/skill.service';
import { PlannerAgentService } from '../../services/planner-agent.service';
import { QueueService } from '../queue/queue.service';
import { getPlanTemplate } from './plan-templates';

/**
 * Student 服务 — 对齐 Python api/user/profile.py + api/user/onboarding.py
 */
@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(UserSkill) private userSkillRepo: Repository<UserSkill>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    @InjectRepository(LearningTask) private taskRepo: Repository<LearningTask>,
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    private profileService: ProfileService,
    private skillService: SkillService,
    private plannerAgent: PlannerAgentService,
    private queueService: QueueService,
  ) {}

  /** 根据 userId 获取学生信息 */
  async getByUserId(userId: number): Promise<Student | null> {
    return this.studentRepo.findOne({ where: { userId, status: 1 } });
  }

  /** 获取用户画像（合并 MySQL + MongoDB） — 对齐 GET /api/user/profile */
  async getProfile(userId: number) {
    const student = await this.getByUserId(userId);
    const mongoProfile = await this.profileService.getProfile(userId);

    return {
      userId,
      username: '',
      realName: student?.name || '',
      phone: '',
      email: '',
      avatar: '',
      studentId: student?.id,
      name: student?.name || '',
      school: student?.school || '',
      studentNo: student?.studentNo || '',
      major: student?.major || '',
      grade: student?.grade || '',
      skills: student?.skills || [],
      targetJobId: student?.targetJobId,
      dailyHours: student?.dailyHours,
      interests: student?.interests || [],
      onboardingCompleted: student?.onboardingCompleted || 0,
      projects: student?.projects || [],
      profile_version: mongoProfile?.version || 0,
      traits: mongoProfile?.traits || {},
      chat_insights: mongoProfile?.chat_insights || [],
      goals: mongoProfile?.goals || {},
    };
  }

  /** 更新用户画像 — 对齐 PUT /api/user/profile */
  async updateProfile(userId: number, data: Record<string, any>) {
    const student = await this.getByUserId(userId);
    if (!student) return null;

    // 更新 MySQL 字段
    const updateData: Partial<Student> = {};
    if (data.realName) updateData.name = data.realName;
    if (data.major) updateData.major = data.major;
    if (data.grade) updateData.grade = data.grade;
    if (data.skills) updateData.skills = data.skills;
    if (data.targetJobId) updateData.targetJobId = data.targetJobId;

    if (Object.keys(updateData).length > 0) {
      await this.studentRepo.update(student.id, updateData);
    }

    return this.getProfile(userId);
  }

  /** 提交 Onboarding — 只保存个人资料，不创建计划 */
  async submitOnboarding(userId: number, data: Record<string, any>) {
    const now = Date.now();
    let student = await this.getByUserId(userId);

    // 1. 创建/更新学生记录
    if (!student) {
      student = await this.studentRepo.save({
        userId,
        name: data.name || '',
        school: data.school || '',
        major: data.major || '',
        grade: data.grade || '',
        interests: data.direction ? [data.direction] : [],
        dailyHours: data.dailyHours || 2,
        skills: data.skills || [],
        onboardingCompleted: 1,
        createTime: now,
        updateTime: now,
        status: 1,
      });
    } else {
      await this.studentRepo.update(student.id, {
        name: data.name || student.name,
        school: data.school || student.school,
        major: data.major || student.major,
        grade: data.grade || student.grade,
        interests: data.direction ? [data.direction] : student.interests,
        dailyHours: data.dailyHours || student.dailyHours,
        skills: data.skills || student.skills,
        onboardingCompleted: 1,
        updateTime: now,
      });
    }

    // 2. 写入 user_skills_v3（通过 SkillService）
    if (data.skills?.length) {
      const levelToTrust: Record<string, number> = { '了解': 0.3, '熟悉': 0.5, '熟练': 0.7 };
      // 先删除旧的 self_report 技能
      const oldSkills = await this.userSkillRepo.find({ where: { userId, source: 'self_report' } });
      if (oldSkills.length) {
        await this.userSkillRepo.delete({ userId, source: 'self_report' });
      }
      // 通过 SkillService 写入
      await this.skillService.addSkills(
        userId,
        data.skills.map((s: any) => ({
          name: s.name,
          source: 'self_report' as const,
          trustWeight: levelToTrust[s.level] || 0.3,
          masteryPct: 0,
        })),
      );
    }

    // 3. 同步到 MongoDB
    await this.profileService.syncBasicFromMySQL(userId, {
      school: data.school || '',
      major: data.major || '',
      grade: data.grade || '',
      direction: data.direction || '',
      dailyHours: data.dailyHours || 2,
    });

    if (data.skills?.length) {
      await this.profileService.updateSkills(userId, data.skills);
    }

    return { completed: true };
  }

  /** 创建学习计划 — 使用 PlannerAgent 生成 */
  async createPlan(userId: number, data: { direction: string; dailyHours?: number; importFromPlanId?: number }) {
    const now = Date.now();
    const student = await this.getByUserId(userId);
    if (!student) throw new Error('请先完成个人信息填写');

    const direction = data.direction || 'frontend';
    const template = getPlanTemplate(direction);
    const dailyHours = data.dailyHours || student.dailyHours || 2;

    // 查找目标岗位
    const targetJob = await this.jobRepo.findOne({
      where: { title: template.targetJobTitle, status: 1 },
      order: { id: 'ASC' },
    });

    // 更新学生的 targetJobId 和 interests
    await this.studentRepo.update(student.id, {
      targetJobId: targetJob?.id || student.targetJobId,
      interests: [direction],
      dailyHours,
      updateTime: now,
    });

    // 使用 PlannerAgent 生成路径（如果岗位有技能数据则智能生成，否则用模板）
    let plan: any;
    let tasks: any[] = [];
    let gapSkills: string[] = [];

    if (targetJob?.requiredSkills?.length) {
      // 智能生成
      const result = await this.plannerAgent.generatePath(userId, targetJob.id, dailyHours);
      plan = result.plan;
      tasks = result.tasks;
      gapSkills = result.gapSkills;
    } else {
      // 使用模板生成（向后兼容）
      const totalDays = template.estimatedDays;
      const estimatedDate = new Date(now + totalDays * 86400000).toISOString().slice(0, 10);

      const pathData = {
        direction,
        phases: template.phases.map((phase, idx) => ({
          name: phase.name,
          index: idx,
          skills: phase.skills.map((sk) => ({
            name: sk.name,
            estimatedMin: sk.estimatedMin,
            priority: sk.priority,
            status: 'pending',
          })),
        })),
      };

      // 如果要从旧计划导入技能进度
      if (data.importFromPlanId) {
        const oldPlan = await this.planRepo.findOne({ where: { id: data.importFromPlanId, userId, status: 1 } });
        if (oldPlan?.pathData?.phases) {
          const oldSkillsDone = new Set<string>();
          for (const phase of oldPlan.pathData.phases) {
            for (const skill of phase.skills || []) {
              if (skill.status === 'done') oldSkillsDone.add(skill.name);
            }
          }
          for (const phase of pathData.phases) {
            for (const skill of phase.skills) {
              if (oldSkillsDone.has(skill.name)) {
                skill.status = 'done';
              }
            }
          }
        }
      }

      plan = await this.planRepo.save({
        userId,
        planName: template.planName,
        planType: 'main',
        targetJobId: targetJob?.id || null,
        pathData,
        currentPhase: 0,
        dailyHours,
        mainRatio: 80,
        matchScore: 0,
        estimatedDate,
        createTime: now,
        updateTime: now,
        status: 1,
      });

      // 生成第一天的学习任务
      const availableMinutes = dailyHours * 60 * 0.8;
      const firstPhase = template.phases[0];
      const taskEntities: Partial<LearningTask>[] = [];
      let usedMinutes = 0;

      for (let i = 0; i < firstPhase.skills.length; i++) {
        const sk = firstPhase.skills[i];
        if (usedMinutes + sk.estimatedMin > availableMinutes && taskEntities.length > 0) break;
        taskEntities.push({
          userId,
          planId: plan.id,
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

      if (taskEntities.length > 0) {
        tasks = await this.taskRepo.save(taskEntities);
      }

      // §5.2 计划创建后异步提交资源生成任务（队列故障不阻塞 onboarding）
      try {
        await this.queueService.addResourceTask(userId, 'path_resources', { pathData });
      } catch (e: any) {
        console.warn('[Student] enqueue path_resources failed (resources will lazy-generate):', e.message);
      }
    }

    // 同步目标到 MongoDB
    await this.profileService.mergeProfileDelta(userId, {
      goals_to_update: {
        target_direction: direction,
        target_job_id: targetJob?.id,
        target_job_title: template.targetJobTitle,
        daily_hours: dailyHours,
        estimated_date: plan.estimatedDate,
      },
    }, 'plan_create');

    return {
      id: plan.id,
      planName: plan.planName,
      estimatedDate: plan.estimatedDate,
      totalSkills: (plan.pathData?.phases || []).reduce((sum: number, p: any) => sum + (p.skills?.length || 0), 0),
      gapSkills,
      todayTasks: tasks.map((t) => ({
        skillName: t.skillName,
        estimatedMin: t.estimatedMin,
        taskType: t.taskType,
      })),
    };
  }

  /** 获取用户所有计划 */
  async getMyPlans(userId: number) {
    const plans = await this.planRepo.find({
      where: { userId, status: 1 },
      order: { planType: 'ASC', createTime: 'DESC' },
    });

    return plans.map((p) => {
      const phases = p.pathData?.phases || [];
      const totalSkills = phases.reduce((sum: number, ph: any) => sum + (ph.skills?.length || 0), 0);
      const doneSkills = phases.reduce(
        (sum: number, ph: any) => sum + (ph.skills?.filter((s: any) => s.status === 'done').length || 0), 0,
      );
      return {
        id: p.id,
        planName: p.planName,
        planType: p.planType,
        targetJobId: p.targetJobId,
        currentPhase: p.currentPhase,
        dailyHours: Number(p.dailyHours) || 0,
        estimatedDate: p.estimatedDate || '',
        totalSkills,
        doneSkills,
        matchScore: Number(p.matchScore) || 0,
      };
    });
  }

  /** 获取 Onboarding 状态 */
  async getOnboardingStatus(userId: number) {
    const student = await this.getByUserId(userId);
    return { completed: student?.onboardingCompleted === 1 };
  }
}
