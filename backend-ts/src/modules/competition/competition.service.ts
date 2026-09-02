import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CompetitionLearner,
  CompetitionLoopResult,
  basePathNodes,
  competitionLearners,
  evidenceTrailBase,
  knowledgeSlice,
} from './competition.fixtures';

@Injectable()
export class CompetitionService {
  health() {
    return {
      status: 'ok',
      service: 'CodeNova Competition API',
      version: '1.0.0',
      capabilities: ['demo-cases', 'run-loop', 'feedback-decision'],
    };
  }

  getDemoCases() {
    return {
      project: {
        name: '焕星·码枢 CodeNova',
        subtitle: '基于原生多智能体协同与动态可视化引擎的垂直软件开发按需导学决策系统',
        topic: '领域知识个性化生成与多智能体协同决策系统研究',
        organizer: '上海云之脑智能科技有限公司',
      },
      domain: {
        id: 'ai-native-software-development',
        name: 'AI 原生软件开发技能培训',
        knowledgeSlice,
      },
      learners: competitionLearners,
    };
  }

  runLoop(input?: { learnerId?: string; quizAccuracy?: number }): CompetitionLoopResult {
    const learner = this.resolveLearner(input?.learnerId);
    const quizAccuracy = this.normalizeAccuracy(input?.quizAccuracy);
    const decision = this.decide(quizAccuracy, learner);
    const matchScore = this.matchScore(learner, quizAccuracy);
    const severityBoost = learner.level === 'foundation' ? 14 : learner.level === 'transition' ? 10 : 4;

    return {
      learner,
      domain: {
        id: 'ai-native-software-development',
        name: 'AI 原生软件开发技能培训',
        knowledgeSlice: 'React/Vite + NestJS + RAG + 多 Agent 编排 + 软件交付质量',
        targetRole: learner.targetRole,
      },
      agents: [
        {
          id: 'profile',
          name: '学情诊断 Agent',
          role: '读取学历背景、理论测试、实践记录，定位理论底盘与技能盲区。',
          status: 'success',
          output: `${learner.name} 的理论得分 ${learner.theoryScore}，实践得分 ${learner.practiceScore}，优先补齐 ${learner.blindSpots[0]}。`,
          confidence: 91,
        },
        {
          id: 'domain',
          name: '领域专家 Agent',
          role: '从软件开发知识库切片召回约束内容，给生成 Agent 提供可引用依据。',
          status: 'success',
          output: `命中 ${knowledgeSlice.length} 个知识片段，覆盖前端工程、后端服务、RAG、多 Agent 与交付质量。`,
          confidence: 94,
        },
        {
          id: 'generator',
          name: '资源生成 Agent',
          role: '按学习者画像生成讲义、实操指南和分阶测试题。',
          status: 'success',
          output: `已生成 ${decision.action === '进阶挑战' ? '挑战型' : decision.action === '降维解释' ? '入门型' : '巩固型'}资源包，难度与每周 ${learner.weeklyHours} 小时节奏匹配。`,
          confidence: 88,
        },
        {
          id: 'reviewer',
          name: '审核裁判 Agent',
          role: '交叉验证事实、引用、难度和格式，阻断无依据内容。',
          status: matchScore >= 70 ? 'success' : 'warning',
          output: `引用覆盖率 ${this.citationCoverage(learner)}%，幻觉风险 ${this.hallucinationRisk(learner)}%，建议保留证据链并补充验收脚本。`,
          confidence: 90,
        },
        {
          id: 'decision',
          name: '路径决策 Agent',
          role: '融合测试反馈与审核结果，决定降维解释、补弱巩固或进阶挑战。',
          status: 'success',
          output: `本轮决策为“${decision.action}”：${decision.reason}`,
          confidence: 89,
        },
      ],
      report: {
        matchScore,
        hallucinationRisk: this.hallucinationRisk(learner),
        citationCoverage: this.citationCoverage(learner),
        blindSpots: learner.blindSpots.map((skill, index) => ({
          skill,
          severity: Math.min(95, 58 + severityBoost + index * 8),
          reason: index === 0 ? '先验测评与实操记录共同指向该短板' : '相关任务完成度低于目标岗位基线',
        })),
        difficultyCurve: this.difficultyCurve(learner, quizAccuracy),
        pathNodes: basePathNodes.map((node, index) => ({
          ...node,
          status: index <= (decision.action === '进阶挑战' ? 2 : 1) ? node.status : 'next',
        })),
      },
      resources: this.resourcesFor(learner, decision.action),
      evidenceTrail: this.evidenceTrailFor(learner),
      debate: this.debateFor(decision.action, learner),
      decision,
    };
  }

  feedback(input?: { learnerId?: string; quizAccuracy?: number }) {
    const learner = this.resolveLearner(input?.learnerId);
    return {
      learnerId: learner.id,
      quizAccuracy: this.normalizeAccuracy(input?.quizAccuracy),
      decision: this.decide(input?.quizAccuracy, learner),
    };
  }

  private resolveLearner(learnerId?: string): CompetitionLearner {
    const learner = competitionLearners.find((item) => item.id === learnerId) || competitionLearners[0];
    if (!learner) throw new NotFoundException('No competition learner fixtures available');
    return learner;
  }

  private normalizeAccuracy(value?: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return 72;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private decide(quizAccuracy: number | undefined, learner: CompetitionLearner): CompetitionLoopResult['decision'] {
    const accuracy = this.normalizeAccuracy(quizAccuracy);
    if (accuracy < 60) {
      return {
        action: '降维解释',
        reason: `本轮正确率 ${accuracy}% 低于 60%，需要把 ${learner.blindSpots[0]} 拆成更小概念并增加示例。`,
        nextTasks: ['生成 10 分钟微讲义', '补 3 道基础诊断题', '安排一次带提示的最小实操'],
      };
    }
    if (accuracy >= 85) {
      return {
        action: '进阶挑战',
        reason: `本轮正确率 ${accuracy}% 达到进阶阈值，可以从知识理解推进到工程交付。`,
        nextTasks: ['生成跨模块挑战任务', '加入测试与验收标准', '要求提交项目证据并进入审核'],
      };
    }
    return {
      action: '补弱巩固',
      reason: `本轮正确率 ${accuracy}% 处于巩固区间，优先修复关键盲区再进入下一阶段。`,
      nextTasks: ['生成错因复盘卡', '补充同构变式练习', '保持当前路径难度并缩短反馈周期'],
    };
  }

  private matchScore(learner: CompetitionLearner, quizAccuracy: number): number {
    const base = Math.round((learner.theoryScore + learner.practiceScore + this.normalizeAccuracy(quizAccuracy)) / 3);
    const levelBonus = learner.level === 'project' ? 8 : learner.level === 'transition' ? 3 : 0;
    return Math.max(45, Math.min(94, base + levelBonus));
  }

  private hallucinationRisk(learner: CompetitionLearner): number {
    return learner.level === 'foundation' ? 4.8 : learner.level === 'transition' ? 4.2 : 3.6;
  }

  private citationCoverage(learner: CompetitionLearner): number {
    return learner.level === 'project' ? 94 : learner.level === 'transition' ? 91 : 89;
  }

  private difficultyCurve(learner: CompetitionLearner, quizAccuracy: number) {
    const accuracy = this.normalizeAccuracy(quizAccuracy);
    const start = learner.level === 'foundation' ? 32 : learner.level === 'transition' ? 44 : 56;
    const lift = accuracy >= 85 ? 12 : accuracy < 60 ? -4 : 6;
    return ['第1周', '第2周', '第3周', '第4周'].map((week, index) => ({
      week,
      target: Math.min(92, start + index * 12),
      adapted: Math.max(24, Math.min(96, start + lift + index * (accuracy >= 85 ? 14 : 10))),
    }));
  }

  private evidenceTrailFor(learner: CompetitionLearner): CompetitionLoopResult['evidenceTrail'] {
    return evidenceTrailBase.map((item, index) => ({
      ...item,
      claim:
        index === 0
          ? `${learner.name} 的首要盲区是 ${learner.blindSpots[0]}，资源难度需与当前工程前置知识保持一致。`
          : item.claim,
      coverage: Math.min(98, item.coverage + (learner.level === 'project' ? 2 : 0)),
    }));
  }

  private debateFor(
    action: CompetitionLoopResult['decision']['action'],
    learner: CompetitionLearner,
  ): CompetitionLoopResult['debate'] {
    const needsRevision = learner.level === 'foundation' || action === '降维解释';
    return [
      {
        agent: '领域专家 Agent',
        stance: `资源必须围绕 ${learner.blindSpots[0]}，不得跳到未掌握的高阶框架细节。`,
        verdict: 'pass',
      },
      {
        agent: '审核裁判 Agent',
        stance: needsRevision
          ? '检测到生成内容难度偏高，要求改写为概念图 + 最小可运行样例。'
          : '证据链完整，允许保留进阶任务，但需附带验收脚本。',
        verdict: needsRevision ? 'revise' : 'pass',
      },
      {
        agent: '路径决策 Agent',
        stance: `采纳“${action}”策略，并把下一轮测试结果写回学习者画像。`,
        verdict: 'pass',
      },
    ];
  }

  private resourcesFor(learner: CompetitionLearner, action: CompetitionLoopResult['decision']['action']) {
    const level = action === '进阶挑战' ? 'L3 挑战' : action === '降维解释' ? 'L1 入门' : 'L2 巩固';
    return [
      {
        type: 'lecture' as const,
        title: `${learner.blindSpots[0]}定制讲义`,
        level,
        summary: '用学习者熟悉的背景解释核心概念，并标注必须掌握的知识边界。',
        sections: ['学习目标', '核心概念', '常见误区', '复盘问题'],
        evidence: ['React/Vite 前端工程', '多 Agent 协同：诊断、生成、审核、决策角色分工'],
      },
      {
        type: 'labGuide' as const,
        title: `${learner.targetRole}实操指南`,
        level,
        summary: '把知识点转成可验收的工程任务，包含环境、步骤、检查点和提交证据。',
        sections: ['环境准备', '任务步骤', '验收标准', '故障排查'],
        evidence: ['NestJS 后端工程', '软件交付质量'],
      },
      {
        type: 'stagedQuiz' as const,
        title: `${learner.blindSpots[1]}分阶测试题`,
        level,
        summary: '按基础题、应用题、挑战题组织，答题反馈会驱动下一轮路径调整。',
        sections: ['基础理解', '工程应用', '挑战迁移', '错因标签'],
        evidence: ['RAG 知识库工程', '软件交付质量'],
      },
    ];
  }
}
