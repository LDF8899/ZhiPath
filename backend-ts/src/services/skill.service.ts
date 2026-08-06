import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserSkill } from '../entities/user-skills.entity';
import { Student } from '../entities/student.entity';
import { LearningCommit } from '../entities/learning-commit.entity';
import { EvaluationResult } from '../entities/evaluation-result.entity';
import { Resume } from '../entities/resume.entity';
import { JobPosition } from '../entities/job.entity';
import { EvidenceRagService } from './evidence-rag.service';

/**
 * 技能服务 — 管理 user_skills_v3
 *
 * 对齐 CONSTITUTION.md §6 技能模型：
 *   - 百分比掌握度（mastery_pct 0-100）
 *   - 信任权重（trust_weight 0-1，按来源递减：exam > github > conversation > self_report）
 *   - 衰减机制（decay_start + last_activity）
 *   - 来源追踪（source: self_report | conversation | github | exam）
 */
@Injectable()
export class SkillService {
  constructor(
    @InjectRepository(UserSkill) private userSkillRepo: Repository<UserSkill>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(LearningCommit) private commitRepo: Repository<LearningCommit>,
    @InjectRepository(EvaluationResult) private evalResultRepo: Repository<EvaluationResult>,
    @InjectRepository(Resume) private resumeRepo: Repository<Resume>,
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    private evidenceRag: EvidenceRagService,
  ) {}

  // ── 基础 CRUD ──────────────────────────────────

  /** 获取用户所有技能 */
  async getSkills(userId: number): Promise<UserSkill[]> {
    return this.userSkillRepo.find({
      where: { userId, status: 1 },
      order: { masteryPct: 'DESC', updateTime: 'DESC' },
    });
  }

  /** 获取用户某项技能（取最新一条） */
  async getSkill(userId: number, skillName: string): Promise<UserSkill | null> {
    return this.userSkillRepo.findOne({
      where: { userId, skillName, status: 1 },
      order: { updateTime: 'DESC' },
    });
  }

  /** 添加/更新技能（幂等：同名同来源不重复） */
  async addSkill(
    userId: number,
    skillName: string,
    source: UserSkill['source'] = 'self_report',
    trustWeight: number = 0.3,
    masteryPct: number = 0,
  ): Promise<UserSkill> {
    const now = Date.now();
    const name = skillName.trim();
    if (!name) throw new Error('skillName 不能为空');

    // 查找已有记录（同名同来源）
    const existing = await this.userSkillRepo.findOne({
      where: { userId, skillName: name, source, status: 1 },
    });

    if (existing) {
      // 更新信任权重（取较高值）和最后活动时间
      const newTrust = Math.max(Number(existing.trustWeight), trustWeight);
      existing.trustWeight = newTrust;
      existing.lastActivity = now;
      existing.updateTime = now;
      // 如果传入的掌握度更高，更新
      if (masteryPct > Number(existing.masteryPct)) {
        existing.masteryPct = masteryPct;
      }
      return this.userSkillRepo.save(existing);
    }

    // 新建
    return this.userSkillRepo.save({
      userId,
      skillName: name,
      masteryPct,
      trustWeight,
      source,
      lastActivity: now,
      decayStart: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  /** 批量添加技能 */
  async addSkills(
    userId: number,
    skills: Array<{ name: string; source?: UserSkill['source']; trustWeight?: number; masteryPct?: number }>,
  ): Promise<UserSkill[]> {
    const results: UserSkill[] = [];
    for (const s of skills) {
      const result = await this.addSkill(
        userId,
        s.name,
        s.source || 'self_report',
        s.trustWeight || 0.3,
        s.masteryPct || 0,
      );
      results.push(result);
    }
    return results;
  }

  // ── 信任度升级 ──────────────────────────────────

  /** 升级技能信任度（考试通过/GitHub佐证后调用） */
  async upgradeTrust(
    userId: number,
    skillName: string,
    newSource: UserSkill['source'],
    newTrustWeight: number,
    masteryPct?: number,
  ): Promise<UserSkill> {
    const now = Date.now();
    const name = skillName.trim();
    if (!name) throw new Error('skillName 不能为空');

    // 查找该技能的所有记录（取信任度最高的）
    const existing = await this.userSkillRepo.findOne({
      where: { userId, skillName: name, status: 1 },
      order: { trustWeight: 'DESC' },
    });

    if (existing) {
      // 如果新信任度更高，升级
      if (newTrustWeight > Number(existing.trustWeight)) {
        existing.source = newSource;
        existing.trustWeight = newTrustWeight;
        existing.lastActivity = now;
        existing.updateTime = now;
        if (masteryPct !== undefined && masteryPct > Number(existing.masteryPct)) {
          existing.masteryPct = masteryPct;
        }
        return this.userSkillRepo.save(existing);
      }
      // 信任度没变化，只更新活跃时间
      existing.lastActivity = now;
      existing.updateTime = now;
      return this.userSkillRepo.save(existing);
    }

    // 不存在，新增
    return this.userSkillRepo.save({
      userId,
      skillName: name,
      masteryPct: masteryPct || 0,
      trustWeight: newTrustWeight,
      source: newSource,
      lastActivity: now,
      decayStart: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  // ── 掌握度更新 ──────────────────────────────────

  /** 更新技能掌握度（增量） */
  async updateMastery(userId: number, skillName: string, delta: number): Promise<UserSkill | null> {
    const skill = await this.getSkill(userId, skillName);
    if (!skill) return null;

    const now = Date.now();
    const current = Number(skill.masteryPct);
    const newMastery = Math.max(0, Math.min(100, current + delta));

    skill.masteryPct = newMastery;
    skill.lastActivity = now;
    skill.updateTime = now;

    // 掌握度提升时重置衰减
    if (delta > 0) {
      skill.decayStart = null;
    }

    return this.userSkillRepo.save(skill);
  }

  /** 设置技能掌握度（绝对值） */
  async setMastery(userId: number, skillName: string, masteryPct: number): Promise<UserSkill | null> {
    const skill = await this.getSkill(userId, skillName);
    if (!skill) return null;

    const now = Date.now();
    skill.masteryPct = Math.max(0, Math.min(100, masteryPct));
    skill.lastActivity = now;
    skill.updateTime = now;

    if (masteryPct >= Number(skill.masteryPct)) {
      skill.decayStart = null;
    }

    return this.userSkillRepo.save(skill);
  }

  // ── 加权技能 ──────────────────────────────────

  /** 获取加权后的有效技能（用于匹配度计算） */
  async getEffectiveSkills(userId: number): Promise<Array<{ name: string; effectiveScore: number; masteryPct: number; trustWeight: number; source: string }>> {
    const skills = await this.getSkills(userId);
    const now = Date.now();

    return skills.map((s) => {
      let mastery = Number(s.masteryPct);
      const trust = Number(s.trustWeight);

      // 衰减计算：超过 30 天未活动，每天衰减 0.5%
      if (s.lastActivity) {
        const daysInactive = (now - Number(s.lastActivity)) / 86400000;
        if (daysInactive > 30) {
          const decayDays = daysInactive - 30;
          mastery = Math.max(0, mastery - decayDays * 0.5);
        }
      }

      // 有效分数 = 掌握度 × 信任权重
      const effectiveScore = mastery * trust;

      return {
        name: s.skillName,
        effectiveScore: Math.round(effectiveScore * 100) / 100,
        masteryPct: Math.round(mastery * 100) / 100,
        trustWeight: trust,
        source: s.source,
      };
    });
  }

  /** 获取用户技能名称集合（去重） */
  async getSkillNames(userId: number): Promise<string[]> {
    const skills = await this.getSkills(userId);
    return [...new Set(skills.map((s) => s.skillName))];
  }

  /** 检查用户是否拥有某技能 */
  async hasSkill(userId: number, skillName: string): Promise<boolean> {
    const count = await this.userSkillRepo.count({
      where: { userId, skillName, status: 1 },
    });
    return count > 0;
  }

  // ── 迁移工具 ──────────────────────────────────

  /** 从 students_v3.skills JSON 迁移到 user_skills_v3（一次性） */
  async syncFromStudentSkills(userId: number): Promise<number> {
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    if (!student?.skills?.length) return 0;

    const now = Date.now();
    const levelToTrust: Record<string, number> = { '了解': 0.3, '熟悉': 0.5, '熟练': 0.7, '精通': 0.9 };
    let migrated = 0;

    for (const s of student.skills) {
      const name = s.name || '';
      if (!name) continue;

      // 检查是否已迁移
      const exists = await this.userSkillRepo.findOne({
        where: { userId, skillName: name, source: 'self_report' },
      });

      if (!exists) {
        await this.userSkillRepo.save({
          userId,
          skillName: name,
          masteryPct: 0,
          trustWeight: levelToTrust[s.level] || 0.3,
          source: 'self_report',
          lastActivity: now,
          createTime: now,
          updateTime: now,
          status: 1,
        });
        migrated++;
      }
    }

    return migrated;
  }

  // ── 统计 ──────────────────────────────────

  /** 获取用户技能统计 */
  async getStats(userId: number): Promise<{ total: number; bySource: Record<string, number>; avgMastery: number }> {
    const skills = await this.getSkills(userId);
    const bySource: Record<string, number> = {};
    let totalMastery = 0;

    for (const s of skills) {
      bySource[s.source] = (bySource[s.source] || 0) + 1;
      totalMastery += Number(s.masteryPct);
    }

    return {
      total: skills.length,
      bySource,
      avgMastery: skills.length > 0 ? Math.round((totalMastery / skills.length) * 100) / 100 : 0,
    };
  }

  // ── 技能证据链（P1-1）──────────────────────────

  /**
   * 技能证据链 — GET /api/user/skills/:skillName/evidence（P1-1）
   *
   * 对齐《ZhiPath_产品业务升级方案》P1-1 / §9.2 证据链聚合表：
   *   - 学习证据：learning commit（含 delta）
   *   - 测评证据：evaluation result（分数/是否通过）
   *   - 项目证据：student.projects（绑定该技能的项目）
   *   - 简历证据：resume content（该技能在简历中的表达）
   *   - 岗位影响：最近一次匹配度 delta + 目标岗位信息
   *
   * 仅聚合现有数据，不新建表。
   */
  async getSkillEvidence(userId: number, skillName: string) {
    const name = skillName.trim();
    const lower = name.toLowerCase();
    const skill = await this.getSkill(userId, name);

    // ── 1. 学习证据：commit（skillName 匹配或 payload 提及）──
    const commits = await this.commitRepo.find({
      where: { userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 300,
    });
    const learning = commits
      .filter((c) => this.commitMentionsSkill(c, lower))
      .slice(0, 5)
      .map((c) => ({
        commitId: c.id,
        type: c.commitType,
        message: c.message,
        delta: this.skillDeltaFromCommit(c, lower),
        time: Number(c.createTime || 0),
      }));

    // ── 2. 测评证据：evaluation result ──
    const evalResults = await this.evalResultRepo.find({
      where: { userId, status: 1 },
      order: { createTime: 'DESC' },
      take: 200,
    });
    const evaluation = evalResults
      .filter((r) => this.namesMatch(r.skillName, lower))
      .slice(0, 5)
      .map((r) => ({
        resultId: r.id,
        skillName: r.skillName,
        score: Number(r.normalizedScore ?? r.score ?? 0),
        passed: r.passed === 1,
        level: r.level,
        summary: r.summary,
        time: Number(r.createTime || 0),
      }));

    // ── 3. 项目证据：student.projects ──
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    const projectList = (student?.projects || []) as Array<Record<string, any>>;
    const project = projectList
      .filter((p) => this.projectMentionsSkill(p, lower))
      .slice(0, 5)
      .map((p) => ({
        name: p.name || p.projectName || '',
        description: p.description || p.desc || '',
        skills: p.skills || p.tech || [],
        period: p.time || p.duration || p.period || '',
      }));

    // ── 4. 简历证据：resume content ──
    const resumes = await this.resumeRepo.find({
      where: { userId, status: 1 },
      order: { version: 'DESC' },
      take: 20,
    });
    const resume = resumes
      .map((r) => {
        const content = r.content || {};
        const skillsArr = (content.skills || []) as Array<Record<string, any>>;
        const skillEntry = skillsArr.find((s) => this.namesMatch(String(s.name || ''), lower));
        const projectsArr = (content.projects || []) as Array<Record<string, any>>;
        const projectEntry = projectsArr.find((p) => this.projectMentionsSkill(p, lower));
        const expression =
          (projectEntry &&
            (projectEntry.description || projectEntry.desc || projectEntry.name || '')) ||
          (skillEntry && `${skillEntry.name}（掌握度 ${skillEntry.masteryPct ?? '—'}%）`) ||
          '';
        if (!expression) return null;
        return {
          resumeId: r.id,
          versionName: r.versionName || `v${r.version}`,
          targetJobTitle: (content.targetJob as any)?.title || '',
          expression: String(expression).slice(0, 120),
        };
      })
      .filter(Boolean)
      .slice(0, 5);

    // ── 5. 岗位影响：最近一次匹配度 delta + 目标岗位 ──
    const impactCommit = commits.find(
      (c) => c.deltaJson?.metricsChange && Number(c.deltaJson.metricsChange.matchScore) !== 0,
    );
    let impact: Record<string, any> = {
      matchDelta: 0,
      commitId: null,
      message: '',
    };
    if (impactCommit) {
      impact = {
        matchDelta: Math.round(Number(impactCommit.deltaJson.metricsChange.matchScore) * 10) / 10,
        commitId: impactCommit.id,
        message: impactCommit.message,
      };
    }
    if (student?.targetJobId) {
      try {
        const targetJob = await this.jobRepo.findOne({
          where: { id: student.targetJobId, status: 1 },
        });
        impact.jobTitle = targetJob?.title || '';
      } catch {
        impact.jobTitle = '';
      }
    } else {
      impact.jobTitle = '';
    }

    const counts = {
      learning: learning.length,
      evaluation: evaluation.length,
      project: project.length,
      resume: resume.length,
    };

    // P1-1 / §7.3：Evidence RAG 语义证据（项目/文件/测评等召回），失败不影响主链路
    let semantic: Array<{ chunkId: number; sourceType: string; title: string; snippet: string; score: number }> = [];
    try {
      semantic = (await this.evidenceRag.search(userId, name, { skill: name, limit: 3 })).map((e) => ({
        chunkId: e.chunkId,
        sourceType: e.sourceType,
        title: e.title,
        snippet: e.snippet,
        score: e.score,
      }));
    } catch {
      semantic = [];
    }

    return {
      skill: name,
      mastery: skill ? Math.round(Number(skill.masteryPct)) : 0,
      hasSkill: Boolean(skill),
      source: skill?.source || '',
      counts,
      summary: `掌握度 ${skill ? Math.round(Number(skill.masteryPct)) : 0}%，${counts.learning} 次学习、${counts.evaluation} 次测评、${counts.project} 个项目、${counts.resume} 份简历表达`,
      evidence: { learning, evaluation, project, resume, impact },
      semantic,
    };
  }

  /** commit 是否提及该技能（skillName 精确匹配或 payload 提及） */
  private commitMentionsSkill(commit: LearningCommit, lowerSkill: string): boolean {
    if (this.namesMatch(commit.skillName, lowerSkill)) return true;
    const payload = commit.payloadJson || {};
    const payloadSkill = payload.skillName || payload.skill || payload.skill_name;
    if (payloadSkill && this.namesMatch(String(payloadSkill), lowerSkill)) return true;
    // message 中提及（如 "task done: React Hooks"）
    return commit.message ? commit.message.toLowerCase().includes(lowerSkill) : false;
  }

  /** 从 commit 的 deltaJson 提取该技能的变化量 */
  private skillDeltaFromCommit(commit: LearningCommit, lowerSkill: string): number {
    const changes = commit.deltaJson?.skillChanges as Array<Record<string, any>> | undefined;
    if (!changes) return 0;
    const change = changes.find((c) => this.namesMatch(String(c.name || ''), lowerSkill));
    return change ? Math.round(Number(change.delta || 0) * 10) / 10 : 0;
  }

  /** 项目对象是否提及该技能（skills/tech 数组或描述文本） */
  private projectMentionsSkill(project: Record<string, any>, lowerSkill: string): boolean {
    const skillsArr = project.skills || project.tech || [];
    if (Array.isArray(skillsArr) && skillsArr.some((s) => this.namesMatch(String(s.name || s), lowerSkill))) {
      return true;
    }
    const text = [project.name, project.projectName, project.description, project.desc]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(lowerSkill);
  }

  /** 技能名互匹配（双向包含，兼容 "React" 与 "React Hooks"） */
  private namesMatch(a: string | null | undefined, lowerB: string): boolean {
    if (!a) return false;
    const lowerA = a.toLowerCase();
    return lowerA === lowerB || lowerA.includes(lowerB) || lowerB.includes(lowerA);
  }
}
