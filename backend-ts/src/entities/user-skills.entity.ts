import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 用户技能表 v3.0 — user_skills_v3
 * 技能模型 §6：百分比掌握度 + 信任权重 + 衰减 + 来源
 * 替代 students_v3.skills JSON
 */
@Entity('user_skills_v3')
export class UserSkill extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 100, name: 'skill_name', comment: '技能名称' })
  skillName: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'mastery_pct', comment: '掌握百分比 0-100 §6.2' })
  masteryPct: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.30, name: 'trust_weight', comment: '信任权重 §6.1' })
  trustWeight: number;

  @Column({
    type: 'enum',
    enum: ['self_report', 'conversation', 'github', 'exam'],
    default: 'self_report',
    name: 'source',
    comment: '技能来源 §6.1',
  })
  source: 'self_report' | 'conversation' | 'github' | 'exam';

  @Column({ type: 'bigint', nullable: true, name: 'last_activity', comment: '最后使用/学习时间戳' })
  lastActivity: number;

  @Column({ type: 'bigint', nullable: true, name: 'decay_start', comment: '开始衰减时间' })
  decayStart: number;
}
