import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { LlmService } from '../../services/llm.service';
import { ProfileService } from '../../services/profile.service';
import { TutorPromptService } from './tutor-prompt.service';
import { ActionExecutorService } from './action-executor.service';
import { EvidenceRagService } from '../../services/evidence-rag.service';

/**
 * Agent 引擎 — 对齐 Python graph/compiler.py chat_node
 *
 * Python 版用 LangGraph StateGraph 编排多 Agent
 * NestJS 版简化为直接调用：意图路由已在 ChatService 处理，
 * 这里只负责 Fallback 路径（普通聊天 + 内嵌动作执行）
 */
@Injectable()
export class AgentEngineService {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private llmService: LlmService,
    private profileService: ProfileService,
    private tutorPromptService: TutorPromptService,
    private actionExecutor: ActionExecutorService,
    private evidenceRag: EvidenceRagService,
  ) {}

  /** 智能聊天节点 — 对齐 Python chat_node()
   *
   * 1. 读取用户画像，构建有记忆的 system prompt
   * 2. 调用 LLM
   * 3. 解析并执行内嵌动作
   * 4. 清理回复
   */
  async chatNode(
    userId: number,
    messages: Array<{ role: string; content: string }>,
    pageContext?: string,
    chatSessionId?: string,
  ): Promise<{ reply: string; actions: any[]; agent: string; evidence?: any[] }> {
    // 1. 读取用户画像
    let profile: any = null;
    let student: any = null;

    try {
      profile = await this.profileService.getProfile(userId);
    } catch (e) {
      console.warn('[AgentEngine] getProfile failed:', e.message);
    }

    try {
      student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    } catch (e) {
      console.warn('[AgentEngine] getStudent failed:', e.message);
    }

    // 2. 构建 system prompt
    const systemPrompt = this.tutorPromptService.buildTutorPrompt(profile, student, pageContext);

    // 2.5 Evidence RAG（P0）：检索个人证据注入上下文，供回答引用
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
    let evidenceItems: any[] = [];
    let evidenceContext = '';
    try {
      evidenceItems = await this.evidenceRag.search(userId, latestUserMessage, { limit: 5 });
      evidenceContext = this.evidenceRag.buildContext(evidenceItems);
    } catch (e) {
      console.warn('[AgentEngine] evidence search failed:', e.message);
    }

    // 3. 构建消息列表（证据上下文放在 system 之后）
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...(evidenceContext
        ? [{
            role: 'system' as const,
            content: `以下是该用户保存过的个人证据（可能相关，也可能不相关）：\n${evidenceContext}\n回答用户问题时，如涉及个人经历/项目/文件内容，必须只引用上述证据，并在相关句子末尾用 [证据#ID] 标注来源；证据不足以回答时明确说明“暂无相关证据”，不得编造。`,
          }]
        : []),
      ...messages,
    ];

    // 4. 调用 LLM
    let reply: string;
    try {
      reply = await this.llmService.chatCompletion(chatMessages);
      console.log(`[AgentEngine] LLM reply length: ${reply.length}`);
    } catch (e) {
      console.error('[AgentEngine] LLM call failed:', e.message);
      reply = '抱歉，AI服务暂时不可用，请稍后再试。';
    }

    // 5. 解析并执行内嵌动作
    const actionResults: any[] = [];
    try {
      const actions = this.actionExecutor.extractActions(reply);
      if (actions.length > 0) {
        const results = await this.actionExecutor.executeActions(actions, userId, {
          source: 'chat',
          chatSessionId,
          userMessage: latestUserMessage,
          recentMessages: messages.slice(-8),
          pageContext,
        });
        actionResults.push(...results);
      }
    } catch (e) {
      console.warn('[AgentEngine] Action execution failed:', e.message);
    }

    // 6. 清理回复
    const clean = this.actionExecutor.cleanReply(reply);

    return {
      reply: clean,
      actions: actionResults,
      agent: 'chat',
      // 引用证据（P0）：供前端展示“引用证据”区域
      evidence: evidenceItems.map((item) => ({
        chunkId: item.chunkId,
        sourceType: item.sourceType,
        title: item.title,
        snippet: item.snippet,
        score: item.score,
      })),
    };
  }
}
