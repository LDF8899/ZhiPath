import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LearningDomain, LearningGoalType, StarterLearningPath } from './learning-domain.types';

const SOFTWARE_ENGINEERING_DOMAIN: LearningDomain = {
  id: 'software-engineering',
  name: '软件工程',
  description: '面向岗位、项目与技术兴趣的工程能力成长。',
  goalTypes: ['career', 'course', 'project', 'interest'],
  terminology: {
    ability: '工程能力',
    phase: '成长阶段',
    evidence: '项目证据',
    assessment: '能力验证',
  },
  assessmentModes: ['项目作品', '代码评审', '知识测验'],
  evidenceTypes: ['代码提交', '项目产物', '技术说明'],
  passScore: 70,
  radarDimensions: [
    { id: 'product-interface', name: '产品与界面', abilityIds: ['web-foundations', 'ui-state'], weight: 0.34 },
    { id: 'service-data', name: '服务与数据', abilityIds: ['api-design', 'data-modeling'], weight: 0.33 },
    { id: 'quality-delivery', name: '质量与交付', abilityIds: ['quality-assurance', 'deployment'], weight: 0.33 },
  ],
  starterPaths: [
    {
      id: 'fullstack-project',
      title: '全栈项目实战',
      description: '通过一个可交付 Web 产品建立从界面到部署的完整工程能力。',
      goalType: 'project',
      phases: [
        {
          name: '产品与界面基础',
          abilities: [
            { id: 'web-foundations', name: 'Web 基础与语义化页面', estimatedMin: 360, priority: 10 },
            { id: 'ui-state', name: '交互与状态管理', estimatedMin: 420, priority: 9 },
          ],
        },
        {
          name: '服务与数据',
          abilities: [
            { id: 'api-design', name: 'API 设计与实现', estimatedMin: 420, priority: 9 },
            { id: 'data-modeling', name: '数据建模与持久化', estimatedMin: 360, priority: 8 },
          ],
        },
        {
          name: '交付与复盘',
          abilities: [
            { id: 'quality-assurance', name: '测试与质量保障', estimatedMin: 300, priority: 8 },
            { id: 'deployment', name: '部署、观测与项目复盘', estimatedMin: 300, priority: 7 },
          ],
        },
      ],
    },
  ],
};

const ENGLISH_DOMAIN: LearningDomain = {
  id: 'english',
  name: '英语',
  description: '面向考试、课程、证书与长期语言能力的系统学习。',
  goalTypes: ['course', 'exam', 'certificate', 'interest'],
  terminology: {
    ability: '语言能力',
    phase: '备考阶段',
    evidence: '学习证据',
    assessment: '水平测评',
  },
  assessmentModes: ['分项练习', '限时模拟', '作文批改', '口语反馈'],
  evidenceTypes: ['练习正确率', '作文版本', '听力记录', '模拟卷成绩'],
  passScore: 60,
  radarDimensions: [
    { id: 'vocabulary-context', name: '词汇与语境', abilityIds: ['cet6-diagnostic', 'cet6-vocabulary'], weight: 0.2 },
    { id: 'listening', name: '听力理解', abilityIds: ['cet6-listening'], weight: 0.2 },
    { id: 'reading', name: '阅读理解', abilityIds: ['cet6-reading'], weight: 0.2 },
    { id: 'writing-translation', name: '写作与翻译', abilityIds: ['cet6-writing', 'cet6-translation'], weight: 0.2 },
    { id: 'simulation-review', name: '模拟与复盘', abilityIds: ['cet6-mock-exam', 'cet6-review'], weight: 0.2 },
  ],
  starterPaths: [
    {
      id: 'cet-6',
      title: '大学英语六级 CET-6',
      description: '覆盖词汇、听力、阅读、写作与翻译，并用模拟考试持续校准。',
      goalType: 'exam',
      phases: [
        {
          name: '诊断与词汇',
          abilities: [
            { id: 'cet6-diagnostic', name: 'CET-6 入门诊断', estimatedMin: 120, priority: 10 },
            { id: 'cet6-vocabulary', name: '六级高频词汇与语境辨析', estimatedMin: 600, priority: 10 },
          ],
        },
        {
          name: '听力与阅读',
          abilities: [
            { id: 'cet6-listening', name: '六级听力理解', estimatedMin: 720, priority: 9 },
            { id: 'cet6-reading', name: '六级阅读理解', estimatedMin: 720, priority: 9 },
          ],
        },
        {
          name: '写作与翻译',
          abilities: [
            { id: 'cet6-writing', name: '六级写作表达', estimatedMin: 480, priority: 8 },
            { id: 'cet6-translation', name: '六级段落翻译', estimatedMin: 480, priority: 8 },
          ],
        },
        {
          name: '模拟与复盘',
          abilities: [
            { id: 'cet6-mock-exam', name: '六级全真模拟', estimatedMin: 540, priority: 10 },
            { id: 'cet6-review', name: '错题归因与冲刺复盘', estimatedMin: 360, priority: 9 },
          ],
        },
      ],
    },
  ],
};

const MATHEMATICS_DOMAIN: LearningDomain = {
  id: 'mathematics',
  name: '数学',
  description: '面向课程学习、升学考试与数学思维训练的系统路径。',
  goalTypes: ['course', 'exam', 'interest'],
  terminology: {
    ability: '数学能力',
    phase: '学习阶段',
    evidence: '解题证据',
    assessment: '步骤评价',
  },
  assessmentModes: ['分步解题', '章节测验', '限时真题', '错因诊断'],
  evidenceTypes: ['解题步骤', '章节正确率', '真题得分', '错题归因'],
  passScore: 70,
  radarDimensions: [
    { id: 'concept-calculation', name: '概念与运算', abilityIds: ['math-concept-diagnostic', 'math-basic-calculation'], weight: 0.2 },
    { id: 'calculus', name: '高等数学', abilityIds: ['calculus-core', 'multivariable-calculus'], weight: 0.25 },
    { id: 'linear-algebra', name: '线性代数', abilityIds: ['linear-algebra'], weight: 0.2 },
    { id: 'probability', name: '概率统计', abilityIds: ['probability-statistics'], weight: 0.15 },
    { id: 'papers-review', name: '真题与复盘', abilityIds: ['math-timed-papers', 'math-error-analysis'], weight: 0.2 },
  ],
  starterPaths: [
    {
      id: 'postgraduate-math',
      title: '考研数学',
      description: '覆盖基础诊断、高等数学、线性代数、概率统计与真题复盘。',
      goalType: 'exam',
      phases: [
        {
          name: '基础诊断',
          abilities: [
            { id: 'math-concept-diagnostic', name: '数学概念与计算诊断', estimatedMin: 180, priority: 10 },
            { id: 'math-basic-calculation', name: '基础运算与公式应用', estimatedMin: 480, priority: 9 },
          ],
        },
        {
          name: '高等数学主干',
          abilities: [
            { id: 'calculus-core', name: '极限、导数与积分', estimatedMin: 900, priority: 10 },
            { id: 'multivariable-calculus', name: '多元函数与级数', estimatedMin: 720, priority: 9 },
          ],
        },
        {
          name: '线代与概率',
          abilities: [
            { id: 'linear-algebra', name: '线性代数方法', estimatedMin: 720, priority: 9 },
            { id: 'probability-statistics', name: '概率论与数理统计', estimatedMin: 720, priority: 9 },
          ],
        },
        {
          name: '真题与复盘',
          abilities: [
            { id: 'math-timed-papers', name: '考研数学限时真题', estimatedMin: 720, priority: 10 },
            { id: 'math-error-analysis', name: '数学错因归类与复盘', estimatedMin: 420, priority: 9 },
          ],
        },
      ],
    },
  ],
};

const LEGAL_STUDIES_DOMAIN: LearningDomain = {
  id: 'legal-studies',
  name: '法律',
  description: '面向法律课程、职业资格考试与案例分析能力的系统学习。',
  goalTypes: ['course', 'exam', 'certificate', 'interest'],
  terminology: {
    ability: '法律能力',
    phase: '研习阶段',
    evidence: '论证证据',
    assessment: '案例评价',
  },
  assessmentModes: ['法条辨析', '案例分析', '客观题测验', '主观题批改'],
  evidenceTypes: ['法条引用', '案例论证', '客观题正确率', '主观题版本'],
  passScore: 60,
  radarDimensions: [
    { id: 'rule-system', name: '规则体系', abilityIds: ['law-system-map', 'legal-reasoning'], weight: 0.2 },
    { id: 'substantive-law', name: '实体法', abilityIds: ['substantive-law'], weight: 0.2 },
    { id: 'procedural-law', name: '程序法', abilityIds: ['procedural-law'], weight: 0.2 },
    { id: 'case-argument', name: '案例与论证', abilityIds: ['case-analysis', 'legal-writing'], weight: 0.25 },
    { id: 'simulation-review', name: '模拟与复盘', abilityIds: ['law-mock-exam', 'law-review'], weight: 0.15 },
  ],
  starterPaths: [
    {
      id: 'legal-professional-qualification',
      title: '国家统一法律职业资格考试',
      description: '以知识体系、案例分析、客观题与主观题训练构成完整备考路径。',
      goalType: 'certificate',
      phases: [
        {
          name: '体系与诊断',
          abilities: [
            { id: 'law-system-map', name: '法律知识体系与入门诊断', estimatedMin: 240, priority: 10 },
            { id: 'legal-reasoning', name: '法律关系与规范分析', estimatedMin: 480, priority: 9 },
          ],
        },
        {
          name: '实体法与程序法',
          abilities: [
            { id: 'substantive-law', name: '民刑实体法核心规则', estimatedMin: 900, priority: 10 },
            { id: 'procedural-law', name: '诉讼与程序法框架', estimatedMin: 720, priority: 9 },
          ],
        },
        {
          name: '案例与论证',
          abilities: [
            { id: 'case-analysis', name: '法律案例分析', estimatedMin: 720, priority: 9 },
            { id: 'legal-writing', name: '主观题论证与法律表达', estimatedMin: 600, priority: 9 },
          ],
        },
        {
          name: '模拟与复盘',
          abilities: [
            { id: 'law-mock-exam', name: '法考全真模拟', estimatedMin: 720, priority: 10 },
            { id: 'law-review', name: '法考错题归因与冲刺复盘', estimatedMin: 420, priority: 9 },
          ],
        },
      ],
    },
  ],
};

/**
 * AI 原生软件开发 —— CodeNova 当前聚焦的垂直领域
 *
 * 能力项按"让模型稳定输出 → 让答案有依据 → 让模型能做事 → 让它能上线"组织，
 * 每一步都要求可运行、可验证的产物，而不是概念复述。
 */
const AI_NATIVE_SOFTWARE_DOMAIN: LearningDomain = {
  id: 'ai-native-software',
  name: 'AI 原生软件开发',
  description: '从 LLM 调用与提示设计，到 RAG 可信生成、智能体编排与可上线交付的工程能力成长。',
  goalTypes: ['project', 'career', 'course', 'interest'],
  terminology: {
    ability: '能力项',
    phase: '成长阶段',
    evidence: '交付证据',
    assessment: '能力验证',
  },
  assessmentModes: ['可运行 Demo', '引用覆盖率检查', '评测集跑分', '代码走查'],
  evidenceTypes: ['可运行代码', '评测结果', '引用片段', '复盘记录'],
  passScore: 70,
  radarDimensions: [
    { id: 'foundation-output', name: '提示与结构化输出', abilityIds: ['llm-basics', 'prompt-engineering'], weight: 0.24 },
    { id: 'rag-grounding', name: '检索与可信生成', abilityIds: ['rag-pipeline', 'citation-grounding'], weight: 0.26 },
    { id: 'agent-orchestration', name: '智能体编排', abilityIds: ['agent-orchestration', 'tool-calling'], weight: 0.25 },
    { id: 'delivery-eval', name: '评测与交付', abilityIds: ['eval-observability', 'delivery-hardening'], weight: 0.25 },
  ],
  starterPaths: [
    {
      id: 'ai-app-engineer',
      title: 'AI 原生应用工程师',
      description: '做出一个带引用校验、可评测、能上线的 AI 应用，覆盖从提示到交付的完整链路。',
      goalType: 'project',
      phases: [
        {
          name: '让模型稳定输出',
          abilities: [
            { id: 'llm-basics', name: 'LLM 调用与结构化输出', estimatedMin: 300, priority: 10 },
            { id: 'prompt-engineering', name: '提示词设计与上下文组织', estimatedMin: 360, priority: 9 },
          ],
        },
        {
          name: '让答案有依据',
          abilities: [
            { id: 'rag-pipeline', name: '文档切片、召回与重排', estimatedMin: 480, priority: 10 },
            { id: 'citation-grounding', name: '引用校验与拒答策略', estimatedMin: 360, priority: 9 },
          ],
        },
        {
          name: '让模型能做事',
          abilities: [
            { id: 'agent-orchestration', name: '多智能体分工与编排', estimatedMin: 480, priority: 9 },
            { id: 'tool-calling', name: '工具调用与失败重试', estimatedMin: 360, priority: 8 },
          ],
        },
        {
          name: '让它能上线',
          abilities: [
            { id: 'eval-observability', name: '评测集、指标与可观测', estimatedMin: 420, priority: 9 },
            { id: 'delivery-hardening', name: '成本、缓存与降级交付', estimatedMin: 360, priority: 8 },
          ],
        },
      ],
    },
    {
      id: 'ai-foundation-course',
      title: 'AI 应用开发基础',
      description: '用更短的周期走完主干：能调用、能检索、能编排，先建立完整认知再深入。',
      goalType: 'course',
      phases: [
        {
          name: '概念与上手',
          abilities: [
            { id: 'llm-basics', name: 'LLM 调用与结构化输出', estimatedMin: 240, priority: 10 },
            { id: 'prompt-engineering', name: '提示词设计与上下文组织', estimatedMin: 300, priority: 9 },
          ],
        },
        {
          name: '检索与引用',
          abilities: [
            { id: 'rag-pipeline', name: '文档切片、召回与重排', estimatedMin: 420, priority: 10 },
            { id: 'citation-grounding', name: '引用校验与拒答策略', estimatedMin: 300, priority: 8 },
          ],
        },
        {
          name: '编排与评测',
          abilities: [
            { id: 'agent-orchestration', name: '多智能体分工与编排', estimatedMin: 420, priority: 9 },
            { id: 'eval-observability', name: '评测集、指标与可观测', estimatedMin: 300, priority: 8 },
          ],
        },
      ],
    },
  ],
};

const DOMAINS = [
  AI_NATIVE_SOFTWARE_DOMAIN,
  SOFTWARE_ENGINEERING_DOMAIN,
  ENGLISH_DOMAIN,
  MATHEMATICS_DOMAIN,
  LEGAL_STUDIES_DOMAIN,
];

@Injectable()
export class LearningDomainRegistry {
  private readonly domains = new Map(DOMAINS.map((domain) => [domain.id, domain]));

  list(): LearningDomain[] {
    return Array.from(this.domains.values());
  }

  get(domainId: string): LearningDomain {
    const domain = this.domains.get(domainId);
    if (!domain) throw new NotFoundException(`学习领域不存在: ${domainId}`);
    return domain;
  }

  resolvePath(domainId: string, goalType: LearningGoalType, starterPathId: string): {
    domain: LearningDomain;
    starterPath: StarterLearningPath;
  } {
    const domain = this.get(domainId);
    if (!domain.goalTypes.includes(goalType)) {
      throw new BadRequestException(`${domain.name}领域不支持目标类型: ${goalType}`);
    }
    const starterPath = domain.starterPaths.find((path) => path.id === starterPathId);
    if (!starterPath) throw new NotFoundException(`起步路线不存在: ${starterPathId}`);
    if (starterPath.goalType !== goalType) {
      throw new BadRequestException('起步路线与学习目标类型不匹配');
    }
    return { domain, starterPath };
  }
}
