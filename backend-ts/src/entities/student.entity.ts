import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 学生画像表 v3.0 — students_v3
 * 个人中心数据中枢 §13.1
 */
@Entity('students_v3')
export class Student extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id', comment: '关联users_v3' })
  userId: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'student_no', comment: '学号' })
  studentNo: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'school', comment: '学校' })
  school: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'major', comment: '专业' })
  major: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'grade', comment: '年级/毕业年份' })
  grade: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone', comment: '联系方式' })
  phone: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'email', comment: '联系方式' })
  email: string;

  @Column({ type: 'bigint', nullable: true, name: 'target_job_id', comment: '目标岗位FK' })
  targetJobId: number;

  @Column({ type: 'json', nullable: true, name: 'interests', comment: '兴趣方向 ["AI","前端"]' })
  interests: string[] | null;

  @Column({ type: 'json', nullable: true, name: 'skills', comment: '技能列表 [{name,level,source}] 快速访问冗余' })
  skills: Array<{ name: string; level: string; source?: string }> | null;

  @Column({ type: 'json', nullable: true, name: 'projects', comment: '项目经历 快速访问冗余' })
  projects: Array<Record<string, any>> | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'github_username', comment: 'GitHub用户名' })
  githubUsername: string;

  @Column({ type: 'json', nullable: true, name: 'work_experience', comment: '实习/工作经历' })
  workExperience: Array<Record<string, any>> | null;

  @Column({ type: 'json', nullable: true, name: 'awards', comment: '获奖/证书' })
  awards: Array<Record<string, any>> | null;

  @Column({ type: 'text', nullable: true, name: 'self_intro', comment: '自我评价/个人简介' })
  selfIntro: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true, name: 'daily_hours', comment: '每日可投入学习时长(h)' })
  dailyHours: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'target_deadline', comment: '目标达成时间' })
  targetDeadline: string;

  @Column({ type: 'tinyint', default: 0, name: 'onboarding_completed', comment: '0=未完成 1=已完成' })
  onboardingCompleted: number;
}
