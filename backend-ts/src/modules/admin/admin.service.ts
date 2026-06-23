import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Student } from '../../entities/student.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord } from '../../entities/exam.entity';
import { Resume } from '../../entities/resume.entity';
import { SystemConfig } from '../../entities/system.entity';

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
    return { userCount, jobCount, studentCount, applicationCount, examCount, newsCount };
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
}
