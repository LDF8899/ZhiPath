import { Injectable } from '@nestjs/common';
import { LlmService } from './llm.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { extractJson } from '../common/json-repair';

/** 讲义必须覆盖的章节，用于校验生成结果是否完整 */
const LECTURE_SECTIONS = ['学习目标', '核心知识', '示例或案例', '实践任务', '常见误区', '复盘问题'];

/**
 * 讲义完整性校验。挡住三类静默损坏：
 *  1) 不是 Markdown —— 模型的思考过程被当成正文返回
 *  2) 章节缺失 —— 输出被 max_tokens 截断
 *  3) 章节重复 —— 模型把模板反复生成了好几遍
 */
export function isCompleteLecture(markdown: string): boolean {
  if (!markdown || !markdown.trimStart().startsWith('#')) return false;
  return LECTURE_SECTIONS.every((section) => {
    const hits = (markdown.match(new RegExp('^##\\s*' + section, 'gm')) || []).length;
    return hits >= 1 && hits <= 2;
  });
}

/**
 * 通用 Markdown 结构校验，适用于模板与本文件 6 章节模板不同的生成器
 * （例如 LectureAgentService 用的是开篇 / 核心直觉 / 动手验证 … 那套）。
 *
 * 只做结构体检，不绑死具体章节名：
 *  1) 必须是 Markdown（挡住思考过程被当成正文）
 *  2) 至少 3 个二级章节（挡住刚开头就被截断）
 *  3) 同一标题不得出现 3 次以上（挡住模板被反复生成）
 *  4) required 里的关键章节必须存在
 */
export function isWellFormedMarkdown(markdown: string, required: string[] = []): boolean {
  if (!markdown || !markdown.trimStart().startsWith('#')) return false;

  const headings = markdown.match(/^##\s+.+$/gm) || [];
  if (headings.length < 3) return false;

  const counts = new Map<string, number>();
  for (const h of headings) counts.set(h.trim(), (counts.get(h.trim()) || 0) + 1);
  for (const n of counts.values()) {
    if (n >= 3) return false;
  }

  return required.every((section) => new RegExp('^##\\s*' + section, 'm').test(markdown));
}

/**
 * 把模型给出的 answer 归一成 options 下标。
 * 实测模型有两种坏习惯：照抄模板填 0、或直接给字母 "B"。两种都会让学生选对也被判错。
 */
export function normalizeAnswer(raw: any, options: any[]): number | null {
  if (!Array.isArray(options) || options.length < 2) return null;

  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < options.length) {
    return raw;
  }
  if (typeof raw === 'string') {
    const text = raw.trim();
    // 纯数字字符串
    if (/^\d+$/.test(text)) {
      const n = Number(text);
      return n >= 0 && n < options.length ? n : null;
    }
    // 字母 A/B/C/D（含 "B."、"B)" 形式）
    const letter = text.match(/^([A-Za-z])/);
    if (letter) {
      const n = letter[1].toUpperCase().charCodeAt(0) - 65;
      return n >= 0 && n < options.length ? n : null;
    }
    // 直接给了选项原文
    const hit = options.findIndex((o) => String(o).trim() === text);
    if (hit >= 0) return hit;
    // 选项形如 "B. xxx"，取前缀匹配
    const prefixed = options.findIndex((o) => String(o).trim().startsWith(text));
    if (prefixed >= 0) return prefixed;
  }
  return null;
}

/**
 * 测验可用性校验。挡住三类问题：
 *  1) 结构不完整（缺 options / 题干）
 *  2) answer 非法（越界、缺失、既非下标也非字母）
 *  3) 多题时全部指向同一下标 —— 模型照抄提示词模板的典型症状
 */
export function isValidQuiz(questions: any): boolean {
  if (!Array.isArray(questions) || questions.length === 0) return false;

  const indexes: number[] = [];
  for (const q of questions) {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;

    const idx = normalizeAnswer(q.answer, q.options);
    if (idx === null) return false;

    // 若模型同时给了 answerText，用它交叉验证下标
    if (typeof q.answerText === 'string' && q.answerText.trim()) {
      const expected = String(q.options[idx]).trim();
      const actual = q.answerText.trim();
      if (actual !== expected && !expected.includes(actual) && !actual.includes(expected)) {
        return false;
      }
    }
    indexes.push(idx);
  }

  if (indexes.length >= 3 && new Set(indexes).size === 1) return false;
  return true;
}

/** 把题目里的 answer 统一改写为规范下标，并去掉多余的 answerText */
export function normalizeQuiz(questions: any[]): any[] {
  return questions.map((q) => {
    const idx = normalizeAnswer(q.answer, q.options);
    return { ...q, answer: idx ?? 0 };
  });
}

export interface LearningResourceContext {
  domainId?: string;
  domainName?: string;
  goalType?: string;
  goalTitle?: string;
  terminology?: Record<string, string>;
  assessmentModes?: string[];
  evidenceTypes?: string[];
}

/** Generate learning resources using the path's domain vocabulary and evidence model. */
@Injectable()
export class ResourceAgentService {
  constructor(
    private llmService: LlmService,
    private knowledgeBase: KnowledgeBaseService,
  ) {}

  async generateLecture(
    ability: string,
    difficulty = 'beginner',
    context: LearningResourceContext = {},
  ): Promise<string | null> {
    const domainContext = this.buildDomainContext(context);
    const exampleRequirement = context.domainId === 'software-engineering'
      ? '包含一个完整、可运行并有解释的代码或工程示例'
      : '包含该领域常见的例题、案例、语料或实践示例，不要强行使用代码';
    const prompt = `请为能力项「${ability}」生成一份结构化学习讲义。

难度：${difficulty}
${domainContext}
要求：
1. 使用 Markdown
2. 包含学习目标、核心知识、示例或案例、实践任务、常见误区、复盘问题
3. 内容具体可执行，不要泛泛而谈
4. ${exampleRequirement}
5. 适合 ${difficulty} 水平的学习者
6. 实践任务应产生一种可记录的学习证据

输出结构：
# ${ability}
## 学习目标
## 核心知识
## 示例或案例
## 实践任务
## 常见误区
## 复盘问题`;

    try {
      // 内容生成走 gen 档并关闭思考：
      // 实测 pro 在 8k 预算下思考吃掉 76% 预算必然截断，而 gen 档 25s 产出完整 6 章节。
      const result = await this.llmService.chatCompletionComplete(
        [
          {
            role: 'system',
            content: '你是跨学科教育内容设计师，能根据专业领域选择正确的术语、例子和练习方式。直接输出 Markdown，不要添加额外说明。',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 8192, tier: 'gen', thinking: 'off' },
        isCompleteLecture,
      );

      if (!result.complete) {
        // 重生成一次仍不合格 —— 宁可不落库，也不能把残缺内容当成有效数据吐给前端
        console.error(
          `[ResourceAgent] Lecture incomplete: ${ability} ` +
          `长度=${result.content.length} finish=${result.finishReason}，放弃落库`,
        );
        return null;
      }

      await this.knowledgeBase.saveLecture(ability, result.content, difficulty);
      console.log(`[ResourceAgent] Lecture generated: ${ability} (${result.content.length}字, ${result.model})`);
      return result.content;
    } catch (error: any) {
      console.error(`[ResourceAgent] Lecture generation failed for ${ability}:`, error.message);
      return null;
    }
  }

  async generateQuiz(
    ability: string,
    count = 5,
    difficulty = 'beginner',
    context: LearningResourceContext = {},
  ): Promise<any[] | null> {
    const domainContext = this.buildDomainContext(context);
    const prompt = `请为能力项「${ability}」生成 ${count} 道有诊断价值的选择题。

难度：${difficulty}
${domainContext}
输出严格 JSON 数组：
[
  {
    "question": "题目描述",
    "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],
    "answer": 2,
    "answerText": "选项C内容",
    "explanation": "解析说明"
  }
]

要求：
1. 覆盖该能力项的核心知识
2. 干扰项应反映真实常见误区
3. 解析要说明判断依据和思考过程
4. 场景和解析必须符合该专业领域，不要默认使用编程语境
5. answer 填「正确选项在 options 中的下标，从 0 开始」，不要填字母，不要照抄上面的示例值
6. answerText 必须逐字等于 options[answer]，用于校验你没有填错下标
7. 各题正确答案的下标要打散，不要每题都一样
8. 只输出 JSON 数组`;

    try {
      const result = await this.llmService.chatCompletionComplete(
        [
          {
            role: 'system',
            content: '你是跨学科评价设计师，擅长根据领域目标设计有诊断价值的练习。只输出 JSON 数组。',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 4096, tier: 'gen', thinking: 'off', jsonObject: true },
        (raw) => {
          try {
            const parsed = JSON.parse(raw);
            return isValidQuiz(parsed?.questions ?? parsed);
          } catch {
            return false;
          }
        },
      );

      const questions = this.extractJsonFromLLM(result.content);
      if (Array.isArray(questions) && isValidQuiz(questions)) {
        const normalized = normalizeQuiz(questions);
        await this.knowledgeBase.saveQuiz(ability, normalized, difficulty);
        console.log(
          `[ResourceAgent] Quiz generated: ${ability} (${normalized.length} 题, ` +
          `答案下标=[${normalized.map((q) => q.answer).join(',')}])`,
        );
        return normalized;
      }

      console.error(
        `[ResourceAgent] Quiz 校验未通过，放弃落库: ${ability} ` +
        `长度=${result.content.length} complete=${result.complete}`,
      );
    } catch (error: any) {
      console.error(`[ResourceAgent] Quiz generation failed for ${ability}:`, error.message);
    }
    return null;
  }

  /** Explicit coding resources remain available, but are never implied by a non-software path. */
  async generateCodingProblems(skill: string, count = 2, difficulty = 'beginner'): Promise<any[] | null> {
    const prompt = `请为技能「${skill}」生成 ${count} 道编程练习题。

难度：${difficulty}

输出严格JSON数组格式：
[
  {
    "title": "题目标题",
    "description": "题目描述（Markdown格式）",
    "template": "代码模板（函数签名+注释）",
    "test_cases": [{"input": "输入描述", "expected": "预期输出"}],
    "hint": "解题提示",
    "solution": "参考答案"
  }
]

要求：
1. 题目实际可编码，不是纯理论
2. 代码模板提供函数签名
3. 测试用例覆盖正常和边界情况
4. 只输出JSON数组`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是编程题设计专家，擅长设计有教学价值的编程练习。只输出 JSON 数组。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 4096, tier: 'gen', thinking: 'off', jsonObject: true },
      );
      const problems = this.extractJsonFromLLM(result);
      if (Array.isArray(problems)) {
        await this.knowledgeBase.saveCoding(skill, problems, difficulty);
        console.log(`[ResourceAgent] Coding problems generated: ${skill} (${problems.length})`);
        return problems;
      }
    } catch (error: any) {
      console.error(`[ResourceAgent] Coding generation failed for ${skill}:`, error.message);
    }
    return null;
  }

  async generateResourcesForPath(
    pathData: Record<string, any>,
  ): Promise<{ generated: number; skipped: number; failed: number }> {
    const phases = pathData.phases || [];
    const stats = { generated: 0, skipped: 0, failed: 0 };
    const context = this.contextFromPathData(pathData);

    for (const phase of phases) {
      const difficulty = this.phaseToDifficulty(phase, phases);
      for (const abilityItem of phase.skills || []) {
        const abilityName = typeof abilityItem === 'string' ? abilityItem : abilityItem.name || '';
        if (!abilityName) continue;
        const existing = await this.knowledgeBase.getContent(abilityName, 'lecture');
        if (existing) {
          stats.skipped++;
          continue;
        }
        try {
          await this.generateLecture(abilityName, difficulty, context);
          await this.generateQuiz(abilityName, 5, difficulty, context);
          stats.generated++;
        } catch (error: any) {
          console.error(`[ResourceAgent] Resource generation failed for ${abilityName}:`, error.message);
          stats.failed++;
        }
      }
    }
    console.log('[ResourceAgent] Resource generation done:', stats);
    return stats;
  }

  contextFromPathData(pathData: Record<string, any>): LearningResourceContext {
    return {
      domainId: pathData?.domainId,
      domainName: pathData?.domainName,
      goalType: pathData?.goalType,
      goalTitle: pathData?.goalTitle,
      terminology: pathData?.terminology,
      assessmentModes: pathData?.assessmentModes,
      evidenceTypes: pathData?.evidenceTypes,
    };
  }

  private buildDomainContext(context: LearningResourceContext): string {
    const lines: string[] = [];
    if (context.domainName || context.domainId) lines.push(`学习领域：${context.domainName || context.domainId}`);
    if (context.goalTitle || context.goalType) lines.push(`学习目标：${context.goalTitle || context.goalType}`);
    if (context.assessmentModes?.length) lines.push(`适用评价方式：${context.assessmentModes.join('、')}`);
    if (context.evidenceTypes?.length) lines.push(`可沉淀证据：${context.evidenceTypes.join('、')}`);
    return lines.length ? `\n领域上下文：\n${lines.join('\n')}\n` : '';
  }

  private extractJsonFromLLM(text: string): any | null {
    try {
      return extractJson(text);
    } catch (error: any) {
      console.error('[ResourceAgent] JSON parse failed:', error.message);
      return null;
    }
  }

  private phaseToDifficulty(phase: any, allPhases: any[]): string {
    const index = allPhases.indexOf(phase);
    const total = allPhases.length;
    if (total <= 1) return 'beginner';
    const ratio = index / (total - 1);
    if (ratio < 0.33) return 'beginner';
    if (ratio < 0.66) return 'intermediate';
    return 'advanced';
  }
}
