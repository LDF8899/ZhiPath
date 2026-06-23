import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Student } from '../../entities/student.entity';
import { LlmService } from '../../services/llm.service';
import { ProfileService } from '../../services/profile.service';
import { ChatHistoryService } from '../../services/chat-history.service';
import { SkillService } from '../../services/skill.service';
import { IntentRouterService } from './intent-router.service';
import { ActionExecutorService } from './action-executor.service';
import { AgentEngineService } from './agent-engine.service';
import { LangGraphEngineService } from './langgraph-engine.service';
import { EventsService } from '../events/events.service';
import { extractJson } from '../../common/json-repair';

const AGENT_INFO_MAP: Record<string, { name: string; animal: string; color: string }> = {
  'generate_path':      { name: '路径规划师', animal: 'cat',     color: '#f5a623' },
  'generate_exam':      { name: '出题专家',   animal: 'dog',     color: '#7b68ee' },
  'recommend_jobs':     { name: '岗位顾问',   animal: 'rabbit',  color: '#ff6b6b' },
  'generate_video':     { name: '视频制作人', animal: 'panda',   color: '#2ed573' },
  'generate_animation': { name: '动画设计师', animal: 'fox',     color: '#ffa502' },
  'show_progress':      { name: '进度管理员', animal: 'owl',     color: '#1e90ff' },
  'chat':               { name: 'AI 助教',    animal: 'hamster', color: '#ff69b4' },
};

const DEFAULT_AGENT_INFO = { name: 'AI 助教', animal: 'hamster', color: '#ff69b4' };

/**
 * Chat 服务 — 对齐 Python api/user/chat.py
 *
 * 支持两种编排模式：
 *   1. 简化版：意图路由 + 直接调用（默认）
 *   2. LangGraph 版：状态图编排（设置 USE_LANGGRAPH=true）
 */
@Injectable()
export class ChatService {
  private useLangGraph: boolean;

  constructor(
    private config: ConfigService,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private llmService: LlmService,
    private profileService: ProfileService,
    private chatHistory: ChatHistoryService,
    private skillService: SkillService,
    private intentRouter: IntentRouterService,
    private actionExecutor: ActionExecutorService,
    private agentEngine: AgentEngineService,
    private langGraphEngine: LangGraphEngineService,
    private eventsService: EventsService,
  ) {
    this.useLangGraph = this.config.get('USE_LANGGRAPH', 'false') === 'true';
    console.log(`[ChatService] Engine: ${this.useLangGraph ? 'LangGraph' : 'Simple'}`);
  }

  /** 主聊天入口 — 对齐 Python chat() */
  async chat(userId: number, body: { message: string; session_id?: string; page_context?: string }) {
    const sessionId = body.session_id || uuidv4();
    const pageContext = body.page_context || 'general';

    // 1. 读取对话历史
    const history = await this.chatHistory.getHistory(userId, sessionId);
    const messages = history.map((m: any) => ({ role: m.role, content: m.content }));
    messages.push({ role: 'user', content: body.message });

    // 2. 保存用户消息
    await this.chatHistory.saveMessage(userId, sessionId, 'user', body.message, { pageContext });
    await this.profileService.markUserActive(userId);

    // 3. 根据配置选择引擎
    let reply = '';
    let actionResults: any[] = [];
    let agent = 'chat';

    if (this.useLangGraph) {
      // LangGraph 引擎：流式状态图编排（每个节点推送 SSE 事件）
      console.log(`[Chat] Using LangGraph engine (streaming)`);
      this.eventsService.emit(userId, { type: 'chat_thinking', data: { message: '正在思考中...' } });
      let lastResult: any = null;
      const accumulatedActions: any[] = [];
      const streamTimeout = 15000; // 15s 超时（给 fallback 留时间，前端 axios 超时 30s）
      try {
        const streamPromise = (async () => {
          for await (const chunk of this.langGraphEngine.streamExecute(userId, messages, pageContext)) {
            lastResult = chunk;
            // 累积每个节点产生的 actions，避免只取最后节点的 partial state
            const nodeActions = (chunk.state as any)?.actions;
            if (Array.isArray(nodeActions) && nodeActions.length > 0) {
              accumulatedActions.push(...nodeActions);
            }
            console.log(`[LangGraph] 节点完成: ${chunk.node} (${chunk.label})`);
          }
        })();
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('LangGraph stream timeout')), streamTimeout),
        );
        await Promise.race([streamPromise, timeoutPromise]);
      } catch (e) {
        console.error('[Chat] LangGraph stream error:', e.message);
      }

      if (lastResult) {
        reply = lastResult.state.reply || '';
        // 优先用累积的 actions（包含所有节点的贡献），降级用最后节点的
        actionResults = accumulatedActions.length > 0 ? accumulatedActions : (lastResult.state.actions || []);
        agent = lastResult.state.agent || 'chat';
      }

      if (!reply) {
        console.warn('[Chat] LangGraph stream produced no reply, falling back to invoke');
        this.eventsService.emit(userId, { type: 'chat_thinking', data: { message: '正在重新处理...' } });
        try {
          const fallback = await this.langGraphEngine.execute(userId, messages, pageContext);
          reply = fallback.reply;
          // 如果 invoke 有新 actions 则用，否则保留 stream 累积的
          if (fallback.actions?.length > 0) {
            actionResults = fallback.actions;
          }
          agent = fallback.agent || agent;
          console.log(`[Chat] LangGraph invoke fallback reply length: ${reply.length}`);
        } catch (e) {
          console.error('[Chat] LangGraph invoke fallback failed:', e.message);
        }
      }

      if (!reply) {
        console.warn('[Chat] LangGraph invoke also empty, falling back to Simple engine');
        this.eventsService.emit(userId, { type: 'chat_thinking', data: { message: '切换到备用模式...' } });
        try {
          const result = await this.agentEngine.chatNode(userId, messages, pageContext);
          reply = result.reply;
          // Simple 引擎产生的 actions 如果有则用，否则保留之前的
          if (result.actions?.length > 0) {
            actionResults = result.actions;
          }
          agent = result.agent || agent;
        } catch (e) {
          console.error('[Chat] Simple engine fallback failed:', e.message);
        }
      }
    } else {
      // 简化版引擎：意图路由 + 直接调用
      console.log(`[Chat] Using Simple engine`);
      this.eventsService.emit(userId, { type: 'chat_thinking', data: { message: '正在思考中...' } });

      // Phase B: 关键词匹配
      let intent = this.intentRouter.matchIntent(body.message);
      console.log(`[Chat] Phase B result:`, intent ? intent.name : 'null', `msg="${body.message}"`);

      // Phase C: LLM Tool Calling（Phase B 没匹配到时）
      if (!intent) {
        const userContext = await this.buildUserContext(userId);
        intent = await this.intentRouter.llmDecideAction(messages, userContext);
        console.log(`[Chat] Phase C result:`, intent ? intent.name : 'null');
      }

      // 执行动作
      if (intent) {
        console.log(`[Chat] Executing intent: ${intent.name}`);
        const executed = await this.executeIntent(intent, userId);
        actionResults = executed.actions;
        reply = executed.reply;
        console.log(`[Chat] Actions count: ${actionResults.length}, reply len: ${reply.length}`);

        // AI 用自然语言总结动作结果
        if (actionResults.length > 0) {
          const summaryReply = await this.aiSummarize(body.message, actionResults, messages);
          if (summaryReply) reply = summaryReply;
        }
      }

      // 没有命中意图 → 走 AgentEngine 普通聊天
      if (!reply) {
        console.log(`[Chat] No reply from intent, falling back to AgentEngine`);
        const result = await this.agentEngine.chatNode(userId, messages, pageContext);
        reply = result.reply;
        actionResults = result.actions;
        agent = result.agent;
        console.log(`[Chat] AgentEngine reply length: ${reply.length}`);
      }
    }

    // 4. 保存回复
    if (reply) {
      await this.chatHistory.saveMessage(userId, sessionId, 'assistant', reply, { agent });
    }

    // 5. 通知前端处理完成
    this.eventsService.emit(userId, { type: 'chat_done', data: { agent, reply_length: reply.length } });

    // 5. 异步更新画像（fire-and-forget）
    this.updateProfileAsync(userId, sessionId).catch((e) =>
      console.warn('[Chat] Async profile update failed:', e.message),
    );

    // 6. 返回
    const profileVersion = await this.profileService.getProfileVersion(userId);
    const agentInfo = AGENT_INFO_MAP[agent] || DEFAULT_AGENT_INFO;

    return {
      reply,
      session_id: sessionId,
      agent,
      agentInfo: {
        name: agentInfo.name,
        animal: agentInfo.animal,
        color: agentInfo.color,
      },
      profile_version: profileVersion,
      actions: actionResults,
    };
  }

  /** 执行意图对应的动作 — 对齐 Python _execute_intent() */
  private async executeIntent(
    intent: { name: string; filters: Record<string, any> },
    userId: number,
  ): Promise<{ actions: any[]; reply: string }> {
    const { name, filters } = intent;

    // 统一命名：支持 skill_name 和 skillName 两种格式
    const skillName = filters.skillName || filters.skill_name || '';
    const diagramType = filters.diagramType || filters.diagram_type || 'flowchart';

    const actionMap: Record<string, any> = {
      generate_path: { type: 'generate_path', targetJobId: filters.targetJobId || 0 },
      recommend_jobs: { type: 'recommend_jobs', filters },
      set_target_job: { type: 'set_target_job', jobId: filters.jobId || 0 },
      generate_exam: { type: 'generate_exam', skillName, question_count: 5, question_type: 'mixed' },
      show_progress: { type: 'show_progress' },
      show_today_tasks: { type: 'show_today_tasks' },
      recommend_resources: { type: 'recommend_resources', skills: filters.skills || [] },
      match_analysis: { type: 'recommend_jobs', filters },
      generate_animation: { type: 'generate_animation', skillName },
      generate_diagram: { type: 'generate_diagram', skillName, diagramType },
      generate_video: { type: 'generate_video', skillName, difficulty: filters.difficulty || 'beginner' },
      generate_avatar: { type: 'generate_avatar', skillName },
    };

    const action = actionMap[name];
    if (!action) return { actions: [], reply: '' };

    // 多模态意图需要技能名，缺失则返回提示
    const multimodalIntents = ['generate_animation', 'generate_diagram', 'generate_video', 'generate_avatar'];
    if (multimodalIntents.includes(name) && !action.skillName) {
      const prompts: Record<string, string> = {
        generate_animation: '你想看哪个技术概念的动画演示？比如「快速排序」「事件循环」「React 渲染」',
        generate_diagram: '你想画什么内容的图表？比如「系统架构」「流程图」「思维导图」',
        generate_video: '你想生成哪个主题的教学视频？比如「Python 入门」「React Hooks」「Docker 基础」',
        generate_avatar: '你想让数字人讲解哪个技术概念？',
      };
      return { actions: [], reply: prompts[name] || '请告诉我你想做什么' };
    }

    // 对于需要 job_id 但没提供的，跳过
    if (name === 'set_target_job' && !filters.jobId) {
      return { actions: [], reply: '' };
    }

    // 对于 generate_path，如果没有 targetJobId，从用户画像取
    if (name === 'generate_path' && !filters.targetJobId) {
      const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
      if (student?.targetJobId) {
        action.targetJobId = student.targetJobId;
      } else {
        return { actions: [], reply: '' };
      }
    }

    try {
      const results = await this.actionExecutor.executeActions([action], userId);
      return { actions: results, reply: '' };
    } catch (e) {
      console.error('[Chat] Action execution failed:', e.message);
      return { actions: [], reply: '' };
    }
  }

  /** 让 AI 用自然语言总结动作执行结果 — 对齐 Python _ai_summarize() */
  private async aiSummarize(
    userMsg: string,
    actionResults: any[],
    history: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const resultDesc: string[] = [];

    for (const r of actionResults) {
      const rtype = r.type || '';
      if (rtype === 'jobs') {
        const jobs = r.data || [];
        resultDesc.push(
          `推荐了 ${jobs.length} 个岗位：${jobs
            .slice(0, 5)
            .map((j: any) => `${j.title}(${j.company},匹配度${j.matchScore || 0}%)`)
            .join('、')}`,
        );
      } else if (rtype === 'path_generating') {
        resultDesc.push('学习路径正在生成中，请稍等片刻。');
      } else if (rtype === 'path_generated') {
        resultDesc.push(`学习路径已生成：${r.data?.planName || ''}，共 ${r.data?.totalSkills || 0} 个技能点，预计 ${r.data?.estimatedDate || ''} 达成。`);
      } else if (rtype === 'target_set') {
        resultDesc.push(`已将岗位「${r.data?.jobTitle || ''}」设为目标岗位。`);
      } else if (rtype === 'resources') {
        resultDesc.push(`推荐了 ${(r.data || []).length} 个学习资源。`);
      } else if (rtype === 'animation') {
        resultDesc.push(`已生成「${r.data?.skill || ''}」的 HTML 动画演示，可在卡片中直接播放。`);
      } else if (rtype === 'diagram') {
        resultDesc.push(`已生成「${r.data?.skill || ''}」的图解（Mermaid 图表）。`);
      } else if (rtype === 'video') {
        const st = r.data?.status;
        if (st === 'not_configured') resultDesc.push(`短视频功能依赖智谱 AI，当前未配置密钥，已展示视频脚本占位。`);
        else if (st === 'pending') resultDesc.push(`「${r.data?.skill || ''}」的教学短视频正在生成中，稍后刷新查看。`);
        else resultDesc.push(`已生成「${r.data?.skill || ''}」的教学短视频。`);
      } else if (rtype === 'video_pending') {
        resultDesc.push(`「${r.data?.skillName || ''}」的教学视频正在生成中（预计 2-4 分钟），进度卡片已展示，可实时查看。`);
      } else if (rtype === 'avatar') {
        const st = r.data?.status;
        if (st === 'not_configured') resultDesc.push(`数字人讲解依赖讯飞虚拟人服务，当前未配置密钥，已展示讲解词占位。`);
        else resultDesc.push(`已生成「${r.data?.skill || ''}」的数字人讲解。`);
      } else if (rtype === 'error') {
        resultDesc.push(`操作失败：${r.message || '未知错误'}`);
      }
    }

    if (!resultDesc.length) return '';

    const system = `你是智途 AI 助教。系统刚刚为用户执行了一个操作，请用自然、简洁的语言总结结果。
不要说"系统为你执行了"，直接说结果。语气温暖，可以加 1 个 emoji。
如果结果中有岗位推荐，简要说明为什么适合这个用户。
如果学习路径在生成中，告诉用户稍等。`;

    const prompt = `用户说：${userMsg}\n\n操作结果：${resultDesc.join('; ')}\n\n请用自然语言回复用户。`;

    try {
      return await this.llmService.chatCompletion(
        [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 512 },
      );
    } catch (e) {
      console.warn('[Chat] AI summarize failed:', e.message);
      return resultDesc.join('\n');
    }
  }

  /** 构建用户上下文 — 对齐 Python _build_user_context() */
  private async buildUserContext(userId: number): Promise<string> {
    const parts: string[] = [];

    try {
      const profile = await this.profileService.getProfile(userId);
      if (profile) {
        const skills = profile.skills || [];
        if (skills.length) {
          parts.push(`用户技能：${skills.slice(0, 8).map((s: any) => s.name || '').join(', ')}`);
        }
        const goals = profile.goals || {};
        if (goals.targetJobTitle) parts.push(`目标岗位：${goals.targetJobTitle}`);
        if (goals.direction) parts.push(`意向方向：${goals.direction}`);
      }
    } catch (e) {
      // ignore
    }

    try {
      const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
      if (student) {
        if (student.major) parts.push(`专业：${student.major}`);
        if (student.grade) parts.push(`年级：${student.grade}`);
        if (student.targetJobId) parts.push(`目标岗位ID：${student.targetJobId}`);
      }
    } catch (e) {
      // ignore
    }

    return parts.length ? `用户信息：\n${parts.join('\n')}` : '';
  }

  /** 异步更新画像 — 对齐 Python _update_profile_async() */
  private async updateProfileAsync(userId: number, sessionId: string) {
    try {
      const history = await this.chatHistory.getHistory(userId, sessionId);
      const recent = history.slice(-10);
      if (recent.length < 2) return;

      // 跳过纯视频生成/工具类对话（聊天记录太短或无实质内容，LLM 无法提取有效画像）
      const userMsgs = recent.filter((m: any) => m.role === 'user');
      const avgLen =
        userMsgs.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0) /
        Math.max(1, userMsgs.length);
      if (avgLen < 15) return; // 用户消息平均太短，多为指令型对话

      // 使用 LLM 分析聊天记录，提取画像增量
      const profile = (await this.profileService.getProfile(userId)) || {};
      const profileSummary = JSON.stringify({
        skills: profile.skills || [],
        goals: profile.goals || {},
        traits: profile.traits || {},
      });

      const chatText = recent
        .map((m: any) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
        .join('\n');

      const system = `你是用户画像分析器。分析以下聊天记录，提取用户的技能、兴趣、强项、弱项等信息。
当前画像摘要：${profileSummary}

输出严格JSON格式（只输出需要更新的字段，没有新信息则输出 {}）：
{
  "skills_to_add": [{"name": "技能名", "level": "入门/熟悉/精通"}],
  "interests_to_add": ["兴趣"],
  "strengths_to_add": ["强项"],
  "weaknesses_to_add": ["弱项"],
  "chat_insights_to_add": ["洞察内容"]
}

只输出JSON，不要其他文字。`;

      const result = await this.llmService.chatCompletion(
        [
          { role: 'system', content: system },
          { role: 'user', content: `最近聊天记录：\n${chatText}` },
        ],
        { temperature: 0.3, maxTokens: 512 },
      );

      const delta = extractJson(result);
      if (delta && Object.keys(delta).length > 0) {
        await this.profileService.mergeProfileDelta(userId, delta, 'chat');

        // 对话中提取的技能写入 user_skills_v3（source=conversation, trustWeight=0.5）
        if (delta.skills_to_add?.length) {
          await this.skillService.addSkills(
            userId,
            delta.skills_to_add.map((s: any) => ({
              name: s.name || s,
              source: 'conversation' as const,
              trustWeight: 0.5,
              masteryPct: 0,
            })),
          );
        }

        console.log(`[Chat] Profile updated from chat for user ${userId}`);
      }
    } catch (e) {
      console.warn('[Chat] Async profile update failed:', e.message);
    }
  }
}
