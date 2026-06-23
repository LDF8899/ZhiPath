import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProfileService } from './profile.service';
import { ChatArchiveService } from './chat-archive.service';
import { LlmService } from './llm.service';
import { extractJson } from '../common/json-repair';

/**
 * 画像分析调度器 — 对齐 Python services/profile_scheduler.py
 *
 * 每 15 分钟扫描有新消息的用户，分析聊天记录，提取画像增量
 * 使用 @nestjs/schedule 的 @Cron() 装饰器
 */
@Injectable()
export class ProfileSchedulerService {
  constructor(
    private profileService: ProfileService,
    private chatArchive: ChatArchiveService,
    private llmService: LlmService,
  ) {}

  /** 每 15 分钟执行一次 — 对齐 Python profile_analysis_loop() */
  @Cron('0 */15 * * * *')
  async runProfileAnalysis() {
    // 1. 获取有新消息的用户
    const activeUsers = await this.profileService.getActiveUserIds();
    if (!activeUsers.length) return;

    console.log(`[ProfileScheduler] Processing ${activeUsers.length} active users`);
    const processed: string[] = [];

    for (const userIdStr of activeUsers) {
      try {
        const userId = parseInt(userIdStr, 10);

        // 2. 获取当前画像
        const currentProfile = (await this.profileService.getProfile(userId)) || {};

        // 3. 获取最近聊天消息
        const recentMessages = await this.chatArchive.getRecentMessages(userId, 30);
        if (!recentMessages.length) {
          processed.push(userIdStr);
          continue;
        }

        // 4. 归档最近会话
        await this.archiveUserSessions(userId);

        // 5. 调 LLM 分析
        const delta = await this.analyzeChatForProfile(currentProfile, recentMessages);

        // 6. merge 到 MongoDB
        if (delta) {
          await this.profileService.mergeProfileDelta(userId, delta, 'chat_analysis');
          console.log(`[ProfileScheduler] Profile updated for user ${userIdStr}:`, Object.keys(delta));
        }

        processed.push(userIdStr);
      } catch (e) {
        console.warn(`[ProfileScheduler] Analysis failed for user ${userIdStr}:`, e.message);
      }
    }

    // 7. 清除已处理的标记
    if (processed.length) {
      await this.profileService.clearActiveUsers(processed);
      console.log(`[ProfileScheduler] Processed ${processed.length} users`);
    }
  }

  /** 分析聊天记录，提取画像增量 — 对齐 Python analyze_chat_for_profile() */
  private async analyzeChatForProfile(
    currentProfile: any,
    recentMessages: any[],
  ): Promise<any | null> {
    if (!recentMessages.length) return null;

    const profileSummary = this.buildProfileSummary(currentProfile);
    const chatText = this.buildChatSummary(recentMessages);

    const CHAT_ANALYSIS_PROMPT = `你是智途ZhiPath的用户画像分析助手。

根据用户的最近聊天记录，提取值得更新画像的信息。

当前画像摘要：
${profileSummary}

最近聊天记录：
${chatText}

规则：
1. 只提取用户**明确提到**的新信息（新学的技术、兴趣变化、目标调整、个人特征等）
2. 不要推断或猜测
3. 不要重复画像中已有的信息
4. 如果没有值得更新的信息，返回 {"has_update": false}

输出严格JSON格式：
{
  "has_update": true/false,
  "delta": {
    "skills_to_add": [{"name": "技能名", "level": "入门|熟悉|熟练"}],
    "interests_to_add": ["兴趣1"],
    "strengths_to_add": ["强项1"],
    "weaknesses_to_add": ["弱项1"],
    "chat_insights_to_add": ["洞察1"],
    "goals_to_update": {"key": "value"}
  }
}

只输出JSON，不要其他文字。`;

    try {
      const result = await this.llmService.chatCompletion(
        [
          { role: 'system', content: CHAT_ANALYSIS_PROMPT },
          { role: 'user', content: '请分析以上聊天记录，提取值得更新画像的信息。' },
        ],
        { temperature: 0.2, maxTokens: 1024 },
      );

      const parsed = extractJson(result);
      if (parsed.has_update && parsed.delta) {
        return parsed.delta;
      }
      return null;
    } catch (e) {
      console.warn('[ProfileScheduler] Chat analysis failed:', e.message);
      return null;
    }
  }

  /** 归档用户最近的会话 */
  private async archiveUserSessions(userId: number) {
    try {
      const collection = this.profileService['mongoConnection'].db!.collection('chat_sessions');
      const sessions = await collection
        .find({ user_id: String(userId) }, { projection: { session_id: 1 } })
        .sort({ updated_at: -1 })
        .limit(3)
        .toArray();

      for (const session of sessions) {
        const sid = session.session_id || '';
        if (sid) {
          await this.chatArchive.archiveChat(userId, sid);
        }
      }
    } catch (e) {
      console.warn(`[ProfileScheduler] Archive failed for user ${userId}:`, e.message);
    }
  }

  /** 将 MongoDB 画像文档转为可读摘要 */
  private buildProfileSummary(profile: any): string {
    const parts: string[] = [];

    const basic = profile.basic || {};
    if (basic.school || basic.major) {
      parts.push(`学校: ${basic.school || '未知'}, 专业: ${basic.major || '未知'}, 年级: ${basic.grade || '未知'}`);
    }

    const skills = profile.skills || [];
    if (skills.length) {
      const skillStrs = skills.map((s: any) => `${s.name}(${s.level || '入门'})`);
      parts.push(`技能: ${skillStrs.join(', ')}`);
    }

    const goals = profile.goals || {};
    if (goals.target_job_title) {
      parts.push(`目标: ${goals.target_job_title}`);
    }

    const traits = profile.traits || {};
    if (traits.interests?.length) parts.push(`兴趣: ${traits.interests.join(', ')}`);
    if (traits.strengths?.length) parts.push(`强项: ${traits.strengths.join(', ')}`);
    if (traits.weaknesses?.length) parts.push(`弱项: ${traits.weaknesses.join(', ')}`);

    return parts.length ? parts.join('\n') : '暂无画像数据';
  }

  /** 将消息列表转为可读文本 */
  private buildChatSummary(messages: any[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === 'user' ? '用户' : '助手';
        let content = msg.content || '';
        if (content.length > 500) content = content.substring(0, 500) + '...';
        return `[${role}] ${content}`;
      })
      .join('\n');
  }
}
