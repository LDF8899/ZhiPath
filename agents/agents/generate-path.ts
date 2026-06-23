/**
 * 学习路径规划 Agent v3.0（优化版）
 */

import { ActionResult, LLMConfig, callLLM, extractJson } from './shared';

interface PathStage {
  stageNumber: number;
  name: string;
  description: string;
  duration: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  skills: string[];
  resources: string[];
  milestones: string[];
  order: number;
}

interface PathData {
  goal: string;
  currentLevel: string;
  totalDuration: string;
  stages: PathStage[];
  tips: string[];
  warningPoints: string[];
}

function buildPrompt(goal: string, currentLevel: string, availableTime: string, preferences?: string): { role: string; content: string }[] {
  return [
    { role: 'system', content: `你是学习规划师，为学生规划「${goal}」的学习路径。

学生信息：
- 目标：${goal}
- 水平：${currentLevel}
- 时间：${availableTime}
${preferences ? `- 偏好：${preferences}` : ''}

规划要求：分3-5阶段，从基础到进阶。

每个阶段：
- stageNumber：编号（从1开始）
- name：名称（10字内）
- description：说明（30-50字）
- duration：时长（如"2周"）
- difficulty：basic/intermediate/advanced
- skills：技能（3-5个）
- resources：资源类型（2-3个）
- milestones：完成标志（2-3个）
- order：顺序

另外：tips（3-5条建议）、warningPoints（2-3条注意事项）

输出严格JSON：
{"goal":"","currentLevel":"","totalDuration":"","stages":[{"stageNumber":1,"name":"","description":"","duration":"","difficulty":"basic","skills":[],"resources":[],"milestones":[],"order":1}],"tips":[],"warningPoints":[]}` },
    { role: 'user', content: `规划「${goal}」学习路径` },
  ];
}

function parseResponse(raw: string, goal: string, currentLevel: string): PathData {
  try {
    const data = JSON.parse(extractJson(raw));
    const stages: PathStage[] = Array.isArray(data.stages)
      ? data.stages.slice(0, 5).map((item: any, i: number) => ({
          stageNumber: Number(item.stageNumber) || i + 1,
          name: String(item.name || `阶段${i + 1}`).substring(0, 20),
          description: String(item.description || '').substring(0, 100),
          duration: String(item.duration || '待定'),
          difficulty: ['basic', 'intermediate', 'advanced'].includes(item.difficulty) ? item.difficulty : 'intermediate',
          skills: Array.isArray(item.skills) ? item.skills.slice(0, 5).map((s: any) => String(s).substring(0, 20)) : [],
          resources: Array.isArray(item.resources) ? item.resources.slice(0, 3).map((r: any) => String(r)) : [],
          milestones: Array.isArray(item.milestones) ? item.milestones.slice(0, 3).map((m: any) => String(m).substring(0, 30)) : [],
          order: Number(item.order) || i + 1,
        }))
      : [];

    return {
      goal: String(data.goal || goal),
      currentLevel: String(data.currentLevel || currentLevel),
      totalDuration: String(data.totalDuration || '待定'),
      stages,
      tips: Array.isArray(data.tips) ? data.tips.slice(0, 5).map((t: any) => String(t).substring(0, 30)) : [],
      warningPoints: Array.isArray(data.warningPoints) ? data.warningPoints.slice(0, 3).map((w: any) => String(w).substring(0, 30)) : [],
    };
  } catch {
    return { goal, currentLevel, totalDuration: '待定', stages: [], tips: [], warningPoints: ['生成失败'] };
  }
}

export async function generatePath(
  goal: string, currentLevel: string = '零基础', availableTime: string = '每天2小时',
  preferences?: string, llmConfig?: LLMConfig
): Promise<ActionResult> {
  if (!goal?.trim()) return { type: 'error', data: { message: '请提供学习目标' } };
  if (goal.length > 50) return { type: 'error', data: { message: '学习目标太长' } };

  const messages = buildPrompt(goal.trim(), currentLevel, availableTime, preferences);
  const raw = await callLLM(llmConfig!, messages);
  const result = parseResponse(raw, goal.trim(), currentLevel);

  return { type: 'learning_path', data: result };
}
