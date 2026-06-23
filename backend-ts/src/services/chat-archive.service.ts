import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 聊天归档服务 — 对齐 Python services/chat_archive.py
 *
 * 将 MongoDB 聊天记录归档为 MD 文件
 * 文件路径: data/chat_history/{user_id}/{session_id}.md
 */
@Injectable()
export class ChatArchiveService {
  private readonly archiveDir: string;

  constructor(@InjectConnection() private mongoConnection: Connection) {
    this.archiveDir = path.join(process.cwd(), 'data', 'chat_history');
  }

  private get chatCollection() {
    return this.mongoConnection.db!.collection('chat_sessions');
  }

  /** 将指定会话归档为 MD 文件 — 对齐 Python archive_chat() */
  async archiveChat(userId: number, sessionId: string): Promise<string | null> {
    try {
      const doc = await this.chatCollection.findOne({
        user_id: String(userId),
        session_id: sessionId,
      });
      if (!doc?.messages?.length) return null;

      const messages = doc.messages;
      const pageContext = doc.page_context || '';
      const createdAt = doc.created_at || 0;

      const lines = [
        `# 聊天记录 — Session ${sessionId}`,
        `- 用户: ${userId}`,
        `- 页面: ${pageContext}`,
        `- 时间: ${this.tsToStr(createdAt)}`,
        `- 消息数: ${messages.length}`,
        '',
        '---',
        '',
      ];

      for (const msg of messages) {
        const role = msg.role || 'unknown';
        const content = msg.content || '';
        const agent = msg.agent || '';
        const ts = msg.timestamp || 0;

        if (role === 'user') {
          lines.push(`## 用户 (${this.tsToStr(ts)})`);
        } else {
          const label = agent ? `助手（${agent}）` : '助手';
          lines.push(`## ${label} (${this.tsToStr(ts)})`);
        }
        lines.push('', content, '');
      }

      const mdContent = lines.join('\n');

      // 写入文件
      const userDir = path.join(this.archiveDir, String(userId));
      fs.mkdirSync(userDir, { recursive: true });
      const filepath = path.join(userDir, `${sessionId}.md`);
      fs.writeFileSync(filepath, mdContent, 'utf-8');

      console.log(`[ChatArchive] Archived: ${filepath}`);
      return filepath;
    } catch (e) {
      console.warn(`[ChatArchive] Archive failed for user ${userId} session ${sessionId}:`, e.message);
      return null;
    }
  }

  /** 获取用户最近 N 条聊天消息（跨所有会话） — 对齐 Python get_recent_messages() */
  async getRecentMessages(userId: number, limit = 30): Promise<any[]> {
    try {
      const sessions = await this.chatCollection
        .find({ user_id: String(userId) }, { projection: { messages: 1, session_id: 1, page_context: 1 } })
        .sort({ updated_at: -1 })
        .limit(5)
        .toArray();

      const allMessages: any[] = [];
      for (const session of sessions) {
        const sessionId = session.session_id || '';
        const pageContext = session.page_context || '';
        for (const msg of session.messages || []) {
          allMessages.push({ ...msg, session_id: sessionId, page_context: pageContext });
        }
      }

      allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      return allMessages.slice(-limit);
    } catch (e) {
      console.warn(`[ChatArchive] getRecentMessages failed for user ${userId}:`, e.message);
      return [];
    }
  }

  /** 毫秒时间戳转可读字符串 */
  private tsToStr(ts: number): string {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return String(ts);
    }
  }
}
