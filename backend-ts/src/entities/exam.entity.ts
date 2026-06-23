import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 考试题库表 v3.0 — exam_questions_v3
 * 含置信度 §12.1 + 通过率统计
 */
@Entity('exam_questions_v3')
export class ExamQuestion extends BaseEntity {
  @Column({ type: 'tinyint', name: 'exam_type', comment: '1=通用技能 2=岗位考试 3=5分钟速测' })
  examType: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'skill_name' })
  skillName: string;

  @Column({ type: 'bigint', nullable: true, name: 'job_id' })
  jobId: number;

  @Column({ type: 'enum', enum: ['choice', 'fill', 'coding', 'essay'], name: 'question_type' })
  questionType: 'choice' | 'fill' | 'coding' | 'essay';

  @Column({ type: 'varchar', length: 500, name: 'title' })
  title: string;

  @Column({ type: 'json', name: 'content', comment: '题目内容' })
  content: Record<string, any>;

  @Column({ type: 'json', nullable: true, name: 'answer', comment: '正确答案/评分要点' })
  answer: Record<string, any> | null;

  @Column({ type: 'tinyint', default: 1, name: 'difficulty', comment: '1-5' })
  difficulty: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'confidence_score', comment: 'Agent出题置信度 §12.1' })
  confidenceScore: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'pass_rate', comment: '通过率(考试后统计)' })
  passRate: number;

  @Column({ type: 'tinyint', default: 0, name: 'status', comment: '0=待审核 1=已上架 2=已下架' })
  status: number;

  @Column({ type: 'enum', enum: ['agent', 'manual', 'enterprise'], default: 'agent', name: 'created_by' })
  createdBy: 'agent' | 'manual' | 'enterprise';

  @Column({ type: 'bigint', nullable: true, name: 'reviewed_by' })
  reviewedBy: number;
}

/**
 * 考试记录表 v3.0 — exam_records_v3
 * 含错题分析 §12.2
 */
@Entity('exam_records_v3')
export class ExamRecord extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({ type: 'tinyint', default: 1, name: 'exam_type', comment: '1=通用技能 2=岗位考试' })
  examType: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'skill_name' })
  skillName: string;

  @Column({ type: 'bigint', nullable: true, name: 'job_id' })
  jobId: number;

  @Column({ type: 'json', nullable: true, name: 'question_ids', comment: '题目ID列表' })
  questionIds: number[] | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'score' })
  score: number;

  @Column({ type: 'tinyint', default: 0, name: 'passed' })
  passed: number;

  @Column({ type: 'json', nullable: true, name: 'answers', comment: '用户答题内容' })
  answers: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'wrong_analysis', comment: '错题分析 §12.2' })
  wrongAnalysis: Record<string, any> | null;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'bigint', nullable: true, name: 'next_retry_time' })
  nextRetryTime: number;
}
