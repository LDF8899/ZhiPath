import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resume } from '../entities/resume.entity';
import { Student } from '../entities/student.entity';
import { JobPosition } from '../entities/job.entity';
import { SkillService } from './skill.service';
import { LlmService } from './llm.service';

/**
 * ResumeAgent 服务 — 简历生成与管理
 *
 * 对齐 CONSTITUTION.md §10 简历系统：
 *   - 多版本 Git 模型（base + 各岗位版本）
 *   - LLM 生成结构化简历
 *   - 版本管理（branch/merge）
 */
@Injectable()
export class ResumeAgentService {
  constructor(
    @InjectRepository(Resume) private resumeRepo: Repository<Resume>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
    private skillService: SkillService,
    private llmService: LlmService,
  ) {}

  /**
   * 生成简历（针对目标岗位）
   */
  async generateResume(userId: number, targetJobId?: number): Promise<Resume> {
    const now = Date.now();

    // 1. 获取用户信息
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    if (!student) throw new Error('用户信息不存在');

    // 2. 获取技能
    const skills = await this.skillService.getEffectiveSkills(userId);

    // 3. 获取目标岗位
    let targetJob: JobPosition | null = null;
    if (targetJobId) {
      targetJob = await this.jobRepo.findOne({ where: { id: targetJobId, status: 1 } });
    }

    // 4. 构建简历内容
    const resumeContent = {
      personalInfo: {
        name: student.name || '',
        school: student.school || '',
        major: student.major || '',
        grade: student.grade || '',
      },
      skills: skills.map((s) => ({
        name: s.name,
        masteryPct: s.masteryPct,
        source: s.source,
      })),
      targetJob: targetJob
        ? {
            title: targetJob.title,
            company: targetJob.company,
            requiredSkills: targetJob.requiredSkills,
          }
        : null,
      projects: student.projects || [],
    };

    // 5. 使用 LLM 生成 HTML 简历
    const htmlContent = await this.generateHtml(resumeContent, targetJob);

    // 6. 获取版本号
    const existingCount = await this.resumeRepo.count({ where: { userId, status: 1 } });
    const version = existingCount + 1;
    const versionName = targetJob
      ? `v${version}-${targetJob.title}`
      : `v${version}-通用`;

    // 7. 保存简历
    return this.resumeRepo.save({
      userId,
      targetJobId: targetJobId || null,
      version,
      versionName,
      isBase: targetJobId ? 0 : 1,
      content: resumeContent,
      htmlContent,
      reviewComment: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  /**
   * 获取用户所有简历版本
   */
  async getResumes(userId: number): Promise<Resume[]> {
    return this.resumeRepo.find({
      where: { userId, status: 1 },
      order: { version: 'DESC' },
    });
  }

  /**
   * 获取简历详情
   */
  async getResume(resumeId: number, userId: number): Promise<Resume | null> {
    return this.resumeRepo.findOne({
      where: { id: resumeId, userId, status: 1 },
    });
  }

  /**
   * 更新简历内容
   */
  async updateResume(
    resumeId: number,
    userId: number,
    data: { content?: Record<string, any>; htmlContent?: string },
  ): Promise<Resume | null> {
    const resume = await this.resumeRepo.findOne({
      where: { id: resumeId, userId, status: 1 },
    });

    if (!resume) return null;

    const now = Date.now();
    const updateData: Partial<Resume> = { updateTime: now };

    if (data.content) updateData.content = data.content;
    if (data.htmlContent) updateData.htmlContent = data.htmlContent;

    await this.resumeRepo.update(resumeId, updateData);
    return this.resumeRepo.findOne({ where: { id: resumeId } });
  }

  /**
   * 从基础简历创建岗位版本（Git branch）
   */
  async createVersion(
    userId: number,
    baseResumeId: number,
    targetJobId: number,
  ): Promise<Resume> {
    const now = Date.now();

    // 获取基础简历
    const baseResume = await this.resumeRepo.findOne({
      where: { id: baseResumeId, userId, status: 1 },
    });

    if (!baseResume) throw new Error('基础简历不存在');

    // 获取目标岗位
    const targetJob = await this.jobRepo.findOne({
      where: { id: targetJobId, status: 1 },
    });

    if (!targetJob) throw new Error('目标岗位不存在');

    // 获取版本号
    const existingCount = await this.resumeRepo.count({ where: { userId, status: 1 } });
    const version = existingCount + 1;

    // 获取技能
    const skills = await this.skillService.getEffectiveSkills(userId);

    // 构建针对岗位的简历内容
    const baseContent = baseResume.content || {};
    const resumeContent = {
      ...baseContent,
      targetJob: {
        title: targetJob.title,
        company: targetJob.company,
        requiredSkills: targetJob.requiredSkills,
        preferredSkills: targetJob.preferredSkills,
      },
      skills: skills.map((s) => ({
        name: s.name,
        masteryPct: s.masteryPct,
        source: s.source,
      })),
    };

    // 使用 LLM 针对岗位优化简历
    const htmlContent = await this.generateHtml(resumeContent, targetJob);

    return this.resumeRepo.save({
      userId,
      targetJobId,
      version,
      versionName: `v${version}-${targetJob.title}`,
      isBase: 0,
      content: resumeContent,
      htmlContent,
      reviewComment: null,
      createTime: now,
      updateTime: now,
      status: 1,
    });
  }

  /**
   * 删除简历
   */
  async deleteResume(resumeId: number, userId: number): Promise<boolean> {
    const resume = await this.resumeRepo.findOne({
      where: { id: resumeId, userId, status: 1 },
    });

    if (!resume) return false;

    const now = Date.now();
    await this.resumeRepo.update(resumeId, { status: 0, updateTime: now });
    return true;
  }

  // ── 内部方法 ──────────────────────────────────

  /**
   * 使用 LLM 生成 HTML 简历
   */
  private async generateHtml(
    content: Record<string, any>,
    targetJob: JobPosition | null,
  ): Promise<string> {
    const prompt = `请根据以下信息生成一份专业的 HTML 简历。

用户信息：
- 姓名：${content.personalInfo?.name || '未填写'}
- 学校：${content.personalInfo?.school || '未填写'}
- 专业：${content.personalInfo?.major || '未填写'}
- 年级：${content.personalInfo?.grade || '未填写'}

技能列表：
${(content.skills || []).map((s: any) => `- ${s.name}（掌握度：${s.masteryPct}%）`).join('\n')}

${targetJob ? `目标岗位：${targetJob.title} @ ${targetJob.company || '未知公司'}` : ''}

项目经历：
${(content.projects || []).map((p: any) => `- ${p.name}: ${p.description || ''}`).join('\n')}

要求：
1. 使用简洁的 HTML + 内联 CSS
2. 适合 A4 打印
3. 突出与目标岗位相关的技能
4. 使用中文
5. 只输出 HTML 代码，不要其他文字`;

    try {
      const result = await this.llmService.chatCompletion([
        { role: 'system', content: '你是简历生成专家，生成专业的 HTML 简历。' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, maxTokens: 2000 });

      // 提取 HTML
      let html = result;
      if (result.includes('```html')) {
        const start = result.indexOf('```html') + 7;
        const end = result.indexOf('```', start);
        html = result.substring(start, end).trim();
      } else if (result.includes('```')) {
        const start = result.indexOf('```') + 3;
        const end = result.indexOf('```', start);
        html = result.substring(start, end).trim();
      }

      return html;
    } catch (e) {
      console.warn('[ResumeAgent] Generate HTML failed:', e.message);
      return this.generateFallbackHtml(content);
    }
  }

  /**
   * 降级 HTML 简历生成
   */
  private generateFallbackHtml(content: Record<string, any>): string {
    const { personalInfo, skills, projects } = content;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 20px; }
    .skill-tag { display: inline-block; background: #eff6ff; color: #2563eb; padding: 4px 12px; border-radius: 4px; margin: 4px; font-size: 14px; }
    .project { margin-bottom: 15px; }
    .project-name { font-weight: bold; color: #1f2937; }
    .project-desc { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${personalInfo?.name || '简历'}</h1>
  <p>${personalInfo?.school || ''} · ${personalInfo?.major || ''} · ${personalInfo?.grade || ''}</p>

  <h2>技能</h2>
  <div>
    ${(skills || []).map((s: any) => `<span class="skill-tag">${s.name} ${s.masteryPct}%</span>`).join('')}
  </div>

  ${(projects || []).length > 0 ? `
  <h2>项目经历</h2>
  ${projects.map((p: any) => `
    <div class="project">
      <div class="project-name">${p.name || ''}</div>
      <div class="project-desc">${p.description || ''}</div>
    </div>
  `).join('')}
  ` : ''}
</body>
</html>`;
  }
}
