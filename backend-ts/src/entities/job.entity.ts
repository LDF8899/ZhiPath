import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 岗位表 v3.0 — job_positions_v3
 * 含投递门槛 §7.4 + JD解析 §26.1
 */
@Entity('job_positions_v3')
export class JobPosition extends BaseEntity {
  @Column({ type: 'varchar', length: 200, name: 'title', comment: '岗位名称' })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'company', comment: '公司名称' })
  company: string;

  @Column({ type: 'enum', enum: ['junior', 'mid', 'senior'], default: 'junior', name: 'level', comment: '岗位级别 §7.4' })
  level: 'junior' | 'mid' | 'senior';

  @Column({ type: 'text', nullable: true, name: 'jd_text', comment: '原始JD文本' })
  jdText: string;

  @Column({ type: 'json', nullable: true, name: 'required_skills', comment: '必须技能 [{name,weight}]' })
  requiredSkills: Array<{ name: string; weight?: number }> | null;

  @Column({ type: 'json', nullable: true, name: 'preferred_skills', comment: '加分技能 [{name,weight}]' })
  preferredSkills: Array<{ name: string; weight?: number }> | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'salary_range', comment: '薪资范围' })
  salaryRange: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'location', comment: '工作地点' })
  location: string;

  @Column({ type: 'tinyint', default: 60, name: 'delivery_threshold', comment: '投递门槛百分比 §7.4' })
  deliveryThreshold: number;

  @Column({ type: 'varchar', length: 50, default: 'manual', name: 'source', comment: 'manual/jd_parser/enterprise' })
  source: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'confidence_score', comment: 'JD解析置信度' })
  confidenceScore: number;

  @Column({ type: 'bigint', nullable: true, name: 'enterprise_id', comment: '关联企业' })
  enterpriseId: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'neo4j_node_id', comment: 'Neo4j节点ID' })
  neo4jNodeId: string;
}

/**
 * 岗位投递表 v3.0 — job_applications_v3
 */
@Entity('job_applications_v3')
export class JobApplication extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'bigint', name: 'job_id' })
  jobId: number;

  @Column({ type: 'bigint', nullable: true, name: 'resume_id' })
  resumeId: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'reviewer_agent_score', comment: 'AI筛选分' })
  reviewerAgentScore: number;

  @Column({ type: 'text', nullable: true, name: 'reviewer_agent_comment', comment: 'AI建议' })
  reviewerAgentComment: string;

  @Column({ type: 'tinyint', default: 0, name: 'admin_decision', comment: '0=待处理 1=通过 2=拒绝' })
  adminDecision: number;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'admin_comment' })
  adminComment: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'enterprise_email' })
  enterpriseEmail: string;
}
