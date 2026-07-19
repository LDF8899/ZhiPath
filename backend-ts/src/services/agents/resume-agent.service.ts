import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 简历生成 Agent（模板驱动版）
 *
 * 职责：调用 LLM 生成结构化 JSON 简历内容，交给模板渲染器输出 HTML。
 *
 * 设计原则：
 * - LLM 只负责内容（文案优化、技能归类、要点提炼），不生成 HTML
 * - 样式由固定模板（resume.html）保证，确保输出一致
 * - 支持目标岗位匹配：技能排序、项目要点针对性优化
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
    birth?: string;
    hometown?: string;
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
  campusExperience?: Array<{
    title: string;
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

// ── 模板数据（对齐 resume.html 结构）──────────────────

export interface ResumeTemplateData {
  personalInfo: {
    name: string;
    jobIntent: string;
    summary?: string;
    birth?: string;
    hometown?: string;
    phone?: string;
    email?: string;
  };
  education: {
    school: string;
    major: string;
    grade?: string;
    courses: string;
  };
  campusExperience: Array<{
    title: string;
    description: string;
  }>;
  skills: Array<{
    category: string;
    items: string;
  }>;
  projects: Array<{
    name: string;
    role: string;
    techStack: string[];
    description: string;
    details: string[];
    result: string;
  }>;
  selfEvaluation: string[];
}

// ── 简历输出 ──────────────────────────────────

export interface ResumeData {
  version: string;
  targetJob: string;
  html: string;                   // 最终 HTML（由模板渲染器填充）
  templateData: ResumeTemplateData; // 结构化内容（来自 LLM）
  highlights: string[];
  suggestions: string[];
}

@Injectable()
export class ResumeAgentService {
  /** 最大重试次数 */
  private static readonly MAX_RETRIES = 2;

  constructor(private llmService: LlmService) {}

  /**
   * 生成简历内容（JSON 版本）
   * 调用 LLM 优化文案 → 返回结构化数据，HTML 由调用方通过模板渲染
   */
  async generate(
    profile: UserProfile,
    targetJob: TargetJob,
    version: string = 'v1',
  ): Promise<ResumeData> {
    const messages = this.buildPrompt(profile, targetJob);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.4,
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseResponse(raw, profile, targetJob, version);
  }

  /**
   * 生成简历摘要（用于邮件正文）
   */
  async generateSummary(profile: UserProfile, targetJob: TargetJob): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content: `你是简历摘要专家，为候选人生成简洁的自我介绍（用于求职邮件正文）。

要求：
- 100-150字
- 突出与目标岗位匹配的技能和经历
- 语气专业但不生硬
- 不要用"我"开头，用第三人称或直接陈述`,
      },
      {
        role: 'user' as const,
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
  ): { role: string; content: string }[] {
    const systemPrompt = `你是资深技术招聘顾问和简历优化专家。你的任务是根据候选人画像和目标岗位，生成结构化的简历内容 JSON。

## 核心原则

1. **诚实优先**：不得虚构任何经历、技能、数字或成果。只能基于输入数据优化表达，不能捏造。
2. **岗位匹配**：与目标岗位相关的技能和经历放在前面、展开详写；无关但有价值的内容保留但简写。
3. **量化成果**：尽量用数据说话（如"性能提升30%"、"覆盖700+用户"），但数据必须来自原始输入。
4. **专业简洁**：每条要点控制在40-70字，避免空话套话。

## 技能归类规则

根据用户技能自动分为 4-5 个类别，每个类别一个卡片。常见类别：
- "后端 & 数据库"：Java, Python, Go, Node.js, MySQL, Redis, SpringBoot 等
- "AI & 大模型"：LLM, RAG, LangChain, PyTorch, NLP, 机器学习 等
- "前端 & 跨端"：Vue, React, TypeScript, Electron, HTML/CSS 等
- "DevOps & 工具"：Docker, Git, CI/CD, Linux 等
- "嵌入式 & 硬件"：ESP32, MQTT, 蓝牙, 串口通信 等

每个类别输出一段 1-2 句的描述文字，说明熟练掌握程度和应用场景。

## 项目要点优化规则

每个项目输出 3-4 条 bullet points：
- 每条以 <strong>标题</strong> 开头概括重点，然后展开说明
- 突出候选人承担的角色和技术难点
- 与目标岗位相关的技术栈要在描述中体现
- 项目成果（result）单独输出一句话总结

## 输出格式

严格输出以下 JSON（不要额外文字、不要 markdown 代码块）：

{
  "templateData": {
    "personalInfo": {
      "name": "姓名",
      "jobIntent": "求职意向：软件开发 · 具体方向",
      "birth": "出生日期（如有）",
      "hometown": "籍贯（如有）",
      "phone": "手机号",
      "email": "邮箱"
    },
    "education": {
      "school": "学校全称",
      "major": "专业 学历",
      "grade": "年级（可选）",
      "courses": "主修课程：课程1、课程2、课程3..."
    },
    "campusExperience": [
      {"title": "经历标题", "description": "具体描述，突出能力和成果"}
    ],
    "skills": [
      {"category": "分类名", "items": "描述熟练掌握的技能及应用场景"}
    ],
    "projects": [
      {
        "name": "项目名称",
        "role": "承担角色（如：独立全栈开发 / 项目核心负责人）",
        "techStack": ["技术1", "技术2", "技术3"],
        "description": "一句话概述项目目标和价值",
        "details": ["<strong>要点标题</strong>具体描述和成果"],
        "result": "✦ 项目成果总结"
      }
    ],
    "selfEvaluation": ["评价要点1", "评价要点2", "评价要点3"]
  },
  "highlights": ["亮点1", "亮点2"],
  "suggestions": ["建议1", "建议2"]
}

## 技能排序

templateData.skills 数组中的类别按与目标岗位的匹配度排序：岗位需要的技能类别排在最前面。`;

    const skillsStr = profile.skills.length > 0
      ? profile.skills.map(s => `- ${s.name}: 掌握度${s.mastery}%${s.verified ? ' (已认证)' : ''}`).join('\n')
      : '（暂无技能数据）';

    const projectsStr = profile.projects.length > 0
      ? profile.projects.map(p => {
          const parts = [`名称：${p.name}`];
          if (p.description) parts.push(`描述：${p.description}`);
          if (p.techStack.length > 0) parts.push(`技术栈：${p.techStack.join('、')}`);
          if (p.role) parts.push(`角色：${p.role}`);
          return parts.join('\n');
        }).join('\n\n')
      : '（暂无项目经历）';

    const examsStr = profile.exams.length > 0
      ? profile.exams.map(e => `- ${e.skill}: ${e.score}分 (${e.passedAt})`).join('\n')
      : '（暂无考试成绩）';

    const learningStr = profile.learningPaths.length > 0
      ? profile.learningPaths.map(l => `- ${l.name}: ${l.progress}%${l.completedAt ? ' (已完成)' : ''}`).join('\n')
      : '（暂无学习路径）';

    const workStr = profile.workExperience && profile.workExperience.length > 0
      ? profile.workExperience.map(w => `- ${w.company} ${w.position} (${w.duration})\n  ${w.description}`).join('\n')
      : '';

    const campusStr = profile.campusExperience && profile.campusExperience.length > 0
      ? profile.campusExperience.map(c => `- ${c.title}：${c.description}`).join('\n')
      : '';

    const awardsStr = profile.awards && profile.awards.length > 0
      ? profile.awards.map(a => `- ${a}`).join('\n')
      : '';

    const userPrompt = `## 候选人画像

姓名：${profile.basicInfo.name}
学校：${profile.basicInfo.school}
专业：${profile.basicInfo.major}
年级：${profile.basicInfo.grade}
${profile.basicInfo.birth ? `出生日期：${profile.basicInfo.birth}` : ''}
${profile.basicInfo.hometown ? `籍贯：${profile.basicInfo.hometown}` : ''}
${profile.basicInfo.email ? `邮箱：${profile.basicInfo.email}` : ''}
${profile.basicInfo.phone ? `手机：${profile.basicInfo.phone}` : ''}
${profile.basicInfo.github ? `GitHub：${profile.basicInfo.github}` : ''}

### 技能清单
${skillsStr}

### 考试成绩
${examsStr}

### 学习路径
${learningStr}

### 项目经历
${projectsStr}
${workStr ? `\n### 工作/实习经历\n${workStr}` : ''}
${campusStr ? `\n### 校园经历\n${campusStr}` : ''}
${awardsStr ? `\n### 获奖/证书\n${awardsStr}` : ''}
${profile.selfEvaluation ? `\n### 自我评价参考\n${profile.selfEvaluation}` : ''}

## 目标岗位

岗位名称：${targetJob.title}
目标公司：${targetJob.company}
级别要求：${targetJob.level}
必须技能：${targetJob.requiredSkills.join('、') || '不限'}
加分技能：${targetJob.preferredSkills.join('、') || '不限'}

## 任务

请根据以上信息，生成结构化的简历内容 JSON。`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  // ── 解析输出 ──────────────────────────────────

  private parseResponse(
    raw: string,
    profile: UserProfile,
    targetJob: TargetJob,
    version: string,
  ): ResumeData {
    try {
      const data = extractJson(raw);
      const templateData = this.normalizeTemplateData(data.templateData || data, profile, targetJob);

      return {
        version,
        targetJob: targetJob.title,
        html: '', // HTML 由模板渲染器生成
        templateData,
        highlights: Array.isArray(data.highlights)
          ? data.highlights.slice(0, 5).map((h: any) => String(h).substring(0, 100))
          : [],
        suggestions: Array.isArray(data.suggestions)
          ? data.suggestions.slice(0, 5).map((s: any) => String(s).substring(0, 200))
          : [],
      };
    } catch (e: any) {
      console.error('[ResumeAgent] JSON parse failed:', e.message);
      // 降级：用原始数据构建模板数据
      const fallbackData = this.buildFallbackTemplateData(profile, targetJob);
      return {
        version,
        targetJob: targetJob.title,
        html: '',
        templateData: fallbackData,
        highlights: [],
        suggestions: ['LLM 生成失败，已使用基础模板。建议重试生成。'],
      };
    }
  }

  /**
   * 标准化模板数据：补全缺失字段、类型检查和清理
   */
  private normalizeTemplateData(
    raw: any,
    profile: UserProfile,
    targetJob: TargetJob,
  ): ResumeTemplateData {
    const pi = raw.personalInfo || {};
    const edu = raw.education || {};

    return {
      personalInfo: {
        name: String(pi.name || profile.basicInfo.name || '').substring(0, 30),
        jobIntent: String(pi.jobIntent || `求职意向：${targetJob.title}`).substring(0, 100),
        birth: String(pi.birth || profile.basicInfo.birth || '').substring(0, 20) || undefined,
        hometown: String(pi.hometown || profile.basicInfo.hometown || '').substring(0, 20) || undefined,
        phone: String(pi.phone || profile.basicInfo.phone || '').substring(0, 20) || undefined,
        email: String(pi.email || profile.basicInfo.email || '').substring(0, 50) || undefined,
      },
      education: {
        school: String(edu.school || profile.basicInfo.school || '').substring(0, 50),
        major: String(edu.major || profile.basicInfo.major || '').substring(0, 50),
        grade: String(edu.grade || profile.basicInfo.grade || '').substring(0, 20) || undefined,
        courses: String(edu.courses || '').substring(0, 300),
      },
      campusExperience: Array.isArray(raw.campusExperience)
        ? raw.campusExperience.slice(0, 5).map((c: any) => ({
            title: String(c.title || '').substring(0, 50),
            description: String(c.description || '').substring(0, 300),
          }))
        : [],
      skills: Array.isArray(raw.skills)
        ? raw.skills.slice(0, 6).map((s: any) => ({
            category: String(s.category || '').substring(0, 30),
            items: String(s.items || '').substring(0, 300),
          }))
        : [],
      projects: Array.isArray(raw.projects)
        ? raw.projects.slice(0, 5).map((p: any) => ({
            name: String(p.name || '').substring(0, 80),
            role: String(p.role || '').substring(0, 30),
            techStack: Array.isArray(p.techStack)
              ? p.techStack.slice(0, 10).map((t: any) => String(t).substring(0, 30))
              : [],
            description: String(p.description || '').substring(0, 200),
            details: Array.isArray(p.details)
              ? p.details.slice(0, 5).map((d: any) => String(d).substring(0, 150))
              : [],
            result: String(p.result || '').substring(0, 200),
          }))
        : [],
      selfEvaluation: Array.isArray(raw.selfEvaluation)
        ? raw.selfEvaluation.slice(0, 5).map((e: any) => String(e).substring(0, 100))
        : [],
    };
  }

  /**
   * 降级：当 LLM 解析失败时，用原始 profile 数据构建模板数据
   */
  private buildFallbackTemplateData(
    profile: UserProfile,
    targetJob: TargetJob,
  ): ResumeTemplateData {
    const bi = profile.basicInfo;
    const requiredSet = new Set(targetJob.requiredSkills.map(s => s.toLowerCase()));
    const prefSet = new Set(targetJob.preferredSkills.map(s => s.toLowerCase()));

    // 技能按匹配度 + 掌握度排序后分组
    const sorted = [...profile.skills].sort((a, b) => {
      const aMatch = (requiredSet.has(a.name.toLowerCase()) ? 2 : 0)
        + (prefSet.has(a.name.toLowerCase()) ? 1 : 0);
      const bMatch = (requiredSet.has(b.name.toLowerCase()) ? 2 : 0)
        + (prefSet.has(b.name.toLowerCase()) ? 1 : 0);
      return bMatch - aMatch || b.mastery - a.mastery;
    });

    // 简单分类
    const categoryMap: Record<string, string[]> = {};
    const frontendKeywords = ['vue', 'react', 'electron', 'html', 'css', 'js', 'typescript', 'javascript', '前端', 'webpack', 'vite'];
    const backendKeywords = ['java', 'python', 'go', 'node', 'spring', 'mysql', 'redis', 'mongodb', 'postgres', '后端', 'api', 'rest', 'graphql'];
    const aiKeywords = ['llm', 'rag', 'pytorch', 'tensorflow', 'nlp', 'transformer', 'langchain', '机器学习', '深度学习', 'ai', '模型', '大模型', 'bert', 'gpt'];
    const devopsKeywords = ['docker', 'kubernetes', 'k8s', 'ci', 'cd', 'jenkins', 'git', 'linux', 'nginx', '运维'];
    const embeddedKeywords = ['esp32', 'mqtt', '蓝牙', '串口', '硬件', 'stm32', 'arduino', '嵌入式'];

    for (const s of sorted) {
      const name = s.name.toLowerCase();
      // 按优先级检查：嵌入式 > AI > DevOps > 后端 > 前端（防止 node.js 被 js 误匹配）
      if (embeddedKeywords.some(k => name.includes(k))) {
        (categoryMap['嵌入式 & 硬件'] ??= []).push(s.name);
      } else if (aiKeywords.some(k => name.includes(k))) {
        (categoryMap['AI & 大模型'] ??= []).push(s.name);
      } else if (devopsKeywords.some(k => name.includes(k))) {
        (categoryMap['DevOps & 工具'] ??= []).push(s.name);
      } else if (backendKeywords.some(k => name.includes(k))) {
        (categoryMap['后端 & 数据库'] ??= []).push(s.name);
      } else if (frontendKeywords.some(k => name.includes(k))) {
        (categoryMap['后端 & 数据库'] ??= []).push(s.name);
      } else {
        (categoryMap['其他技术'] ??= []).push(s.name);
      }
    }

    return {
      personalInfo: {
        name: bi.name,
        jobIntent: `求职意向：${targetJob.title}`,
        birth: bi.birth,
        hometown: bi.hometown,
        phone: bi.phone,
        email: bi.email,
      },
      education: {
        school: bi.school,
        major: bi.major,
        grade: bi.grade,
        courses: '',
      },
      campusExperience: (profile.campusExperience || []).map(c => ({
        title: c.title,
        description: c.description,
      })),
      skills: Object.entries(categoryMap).map(([category, names]) => ({
        category,
        items: `熟练${names.join('、')}等技术，具备实际项目开发经验。`,
      })),
      projects: profile.projects.map(p => ({
        name: p.name,
        role: p.role || '开发者',
        techStack: p.techStack,
        description: p.description,
        details: [],
        result: '',
      })),
      selfEvaluation: profile.selfEvaluation
        ? [profile.selfEvaluation]
        : [],
    };
  }
}
