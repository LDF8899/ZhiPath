# 智能体目录

统一管理所有智能体，每个智能体是一个独立的 NestJS Service。

## 📁 目录结构

```
backend-ts/src/services/agents/
├── lecture-agent.service.ts      # 讲义生成
├── reading-agent.service.ts      # 拓展阅读
├── code-agent.service.ts         # 代码案例
├── path-agent.service.ts         # 学习路径（LLM 版）
├── assess-agent.service.ts       # 学习评估
├── jd-parser-agent.service.ts    # 岗位 JD 解析
├── reviewer-agent.service.ts     # 质量审查 + 错题分析
├── resume-agent.service.ts       # 简历生成
├── profile-agent.service.ts      # 用户画像分析
├── exam-agent.service.ts         # 考试出题
├── skill-gap-agent.service.ts    # 技能差距分析
├── daily-task-agent.service.ts   # 每日任务调度
├── news-agent.service.ts         # 资讯生成
├── orchestrator-agent.service.ts # 中控智能体（意图识别 + 任务编排）
├── index.ts                      # 统一导出
└── README.md                     # 本文件
```

## 📋 智能体列表

### 原有 5 个（内容生成）

| 智能体 | 类名 | 功能 | 输入 | 输出 |
|--------|------|------|------|------|
| 讲义生成 | `LectureAgentService` | 生成结构化讲义 + 练习题 | skillName, level | `{ content, exercises, keyPoints }` |
| 拓展阅读 | `ReadingAgentService` | 生成多篇拓展阅读 | skillName, count | `{ items[], studyAdvice }` |
| 代码案例 | `CodeAgentService` | 生成可运行代码案例 | skillName, language, count | `{ examples[], bestPractices }` |
| 学习路径 | `PathAgentService` | LLM 生成学习路径 | goal, currentLevel | `{ stages[], tips[] }` |
| 学习评估 | `AssessAgentService` | 多维度评估学习效果 | learningData, goal | `{ overallScore, dimensions[] }` |

### 新增 8 个（业务智能体）

| 智能体 | 类名 | 功能 | 输入 | 输出 |
|--------|------|------|------|------|
| JD 解析 | `JDParserAgentService` | 解析岗位 JD，提取技能要求 | jdText | `{ requiredSkills[], preferredSkills[] }` |
| 质量审查 | `ReviewerAgentService` | 内容审查 + 答案验证 + 错题分析 | content / questions / wrongQuestions | `{ passed, score, issues[] }` |
| 简历生成 | `ResumeAgentService` | 根据画像+岗位生成简历 | profile, targetJob | `{ html, sections[], highlights[] }` |
| 画像分析 | `ProfileAgentService` | 分析学习数据，生成报告 | learningData | `{ summary, achievements[], recommendations[] }` |
| 考试出题 | `ExamAgentService` | 生成高质量考试题目 | config | `{ questions[], metadata }` |
| 技能差距 | `SkillGapAgentService` | 用户 vs 岗位差距分析 | userSkills, targetJob | `{ matchScore, gapSkills[], improvementPlan }` |
| 每日任务 | `DailyTaskAgentService` | 从路径抽取每日任务 | currentPath, availableMinutes | `{ mainlineTasks[], sideTasks[] }` |
| 资讯生成 | `NewsAgentService` | 趋势分析 + 摘要提取 + 推荐 | skills / articles | `{ trends[], hotSkills[] }` |
| **中控智能体** | `OrchestratorAgentService` | 意图识别 + 任务编排 | query, context | `{ intent, tasks[], summary, data }` |

## 🚀 快速添加新智能体

### 1. 创建 Service 文件

```typescript
// backend-ts/src/services/agents/xxx-agent.service.ts

import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';

/**
 * XXX Agent
 *
 * 功能：xxx
 * 场景：xxx
 */

// 定义输入/输出类型
export interface XxxInput { ... }
export interface XxxOutput { ... }

@Injectable()
export class XxxAgentService {
  constructor(private llmService: LlmService) {}

  /**
   * 主方法
   */
  async doSomething(input: XxxInput): Promise<XxxOutput> {
    // 1. 参数验证
    if (!input.xxx) throw new Error('xxx');

    // 2. 构建 Prompt
    const messages = this.buildPrompt(input);

    // 3. 调用 LLM
    const raw = await this.llmService.chatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 4096,
      tier: 'pro',  // 'flash' 或 'pro'
    });

    // 4. 解析返回
    return this.parseResponse(raw);
  }

  // ── Prompt 设计 ──────────────────────────────────

  private buildPrompt(input: XxxInput): { role: string; content: string }[] {
    return [
      {
        role: 'system',
        content: `你是 xxx 专家...

输出严格 JSON：
{
  "field": "value"
}

只输出 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请 xxx：${input.xxx}`,
      },
    ];
  }

  // ── 解析输出 ──────────────────────────────────

  private parseResponse(raw: string): XxxOutput {
    try {
      const data = JSON.parse(this.extractJson(raw));
      return { /* ... */ };
    } catch {
      return { /* 默认值 */ };
    }
  }

  // ── 工具函数 ──────────────────────────────────

  private extractJson(raw: string): string {
    try { JSON.parse(raw); return raw; } catch {}

    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try { JSON.parse(codeBlock[1].trim()); return codeBlock[1].trim(); } catch {}
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { JSON.parse(jsonMatch[0]); return jsonMatch[0]; } catch {}
    }

    return '{}';
  }
}
```

### 2. 注册到 index.ts

```typescript
// 在 index.ts 中添加

export { XxxAgentService } from './xxx-agent.service';
export type { XxxInput, XxxOutput } from './xxx-agent.service';
```

### 3. 注册到 Module

```typescript
// 在 agents.module.ts 中添加

import { XxxAgentService } from '../../services/agents';

@Module({
  providers: [..., XxxAgentService],
  exports: [..., XxxAgentService],
})
export class AgentsModule {}
```

### 4. 使用

```typescript
// 在其他 Service 或 Controller 中

import { XxxAgentService } from '../../services/agents';

@Injectable()
export class SomeService {
  constructor(private xxxAgent: XxxAgentService) {}

  async doSomething() {
    const result = await this.xxxAgent.doSomething({ xxx: '...' });
    // ...
  }
}
```

## ⚠️ 注意事项

1. **统一使用 LlmService** — 不要自己写 fetch 调用，使用注入的 `this.llmService.chatCompletion()`
2. **tier 选择**：
   - `flash` — 快速便宜，用于简单任务（标签提取、鼓励语生成）
   - `pro` — 推理能力强，用于复杂任务（内容生成、分析审查）
3. **maxTokens 必须设置** — 防止输出过长被截断
4. **JSON 解析要健壮** — LLM 返回格式不稳定，必须有 try-catch 兜底
5. **错误不要吞掉** — throw 出去让调用方处理
6. **类型要导出** — 在 index.ts 中 export type，方便其他模块使用

## 🔗 相关文件

- LLM 服务：`backend-ts/src/services/llm.service.ts`
- Agents 模块：`backend-ts/src/modules/agents/agents.module.ts`
- Agents 控制器：`backend-ts/src/modules/agents/agents.controller.ts`
- 智能体办公室：`backend-ts/src/modules/agent-office/agent-office.controller.ts`
- 队列处理器：`backend-ts/src/modules/queue/agent.processor.ts`
