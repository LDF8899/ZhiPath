import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { UserSkill } from '../../entities/user-skills.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { JobPosition } from '../../entities/job.entity';
import { ProfileService } from '../../services/profile.service';
import { SkillService } from '../../services/skill.service';
import { PlannerAgentService } from '../../services/planner-agent.service';
import { getPlanTemplate } from './plan-templates';
import { BranchService } from '../../services/branch.service';
import { SkillSnapshotService } from '../../services/skill-snapshot.service';
import { LearningDomainRegistry } from '../../domains/learning-domain.registry';
import type { LearningGoalType } from '../../domains/learning-domain.types';

/**
 * Student 服务 — 对齐 Python api/user/profile.py + api/user/onboarding.py
 */
@Injectable()
export class StudentService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(UserSkill) private userSkillRepo: Repository<UserSkill>,
    @InjectRepository(LearningPlan) private planRepo: Repository<LearningPlan>,
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    private profileService: ProfileService,
    private skillService: SkillService,
    private plannerAgent: PlannerAgentService,
    private branchService: BranchService,
    private snapshotService: SkillSnapshotService,
    private domainRegistry: LearningDomainRegistry,
  ) {}

  /** 根据 userId 获取学生信息 */
  async getByUserId(userId: number): Promise<Student | null> {
    return this.studentRepo.findOne({ where: { userId, status: 1 } });
  }

  /** 获取用户画像（合并 MySQL + MongoDB） — 对齐 GET /api/user/profile */
  async getProfile(userId: number) {
    const student = await this.getByUserId(userId);
    const mongoProfile = await this.profileService.getProfile(userId);
    const gitProfile = await this.getGitProfileState(userId);

    return {
      userId,
      username: '',
      realName: student?.name || '',
      phone: student?.phone || '',
      email: student?.email || '',
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
      radarDimensions: gitProfile.radarDimensions,
      abilityMetrics: gitProfile.abilityMetrics,
      latestSnapshot: gitProfile.latestSnapshot,
      activeBranch: gitProfile.activeBranch,
    };
  }

  async getRadarProfile(userId: number) {
    const gitProfile = await this.getGitProfileState(userId);
    return {
      radarDimensions: gitProfile.radarDimensions,
      latestSnapshot: gitProfile.latestSnapshot,
      activeBranch: gitProfile.activeBranch,
    };
  }

  async getAbilityMetrics(userId: number) {
    const gitProfile = await this.getGitProfileState(userId);
    return {
      abilityMetrics: gitProfile.abilityMetrics,
      latestSnapshot: gitProfile.latestSnapshot,
      activeBranch: gitProfile.activeBranch,
    };
  }

  private async getGitProfileState(userId: number) {
    const branches = await this.branchService.listBranches(userId);
    const activeBranch = branches.find((b) => b.branchType === 'main') || branches[0] || null;
    const latestSnapshot = activeBranch?.headCommitId
      ? await this.snapshotService.getSnapshotByCommit(userId, activeBranch.headCommitId)
      : null;
    return {
      activeBranch,
      latestSnapshot,
      radarDimensions: latestSnapshot?.radarJson || [],
      abilityMetrics: latestSnapshot?.abilityMetricsJson || null,
    };
  }

  /** 更新用户画像 — 对齐 PUT /api/user/profile */
  async updateProfile(userId: number, data: Record<string, any>) {
    const student = await this.getByUserId(userId);
    if (!student) return null;

    // 更新 MySQL 字段
    const updateData: Partial<Student> = {};
    if (data.name || data.realName) updateData.name = data.name || data.realName;
    if (data.school) updateData.school = data.school;
    if (data.major) updateData.major = data.major;
    if (data.grade) updateData.grade = data.grade;
    if (data.phone) updateData.phone = data.phone;
    if (data.email) updateData.email = data.email;
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
        interests: data.domainId || data.direction ? [data.domainId || data.direction] : [],
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
        interests: data.domainId || data.direction ? [data.domainId || data.direction] : student.interests,
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
      direction: data.domainId || data.direction || '',
      dailyHours: data.dailyHours || 2,
    });

    if (data.domainId && data.goalType) {
      await this.profileService.mergeProfileDelta(userId, {
        goals_to_update: {
          learning_domain_id: data.domainId,
          goal_type: data.goalType,
          goal_title: data.goalTitle || '',
          starter_path_id: data.starterPathId || '',
          daily_hours: data.dailyHours || 2,
        },
      }, 'onboarding_learning_goal');
    }

    if (data.skills?.length) {
      await this.profileService.updateSkills(userId, data.skills);
    }

    return { completed: true };
  }

  /** 创建计划：岗位主线绑定岗位，自选计划只绑定用户目标。 */
  async createPlan(userId: number, data: {
    planType?: 'main' | 'side';
    direction?: string;
    planName?: string;
    skills?: string[];
    targetJobId?: number;
    dailyHours?: number;
    importFromPlanId?: number;
    domainId?: string;
    goalType?: LearningGoalType;
    goalTitle?: string;
    starterPathId?: string;
  }) {
    const now = Date.now();
    const student = await this.getByUserId(userId);
    if (!student) throw new Error('请先完成个人信息填写');

    const planType = data.planType || 'main';
    const direction = data.direction || student.interests?.[0] || 'frontend';
    const dailyHours = Math.max(0.5, Math.min(8, Number(data.dailyHours || student.dailyHours || 2)));
    let targetJob: JobPosition | null = null;
    let customSkills: string[] | undefined;
    let result: Awaited<ReturnType<PlannerAgentService['generatePath']>>;
    const isDomainPlan = Boolean(data.domainId || data.starterPathId || (data.goalType && data.goalType !== 'career'));

    if (isDomainPlan) {
      if (!data.domainId || !data.goalType || !data.starterPathId) {
        throw new Error('请选择完整的学习领域、目标类型和起步路线');
      }
      const { domain, starterPath } = this.domainRegistry.resolvePath(
        data.domainId,
        data.goalType,
        data.starterPathId,
      );
      const goalTitle = data.goalTitle?.trim() || data.planName?.trim() || starterPath.title;
      result = await this.plannerAgent.generateDomainPath(
        userId,
        domain,
        starterPath,
        data.goalType,
        goalTitle,
        dailyHours,
        planType,
      );
    } else {
      if (planType === 'main') {
        if (data.targetJobId) {
          targetJob = await this.jobRepo.findOne({ where: { id: data.targetJobId, status: 1 } });
        } else {
          const template = getPlanTemplate(direction);
          targetJob = await this.jobRepo.findOne({
            where: { title: template.targetJobTitle, status: 1 },
            order: { id: 'ASC' },
          });
        }
        if (!targetJob) throw new Error('岗位驱动计划必须选择一个有效岗位');
      } else {
        customSkills = Array.from(new Set((data.skills || [])
          .map((skill) => String(skill).trim())
          .filter(Boolean)));
        if (customSkills.length === 0) {
          const fallback = data.planName?.trim() || direction.trim();
          if (!fallback) throw new Error('自选计划至少需要一个学习主题');
          customSkills = [fallback];
        }
      }
      result = await this.plannerAgent.generatePath(
        userId,
        targetJob?.id,
        dailyHours,
        customSkills,
        data.planName?.trim() || undefined,
        planType,
      );
    }

    if (data.importFromPlanId) {
      const oldPlan = await this.planRepo.findOne({ where: { id: data.importFromPlanId, userId, status: 1 } });
      const completed = new Set<string>();
      for (const phase of oldPlan?.pathData?.phases || []) {
        for (const skill of phase.skills || []) if (skill.status === 'done') completed.add(skill.name);
      }
      if (completed.size > 0 && result.plan.pathData?.phases) {
        for (const phase of result.plan.pathData.phases) {
          for (const skill of phase.skills || []) if (completed.has(skill.name)) skill.status = 'done';
        }
        result.plan.updateTime = now;
        await this.planRepo.save(result.plan);
      }
    }

    if (planType === 'main' && targetJob) {
      await this.studentRepo.update(student.id, {
        targetJobId: targetJob.id,
        interests: [direction],
        dailyHours,
        updateTime: now,
      });
      await this.profileService.mergeProfileDelta(userId, {
        goals_to_update: {
          target_direction: direction,
          target_job_id: targetJob.id,
          target_job_title: targetJob.title,
          daily_hours: dailyHours,
          estimated_date: result.plan.estimatedDate,
        },
      }, 'main_plan_create');
    }

    const branch = await this.branchService.ensurePlanBranch(userId, result.plan);
    return {
      id: result.plan.id,
      planName: result.plan.planName,
      planType: result.plan.planType,
      domainId: result.plan.domainId,
      goalType: result.plan.goalType,
      goalTitle: result.plan.goalTitle,
      branchId: branch.id,
      estimatedDate: result.plan.estimatedDate,
      totalSkills: (result.plan.pathData?.phases || []).reduce((sum: number, phase: any) => sum + (phase.skills?.length || 0), 0),
      gapSkills: result.gapSkills,
      todayTasks: result.tasks.map((task) => ({
        skillName: task.skillName,
        estimatedMin: task.estimatedMin,
        taskType: task.taskType,
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
        planStatus: p.planStatus,
        scheduleEnabled: p.scheduleEnabled === 1,
        targetJobId: p.targetJobId,
        domainId: p.domainId,
        goalType: p.goalType,
        goalTitle: p.goalTitle,
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
