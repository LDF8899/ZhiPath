import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningPlan } from '../../entities/learning.entity';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { KnowledgeBaseService } from '../../services/knowledge-base.service';
import { LectureAgentService, CodeAgentService, ReadingAgentService } from '../../services/agents';
import { AgentTaskService } from '../../services/agent-task.service';
import { AgentProfileService } from '../../services/agent-profile.service';
import { GeneratedResourceService } from '../../services/generated-resource.service';
import { BranchService } from '../../services/branch.service';

/**
 * Learning Paths 服务 — 对齐 Python api/user/learning_paths.py
 */
@Injectable()
export class LearningPathsService {
  /** 正在生成中的技能集合（防重入） */
  private generatingSkills = new Set<string>();

  constructor(
    @InjectRepository(LearningPlan) private pathRepo: Repository<LearningPlan>,
    @InjectConnection() private mongoConnection: Connection,
    private knowledgeService: KnowledgeBaseService,
    private lectureAgent: LectureAgentService,
    private codeAgent: CodeAgentService,
    private readingAgent: ReadingAgentService,
    private taskService: AgentTaskService,
    private profileService: AgentProfileService,
    private generatedResources: GeneratedResourceService,
    private branchService: BranchService,
  ) {}

  /** 学习路径列表 — 对齐 GET /api/user/learning-paths */
  async getPaths(userId: number, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.pathRepo.findAndCount({
      where: { userId: userId, status: 1 },
      order: { createTime: 'DESC' },
      skip,
      take: pageSize,
    });
    const list = await Promise.all(items.map(async (plan) => {
      const branch = await this.branchService.ensurePlanBranch(userId, plan);
      return { ...plan, branchId: branch.id };
    }));
    return { list, total, page, pageSize };
  }

  /** 单条路径 — 对齐 GET /api/user/learning-paths/:pathId */
  async getPath(userId: number, pathId: number) {
    const plan = await this.pathRepo.findOne({ where: { id: pathId, userId, status: 1 } });
    if (!plan) throw new NotFoundException('学习计划不存在');
    const branch = await this.branchService.ensurePlanBranch(userId, plan);
    return { ...plan, branchId: branch.id };
  }

  /** 创建路径 — 对齐 POST /api/user/learning-paths */
  async createPath(userId: number, targetJobId?: number) {
    const path = await this.pathRepo.save({
      userId: userId,
      targetJobId: targetJobId,
      pathData: null,
      currentPhase: 0,
      status: 1,
      createTime: Date.now(),
      updateTime: Date.now(),
    });
    return path;
  }

  async addSkill(userId: number, pathId: number, input: { skillName?: string; estimatedMin?: number }) {
    const skillName = String(input.skillName || '').trim();
    if (!skillName) throw new BadRequestException('请输入学习主题');
    const plan = await this.pathRepo.findOne({ where: { id: pathId, userId, status: 1 } });
    if (!plan) throw new NotFoundException('学习计划不存在');
    if (plan.planType !== 'side') throw new BadRequestException('额外学习内容只能加入自选计划');
    if (plan.planStatus === 'archived') throw new BadRequestException('归档计划不能添加学习内容');

    const pathData = plan.pathData || { direction: 'self', phases: [] };
    const phases = Array.isArray(pathData.phases) ? pathData.phases : [];
    const duplicate = phases.some((phase: any) =>
      (phase.skills || []).some((skill: any) => String(skill.name).toLowerCase() === skillName.toLowerCase()),
    );
    if (duplicate) throw new BadRequestException('该学习内容已在计划中');

    let phase = phases.find((item: any) => item.kind === 'self_added');
    if (!phase) {
      phase = { name: '自选补充', kind: 'self_added', index: phases.length, skills: [] };
      phases.push(phase);
    }
    phase.skills.push({
      name: skillName,
      estimatedMin: Math.max(30, Math.min(1200, Number(input.estimatedMin) || 120)),
      priority: 5,
      isRequired: false,
      status: 'pending',
    });
    plan.pathData = { ...pathData, phases };
    plan.updateTime = Date.now();
    await this.pathRepo.save(plan);
    return this.getPath(userId, pathId);
  }

  async setPlanStatus(userId: number, pathId: number, planStatus: 'active' | 'paused' | 'archived') {
    const plan = await this.pathRepo.findOne({ where: { id: pathId, userId, status: 1 } });
    if (!plan) throw new NotFoundException('学习计划不存在');
    if (!['active', 'paused', 'archived'].includes(planStatus)) throw new BadRequestException('无效的计划状态');
    if (planStatus === 'active' && plan.planType === 'main') {
      await this.pathRepo.createQueryBuilder()
        .update(LearningPlan)
        .set({ planStatus: 'archived', scheduleEnabled: 0, updateTime: Date.now() })
        .where('user_id = :userId AND plan_type = :type AND plan_status = :status AND id <> :id', {
          userId,
          type: 'main',
          status: 'active',
          id: plan.id,
        })
        .execute();
    }
    plan.planStatus = planStatus;
    plan.scheduleEnabled = planStatus === 'active' ? 1 : 0;
    plan.updateTime = Date.now();
    await this.pathRepo.save(plan);
    return this.getPath(userId, pathId);
  }

  async mergePlan(userId: number, pathId: number) {
    const branch = await this.branchService.ensurePlanBranch(userId, pathId);
    return this.branchService.mergeBranch(userId, branch.id);
  }

  /** 知识库资源查询 — 对齐 GET /api/user/learning-paths/knowledge/:skill */
  async getSkillContent(skill: string, userId?: number) {
    try {
      // 拒绝无效技能名
      if (!skill || skill === '未知' || skill === '未知技能') {
        return { skill, lecture: null, quiz: null, coding: null, reading: null, has_content: false };
      }

      console.log(`[LearningPaths] getSkillContent called for: ${skill}, userId: ${userId}`);

      // 并行查询所有内容类型
      const [lectureDoc, quizDoc, codingDoc, readingDoc] = await Promise.all([
        this.knowledgeService.getContent(skill, 'lecture'),
        this.knowledgeService.getContent(skill, 'quiz'),
        this.knowledgeService.getContent(skill, 'coding'),
        this.knowledgeService.getContent(skill, 'reading'),
      ]);

      const hasLecture = !!lectureDoc?.content?.markdown;
      const hasQuiz = !!quizDoc?.content?.questions?.length;
      const hasCoding = !!codingDoc?.content?.problems?.length;
      const hasReading = !!readingDoc?.content?.items?.length;

      console.log(`[LearningPaths] Content check: lecture=${hasLecture}, quiz=${hasQuiz}, coding=${hasCoding}, reading=${hasReading}`);

      if (hasLecture || hasQuiz) {
        console.log(`[LearningPaths] Content found in MongoDB for: ${skill}`);
        return {
          skill,
          lecture: hasLecture ? lectureDoc.content.markdown : null,
          quiz: hasQuiz ? quizDoc.content.questions : null,
          coding: hasCoding ? codingDoc.content.problems : null,
          reading: hasReading ? readingDoc.content.items : null,
          has_content: true,
        };
      }

      // 没有内容 → 触发全量异步生成（防重入）
      if (!this.generatingSkills.has(skill)) {
        this.generatingSkills.add(skill);
        console.log(`[LearningPaths] No content found, triggering generation for: ${skill}`);
        this.generateAllContent(skill, userId)
          .finally(() => this.generatingSkills.delete(skill))
          .catch((e) => console.error(`[LearningPaths] Content generation failed for ${skill}:`, e.message));
      }
      // 静默跳过：正在生成中，不重复打日志

      return { skill, lecture: null, quiz: null, coding: null, reading: null, has_content: false, generating: true };
    } catch (e: any) {
      console.error(`[LearningPaths] getSkillContent error for ${skill}:`, e.message);
      return { skill, lecture: null, quiz: null, coding: null, reading: null, has_content: false };
    }
  }

  /** 异步并行生成所有知识内容并保存到 MongoDB */
  private async syncGeneratedResource(userId: number | undefined, task: any, result?: any, failedMessage?: string): Promise<void> {
    if (!userId || !task) return;
    if (failedMessage) {
      await this.generatedResources.failFromTask(userId, task, failedMessage).catch((e) =>
        console.warn('[LearningPaths] generated resource failure upsert failed:', e.message),
      );
      return;
    }
    await this.generatedResources.upsertFromTask(userId, task, result).catch((e) =>
      console.warn('[LearningPaths] generated resource upsert failed:', e.message),
    );
  }

  private async generateAllContent(skill: string, userId?: number): Promise<void> {
    console.log(`[LearningPaths] generateAllContent START for: ${skill}, userId: ${userId}, hasProfileService: ${!!this.profileService}`);

    // 创建办公室任务（如果 userId 可用）
    const taskIds: { lecture?: number; code?: number; reading?: number } = {};
    if (userId) {
      try {
        const [lt, ct, rt] = await Promise.all([
          this.taskService.createTask(userId, 'lecture', `讲义: ${skill}`, { skillName: skill }),
          this.taskService.createTask(userId, 'code', `代码案例: ${skill}`, { skillName: skill }),
          this.taskService.createTask(userId, 'reading', `拓展阅读: ${skill}`, { skillName: skill }),
        ]);
        taskIds.lecture = lt.id;
        taskIds.code = ct.id;
        taskIds.reading = rt.id;
        await Promise.all([
          this.syncGeneratedResource(userId, lt),
          this.syncGeneratedResource(userId, ct),
          this.syncGeneratedResource(userId, rt),
        ]);
        // 标记为运行中 + 员工上岗
        const runningTasks = await Promise.all([
          this.taskService.updateStatus(lt.id, 'running'),
          this.taskService.updateStatus(ct.id, 'running'),
          this.taskService.updateStatus(rt.id, 'running'),
        ]);
        await Promise.all(runningTasks.map((task) => this.syncGeneratedResource(userId, task)));
        // 员工上岗：busy + 直接分配工位（不依赖 updateStatus 内部逻辑）
        const profiles = await this.profileService.getProfiles(userId);
        for (const agentType of ['lecture', 'code', 'reading'] as const) {
          const profile = profiles.find(p => p.agentType === agentType);
          if (!profile) continue;
          // 计算工位：已在工位则保留，否则分配下一个
          let stationId = profile.stationId;
          if (stationId === null) {
            const usedStations = profiles.filter(p => p.stationId !== null).map(p => p.stationId as number);
            stationId = usedStations.length > 0 ? Math.max(...usedStations) + 1 : 1;
            // 同步更新本地 profiles 数组，避免后续 agent 重复分配同一工位
            profile.stationId = stationId;
          }
          await this.profileService.updateStatus(userId, agentType, 'busy').catch(() => {});
          // 无论 updateStatus 内部是否分配了工位，这里再确保一次
          if (stationId !== null) {
            await this.profileService.assignStation(userId, agentType, stationId).catch(() => {});
          }
        }
      } catch (e: any) {
        console.warn('[LearningPaths] Failed to create office tasks:', e.message);
      }
    }

    // 3 个 Agent 并行执行
    const [lectureResult, codeResult, readingResult] = await Promise.allSettled([
      this.lectureAgent.generate(skill, 'beginner'),
      this.codeAgent.generate(skill, 'JavaScript', 3),
      this.readingAgent.generate(skill, 5),
    ]);

    console.log(`[LearningPaths] Agents completed: lecture=${lectureResult.status}, code=${codeResult.status}, reading=${readingResult.status}`);

    // 更新办公室任务状态 + 员工下岗
    if (userId) {
      const update = async (id: number | undefined, status: 'success' | 'failed', result?: any, error?: string) => {
        if (!id) return;
        const task = await this.taskService.updateStatus(id, status, result, error).catch(() => null);
        if (status === 'failed') {
          await this.syncGeneratedResource(userId, task, undefined, error || 'Content generation failed');
        } else {
          await this.syncGeneratedResource(userId, task, result);
        }
      };
      await Promise.all([
        update(taskIds.lecture, lectureResult.status === 'fulfilled' ? 'success' : 'failed',
          lectureResult.status === 'fulfilled' ? lectureResult.value : undefined,
          lectureResult.status === 'rejected' ? lectureResult.reason?.message : undefined),
        update(taskIds.code, codeResult.status === 'fulfilled' ? 'success' : 'failed',
          codeResult.status === 'fulfilled' ? codeResult.value : undefined,
          codeResult.status === 'rejected' ? codeResult.reason?.message : undefined),
        update(taskIds.reading, readingResult.status === 'fulfilled' ? 'success' : 'failed',
          readingResult.status === 'fulfilled' ? readingResult.value : undefined,
          readingResult.status === 'rejected' ? readingResult.reason?.message : undefined),
      ]);
      // 员工下岗
      this.profileService.updateStatus(userId, 'lecture', 'idle').catch(() => {});
      this.profileService.updateStatus(userId, 'code', 'idle').catch(() => {});
      this.profileService.updateStatus(userId, 'reading', 'idle').catch(() => {});
    }

    if (lectureResult.status === 'rejected') console.error(`[LearningPaths] Lecture error:`, lectureResult.reason);
    if (codeResult.status === 'rejected') console.error(`[LearningPaths] Code error:`, codeResult.reason);
    if (readingResult.status === 'rejected') console.error(`[LearningPaths] Reading error:`, readingResult.reason);

    // 保存讲义 + 练习题
    if (lectureResult.status === 'fulfilled' && lectureResult.value) {
      const result = lectureResult.value;
      if (result.content) {
        await this.knowledgeService.saveLecture(skill, result.content, 'beginner');
        console.log(`[LearningPaths] Lecture saved for: ${skill}`);
      }
      if (result.exercises?.length) {
        const questions = result.exercises
          .filter((ex: any) => ex.type === 'choice' && ex.options?.length)
          .map((ex: any) => {
            const answerIdx = ex.options.indexOf(ex.answer);
            return {
              question: ex.question || '',
              options: ex.options || [],
              answer: answerIdx >= 0 ? answerIdx : 0,
              explanation: ex.explanation || '',
            };
          });
        if (questions.length > 0) {
          await this.knowledgeService.saveQuiz(skill, questions, 'beginner');
          console.log(`[LearningPaths] Quiz saved for: ${skill} (${questions.length} questions)`);
        }
      }
    }

    // 保存代码案例
    if (codeResult.status === 'fulfilled' && codeResult.value?.examples?.length) {
      await this.knowledgeService.saveCoding(skill, codeResult.value.examples, 'beginner');
      console.log(`[LearningPaths] Coding saved for: ${skill} (${codeResult.value.examples.length} examples)`);
    }

    // 保存拓展阅读
    if (readingResult.status === 'fulfilled' && readingResult.value?.items?.length) {
      await this.knowledgeService.saveContent(skill, 'reading', {
        items: readingResult.value.items,
        studyAdvice: readingResult.value.studyAdvice,
        total: readingResult.value.items.length,
      }, 'beginner');
      console.log(`[LearningPaths] Reading saved for: ${skill} (${readingResult.value.items.length} items)`);
    }

    console.log(`[LearningPaths] All content generation completed for: ${skill}`);
  }
}
