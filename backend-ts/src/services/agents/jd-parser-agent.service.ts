import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import { extractJson } from '../../common/json-repair';

/**
 * 岗位 JD 解析 Agent
 *
 * 功能：解析岗位描述（JD），提取结构化信息
 * 场景：管理员录入岗位时自动解析
 * 输出：必须技能、加分技能、岗位分类、置信度
 */

export interface JDSkill {
  name: string;
  category: string;       // frontend/backend/devops/database/...
  importance: 'required' | 'preferred';
  level: 'basic' | 'intermediate' | 'advanced';
  confidence: number;     // 0-1，置信度
}

export interface JDParseResult {
  title: string;
  company: string;
  level: 'junior' | 'mid' | 'senior';
  category: string;                    // 岗位分类
  requiredSkills: JDSkill[];           // 必须技能
  preferredSkills: JDSkill[];          // 加分技能
  responsibilities: string[];          // 职责描述
  requirements: string[];              // 任职要求
  salaryRange: string;
  location: string;
  confidence: number;                  // 整体解析置信度
  suggestions: string[];               // 给管理员的建议（如"建议补充xxx技能"）
}

@Injectable()
export class JDParserAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 解析岗位 JD
   * @param jdText JD 原文
   * @param basicInfo 基本信息（可选，如管理员已填写的标题、公司等）
   */
  async parse(jdText: string, basicInfo?: { title?: string; company?: string }): Promise<JDParseResult> {
    if (!jdText?.trim()) throw new Error('请提供岗位描述');

    const messages = this.buildPrompt(jdText.trim(), basicInfo);
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.3,  // 低温度，更稳定的解析结果
      maxTokens: 4096,
      tier: 'pro',
    });

    return this.parseResponse(raw, jdText);
  }

  /**
   * 批量解析多个 JD
   * @param jdList JD 列表
   */
  async parseBatch(jdList: Array<{ text: string; basicInfo?: any }>): Promise<JDParseResult[]> {
    const results: JDParseResult[] = [];
    for (const jd of jdList) {
      try {
        const result = await this.parse(jd.text, jd.basicInfo);
        results.push(result);
      } catch (e) {
        results.push({
          title: jd.basicInfo?.title || '解析失败',
          company: jd.basicInfo?.company || '',
          level: 'mid',
          category: 'unknown',
          requiredSkills: [],
          preferredSkills: [],
          responsibilities: [],
          requirements: [],
          salaryRange: '',
          location: '',
          confidence: 0,
          suggestions: [`解析失败: ${e.message}`],
        });
      }
    }
    return results;
  }

  // ── Prompt 设计 ──────────────────────────────────

  private buildPrompt(jdText: string, basicInfo?: any): { role: string; content: string }[] {
    const systemPrompt = `你是岗位 JD 解析专家，负责从岗位描述中提取结构化信息。

任务：解析以下岗位描述，输出严格 JSON。

解析要求：

1. 基本信息：
   - title：岗位名称
   - company：公司名称
   - level：岗位级别（junior/mid/senior）
   - category：岗位分类（frontend/backend/fullstack/devops/mobile/data/ai/...）

2. 技能提取（核心任务）：
   - 从 JD 中提取所有提到的技术技能
   - 区分"必须技能"和"加分技能"
     - 必须：明确写"必须"、"required"、"精通"、"熟练掌握"
     - 加分：写"优先"、"preferred"、"加分"、"了解即可"
   - 每个技能标注：
     - name：技能名称（统一命名，如"React"而非"react"或"React.js"）
     - category：技能分类（frontend/backend/devops/database/...）
     - importance：required/preferred
     - level：basic/intermediate/advanced（根据 JD 描述判断）
     - confidence：提取置信度（0-1）

3. 职责和要求：
   - responsibilities：岗位职责列表
   - requirements：任职要求列表

4. 分析建议：
   - suggestions：给管理员的建议
     - 如"JD 中未明确技能级别，建议补充"
     - 如"检测到可能遗漏的技能：xxx"
     - 如"建议标准化技能名称：xxx → yyy"

输出严格 JSON：
{
  "title": "",
  "company": "",
  "level": "mid",
  "category": "frontend",
  "requiredSkills": [
    {"name": "React", "category": "frontend", "importance": "required", "level": "intermediate", "confidence": 0.95}
  ],
  "preferredSkills": [
    {"name": "TypeScript", "category": "frontend", "importance": "preferred", "level": "basic", "confidence": 0.9}
  ],
  "responsibilities": ["负责前端开发", ...],
  "requirements": ["3年以上经验", ...],
  "salaryRange": "",
  "location": "",
  "confidence": 0.9,
  "suggestions": ["建议补充 Node.js 技能"]
}

注意事项：
- 技能名称要标准化（React 不要写成 react/React.js）
- 如果 JD 中没有明确薪资/地点，留空字符串
- 置信度反映解析的准确性，模糊描述降低置信度
- 只输出 JSON，不要其他文字`;

    return [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `请解析以下岗位 JD：
${basicInfo?.title ? `\n岗位名称（已知）：${basicInfo.title}` : ''}
${basicInfo?.company ? `\n公司名称（已知）：${basicInfo.company}` : ''}

--- JD 原文 ---
${jdText}
--- 结束 ---`,
      },
    ];
  }

  // ── 解析输出 ──────────────────────────────────

  private parseResponse(raw: string, jdText: string): JDParseResult {
    try {
      const data = extractJson(raw);

      return {
        title: String(data.title || '').substring(0, 100),
        company: String(data.company || '').substring(0, 100),
        level: ['junior', 'mid', 'senior'].includes(data.level) ? data.level : 'mid',
        category: String(data.category || 'unknown').substring(0, 50),
        requiredSkills: this.parseSkills(data.requiredSkills, 'required'),
        preferredSkills: this.parseSkills(data.preferredSkills, 'preferred'),
        responsibilities: Array.isArray(data.responsibilities)
          ? data.responsibilities.slice(0, 10).map((r: any) => String(r).substring(0, 200))
          : [],
        requirements: Array.isArray(data.requirements)
          ? data.requirements.slice(0, 10).map((r: any) => String(r).substring(0, 200))
          : [],
        salaryRange: String(data.salaryRange || '').substring(0, 50),
        location: String(data.location || '').substring(0, 100),
        confidence: Math.min(1, Math.max(0, Number(data.confidence) || 0.5)),
        suggestions: Array.isArray(data.suggestions)
          ? data.suggestions.slice(0, 5).map((s: any) => String(s).substring(0, 200))
          : [],
      };
    } catch (e) {
      console.error('[JDParserAgent] JSON parse failed:', e.message);
      return {
        title: '解析失败',
        company: '',
        level: 'mid',
        category: 'unknown',
        requiredSkills: [],
        preferredSkills: [],
        responsibilities: [],
        requirements: [],
        salaryRange: '',
        location: '',
        confidence: 0,
        suggestions: ['JSON 解析失败，请检查 JD 格式或手动填写'],
      };
    }
  }

  private parseSkills(skills: any[], defaultImportance: 'required' | 'preferred'): JDSkill[] {
    if (!Array.isArray(skills)) return [];
    return skills.slice(0, 20).map((s: any) => ({
      name: String(s.name || '').substring(0, 50),
      category: String(s.category || 'other').substring(0, 50),
      importance: ['required', 'preferred'].includes(s.importance) ? s.importance : defaultImportance,
      level: ['basic', 'intermediate', 'advanced'].includes(s.level) ? s.level : 'intermediate',
      confidence: Math.min(1, Math.max(0, Number(s.confidence) || 0.7)),
    }));
  }
}
