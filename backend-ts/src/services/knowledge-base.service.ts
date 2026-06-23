import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * 知识库服务 — 对齐 Python services/knowledge_base.py
 *
 * MongoDB knowledge_base 集合
 * 全平台复用的知识资产：讲义、习题、编程题
 */
@Injectable()
export class KnowledgeBaseService {
  constructor(@InjectConnection() private mongoConnection: Connection) {}

  private get collection() {
    return this.mongoConnection.db!.collection('knowledge_base');
  }

  // ── 写入 ──

  /** 保存一条知识内容（同技能同类型则更新） — 对齐 Python save_content() */
  async saveContent(
    skill: string,
    contentType: string,
    content: Record<string, any>,
    difficulty = 'beginner',
    shared = true,
  ): Promise<string> {
    const now = Date.now();
    const doc = {
      skill,
      content_type: contentType,
      content,
      metadata: { difficulty, version: 1 },
      shared,
      updated_at: now,
    };

    const result = await this.collection.updateOne(
      { skill, content_type: contentType },
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true },
    );

    if (result.upsertedId) {
      console.log(`[KnowledgeBase] Saved: ${skill}/${contentType} (new)`);
      return result.upsertedId.toString();
    } else {
      console.log(`[KnowledgeBase] Updated: ${skill}/${contentType}`);
      const existing = await this.collection.findOne({ skill, content_type: contentType });
      return existing?._id?.toString() || '';
    }
  }

  /** 保存讲义 — 对齐 Python save_lecture() */
  async saveLecture(skill: string, markdownContent: string, difficulty = 'beginner') {
    return this.saveContent(skill, 'lecture', { markdown: markdownContent, format: 'markdown' }, difficulty);
  }

  /** 保存练习题 — 对齐 Python save_quiz() */
  async saveQuiz(skill: string, questions: any[], difficulty = 'beginner') {
    return this.saveContent(skill, 'quiz', { questions, total: questions.length }, difficulty);
  }

  /** 保存编程题 — 对齐 Python save_coding() */
  async saveCoding(skill: string, problems: any[], difficulty = 'beginner') {
    return this.saveContent(skill, 'coding', { problems, total: problems.length }, difficulty);
  }

  /** 保存 HTML 动画演示（多模态） */
  async saveAnimation(skill: string, title: string, html: string, difficulty = 'beginner') {
    return this.saveContent(skill, 'animation', { title, html }, difficulty);
  }

  /** 保存 Mermaid 图表（多模态） */
  async saveDiagram(skill: string, title: string, mermaid: string, diagramType = 'flowchart', difficulty = 'beginner') {
    return this.saveContent(skill, 'diagram', { title, mermaid, diagram_type: diagramType }, difficulty);
  }

  /** 保存短视频元数据（多模态） */
  async saveVideo(skill: string, video: Record<string, any>, difficulty = 'beginner') {
    return this.saveContent(skill, 'video', video, difficulty);
  }

  /** 保存数字人讲解元数据（多模态） */
  async saveAvatar(skill: string, avatar: Record<string, any>, difficulty = 'beginner') {
    return this.saveContent(skill, 'avatar', avatar, difficulty);
  }

  // ── 读取 ──

  /** 获取指定技能的指定类型内容 — 对齐 Python get_content() */
  async getContent(skill: string, contentType: string): Promise<any | null> {
    const doc = await this.collection.findOne({ skill, content_type: contentType });
    if (doc) {
      (doc as any)._id = doc._id?.toString();
      return doc;
    }
    return null;
  }

  /** 获取讲义 Markdown — 对齐 Python get_lecture() */
  async getLecture(skill: string): Promise<string | null> {
    const doc = await this.getContent(skill, 'lecture');
    return doc?.content?.markdown || null;
  }

  /** 获取练习题列表 — 对齐 Python get_quiz() */
  async getQuiz(skill: string): Promise<any[] | null> {
    const doc = await this.getContent(skill, 'quiz');
    return doc?.content?.questions || null;
  }

  /** 获取编程题列表 — 对齐 Python get_coding() */
  async getCoding(skill: string): Promise<any[] | null> {
    const doc = await this.getContent(skill, 'coding');
    return doc?.content?.problems || null;
  }

  /** 获取 HTML 动画（多模态） */
  async getAnimation(skill: string): Promise<{ title: string; html: string } | null> {
    const doc = await this.getContent(skill, 'animation');
    return doc?.content?.html ? { title: doc.content.title || skill, html: doc.content.html } : null;
  }

  /** 获取 Mermaid 图表（多模态） */
  async getDiagram(skill: string): Promise<{ title: string; mermaid: string; diagram_type?: string } | null> {
    const doc = await this.getContent(skill, 'diagram');
    return doc?.content?.mermaid
      ? { title: doc.content.title || skill, mermaid: doc.content.mermaid, diagram_type: doc.content.diagram_type }
      : null;
  }

  /** 获取短视频元数据（多模态） */
  async getVideo(skill: string): Promise<Record<string, any> | null> {
    const doc = await this.getContent(skill, 'video');
    return doc?.content || null;
  }

  /** 获取数字人讲解元数据（多模态） */
  async getAvatar(skill: string): Promise<Record<string, any> | null> {
    const doc = await this.getContent(skill, 'avatar');
    return doc?.content || null;
  }

  /** 获取某技能的所有类型内容摘要 — 对齐 Python list_by_skill() */
  async listBySkill(skill: string) {
    const docs = await this.collection
      .find({ skill }, { projection: { skill: 1, content_type: 1, metadata: 1, updated_at: 1 } })
      .toArray();
    return docs.map((d) => ({ ...(d as any), _id: d._id?.toString() }));
  }

  /** 获取知识库中所有已有的技能名 — 对齐 Python list_all_skills() */
  async listAllSkills(): Promise<string[]> {
    return this.collection.distinct('skill');
  }

  // ── 删除 ──

  /** 删除指定内容 — 对齐 Python delete_content() */
  async deleteContent(skill: string, contentType: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ skill, content_type: contentType });
    return result.deletedCount > 0;
  }
}
