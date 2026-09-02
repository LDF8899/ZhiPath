import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ExamQuestion, ExamRecord } from '../../entities/exam.entity';

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectRepository(ExamQuestion) private readonly questionRepo: Repository<ExamQuestion>,
    @InjectRepository(ExamRecord) private readonly examRepo: Repository<ExamRecord>,
  ) {}

  async listQuestions(userId: number, filters: { skillName?: string; questionType?: string; difficulty?: string; source?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
    const qb = this.questionRepo.createQueryBuilder('q').where('q.status = 1');
    if (filters.skillName) qb.andWhere('q.skill_name LIKE :s', { s: `%${filters.skillName}%` });
    if (filters.questionType) qb.andWhere('q.question_type = :t', { t: filters.questionType });
    if (filters.difficulty) qb.andWhere('q.difficulty = :d', { d: Number(filters.difficulty) });
    if (filters.source === 'generated') qb.andWhere('q.generation_task_id IS NOT NULL');
    else if (filters.source === 'imported') qb.andWhere('q.generation_task_id IS NULL AND q.created_by = :src', { src: 'agent' });
    else if (filters.source === 'manual') qb.andWhere('q.created_by = :src', { src: 'manual' });
    qb.orderBy('q.createTime', 'DESC');
    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    return {
      total,
      page,
      pageSize,
      list: rows.map((q) => ({
        id: q.id,
        type: q.questionType,
        title: q.title,
        options: (q.content as any)?.options || [],
        difficulty: q.difficulty,
        confidence: q.confidenceScore,
        skillName: q.skillName,
        source: q.generationTaskId ? 'generated' : (q.createdBy === 'agent' ? 'imported' : q.createdBy),
      })),
    };
  }

  async assemble(userId: number, questionIds: number[]) {
    if (!questionIds?.length) throw new BadRequestException('请先勾选要组卷的题目');
    const questions = await this.questionRepo.find({ where: { id: In(questionIds), status: 1 } });
    if (!questions.length) throw new BadRequestException('未找到可组卷的题目');
    const now = Date.now();
    const exam = await this.examRepo.save({
      userId,
      examType: 1,
      answers: {
        served: questions.map((q) => ({
          id: q.id,
          questionType: q.questionType,
          type: q.questionType,
          title: q.title,
          content: q.content,
          options: (q.content as any)?.options || [],
          difficulty: q.difficulty,
          // served 快照必须带正确答案：交卷按此批改，下发前端时由 sanitizeServed 剔除
          answer: q.answer,
        })),
        userAnswers: {},
        startedAt: now,
        timeLimitSec: 0,
      },
      passed: 0,
      retryCount: 0,
      createTime: now,
      updateTime: now,
      status: 1,
    } as any);
    return { examId: exam.id, questionCount: questions.length };
  }
}
