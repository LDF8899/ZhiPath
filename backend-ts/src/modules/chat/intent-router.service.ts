import { Injectable } from '@nestjs/common';
import { LlmService } from '../../services/llm.service';

/**
 * 意图路由器 — 对齐 Python agents/intent_router.py
 *
 * Phase B: 关键词匹配（0延迟，覆盖 80% 常见意图）
 * Phase C: LLM Tool Calling（1-2s，处理模糊/复杂意图）
 */

// ── Phase B: 关键词意图规则 ──────────────────────────────────

interface IntentRule {
  name: string;
  keywords: string[];
  description: string;
}

const INTENT_RULES: IntentRule[] = [
  {
    name: 'generate_path',
    keywords: ['学习计划', '学习路径', '规划路径', '制定计划', '怎么学', '帮我规划', '学习方案', '三个月'],
    description: '生成学习路径',
  },
  {
    name: 'recommend_jobs',
    keywords: ['推荐岗位', '什么岗位', '找工作', '匹配岗位', '有什么岗位', '适合我', '岗位推荐'],
    description: '推荐适合的岗位',
  },
  {
    name: 'set_target_job',
    keywords: ['设为目标', '就这个', '选这个', '确定这个', '这个岗位', '目标岗位'],
    description: '设置目标岗位',
  },
  {
    name: 'generate_exam',
    keywords: ['出题', '考试', '测试我', '练习题', '题库', '做题', '考考我', '出几道题'],
    description: '生成练习题/考试',
  },
  {
    name: 'show_progress',
    keywords: ['进度', '学了多少', '完成情况', '学习进度', '我的进度'],
    description: '查看学习进度',
  },
  {
    name: 'show_today_tasks',
    keywords: ['今天学什么', '今日任务', '今天的任务', '今天做什么'],
    description: '查看今日任务',
  },
  {
    name: 'recommend_resources',
    keywords: ['学习资源', '推荐教程', '推荐课程', '学什么资料', '有什么资料'],
    description: '推荐学习资源',
  },
  {
    name: 'match_analysis',
    keywords: ['匹配度', '差距分析', '还差什么', '技能差距'],
    description: '分析匹配度和技能差距',
  },
  {
    name: 'generate_animation',
    keywords: ['动画', '动画演示', '可视化演示', '动起来', '动态演示', '演示一下'],
    description: '生成 HTML 动画演示',
  },
  {
    name: 'generate_diagram',
    keywords: ['流程图', '图表', '画个图', '架构图', '时序图', '思维导图', '图解', '画出来'],
    description: '生成 Mermaid 图表',
  },
  {
    name: 'generate_video',
    keywords: ['短视频', '生成视频', '教学视频', '视频讲解', '做个视频'],
    description: '生成短视频',
  },
  {
    name: 'generate_avatar',
    keywords: ['数字人', '虚拟教师', '虚拟老师', '数字老师', '真人讲解'],
    description: '生成数字人讲解',
  },
];

// ── Phase C: LLM Tool Calling 定义 ──────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_learning_path',
      description: '为用户生成分阶段的学习路径。触发词：学习计划、学习路径、怎么学、帮我规划、制定计划、学习方案、学XX要多久、入门XX怎么学。当用户提到想学什么、制定计划、规划学习时调用。',
      parameters: {
        type: 'object',
        properties: {
          target_job_id: { type: 'integer', description: '目标岗位ID，如果用户没有指定则传 0' },
          direction: { type: 'string', description: "学习方向，如'前端开发'、'Python后端'" },
          duration_months: { type: 'integer', description: '计划时长（月），默认3' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_jobs',
      description: '推荐适合用户的岗位。触发词：推荐岗位、有什么岗位、找工作、适合我、我能做什么、岗位推荐、匹配岗位。当用户问有什么岗位、推荐岗位、找工作时调用。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词，如岗位名称、技术栈' },
          location: { type: 'string', description: '工作地点' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_target_job',
      description: '设置用户的目标岗位。当用户确认选择某个岗位时调用。',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'integer', description: '岗位ID' },
        },
        required: ['job_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_exam',
      description: '为用户生成练习题或考试题。触发词：出题、考试、测试我、练习题、做题、考考我、出几道题、刷题、巩固一下、检验学习成果。当用户想做题、考试、测试自己时调用。',
      parameters: {
        type: 'object',
        properties: {
          skill_name: { type: 'string', description: "技能名称，如'React'、'JavaScript'" },
          question_count: { type: 'integer', description: '题目数量，默认5' },
          question_type: {
            type: 'string',
            description: '题目类型：choice(选择题)、coding(编程题)、mixed(混合)',
            enum: ['choice', 'coding', 'mixed'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_progress',
      description: '查询用户的学习进度和完成情况。触发词：进度、学了多少、完成情况、学习进度、我的进度、我学到哪了、还剩多少。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_today_tasks',
      description: '查询用户今天的学习任务。触发词：今天学什么、今日任务、今天的任务、今天做什么、接下来学啥。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'match_analysis',
      description: '分析用户技能与目标岗位的匹配度和差距。触发词：匹配度、差距分析、还差什么、技能差距、我够不够格、能不能投。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_resources',
      description: '推荐学习资源。触发词：学习资源、推荐教程、推荐课程、学什么资料、有什么资料、看什么书、看什么视频。当用户问学什么资料、推荐教程时调用。',
      parameters: {
        type: 'object',
        properties: {
          skills: {
            type: 'array',
            items: { type: 'string' },
            description: '需要资源的技能列表',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_animation',
      description: '为某个技术概念生成可视化 HTML 动画演示。触发词：动画、动画演示、可视化演示、动起来、动态演示、演示一下、给我看看XX怎么运行的、XX是怎么工作的。当用户想看动画、动态演示、可视化某个概念的执行过程时调用。',
      parameters: {
        type: 'object',
        properties: {
          skill_name: { type: 'string', description: "要演示的技术概念，如'快速排序'、'事件循环'、'React 渲染'" },
        },
        required: ['skill_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_diagram',
      description: '为某个技术主题生成 Mermaid 图表（流程图/架构图/时序图/思维导图）。触发词：流程图、图表、画个图、架构图、时序图、思维导图、图解、画出来、帮我画、画一下。当用户想画图、看流程图、看架构关系时调用。',
      parameters: {
        type: 'object',
        properties: {
          skill_name: { type: 'string', description: '要画图的技术主题' },
          diagram_type: {
            type: 'string',
            description: '图表类型',
            enum: ['flowchart', 'sequence', 'architecture', 'mindmap'],
          },
        },
        required: ['skill_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description: '为某个技术概念生成 2-3 分钟的带旁白教学视频（含字幕、代码演示、流程图）。触发词：短视频、生成视频、教学视频、视频讲解、做个视频、录个视频、视频教程。当用户想看视频、生成教学视频、视频讲解时调用。',
      parameters: {
        type: 'object',
        properties: {
          skill_name: { type: 'string', description: '要生成视频的技术概念' },
          difficulty: {
            type: 'string',
            description: '难度：beginner(入门)、intermediate(进阶)、advanced(高级)',
            enum: ['beginner', 'intermediate', 'advanced'],
          },
        },
        required: ['skill_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_avatar',
      description: '为某个技术概念生成数字人虚拟教师讲解。触发词：数字人、虚拟教师、虚拟老师、数字老师、真人讲解、找个老师讲、有人讲一下。当用户想要真人/虚拟老师讲解时调用。',
      parameters: {
        type: 'object',
        properties: {
          skill_name: { type: 'string', description: '要讲解的技术概念' },
        },
        required: ['skill_name'],
      },
    },
  },
];

@Injectable()
export class IntentRouterService {
  constructor(private llmService: LlmService) {}

  /** Phase B: 关键词匹配意图 — 仅匹配高置信度、无歧义的关键词
   *  多模态意图（视频/动画/图表/数字人）不在此匹配，全部交给 Phase C LLM 判断
   */
  matchIntent(message: string): { name: string; filters: Record<string, any> } | null {
    const msg = message.trim();

    // ── 通用关键词匹配（仅非多模态意图） ──
    for (const rule of INTENT_RULES) {
      // 跳过多模态意图，交给 LLM 判断
      if (['generate_video', 'generate_animation', 'generate_diagram', 'generate_avatar'].includes(rule.name)) {
        continue;
      }
      for (const kw of rule.keywords) {
        if (msg.includes(kw)) {
          console.log(`[IntentRouter] Phase B match: ${rule.name} (keyword=${kw})`);
          return {
            name: rule.name,
            filters: this.extractFilters(msg, rule.name),
          };
        }
      }
    }

    return null;
  }

  /** Phase C: LLM Tool Calling — 对齐 Python llm_decide_action() */
  async llmDecideAction(
    messages: Array<{ role: string; content: string }>,
    userContext = '',
  ): Promise<{ name: string; filters: Record<string, any> } | null> {
    const msg = messages[messages.length - 1]?.content?.trim() || '';
    const system = `你是智途 AI 助教的动作决策器。根据用户消息，决定是否需要调用系统工具。

${userContext}

规则：
1. 如果用户的需求可以通过系统工具完成，**必须调用**对应的 tool
2. 只有纯闲聊、打招呼、完全无关的话题才不调用 tool
3. 一次只调用一个最匹配的 tool
4. 用户说"帮我""我想""能不能""可以吗"等请求性语句时，几乎一定需要调用 tool

**重要：以下情况不要调用 tool：**
- 用户在追问、确认、解释之前的内容（如"怎么生成的""为什么""然后呢""解释一下"）
- 用户在讨论之前工具返回的结果（如"这个答案不对""换个题""难点在哪里"）
- 用户的话中虽然包含"生成""视频"等词，但上下文明显是在讨论之前的内容
- 只有用户**明确请求新的操作**时才调用 tool`;

    const toolMessages = [
      { role: 'system', content: system },
      ...messages.slice(-6),
    ];

    try {
      const result = await this.llmService.toolCalling(toolMessages, TOOLS, {
        temperature: 0.1,
        maxTokens: 256,
      });

      if (result.toolCalls.length > 0) {
        const tc = result.toolCalls[0];
        const funcName = tc.function.name;
        const funcArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};

        // 防护：多模态意图（视频/动画/数字人/图表）必须消息中有明确关键词，否则拒绝
        const multimodalIntents = ['generate_video', 'generate_animation', 'generate_avatar', 'generate_diagram'];
        if (multimodalIntents.includes(funcName)) {
          const multimodalKeywords: Record<string, string[]> = {
            generate_video: ['视频', '短视频', '教学视频'],
            generate_animation: ['动画', '动画演示', '可视化', '动起来'],
            generate_avatar: ['数字人', '虚拟老师', '虚拟教师', '真人讲解'],
            generate_diagram: ['流程图', '架构图', '时序图', '思维导图', '图解', '画个图', '画出来'],
          };
          const keywords = multimodalKeywords[funcName] || [];
          const hasKeyword = keywords.some(kw => msg.includes(kw));
          if (!hasKeyword) {
            console.log(`[IntentRouter] Phase C rejected ${funcName}: no multimodal keyword in "${msg}"`);
            return null;
          }
        }

        console.log(`[IntentRouter] Phase C match: ${funcName} args=`, funcArgs);
        return { name: funcName, filters: funcArgs };
      }
    } catch (e) {
      console.warn('[IntentRouter] Phase C tool calling failed:', e.message);
    }

    return null;
  }

  /** 从消息中提取过滤参数 — 对齐 Python _extract_filters() */
  private extractFilters(message: string, intentName: string): Record<string, any> {
    const filters: Record<string, any> = {};

    if (intentName === 'recommend_jobs') {
      const directions = ['前端', '后端', '全栈', 'Python', 'Java', 'React', 'Vue', 'AI', '算法', '测试', '运维'];
      for (const d of directions) {
        if (message.toLowerCase().includes(d.toLowerCase())) {
          filters.keyword = d;
          break;
        }
      }
    } else if (intentName === 'set_target_job') {
      const idMatch = message.match(/#(\d+)/);
      if (idMatch) filters.jobId = parseInt(idMatch[1], 10);
    } else if (intentName === 'generate_path') {
      const idMatch = message.match(/岗位[ID]*[：:]*\s*(\d+)/);
      if (idMatch) filters.targetJobId = parseInt(idMatch[1], 10);
    } else if (intentName === 'generate_exam') {
      const skillMatch = message.match(/(?:关于|考|测试)\s*(\w+)/);
      if (skillMatch) filters.skillName = skillMatch[1];
    } else if (
      intentName === 'generate_animation' ||
      intentName === 'generate_diagram' ||
      intentName === 'generate_video' ||
      intentName === 'generate_avatar'
    ) {
      const skill = this.extractSkillForMultimodal(message, intentName);
      if (skill) filters.skillName = skill;
      if (intentName === 'generate_video') {
        if (message.includes('高级') || message.includes('深入') || message.includes('advanced')) filters.difficulty = 'advanced';
        else if (message.includes('进阶') || message.includes('中级') || message.includes('intermediate')) filters.difficulty = 'intermediate';
        else filters.difficulty = 'beginner';
      }
      if (intentName === 'generate_diagram') {
        if (message.includes('时序图')) filters.diagramType = 'sequence';
        else if (message.includes('架构图')) filters.diagramType = 'architecture';
        else if (message.includes('思维导图')) filters.diagramType = 'mindmap';
        else filters.diagramType = 'flowchart';
      }
    }

    return filters;
  }

  /**
   * 从消息中提取多模态目标技能名。
   * 策略：剥离意图触发词（动画/流程图/视频...）和常见动词，剩余短语作为技能名。
   */
  private extractSkillForMultimodal(message: string, intentName: string): string {
    let s = message.trim();
    // 引号内优先
    const quoted = s.match(/[「"'""]([^」"'""]{1,30})[」"'""]/);
    if (quoted) return quoted[1].trim();

    // “演示一下 XXX 的动画” / “给我画 XXX 的流程图” → 取“的”之前的核心词
    const triggerWords = [
      '动画演示', '可视化演示', '动态演示', '动画', '动起来', '演示一下', '演示',
      '流程图', '架构图', '时序图', '思维导图', '图表', '图解', '画个图', '画出来', '画',
      '短视频', '教学视频', '视频讲解', '生成视频', '做个视频', '视频',
      '数字人', '虚拟教师', '虚拟老师', '数字老师', '真人讲解', '讲解',
      '帮我', '给我', '请', '生成', '做一个', '做个', '来一个', '来个', '一下', '的', '一个',
    ];
    for (const w of triggerWords) {
      s = s.split(w).join(' ');
    }
    s = s.replace(/[，。、！？,.!?]/g, ' ').replace(/\s+/g, ' ').trim();
    return s.length >= 1 && s.length <= 30 ? s : '';
  }
}
