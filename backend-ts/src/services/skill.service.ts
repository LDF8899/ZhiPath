import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserSkill } from '../entities/user-skills.entity';
import { Student } from '../entities/student.entity';

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
}
