import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resume } from '../entities/resume.entity';
import { Student } from '../entities/student.entity';
import { JobPosition } from '../entities/job.entity';
import { SkillService } from './skill.service';
import { LlmService } from './llm.service';
import { extractJson } from '../common/json-repair';
import type { ResumeTemplateData } from './agents/resume-agent.service';

/**
 * ResumeAgent 服务 — 简历生成与管理（模板驱动版）
 *
 * 对齐 CONSTITUTION.md §10 简历系统：
 *   - 多版本 Git 模型（base + 各岗位版本）
 *   - LLM 生成结构化内容 + 固定模板渲染 HTML
 *   - 版本管理（branch/merge）
 *
 * 渲染架构：
 *   DB 数据 → buildTemplateData() → ResumeTemplateData → renderTemplateHtml() → HTML
 *                                              ↑
 *                                   LLM 优化文案（可选）
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
    const personalInfo = {
      name: student.name || '',
      school: student.school || '',
      major: student.major || '',
      grade: student.grade || '',
      phone: student.phone || '',
      email: student.email || '',
      github: student.githubUsername || '',
      selfIntro: student.selfIntro || '',
      studentNo: student.studentNo || '',
      birth: (student as any).birth || '',
      hometown: (student as any).hometown || '',
    };

    const resumeContent = {
      personalInfo,
      skills: skills.map((s) => ({
        name: s.name,
        masteryPct: s.masteryPct,
        source: s.source,
      })),
      targetJob: targetJob
        ? {
            title: targetJob.title,
            company: targetJob.company,
            location: targetJob.location,
            requiredSkills: targetJob.requiredSkills,
            preferredSkills: targetJob.preferredSkills,
          }
        : null,
      projects: (student as any).projects || [],
      workExperience: (student as any).workExperience || [],
      campusExperience: (student as any).campusExperience || [],
      awards: (student as any).awards || [],
      resumeAdvice: await this.buildResumeAdvice(userId, targetJob, skills, (student as any).projects || []),
    };

    // 5. 构建模板数据 + 调用 LLM 优化文案 → 渲染 HTML
    const templateData = await this.buildTemplateData(resumeContent, targetJob);
    const htmlContent = this.renderTemplateHtml(templateData);

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

    const baseResume = await this.resumeRepo.findOne({
      where: { id: baseResumeId, userId, status: 1 },
    });
    if (!baseResume) throw new Error('基础简历不存在');

    const targetJob = await this.jobRepo.findOne({
      where: { id: targetJobId, status: 1 },
    });
    if (!targetJob) throw new Error('目标岗位不存在');

    const existingCount = await this.resumeRepo.count({ where: { userId, status: 1 } });
    const version = existingCount + 1;
    const skills = await this.skillService.getEffectiveSkills(userId);

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
      resumeAdvice: await this.buildResumeAdvice(userId, targetJob, skills, baseContent.projects || []),
    };

    const templateData = await this.buildTemplateData(resumeContent, targetJob);
    const htmlContent = this.renderTemplateHtml(templateData);

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

  // ── 模板数据构建 ──────────────────────────────────

  /**
   * 从 DB 原始数据构建 ResumeTemplateData，可选调用 LLM 优化文案
   */
  async buildTemplateData(
    content: Record<string, any>,
    targetJob: JobPosition | null,
  ): Promise<ResumeTemplateData> {
    const pi = content.personalInfo || {};
    const skills = content.skills || [];
    const projects = content.projects || [];
    const workExp = content.workExperience || [];
    const campus = content.campusExperience || [];
    const awards = content.awards || [];
    const job = content.targetJob;

    // 调用 LLM 优化文案（项目要点、摘要等）
    let enhancement: Record<string, any> = {};
    try {
      const result = await this.llmService.chatCompletion([
        {
          role: 'system',
          content: `你是严谨的中文技术招聘顾问。只优化简历文案，不得虚构经历、技术、职责、数字或成果。
原始信息不足时保持克制。输出严格 JSON：
{"summary":"40-80字职业摘要","jobIntent":"求职意向推荐","projectDetails":{项目索引:[要点数组]},
"projectResults":{项目索引:"成果总结"},"skillCategories":[{category:"分类",items:"描述"}],
"campusDescriptions":{校园索引:"优化描述"},"selfEvaluation":["评价要点"]}。
数组/对象顺序与输入一致，每条不超 80 字。`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            targetJob: targetJob ? {
              title: targetJob.title,
              company: targetJob.company,
              requiredSkills: targetJob.requiredSkills,
              preferredSkills: targetJob.preferredSkills,
            } : null,
            candidate: {
              name: pi.name,
              school: pi.school,
              major: pi.major,
              skills: skills.map((s: any) => `${s.name}(${s.masteryPct || 0}%)`),
              projects: projects.map((p: any) => ({
                name: p.name,
                description: p.description || p.desc || '',
                techStack: p.techStack || p.tech || [],
                role: p.role || '',
              })),
              campus: campus.map((c: any) => ({
                title: c.title || c.name || '',
                description: c.description || c.desc || '',
              })),
              selfIntro: pi.selfIntro || '',
            },
          }),
        },
      ], { temperature: 0.2, maxTokens: 2000, tier: 'pro' });
      enhancement = extractJson(result) || {};
    } catch (e: any) {
      console.warn('[ResumeAgent] Copy enhancement failed:', e.message);
    }

    return this.assembleTemplateData(pi, skills, projects, workExp, campus, awards, job, enhancement);
  }

  /**
   * 组装最终模板数据（合并原始数据 + LLM 优化结果）
   */
  private assembleTemplateData(
    pi: any,
    skills: any[],
    projects: any[],
    workExp: any[],
    campus: any[],
    awards: any[],
    job: any,
    enhancement: Record<string, any>,
  ): ResumeTemplateData {
    const escapeStr = (v: unknown, max = 200) => String(v ?? '').substring(0, max);

    // 技能分类：优先使用 LLM 分类，否则自动分类
    const skillCategories: Array<{ category: string; items: string }> =
      (enhancement.skillCategories && enhancement.skillCategories.length > 0)
        ? enhancement.skillCategories
        : this.autoCategorizeSkills(skills, job);

    // 项目详情
    const projectDetails = enhancement.projectDetails || {};
    const projectResults = enhancement.projectResults || {};

    // 校园经历
    const campusDescriptions = enhancement.campusDescriptions || {};

    return {
      personalInfo: {
        name: escapeStr(pi.name, 30),
        jobIntent: escapeStr(enhancement.jobIntent || (job ? `求职意向：${job.title}` : ''), 100),
        summary: escapeStr(enhancement.summary || pi.selfIntro || '', 200) || undefined,
        birth: escapeStr(pi.birth, 20) || undefined,
        hometown: escapeStr(pi.hometown, 20) || undefined,
        phone: escapeStr(pi.phone, 20) || undefined,
        email: escapeStr(pi.email, 50) || undefined,
      },
      education: {
        school: escapeStr(pi.school, 50),
        major: escapeStr(pi.major, 50),
        grade: escapeStr(pi.grade, 20) || undefined,
        courses: escapeStr(
          enhancement.courses || pi.courses || '',
          300,
        ),
      },
      campusExperience: campus.length > 0
        ? campus.map((c: any, i: number) => ({
            title: escapeStr(c.title || c.name || '', 50),
            description: escapeStr(campusDescriptions[i] || c.description || c.desc || '', 300),
          }))
        : [],
      skills: skillCategories,
      projects: projects.map((p: any, i: number) => ({
        name: escapeStr(p.name || '项目经历', 80),
        role: escapeStr(p.role || '开发者', 30),
        techStack: (p.techStack || p.tech || []).slice(0, 10).map((t: any) => String(t).substring(0, 30)),
        description: escapeStr(p.description || p.desc || '', 200),
        details: Array.isArray(projectDetails[i])
          ? projectDetails[i].slice(0, 5).map((d: any) => String(d).substring(0, 150))
          : (p.description ? [String(p.description).substring(0, 150)] : []),
        result: escapeStr(projectResults[i] || '', 200),
      })),
      selfEvaluation: Array.isArray(enhancement.selfEvaluation)
        ? enhancement.selfEvaluation.slice(0, 5).map((e: any) => String(e).substring(0, 100))
        : (pi.selfIntro ? [escapeStr(pi.selfIntro, 100)] : []),
    };
  }

  /**
   * 自动技能分类（LLM 分类失败时的降级方案）
   */
  private autoCategorizeSkills(
    skills: any[],
    job: any,
  ): Array<{ category: string; items: string }> {
    const requiredNames = new Set(
      (job?.requiredSkills || []).map((s: any) => String(s?.name || s).toLowerCase()),
    );

    const categories: Record<string, { names: string[]; mastery: number }> = {};

    const aiKw = ['llm', 'rag', 'pytorch', 'tensorflow', 'nlp', 'transformer', 'langchain', 'bert', 'gpt', 'ai', '模型', '大模型', '机器学习', '深度学习', 'embedding'];
    const feKw = ['vue', 'react', 'electron', 'html', 'css', 'js', 'typescript', 'javascript', '前端', 'webpack', 'vite', '小程序', 'uniapp'];
    const beKw = ['java', 'spring', 'mysql', 'redis', 'mongodb', 'postgres', 'python', 'go', 'node', 'express', 'nestjs', 'fastapi', 'django', 'rest', 'graphql', '后端', 'api'];
    const devopsKw = ['docker', 'kubernetes', 'k8s', 'ci', 'cd', 'jenkins', 'git', 'linux', 'nginx', '运维', 'devops'];
    const embedKw = ['esp32', 'mqtt', '蓝牙', '串口', '硬件', 'stm32', 'arduino', '嵌入式', 'iot'];

    for (const s of skills) {
      const name = String(s.name || '').toLowerCase();
      let cat = '其他技术';
      // 按优先级检查：嵌入式 > AI > DevOps > 后端 > 前端（防止 node.js 被 js 误匹配）
      if (embedKw.some(k => name.includes(k))) cat = '嵌入式 & 硬件';
      else if (aiKw.some(k => name.includes(k))) cat = 'AI & 大模型';
      else if (devopsKw.some(k => name.includes(k))) cat = 'DevOps & 工具';
      else if (beKw.some(k => name.includes(k))) cat = '后端 & 数据库';
      else if (feKw.some(k => name.includes(k))) cat = '前端 & 跨端';

      if (!categories[cat]) categories[cat] = { names: [], mastery: 0 };
      categories[cat].names.push(String(s.name));
      categories[cat].mastery = Math.max(categories[cat].mastery, Number(s.masteryPct || 0));
    }

    // 排序：包含岗位必须技能的类别优先
    const sorted = Object.entries(categories).sort((a, b) => {
      const aMatch = a[1].names.some(n => requiredNames.has(n.toLowerCase())) ? 1 : 0;
      const bMatch = b[1].names.some(n => requiredNames.has(n.toLowerCase())) ? 1 : 0;
      return bMatch - aMatch || b[1].mastery - a[1].mastery;
    });

    return sorted.map(([category, { names }]) => ({
      category,
      items: `熟练${names.join('、')}等技术，具备实际项目开发经验。`,
    }));
  }

  private async buildResumeAdvice(userId: number, targetJob: JobPosition | null, skills: any[], projects: any[]) {
    if (!targetJob) {
      return {
        target: null,
        matchedSkills: [],
        missingSkills: [],
        actionItems: [
          '先选择一个目标岗位，再生成岗位版简历。',
          '补充 1-2 个与目标方向相关的项目经历。',
          '把技能掌握证据沉淀到测评、项目或代码记录中。',
        ],
        expressions: [],
      };
    }

    const skillMap = new Map(
      (skills || []).map((skill) => [this.normSkill(skill.name), Number(skill.masteryPct ?? skill.mastery ?? skill.effectiveMastery ?? 0)]),
    );
    const required = this.skillNames(targetJob.requiredSkills || []);
    const preferred = this.skillNames(targetJob.preferredSkills || []);
    const matchedSkills = [...required, ...preferred]
      .filter((name, index, arr) => name && arr.findIndex((item) => this.normSkill(item) === this.normSkill(name)) === index)
      .filter((name) => (skillMap.get(this.normSkill(name)) || 0) > 0)
      .slice(0, 8)
      .map((name) => ({ name, masteryPct: Math.round(skillMap.get(this.normSkill(name)) || 0) }));
    const missingSkills = required
      .filter((name) => (skillMap.get(this.normSkill(name)) || 0) <= 0)
      .slice(0, 6);
    const projectCount = Array.isArray(projects) ? projects.length : 0;
    const strongest = matchedSkills.slice(0, 3).map((item) => item.name).join('、');
    const missing = missingSkills.slice(0, 3).join('、');

    const actionItems = [
      strongest
        ? `把 ${strongest} 放到技能区和项目描述前半段，突出与「${targetJob.title}」的直接相关性。`
        : `当前简历缺少与「${targetJob.title}」直接对应的技能证据，先补齐核心技能后再生成岗位版。`,
      missing
        ? `优先补齐 ${missing}，完成测评或项目后再更新简历。`
        : '必须技能已基本覆盖，下一步强化项目成果和职责表述。',
      projectCount > 0
        ? '项目经历中补充技术选型、个人职责、结果指标，避免只写功能清单。'
        : '至少补充 1 个与目标岗位相关的项目经历，否则岗位版简历说服力不足。',
    ];

    // P1-2 evidence-aware 表达建议：3-5 条，每条引用技能与证据，证据不足时提示
    const expressions = await this.buildEvidenceAdvice(
      userId,
      targetJob,
      matchedSkills.map((item) => item.name),
      missingSkills,
    );

    return {
      target: {
        title: targetJob.title,
        company: targetJob.company || '',
      },
      matchedSkills,
      missingSkills,
      actionItems,
      expressions,
    };
  }

  /**
   * P1-2：生成岗位版简历表达建议（evidence-aware）
   *
   * 每条建议：
   *   - 引用岗位关键词（技能名 + 岗位标题）
   *   - 标明证据来源（测评/项目/学习/无）
   *   - 证据不足时给出"建议补项目/测评"提示，不鼓励过度包装
   *
   * 覆盖技能：匹配技能前 4 个 + 缺失技能前 2 个（去重后最多 5 条）。
   */
  private async buildEvidenceAdvice(
    userId: number,
    targetJob: JobPosition,
    matchedSkillNames: string[],
    missingSkills: string[],
  ): Promise<Array<Record<string, any>>> {
    const candidates: string[] = [];
    for (const name of [...matchedSkillNames, ...missingSkills]) {
      const norm = this.normSkill(name);
      if (name && !candidates.some((c) => this.normSkill(c) === norm)) {
        candidates.push(name);
      }
      if (candidates.length >= 5) break;
    }

    const expressions: Array<Record<string, any>> = [];
    let seq = 1;

    for (const name of candidates) {
      let evidence: any = null;
      try {
        evidence = await this.skillService.getSkillEvidence(userId, name);
      } catch {
        evidence = null;
      }
      const evData = evidence?.evidence || null;
      const passedEval = evData?.evaluation?.find((r: any) => r.passed) || null;
      const project = evData?.project?.[0] || null;
      const learningCount = evData?.learning?.length || 0;

      if (passedEval) {
        const detail = passedEval.summary || `${passedEval.score} 分通过`;
        expressions.push({
          id: seq++,
          category: 'evaluation',
          advice: `把「${name}」写进技能区，并用「${detail}」作为掌握依据，与「${targetJob.title}」的岗位关键词直接呼应。`,
          keywords: [name, targetJob.title],
          skills: [name],
          evidence: { type: 'evaluation', detail, count: 1 },
          confidence: 'high',
          warning: '',
        });
      } else if (project) {
        const detail = project.description || project.name;
        expressions.push({
          id: seq++,
          category: 'project',
          advice: `在项目「${project.name}」描述中突出 ${name} 的实际应用与个人职责，让岗位要求与项目经验直接对应。`,
          keywords: [name, targetJob.title],
          skills: [name],
          evidence: { type: 'project', detail: String(detail).slice(0, 60), count: 1 },
          confidence: 'high',
          warning: '',
        });
      } else if (learningCount > 0) {
        expressions.push({
          id: seq++,
          category: 'learning',
          advice: `「${name}」已有 ${learningCount} 次学习记录，可在简历中体现持续学习；建议补一次速测，把学习转化为可写证据。`,
          keywords: [name, targetJob.title],
          skills: [name],
          evidence: { type: 'learning', detail: `${learningCount} 次学习 commit`, count: learningCount },
          confidence: 'medium',
          warning: '证据偏弱，建议补一次速测或小项目。',
        });
      } else {
        expressions.push({
          id: seq++,
          category: 'gap',
          advice: `「${name}」是「${targetJob.title}」的关键词但暂无证据，建议先完成相关测评或项目，再写入简历，避免过度包装。`,
          keywords: [name, targetJob.title],
          skills: [name],
          evidence: { type: 'none', detail: '', count: 0 },
          confidence: 'low',
          warning: '建议补项目或测评后再写入简历。',
        });
      }
    }

    return expressions;
  }

  private skillNames(skills: Array<{ name?: string } | string>) {
    return (skills || [])
      .map((skill: any) => typeof skill === 'string' ? skill : skill?.name || '')
      .map((name) => String(name).trim())
      .filter(Boolean);
  }

  private normSkill(value: unknown) {
    return String(value || '').trim().toLowerCase();
  }

  // ── HTML 模板渲染 ──────────────────────────────────

  /**
   * 将 ResumeTemplateData 渲染为 resume.html 风格的精美 HTML
   */
  renderTemplateHtml(data: ResumeTemplateData): string {
    const esc = (v: unknown) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const pi = data.personalInfo;
    const edu = data.education;
    const contactItems = [
      pi.birth ? { label: '出生', value: pi.birth } : null,
      pi.hometown ? { label: '籍贯', value: pi.hometown } : null,
      pi.phone ? { label: '电话', value: pi.phone } : null,
      pi.email ? { label: '邮箱', value: pi.email } : null,
    ].filter(Boolean) as { label: string; value: string }[];

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pi.name)} - 个人简历</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --primary: #cc785c;
    --primary-active: #a9583e;
    --primary-disabled: #e6dfd8;
    --ink: #141413;
    --body-color: #3d3d3a;
    --body-strong: #252523;
    --muted: #6c6a64;
    --muted-soft: #8e8b82;
    --hairline: #e6dfd8;
    --hairline-soft: #ebe6df;
    --canvas: #faf9f5;
    --surface-soft: #f5f0e8;
    --surface-card: #efe9de;
    --surface-cream-strong: #e8e0d2;
    --surface-dark: #8a7f78;
    --surface-dark-elevated: #9a8f88;
    --surface-dark-soft: #7a6f68;
    --on-primary: #ffffff;
    --on-dark: #2f2925;
    --on-dark-soft: #3d3835;
    --accent-teal: #5db8a6;
    --font-display: "Cormorant Garamond", "Tiempos Headline", Garamond, "Times New Roman", serif;
    --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.55;
    color: var(--body-color);
    background: #e8e0d2;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 20px auto;
    background: var(--canvas);
    box-shadow: 0 1px 3px rgba(20,20,19,0.08);
    position: relative;
  }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    html, body { background: white !important; margin: 0; padding: 0; font-size: 13px; }
    .page { margin: 0 !important; box-shadow: none !important; width: 100% !important; min-height: auto !important; background: var(--canvas) !important; }
    .no-print { display: none !important; }
    .header { padding: 24px 36px 20px; gap: 20px; background: var(--surface-dark) !important; }
    .photo-area { width: 90px; height: 112px; background: var(--surface-dark-elevated) !important; }
    .name { font-size: 28px; margin-bottom: 4px; }
    .job-intent { font-size: 13px; margin-bottom: 10px; color: var(--primary) !important; }
    .contact-row { font-size: 12px; gap: 4px 14px; }
    .content { padding: 18px 36px 24px; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 17px; padding-bottom: 5px; margin-bottom: 8px; }
    .edu-school { font-size: 14px; }
    .edu-major, .edu-courses { font-size: 12px; }
    .project { padding: 10px 14px; margin-bottom: 10px; background: var(--surface-card) !important; break-inside: avoid; }
    .project-name { font-size: 14px; }
    .project-desc, .project-details li { font-size: 12px; }
    .project-result { font-size: 11px; }
    .project-role { font-size: 9px; background: var(--primary) !important; }
    .tag { font-size: 10px; padding: 1px 7px; background: var(--canvas) !important; }
    .skill-grid { gap: 8px; break-inside: avoid; }
    .skill-card { padding: 10px 12px; background: var(--surface-card) !important; }
    .skill-card-title { font-size: 12px; margin-bottom: 4px; }
    .skill-card-body { font-size: 11px; line-height: 1.5; }
    .campus-item { padding: 8px 12px; margin-bottom: 8px; background: var(--surface-card) !important; break-inside: avoid; }
    .campus-title { font-size: 13px; }
    .campus-desc { font-size: 12px; }
    .eval-list li { font-size: 12px; margin-bottom: 3px; }
    .section-title .marker { background: var(--primary) !important; }
    .eval-list li::before { color: var(--primary) !important; }
    .project-result { color: var(--primary) !important; }
    .project-section { page-break-before: always; }
    .drag-hint { display: none !important; }
    .drag-handle { display: none !important; }
    [contenteditable="true"]:hover, [contenteditable="true"]:focus { background: transparent !important; box-shadow: none !important; }
  }
  .header {
    background: var(--surface-dark);
    color: var(--on-dark);
    padding: 36px 44px 32px;
    display: flex;
    align-items: center;
    gap: 28px;
  }
  .photo-area {
    flex-shrink: 0;
    width: 108px;
    height: 136px;
    border: 2px dashed var(--on-dark-soft);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s;
    overflow: hidden;
    background: var(--surface-dark-elevated);
  }
  .photo-area:hover { border-color: var(--primary); }
  .photo-area .icon { font-size: 26px; margin-bottom: 6px; opacity: 0.4; }
  .photo-area .hint { font-size: 11px; opacity: 0.35; text-align: center; line-height: 1.3; }
  .photo-area img { width: 100%; height: 100%; object-fit: cover; display: none; }
  .photo-area.has-photo img { display: block; }
  .photo-area.has-photo .icon, .photo-area.has-photo .hint { display: none; }
  .header-info { flex: 1; }
  .name {
    font-family: var(--font-display);
    font-size: 36px;
    font-weight: 400;
    letter-spacing: -0.5px;
    line-height: 1.1;
    margin-bottom: 6px;
    color: var(--on-dark);
  }
  .job-intent {
    font-size: 14px;
    color: var(--primary);
    margin-bottom: 16px;
  }
  .contact-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 18px;
    font-size: 13px;
    color: var(--on-dark-soft);
  }
  .contact-item { display: flex; align-items: center; gap: 6px; }
  .contact-item .label {
    color: #5a5450;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 500;
  }
  .content { padding: 28px 44px 36px; }
  .section { margin-bottom: 22px; }
  .section:last-child { margin-bottom: 0; }
  .section-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 500;
    color: var(--ink);
    letter-spacing: -0.3px;
    padding-bottom: 8px;
    border-bottom: 1.5px solid var(--hairline);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-title .marker {
    width: 8px;
    height: 8px;
    background: var(--primary);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .edu-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
  .edu-school { font-size: 15px; font-weight: 600; color: var(--ink); }
  .edu-major { font-size: 13px; color: var(--muted); margin-left: 8px; }
  .edu-courses { font-size: 13px; color: var(--muted); line-height: 1.7; }
  .project-list { position: relative; }
  .project {
    margin-bottom: 16px;
    background: var(--surface-card);
    border-radius: 12px;
    padding: 16px 20px;
    position: relative;
    transition: box-shadow 0.2s;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .project:last-child { margin-bottom: 0; }
  .project:hover { box-shadow: 0 2px 12px rgba(20,20,19,0.06); }
  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }
  .project-name { font-size: 15px; font-weight: 600; color: var(--ink); }
  .project-role {
    font-size: 10px;
    color: var(--on-primary);
    background: var(--primary);
    padding: 2px 10px;
    border-radius: 9999px;
    font-weight: 500;
    flex-shrink: 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .tech-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
    align-items: center;
  }
  .tag {
    font-size: 11px;
    padding: 2px 9px;
    background: var(--canvas);
    color: var(--muted);
    border-radius: 9999px;
    font-weight: 500;
    border: 1px solid var(--hairline-soft);
  }
  .project-desc { font-size: 13px; color: var(--body-strong); margin-bottom: 8px; line-height: 1.6; }
  .project-details { list-style: none; padding: 0; }
  .project-details li {
    font-size: 13px;
    line-height: 1.65;
    color: var(--body-color);
    padding-left: 14px;
    position: relative;
    margin-bottom: 3px;
  }
  .project-details li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    width: 5px;
    height: 5px;
    border-radius: 1px;
    background: var(--hairline);
  }
  .project-result { font-size: 12px; color: var(--primary); font-weight: 500; margin-top: 8px; padding-left: 10px; }
  .campus-item {
    margin-bottom: 12px;
    padding: 12px 16px;
    background: var(--surface-card);
    border-radius: 12px;
    break-inside: avoid;
  }
  .campus-item:last-child { margin-bottom: 0; }
  .campus-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }
  .campus-title { font-size: 14px; font-weight: 600; color: var(--ink); }
  .campus-desc { font-size: 13px; color: var(--body-color); line-height: 1.65; }
  .skill-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .skill-card { background: var(--surface-card); border-radius: 12px; padding: 14px 16px; position: relative; transition: box-shadow 0.2s; }
  .skill-card:hover { box-shadow: 0 2px 12px rgba(20,20,19,0.06); }
  .skill-card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .skill-card-title::before {
    content: "";
    width: 6px;
    height: 6px;
    background: var(--primary);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .skill-card-body { font-size: 12px; color: var(--body-color); line-height: 1.7; }
  .eval-list { list-style: none; padding: 0; }
  .eval-list li {
    font-size: 13px;
    line-height: 1.7;
    color: var(--body-color);
    padding-left: 18px;
    position: relative;
    margin-bottom: 5px;
  }
  .eval-list li::before {
    content: "✦";
    position: absolute;
    left: 0;
    top: 0;
    color: var(--primary);
    font-size: 10px;
  }
  [contenteditable="true"] {
    outline: none;
    border-radius: 4px;
    transition: background 0.2s, box-shadow 0.2s;
  }
  [contenteditable="true"]:hover { background: rgba(204,120,92,0.04); }
  [contenteditable="true"]:focus { background: rgba(204,120,92,0.06); box-shadow: 0 0 0 2px rgba(204,120,92,0.15); }
  .toolbar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--surface-dark);
    color: var(--on-dark);
    padding: 10px 24px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
    box-shadow: 0 4px 24px rgba(20,20,19,0.15);
    z-index: 100;
  }
  .toolbar button {
    background: var(--primary);
    color: var(--on-primary);
    border: none;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .toolbar button:hover { background: var(--primary-active); }
  .toolbar button:active { transform: scale(0.95); }
  .toolbar .sep { width: 1px; height: 18px; background: var(--surface-dark-elevated); }
  .toolbar .tip { font-size: 12px; color: var(--on-dark-soft); }
  .drag-hint {
    font-size: 11px;
    color: var(--muted-soft);
    text-align: right;
    margin-bottom: 6px;
    font-style: italic;
  }
  @media screen and (max-width: 800px) {
    .page { width: 100%; margin: 0; }
    .header { padding: 24px; gap: 18px; flex-wrap: wrap; }
    .content { padding: 20px 24px 28px; }
    .name { font-size: 28px; }
    .skill-grid { grid-template-columns: 1fr; }
    .project { padding: 14px 16px; }
    .toolbar { bottom: 12px; padding: 8px 16px; gap: 10px; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="photo-area" id="photoArea" onclick="document.getElementById('photoInput').click()">
      <div class="icon">📷</div>
      <div class="hint">点击上传<br>证件照</div>
      <img id="photoPreview" alt="证件照">
      <input type="file" id="photoInput" accept="image/*" style="display:none">
    </div>
    <div class="header-info">
      <div class="name" contenteditable="true">${esc(pi.name)}</div>
      <div class="job-intent" contenteditable="true">${esc(pi.jobIntent)}</div>${pi.summary ? `
      <div class="summary" contenteditable="true" style="font-size:12px;color:var(--muted);margin-top:-10px;margin-bottom:16px;line-height:1.6">${esc(pi.summary)}</div>` : ''}
      <div class="contact-row">
${contactItems.map(({ label, value }) => `        <div class="contact-item">
          <span class="label">${esc(label)}</span>
          <span contenteditable="true">${esc(value)}</span>
        </div>`).join('\n')}
      </div>
    </div>
  </div>
  <div class="content">
    <!-- 教育背景 -->
    <div class="section">
      <div class="section-title"><span class="marker"></span>教育背景</div>
      <div class="edu-row">
        <div>
          <span class="edu-school" contenteditable="true">${esc(edu.school)}</span>
          <span class="edu-major" contenteditable="true">| ${esc(edu.major)}${edu.grade ? ` ${esc(edu.grade)}` : ''}</span>
        </div>
      </div>${edu.courses ? `
      <div class="edu-courses" contenteditable="true">${esc(edu.courses)}</div>` : ''}
    </div>
    <!-- 校园经历 -->
${data.campusExperience.length > 0 ? `    <div class="section">
      <div class="section-title"><span class="marker"></span>校园经历</div>
${data.campusExperience.map(c => `      <div class="campus-item">
        <div class="campus-header">
          <span class="campus-title" contenteditable="true">${esc(c.title)}</span>
        </div>
        <div class="campus-desc" contenteditable="true">${esc(c.description)}</div>
      </div>`).join('\n')}
    </div>` : ''}
    <!-- 专业技能 -->
${data.skills.length > 0 ? `    <div class="section">
      <div class="section-title"><span class="marker"></span>专业技能</div>
      <div class="drag-hint">⇔ 拖拽技能卡片可调整顺序</div>
      <div class="skill-grid" id="skillGrid">
${data.skills.map(s => `        <div class="skill-card" draggable="true">
          <div class="skill-card-title" contenteditable="true">${esc(s.category)}</div>
          <div class="skill-card-body" contenteditable="true">${esc(s.items)}</div>
        </div>`).join('\n')}
      </div>
    </div>` : ''}
    <!-- 项目经历 -->
${data.projects.length > 0 ? `    <div class="section project-section">
      <div class="section-title"><span class="marker"></span>项目经历</div>
      <div class="drag-hint">⇔ 拖拽项目卡片可调整顺序 · 点击 + 可添加新技术栈</div>
      <div class="project-list" id="projectList">
${data.projects.map(p => `        <div class="project" draggable="true">
          <div class="project-header">
            <span class="project-name" contenteditable="true">${esc(p.name)}</span>
            <span class="project-role" contenteditable="true">${esc(p.role)}</span>
          </div>${p.techStack.length > 0 ? `
          <div class="tech-tags">
${p.techStack.map(t => `            <span class="tag">${esc(t)}</span>`).join('\n')}
          </div>` : ''}
          <div class="project-desc" contenteditable="true">${esc(p.description)}</div>${p.details.length > 0 ? `
          <ul class="project-details">
${p.details.map(d => `            <li contenteditable="true">${d}</li>`).join('\n')}
          </ul>` : ''}${p.result ? `
          <div class="project-result" contenteditable="true">${esc(p.result)}</div>` : ''}
        </div>`).join('\n')}
      </div>
    </div>` : ''}
    <!-- 自我评价 -->
${data.selfEvaluation.length > 0 ? `    <div class="section">
      <div class="section-title"><span class="marker"></span>自我评价</div>
      <ul class="eval-list">
${data.selfEvaluation.map(e => `        <li contenteditable="true">${esc(e)}</li>`).join('\n')}
      </ul>
    </div>` : ''}
  </div>
</div>
<div class="toolbar no-print">
  <span class="tip">点击文字编辑 · 拖拽卡片调序 · 导出时请勾选"背景图形"</span>
  <span class="sep"></span>
  <button onclick="window.print()">导出 PDF</button>
</div>
<script>
  (function() {
    var photoInput = document.getElementById('photoInput');
    var photoArea = document.getElementById('photoArea');
    var photoPreview = document.getElementById('photoPreview');
    if (photoInput) {
      photoInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) { photoPreview.src = ev.target.result; photoArea.classList.add('has-photo'); };
        reader.readAsDataURL(file);
      });
    }
    // Prevent Enter in single-line fields
    document.querySelectorAll('.name, .job-intent, .edu-school, .edu-major, .project-name, .skill-card-title, .campus-title')
      .forEach(function(el) { el.addEventListener('keydown', function(e) { if (e.key === 'Enter') e.preventDefault(); }); });
  })();
</script>
</body>
</html>`;
  }

  /**
   * 兼容旧接口：使用已有 JSON 内容生成 HTML（不再调用 LLM）
   * @deprecated 建议使用 renderTemplateHtml + buildTemplateData
   */
  private async generateHtml(
    content: Record<string, any>,
    targetJob: JobPosition | null,
  ): Promise<string> {
    const templateData = await this.buildTemplateData(content, targetJob);
    return this.renderTemplateHtml(templateData);
  }
}
