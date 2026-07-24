import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Student } from '../../entities/student.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord, ExamQuestion } from '../../entities/exam.entity';
import { Resume } from '../../entities/resume.entity';
import { SystemConfig } from '../../entities/system.entity';
import { GeneratedResource } from '../../entities/generated-resource.entity';
import { JobSearchService } from '../../services/job-search.service';

/**
 * Admin 服务 — 对齐 Python api/admin/* 所有管理端接口
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    @InjectRepository(JobApplication) private applicationRepo: Repository<JobApplication>,
    @InjectRepository(Enterprise) private enterpriseRepo: Repository<Enterprise>,
    @InjectRepository(News) private newsRepo: Repository<News>,
    @InjectRepository(ExamRecord) private examRepo: Repository<ExamRecord>,
    @InjectRepository(Resume) private resumeRepo: Repository<Resume>,
    @InjectRepository(SystemConfig) private configRepo: Repository<SystemConfig>,
    @InjectRepository(ExamQuestion) private questionRepo: Repository<ExamQuestion>,
    @InjectRepository(GeneratedResource) private resourceRepo: Repository<GeneratedResource>,
  ) {}

  // ── Dashboard ──
  async getDashboard() {
    const [userCount, jobCount, studentCount, applicationCount, examCount, newsCount] = await Promise.all([
      this.userRepo.count({ where: { status: 1 } }),
      this.jobRepo.count({ where: { status: 1 } }),
      this.studentRepo.count({ where: { status: 1 } }),
      this.applicationRepo.count({ where: { status: 1 } }),
      this.examRepo.count({ where: { status: 1 } }),
      this.newsRepo.count({ where: { status: 1 } }),
    ]);
    const quality = await this.getOperationalQuality();
    return { userCount, jobCount, studentCount, applicationCount, examCount, newsCount, quality };
  }

  private async getOperationalQuality() {
    const [
      enterpriseJobCount,
      platformJobCount,
      lowConfidenceJobCount,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      questionTotal,
      questionApproved,
      questionPending,
      lowConfidenceQuestions,
      questionAvgRaw,
      examQualityRaw,
      examFeedbackRecords,
      resourceTotal,
      resourceSuccess,
      resourceFailed,
      resourceRunning,
      resourceFeedbackRaw,
    ] = await Promise.all([
      this.jobRepo.createQueryBuilder('j').where('j.status = 1').andWhere('j.enterprise_id IS NOT NULL').getCount(),
      this.jobRepo.createQueryBuilder('j').where('j.status = 1').andWhere('(j.enterprise_id IS NULL OR j.enterprise_id = 0)').getCount(),
      this.jobRepo.createQueryBuilder('j').where('j.status = 1').andWhere('j.confidence_score IS NOT NULL').andWhere('j.confidence_score < :min', { min: 0.6 }).getCount(),
      this.applicationRepo.count({ where: { status: 1, adminDecision: 0 } }),
      this.applicationRepo.count({ where: { status: 1, adminDecision: 1 } }),
      this.applicationRepo.count({ where: { status: 1, adminDecision: 2 } }),
      this.questionRepo.count(),
      this.questionRepo.count({ where: { status: 1 } }),
      this.questionRepo.count({ where: { status: 0 } }),
      this.questionRepo.createQueryBuilder('q').where('q.confidence_score IS NOT NULL').andWhere('q.confidence_score < :min', { min: 0.6 }).getCount(),
      this.questionRepo.createQueryBuilder('q').select('AVG(q.pass_rate)', 'avg').where('q.pass_rate IS NOT NULL').getRawOne<{ avg: string | null }>(),
      this.examRepo.createQueryBuilder('e')
        .select('AVG(e.score)', 'avgScore')
        .addSelect('SUM(CASE WHEN e.passed = 1 THEN 1 ELSE 0 END)', 'passed')
        .addSelect('COUNT(e.id)', 'total')
        .where('e.status = 1')
        .andWhere('e.score IS NOT NULL')
        .getRawOne<{ avgScore: string | null; passed: string | null; total: string | null }>(),
      this.examRepo.createQueryBuilder('e')
        .select(['e.id', 'e.wrongAnalysis'])
        .where('e.status = 1')
        .andWhere('e.wrong_analysis IS NOT NULL')
        .getMany(),
      this.resourceRepo.count({ where: { status: 1 } }),
      this.resourceRepo.count({ where: { status: 1, resourceStatus: 'success' } }),
      this.resourceRepo.count({ where: { status: 1, resourceStatus: 'failed' } }),
      this.resourceRepo.count({ where: { status: 1, resourceStatus: 'running' } }),
      this.resourceRepo.createQueryBuilder('r')
        .select(`SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(r.preview_meta, '$.feedbackUseful')) = 'true' THEN 1 ELSE 0 END)`, 'useful')
        .addSelect(`SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(r.preview_meta, '$.feedbackUseful')) = 'false' THEN 1 ELSE 0 END)`, 'notUseful')
        .where('r.status = 1')
        .getRawOne<{ useful: string | null; notUseful: string | null }>(),
    ]);

    const activeApplications = pendingApplications + approvedApplications + rejectedApplications;
    const usefulFeedback = Number(resourceFeedbackRaw?.useful || 0);
    const notUsefulFeedback = Number(resourceFeedbackRaw?.notUseful || 0);
    const feedbackTotal = usefulFeedback + notUsefulFeedback;
    const searchMetrics = JobSearchService.getMetricsSnapshot();
    const scoredExamCount = Number(examQualityRaw?.total || 0);
    const passedExamCount = Number(examQualityRaw?.passed || 0);
    const reviewedApplications = approvedApplications + rejectedApplications;
    const questionFeedback = this.countQuestionFeedback(examFeedbackRecords);
    return {
      jobSource: {
        platformJobCount,
        enterpriseJobCount,
        lowConfidenceJobCount,
        enterpriseRate: percent(enterpriseJobCount, platformJobCount + enterpriseJobCount),
      },
      applications: {
        total: activeApplications,
        pending: pendingApplications,
        approved: approvedApplications,
        rejected: rejectedApplications,
        pendingRate: percent(pendingApplications, activeApplications),
        reviewRate: percent(reviewedApplications, activeApplications),
        approvalRate: percent(approvedApplications, reviewedApplications),
        rejectionRate: percent(rejectedApplications, reviewedApplications),
        funnel: [
          { label: '投递', count: activeApplications, rate: activeApplications > 0 ? 100 : 0 },
          { label: '待审', count: pendingApplications, rate: percent(pendingApplications, activeApplications) },
          { label: '通过', count: approvedApplications, rate: percent(approvedApplications, activeApplications) },
          { label: '拒绝', count: rejectedApplications, rate: percent(rejectedApplications, activeApplications) },
        ],
      },
      questions: {
        total: questionTotal,
        approved: questionApproved,
        pending: questionPending,
        lowConfidence: lowConfidenceQuestions,
        avgPassRate: questionAvgRaw?.avg == null ? null : Math.round(Number(questionAvgRaw.avg) * 100) / 100,
        avgScore: examQualityRaw?.avgScore == null ? null : Math.round(Number(examQualityRaw.avgScore) * 10) / 10,
        examPassRate: percent(passedExamCount, scoredExamCount),
        scoredExamCount,
        complaintRate: percent(questionFeedback.complaints, questionFeedback.total),
        complaintSampleSize: questionFeedback.total,
        complaintCount: questionFeedback.complaints,
      },
      resources: {
        total: resourceTotal,
        success: resourceSuccess,
        failed: resourceFailed,
        running: resourceRunning,
        failureRate: percent(resourceFailed, resourceTotal),
        usefulFeedback,
        notUsefulFeedback,
        usefulRate: percent(usefulFeedback, feedbackTotal),
      },
      instrumentation: {
        aiFallbackRate: searchMetrics.aiFallbackRate,
        searchNoResultRate: searchMetrics.searchNoResultRate,
        resourceUsefulRate: percent(usefulFeedback, feedbackTotal),
        searchSampleSize: searchMetrics.totalSearches,
        resourceFeedbackSampleSize: feedbackTotal,
        note: feedbackTotal > 0
          ? '搜索指标为当前服务进程运行期统计；资源有用率和题目投诉率来自用户反馈。'
          : '搜索指标为当前服务进程运行期统计；资源有用率等待用户反馈样本；题目投诉率来自考试结果页反馈。',
      },
    };
  }

  private countQuestionFeedback(records: ExamRecord[]) {
    let total = 0;
    let complaints = 0;
    for (const record of records) {
      const feedbackList = record.wrongAnalysis?.questionFeedback;
      if (!Array.isArray(feedbackList)) continue;
      for (const item of feedbackList) {
        total++;
        if (item?.isComplaint || item?.type === 'complaint') complaints++;
      }
    }
    return { total, complaints };
  }

  // ── Users ──
  async getUsers(page = 1, pageSize = 20, keyword?: string) {
    const skip = (page - 1) * pageSize;
    const qb = this.userRepo.createQueryBuilder('u').where('u.status = 1');
    if (keyword) qb.andWhere('u.username LIKE :kw OR u.realName LIKE :kw', { kw: `%${keyword}%` });
    const [items, total] = await qb.orderBy('u.createTime', 'DESC').skip(skip).take(pageSize).getManyAndCount();
    return { list: items, total, page, pageSize };
  }

  async createUser(data: Partial<User>) {
    const bcrypt = await import('bcryptjs');
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.userRepo.save({ ...data, createTime: Date.now(), updateTime: Date.now(), status: 1 });
  }

  async updateUser(id: number, data: Partial<User>) {
    await this.userRepo.update(id, { ...data, updateTime: Date.now() });
    return this.userRepo.findOne({ where: { id } });
  }

  async deleteUser(id: number) {
    await this.userRepo.update(id, { status: 0, updateTime: Date.now() });
    return { success: true };
  }

  async getStudents(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.studentRepo.findAndCount({
      where: { status: 1 }, order: { createTime: 'DESC' }, skip, take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  // NOTE: Group table removed in v3. Admin check now uses user.role === 'admin' instead.

  // ── Jobs ──
  async getJobs(page = 1, pageSize = 20, keyword?: string, status?: number) {
    const skip = (page - 1) * pageSize;
    const qb = this.jobRepo.createQueryBuilder('j').where('j.status = 1');
    if (keyword) qb.andWhere('j.title LIKE :kw', { kw: `%${keyword}%` });
    if (status !== undefined) qb.andWhere('j.status = :status', { status });
    const [items, total] = await qb.orderBy('j.createTime', 'DESC').skip(skip).take(pageSize).getManyAndCount();
    return { list: items, total, page, pageSize };
  }

  async createJob(data: Partial<JobPosition>) {
    return this.jobRepo.save({ ...data, createTime: Date.now(), updateTime: Date.now(), status: 1 });
  }

  async updateJob(id: number, data: Partial<JobPosition>) {
    await this.jobRepo.update(id, { ...data, updateTime: Date.now() });
    return this.jobRepo.findOne({ where: { id } });
  }

  async deleteJob(id: number) {
    await this.jobRepo.update(id, { status: 0, updateTime: Date.now() });
    return { success: true };
  }

  // ── Applications ──
  async getApplications(page = 1, pageSize = 20, jobId?: number, decision?: number) {
    const skip = (page - 1) * pageSize;
    const where: any = { status: 1 };
    if (jobId) where.jobId = jobId;
    if (decision !== undefined) where.adminDecision = decision;
    const [items, total] = await this.applicationRepo.findAndCount({
      where, order: { createTime: 'DESC' }, skip, take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  async reviewApplication(id: number, decision: number, comment?: string) {
    await this.applicationRepo.update(id, { adminDecision: decision, adminComment: comment, updateTime: Date.now() });
    return this.applicationRepo.findOne({ where: { id } });
  }

  // ── Enterprises ──
  async getEnterprises(page = 1, pageSize = 20, status?: number) {
    const skip = (page - 1) * pageSize;
    const where: any = {};
    if (status !== undefined) where.status = status;
    const [items, total] = await this.enterpriseRepo.findAndCount({
      where, order: { createTime: 'DESC' }, skip, take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  async createEnterprise(data: Partial<Enterprise>) {
    return this.enterpriseRepo.save({ ...data, createTime: Date.now(), updateTime: Date.now(), status: 0 /* 待审核 */ });
  }

  async updateEnterprise(id: number, data: Partial<Enterprise>) {
    await this.enterpriseRepo.update(id, { ...data, updateTime: Date.now() });
    return this.enterpriseRepo.findOne({ where: { id } });
  }

  async deleteEnterprise(id: number) {
    await this.enterpriseRepo.update(id, { status: 0, updateTime: Date.now() });
    return { success: true };
  }

  // ── News ──
  async getNews(page = 1, pageSize = 20, type?: string, status?: number) {
    const skip = (page - 1) * pageSize;
    const where: any = { status: 1 };
    if (type) where.type = type;
    if (status !== undefined) where.status = status;
    const [items, total] = await this.newsRepo.findAndCount({
      where, order: { createTime: 'DESC' }, skip, take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  async createNews(data: Partial<News>) {
    return this.newsRepo.save({ ...data, createTime: Date.now(), updateTime: Date.now(), status: 1, publishTime: Date.now() });
  }

  async updateNews(id: number, data: Partial<News>) {
    await this.newsRepo.update(id, { ...data, updateTime: Date.now() });
    return this.newsRepo.findOne({ where: { id } });
  }

  async deleteNews(id: number) {
    await this.newsRepo.update(id, { status: 0, updateTime: Date.now() });
    return { success: true };
  }

  // ── Exams ──
  async getExams(page = 1, pageSize = 20, userId?: number, examType?: number, passed?: number) {
    const skip = (page - 1) * pageSize;
    const where: any = { status: 1 };
    if (userId) where.userId = userId;
    if (examType) where.examType = examType;
    if (passed !== undefined) where.passed = passed;
    const [items, total] = await this.examRepo.findAndCount({
      where, order: { createTime: 'DESC' }, skip, take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  // ── Resumes ──
  async getResumes(page = 1, pageSize = 20, status?: number) {
    const skip = (page - 1) * pageSize;
    const where: any = { status: 1 };
    // NOTE: Resumes have their own status field for review state
    const [items, total] = await this.resumeRepo.findAndCount({
      where, order: { createTime: 'DESC' }, skip, take: pageSize,
    });
    return { list: items, total, page, pageSize };
  }

  async reviewResume(id: number, reviewStatus: number, comment?: string) {
    await this.resumeRepo.update(id, { status: reviewStatus, reviewComment: comment, updateTime: Date.now() });
    return this.resumeRepo.findOne({ where: { id } });
  }

  // ── Settings ──
  async getSettings() {
    const configs = await this.configRepo.find();
    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.configKey] = c.configValue || '';
    }
    return map;
  }

  async updateSetting(key: string, value: string) {
    const existing = await this.configRepo.findOne({ where: { configKey: key } });
    if (existing) {
      await this.configRepo.update(existing.id, { configValue: value, updateTime: Date.now() });
    } else {
      await this.configRepo.save({ configKey: key, configValue: value, createTime: Date.now(), updateTime: Date.now() });
    }
    return { key, value };
  }

  // ── 题库管理 ──────────────────────────────

  async getQuestions(page: number, pageSize: number, filters: { skillName?: string; questionType?: string; difficulty?: number; status?: number }) {
    const qb = this.questionRepo.createQueryBuilder('q');
    if (filters.skillName) qb.andWhere('q.skill_name LIKE :skill', { skill: `%${filters.skillName}%` });
    if (filters.questionType) qb.andWhere('q.question_type = :type', { type: filters.questionType });
    if (filters.difficulty) qb.andWhere('q.difficulty = :diff', { diff: filters.difficulty });
    if (filters.status !== undefined) qb.andWhere('q.status = :status', { status: filters.status });
    qb.orderBy('q.create_time', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { list: items, total, page, pageSize };
  }

  async updateQuestion(id: number, data: any) {
    await this.questionRepo.update(id, { ...data, updateTime: Date.now() });
    return this.questionRepo.findOne({ where: { id } });
  }

  async reviewQuestion(id: number, status: number) {
    await this.questionRepo.update(id, { status, updateTime: Date.now() });
    return this.questionRepo.findOne({ where: { id } });
  }

  async getQuestionStats(skillName?: string) {
    const qb = this.questionRepo.createQueryBuilder('q').where('q.status = 1');
    if (skillName) qb.andWhere('q.skill_name = :skill', { skill: skillName });
    const questions = await qb.getMany();
    const byType: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    for (const q of questions) {
      byType[q.questionType] = (byType[q.questionType] || 0) + 1;
      byDifficulty[String(q.difficulty)] = (byDifficulty[String(q.difficulty)] || 0) + 1;
    }
    return { total: questions.length, byType, byDifficulty };
  }
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}
