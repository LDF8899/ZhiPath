import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { LlmService } from '../../services/llm.service';
import { ProfileService } from '../../services/profile.service';
import { TutorPromptService } from './tutor-prompt.service';
import { ActionExecutorService } from './action-executor.service';

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
  ): Promise<{ reply: string; actions: any[]; agent: string }> {
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

    // 3. 构建消息列表
    const chatMessages = [
      { role: 'system', content: systemPrompt },
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
        const results = await this.actionExecutor.executeActions(actions, userId);
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
    };
  }
}
