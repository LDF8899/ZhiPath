import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 简历生成 Agent
 *
 * 功能：
 * 1. 根据用户画像生成简历
 * 2. 根据目标岗位调整简历重点
 * 3. 生成多版本简历
 *
 * 场景：用户投递简历时自动生成
 */

// ── 用户画像数据 ──────────────────────────────────

export interface UserProfile {
  basicInfo: {
    name: string;
    school: string;
    major: string;
    grade: string;
    email?: string;
    phone?: string;
    github?: string;
  };
  skills: Array<{
    name: string;
    mastery: number;       // 0-100
    verified: boolean;     // 是否经过考试验证
  }>;
  projects: Array<{
    name: string;
    description: string;
    techStack: string[];
    role?: string;
    link?: string;
  }>;
  exams: Array<{
    skill: string;
    score: number;
    passedAt: string;
  }>;
  learningPaths: Array<{
    name: string;
    progress: number;      // 0-100
    completedAt?: string;
  }>;
  workExperience?: Array<{
    company: string;
    position: string;
    duration: string;
    description: string;
  }>;
  awards?: string[];
  selfEvaluation?: string;
}

// ── 目标岗位 ──────────────────────────────────

export interface TargetJob {
  title: string;
  company: string;
  requiredSkills: string[];
  preferredSkills: string[];
  level: 'junior' | 'mid' | 'senior';
}

// ── 简历输出 ──────────────────────────────────

export interface ResumeData {
  version: string;          // 版本标识
  targetJob: string;        // 目标岗位
  html: string;             // HTML 格式简历
  sections: ResumeSection[];
  highlights: string[];     // 突出展示的技能/经历
  suggestions: string[];    // 给用户的建议
}

export interface ResumeSection {
  title: string;
  content: string;
  order: number;
}

@Injectable()
export class ResumeAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 生成简历
   * @param profile 用户画像
   * @param targetJob 目标岗位
   * @param version 版本标识（如"v1-前端开发"）
   */
  async generate(
    profile: UserProfile,
    targetJob: TargetJob,
    version: string = 'v1',
  ): Promise<ResumeData> {
    const messages = this.buildPrompt(profile, targetJob, version);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 6144,
      tier: 'pro',
    });

    return this.parseResponse(raw, targetJob.title, version);
  }

  /**
   * 生成简历摘要（用于邮件正文）
   * @param profile 用户画像
   * @param targetJob 目标岗位
   */
  async generateSummary(profile: UserProfile, targetJob: TargetJob): Promise<string> {
    const messages = [
      {
        role: 'system',
        content: `你是简历摘要专家，为候选人生成简洁的自我介绍（用于求职邮件正文）。

要求：
- 100-150字
- 突出与目标岗位匹配的技能和经历
- 语气专业但不生硬
- 不要用"我"开头，用第三人称或直接陈述`,
      },
      {
        role: 'user',
        content: `请为以下候选人生成简历摘要：

候选人：${profile.basicInfo.name}
学校/专业：${profile.basicInfo.school} / ${profile.basicInfo.major}
目标岗位：${targetJob.title} @ ${targetJob.company}

技能：${profile.skills.map(s => `${s.name}(${s.mastery}%)`).join('、')}
项目：${profile.projects.map(p => p.name).join('、')}
${profile.exams.length > 0 ? `考试成绩：${profile.exams.map(e => `${e.skill} ${e.score}分`).join('、')}` : ''}`,
      },
    ];

    return this.llmService.chatCompletion(messages, {
      temperature: 0.6,
      maxTokens: 512,
      tier: 'flash',
    });
  }

  // ── Prompt 设计 ──────────────────────────────────

  private buildPrompt(
    profile: UserProfile,
    targetJob: TargetJob,
    version: string,
  ): { role: string; content: string }[] {
    const systemPrompt = `你是简历生成专家，根据用户画像和目标岗位生成专业简历。

任务：生成 HTML 格式的简历，突出与目标岗位匹配的内容。

简历结构：
1. 个人信息（头部）
2. 求职意向（目标岗位）
3. 教育背景
4. 技能清单（按匹配度排序，目标岗位需要的技能优先）
5. 项目经历（与目标岗位相关的项目优先）
6. 考试成绩/认证（如有）
7. 学习成果（完成的学习路径）
8. 工作/实习经历（如有）
9. 获奖/证书（如有）
10. 自我评价

设计原则：
- 匹配的技能和经历放在前面，突出展示
- 不匹配但有价值的内容保留，弱化展示
- 项目经历要量化成果（如"提升了30%性能"）
- 技能用进度条或百分比展示掌握度
- 排版紧凑，减少留白，适合 A4 打印
- 使用 CSS 内联样式，不依赖外部 CSS

输出严格 JSON：
{
  "version": "${version}",
  "targetJob": "${targetJob.title}",
  "html": "<!DOCTYPE html>...",
  "sections": [
    {"title": "个人信息", "content": "...", "order": 1},
    {"title": "技能清单", "content": "...", "order": 4}
  ],
  "highlights": ["React 95%", "有字节跳动实习经历"],
  "suggestions": ["建议补充 TypeScript 项目经验"]
}

HTML 要求：
- 完整的 HTML 文档（包含 <html>, <head>, <body>）
- 所有样式用 <style> 标签内联
- 支持中文
- 打印友好（@media print）
- 只输出 JSON，不要其他文字`;

    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `请为以下候选人生成简历：

--- 候选人画像 ---
姓名：${profile.basicInfo.name}
学校：${profile.basicInfo.school}
专业：${profile.basicInfo.major}
年级：${profile.basicInfo.grade}
${profile.basicInfo.email ? `邮箱：${profile.basicInfo.email}` : ''}
${profile.basicInfo.phone ? `手机：${profile.basicInfo.phone}` : ''}
${profile.basicInfo.github ? `GitHub：${profile.basicInfo.github}` : ''}

技能清单：
${profile.skills.map(s => `- ${s.name}: ${s.mastery}%${s.verified ? ' (已认证)' : ''}`).join('\n')}

项目经历：
${profile.projects.map(p => `- ${p.name}：${p.description}\n  技术栈：${p.techStack.join(', ')}${p.role ? `\n  角色：${p.role}` : ''}`).join('\n')}

考试成绩：
${profile.exams.map(e => `- ${e.skill}: ${e.score}分 (${e.passedAt})`).join('\n') || '无'}

学习路径：
${profile.learningPaths.map(l => `- ${l.name}: ${l.progress}%${l.completedAt ? ' (已完成)' : ''}`).join('\n') || '无'}

${profile.workExperience?.length ? `工作/实习经历：\n${profile.workExperience.map(w => `- ${w.company} ${w.position} (${w.duration})\n  ${w.description}`).join('\n')}` : ''}
${profile.awards?.length ? `获奖/证书：\n${profile.awards.map(a => `- ${a}`).join('\n')}` : ''}
${profile.selfEvaluation ? `自我评价：${profile.selfEvaluation}` : ''}
--- 结束 ---

--- 目标岗位 ---
岗位：${targetJob.title}
公司：${targetJob.company}
级别：${targetJob.level}
必须技能：${targetJob.requiredSkills.join('、')}
加分技能：${targetJob.preferredSkills.join('、')}
--- 结束 ---`,
      },
    ];
  }

  // ── 解析输出 ──────────────────────────────────

  private parseResponse(raw: string, targetJob: string, version: string): ResumeData {
    try {
      const data = extractJson(raw);

      return {
        version: String(data.version || version),
        targetJob: String(data.targetJob || targetJob),
        html: String(data.html || '').substring(0, 50000),
        sections: Array.isArray(data.sections)
          ? data.sections.map((s: any, i: number) => ({
              title: String(s.title || '').substring(0, 50),
              content: String(s.content || '').substring(0, 5000),
              order: Number(s.order) || i + 1,
            }))
          : [],
        highlights: Array.isArray(data.highlights)
          ? data.highlights.slice(0, 5).map((h: any) => String(h).substring(0, 100))
          : [],
        suggestions: Array.isArray(data.suggestions)
          ? data.suggestions.slice(0, 5).map((s: any) => String(s).substring(0, 200))
          : [],
      };
    } catch (e) {
      console.error('[ResumeAgent] JSON parse failed:', e.message);
      return {
        version,
        targetJob,
        html: '<html><body><p>简历生成失败，请重试</p></body></html>',
        sections: [],
        highlights: [],
        suggestions: ['JSON 解析失败，请重试'],
      };
    }
  }
}
