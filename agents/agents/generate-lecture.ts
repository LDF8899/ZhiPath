/**
 * 讲义生成 Agent v3.0（优化版）
 *
 * 优化：使用共享 callLLM、统一结构、更好的 Prompt
 */

import { ActionResult, LLMConfig, callLLM, extractJson } from './shared';

// ============================================================
// 类型定义
// ============================================================

interface Exercise {
  number: number;
  type: 'choice' | 'fill' | 'short_answer' | 'coding';
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

interface LectureData {
  skill: string;
  level: string;
  content: string;
  exercises: Exercise[];
  keyPoints: string[];
  prerequisites: string[];
  estimatedTime: string;
  wordCount: number;
}

// ============================================================
// Prompt 设计
// ============================================================

function buildPrompt(
  skillName: string,
  level: 'beginner' | 'intermediate' | 'advanced',
  extra?: string
): { role: string; content: string }[] {
  const levelConfig = {
    beginner: {
      desc: '零基础入门',
      style: '假设学生完全没接触过这个技术，用生活类比引入每个概念',
      depth: '只讲核心用法，避免底层细节',
      constraint: '不要使用学生可能不知道的术语，首次出现必须解释',
    },
    intermediate: {
      desc: '进阶提升',
      style: '假设学生用过但不深入，重点讲"为什么这样设计"',
      depth: '深入核心机制和最佳实践',
      constraint: '对比不同方案的 trade-off',
    },
    advanced: {
      desc: '高级深入',
      style: '假设学生有实战经验，讲底层原理和边界情况',
      depth: '深入源码级实现和性能优化',
      constraint: '讨论设计决策的 trade-off 和社区争议',
    },
  };
  const config = levelConfig[level];

  const systemPrompt = `你是一位有 10 年教学经验的技术讲师，擅长把复杂概念讲得让初学者真正理解。请为「${skillName}」写一份讲义（${config.desc}）。

## 教学原则（必须遵守）

1. **先给直觉，再给定义**。不要一上来就甩术语。先用一个场景、故事或问题让学生"感受到"这个概念存在的必要性。
2. **贯穿全文的类比**。选一个贴切的生活类比，在整个讲义中反复使用它来解释不同方面。不要碎片化地用一堆不同的类比。
3. **"没有 X 之前 vs 有了 X 之后"对比**。每个核心概念都要展示：没有它时的痛苦 → 引入它 → 有了它后的改善。
4. **思考暂停**。在讲完 2-3 个核心概念后，设置一个"想一想"环节：先提一个开放性问题，让学生思考 3 秒钟，然后再给出答案和解释。
5. **代码必须讲"为什么"**。每个代码示例前解释"为什么要这样写"，代码后解释"如果改成别的会怎样"。
6. **${config.style}**
7. **${config.constraint}**

## 讲义结构（Markdown）

# ${skillName}

## 开篇：一个真实痛点
用一个具体的开发场景或故事引入。让读者感受到"我确实需要学这个"。不要用"XX 是一种..."这种定义式开头。

## 为什么需要 ${skillName}？
没有它之前人们怎么做的？有什么痛苦？${skillName} 如何解决了这些问题？

## 核心直觉
用贯穿全文的类比解释 ${skillName} 的本质。不需要代码，只需要让读者在脑中建立心智模型。

## 核心概念（3-5个）
每个概念的结构：
### 概念名称
先用一句话说"它是什么"（不要用学术定义，用大白话）。
然后展示"没有它 vs 有了它"的对比。
给出最小可运行代码示例（带逐行注释）。
如果改错某一行会怎样？展示常见错误。

## 动手验证
给出一个完整的、可以直接运行的最小示例（不超过 30 行），让学生亲手运行看到效果。

## 深入理解
原理、机制、边界条件。适合想深入的学生阅读。

## 常见陷阱（3-5个）
每个陷阱的结构：
- 错误写法（代码）
- 运行后果（会出什么问题）
- 正确写法（代码）
- 为什么会这样（原理）

## 思考题
3 道开放性思考题（不需要标准答案，鼓励学生用自己的话回答）。

## 知识点总结
3-5 条核心要点，每条一句话。

## 练习题

讲义结束后输出练习题，用以下分隔符包裹：
---EXERCISES---
1. [选择题] 题目
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：B
解析：详细解释为什么 B 正确，其他选项为什么错误

2. [概念反转题] 以下说法是否正确？说明理由。
题目描述
答案：正确/错误 + 详细解释

3. [迁移题] 场景描述，要求学生应用刚学的知识解决
答案：解题思路和关键步骤
解析：这道题考察的核心知识点

4. [编程题] 题目
答案：代码
解析：思路
---END---

## 输出要求
- 中文输出
- 总字数 3000-5000（比以前更充实）
- 代码可运行，带注释
- 练习题 5-7 道（比以前更多更丰富），包含至少 1 道概念反转题和 1 道迁移题`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `生成「${skillName}」讲义${extra ? `\n${extra}` : ''}` },
  ];
}

// ============================================================
// 解析输出
// ============================================================

function parseResponse(raw: string, skillName: string, level: string): LectureData {
  let content = raw.trim();

  // 提取练习题
  const exercises: Exercise[] = [];
  const exerciseMatch = content.match(/---EXERCISES---([\s\S]*?)---END---/);
  if (exerciseMatch) {
    content = content.replace(/---EXERCISES---[\s\S]*?---END---/, '').trim();
    exercises.push(...parseExercises(exerciseMatch[1]));
  }

  // 处理 markdown 代码块包裹
  if (content.startsWith('```markdown') || content.startsWith('```md')) {
    const endIdx = content.indexOf('```', 3);
    if (endIdx > 0) content = content.substring(content.indexOf('\n') + 1, endIdx).trim();
  }

  if (!content.startsWith('#')) content = `# ${skillName}\n\n${content}`;

  return {
    skill: skillName,
    level,
    content,
    exercises,
    keyPoints: extractSection(content, '知识点总结', 5),
    prerequisites: extractSection(content, '前置知识', 5),
    estimatedTime: estimateTime(content),
    wordCount: content.length,
  };
}

function parseExercises(text: string): Exercise[] {
  const exercises: Exercise[] = [];
  const blocks = text.split(/\n\d+\.\s+/).filter(b => b.trim());

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    const typeMatch = block.match(/\[(选择题|填空题|简答题|编程题|概念反转题|迁移题)\]/);
    const typeMap: Record<string, Exercise['type']> = { '选择题': 'choice', '填空题': 'fill', '简答题': 'short_answer', '编程题': 'coding', '概念反转题': 'short_answer', '迁移题': 'short_answer' };
    const type = typeMatch ? typeMap[typeMatch[1]] || 'short_answer' : 'short_answer';

    const answerIdx = block.indexOf('\n答案：');
    const question = block.substring(typeMatch ? block.indexOf(']') + 1 : 0, answerIdx > 0 ? answerIdx : block.length).trim();
    const answerMatch = block.match(/答案：(.+?)(?:\n|$)/);
    const explanationMatch = block.match(/解析：(.+?)(?:\n|$)/);

    exercises.push({
      number: i + 1,
      type,
      question,
      options: type === 'choice' ? question.match(/[A-D]\.\s+.+/g)?.map(o => o.trim()) : undefined,
      answer: answerMatch?.[1]?.trim() || '',
      explanation: explanationMatch?.[1]?.trim() || '',
    });
  }
  return exercises;
}

function extractSection(content: string, sectionName: string, maxItems: number): string[] {
  const match = content.match(new RegExp(`## ${sectionName}\\s*([\\s\\S]*?)(?=\\n##|$)`));
  if (!match) return [];
  return match[1].split('\n')
    .filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
    .map(l => l.replace(/^[-*]\s*/, '').trim())
    .filter(l => l.length > 0)
    .slice(0, maxItems);
}

function estimateTime(content: string): string {
  const minutes = Math.ceil(content.length / 400) + Math.ceil((content.match(/```/g)?.length || 0) / 2 * 2);
  if (minutes < 5) return '5分钟';
  if (minutes < 15) return '10-15分钟';
  if (minutes < 30) return '20-30分钟';
  return '30分钟以上';
}

// ============================================================
// 主函数
// ============================================================

export async function generateLecture(
  skillName: string,
  level: 'beginner' | 'intermediate' | 'advanced' = 'beginner',
  extra?: string,
  llmConfig?: LLMConfig
): Promise<ActionResult> {
  if (!skillName?.trim()) return { type: 'error', data: { message: '请提供技能名称' } };
  if (skillName.length > 50) return { type: 'error', data: { message: '技能名称太长' } };

  const messages = buildPrompt(skillName.trim(), level, extra);
  const raw = await callLLM(llmConfig!, messages);
  const result = parseResponse(raw, skillName.trim(), level);

  return { type: 'lecture', data: result };
}
