import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'crypto';

/**
 * 知识库服务 — 对齐 Python services/knowledge_base.py
 *
 * MongoDB knowledge_base 集合
 * 全平台复用的知识资产：讲义、习题、编程题
 */
@Injectable()
export class KnowledgeBaseService implements OnModuleInit {
  constructor(
    @InjectConnection() private mongoConnection: Connection,
    private readonly dataSource: DataSource,
  ) {}

  private get collection() {
    return this.mongoConnection.db!.collection('knowledge_base');
  }

  private filter(skill: string, contentType: string, tenantId = 1) { return { tenantId, skill, content_type: contentType }; }

  async onModuleInit() {
    await this.collection.createIndexes([
      { key: { tenantId: 1, skill: 1, content_type: 1 }, unique: true, name: 'uq_knowledge_tenant_skill_type' },
      { key: { tenantId: 1, updated_at: -1 }, name: 'idx_knowledge_tenant_updated' },
    ]).catch((error) => console.warn('[KnowledgeBaseService] index initialization failed:', error.message));
  }

  // ── 写入 ──

  /** 保存一条知识内容（同技能同类型则更新） — 对齐 Python save_content() */
  async saveContent(
    skill: string,
    contentType: string,
    content: Record<string, any>,
    difficulty = 'beginner',
    shared = true,
    tenantId = 1,
    clientApp = 'legacy',
  ): Promise<string> {
    const now = Date.now();
    const doc = {
      skill,
      content_type: contentType,
      content,
      metadata: { difficulty, version: 1 },
      shared,
      schemaVersion: 1,
      tenantId,
      clientApp,
      updated_at: now,
    };

    const result = await this.collection.updateOne(
      this.filter(skill, contentType, tenantId),
      { $set: doc, $setOnInsert: { created_at: now } },
      { upsert: true },
    );

    // MySQL is the durable identity/lifecycle index. Mongo remains the body
    // store so large markdown, question and media payloads do not bloat the
    // transactional schema. The metadata write is deliberately best-effort
    // during the rolling migration; once migration 25 is present it becomes
    // the canonical catalog used by v1 resources.
    await this.upsertMetadata({
      skill,
      contentType,
      content,
      difficulty,
      tenantId,
      clientApp,
      now,
    });

    if (result.upsertedId) {
      console.log(`[KnowledgeBase] Saved: ${skill}/${contentType} (new)`);
      return result.upsertedId.toString();
    } else {
      console.log(`[KnowledgeBase] Updated: ${skill}/${contentType}`);
      const existing = await this.collection.findOne(this.filter(skill, contentType, tenantId));
      return existing?._id?.toString() || '';
    }
  }

  /** 保存讲义 — 对齐 Python save_lecture() */
  async saveLecture(skill: string, markdownContent: string, difficulty = 'beginner', tenantId = 1, clientApp = 'legacy') {
    return this.saveContent(skill, 'lecture', { markdown: markdownContent, format: 'markdown' }, difficulty, true, tenantId, clientApp);
  }

  /** 保存练习题 — 对齐 Python save_quiz() */
  async saveQuiz(skill: string, questions: any[], difficulty = 'beginner', tenantId = 1, clientApp = 'legacy') {
    return this.saveContent(skill, 'quiz', { questions, total: questions.length }, difficulty, true, tenantId, clientApp);
  }

  /** 保存编程题 — 对齐 Python save_coding() */
  async saveCoding(skill: string, problems: any[], difficulty = 'beginner', tenantId = 1, clientApp = 'legacy') {
    return this.saveContent(skill, 'coding', { problems, total: problems.length }, difficulty, true, tenantId, clientApp);
  }

  /** 保存 HTML 动画演示（多模态） */
  async saveAnimation(skill: string, title: string, html: string, difficulty = 'beginner', tenantId = 1, clientApp = 'legacy') {
    return this.saveContent(skill, 'animation', { title, html }, difficulty, true, tenantId, clientApp);
  }

  /** 保存 Mermaid 图表（多模态） */
  async saveDiagram(skill: string, title: string, mermaid: string, diagramType = 'flowchart', difficulty = 'beginner', tenantId = 1, clientApp = 'legacy') {
    return this.saveContent(skill, 'diagram', { title, mermaid, diagram_type: diagramType }, difficulty, true, tenantId, clientApp);
  }

  /** 保存短视频元数据（多模态） */
  async saveVideo(skill: string, video: Record<string, any>, difficulty = 'beginner', tenantId = 1, clientApp = 'legacy') {
    return this.saveContent(skill, 'video', video, difficulty, true, tenantId, clientApp);
  }

  /** 保存数字人讲解元数据（多模态） */
  async saveAvatar(skill: string, avatar: Record<string, any>, difficulty = 'beginner', tenantId = 1, clientApp = 'legacy') {
    return this.saveContent(skill, 'avatar', avatar, difficulty, true, tenantId, clientApp);
  }

  // ── 读取 ──

  /** 获取指定技能的指定类型内容 — 对齐 Python get_content() */
  async getContent(skill: string, contentType: string, tenantId = 1): Promise<any | null> {
    // MySQL metadata is the lifecycle/visibility source of truth. During the
    // rolling migration an absent row is treated as legacy and Mongo is still
    // consulted, but an explicitly archived row must never be resurrected by
    // a stale Mongo document.
    try {
      const metadata = await this.dataSource.query(
        `SELECT lifecycle_status AS lifecycleStatus, schema_version AS schemaVersion,
                content_hash AS contentHash, title, updated_at AS updatedAt
           FROM knowledge_assets
          WHERE tenant_id <=> ? AND skill_key = ? AND content_type = ? LIMIT 1`,
        [tenantId, skill, contentType],
      );
      if (metadata[0]?.lifecycleStatus === 'archived') return null;
    } catch {
      // Migration 25 may not yet exist on an older installation.
    }
    const doc = await this.collection.findOne(this.filter(skill, contentType, tenantId));
    if (doc) {
      (doc as any)._id = doc._id?.toString();
      return doc;
    }
    return null;
  }

  /** 已发布知识资产目录；正文仍由 getContent 从 Mongo 读取。 */
  async listPublishedAssets(tenantId = 1, skill?: string) {
    try {
      const params: any[] = [tenantId];
      const skillClause = skill ? ' AND skill_key = ?' : '';
      if (skill) params.push(skill);
      const rows = await this.dataSource.query(
        `SELECT public_id AS id, skill_key AS skill, content_type AS contentType,
                title, source_ref AS sourceRef, content_hash AS contentHash,
                schema_version AS schemaVersion, lifecycle_status AS lifecycleStatus,
                metadata_json AS metadata, created_at AS createdAt, updated_at AS updatedAt
           FROM knowledge_assets
          WHERE lifecycle_status = 'published'
            AND (tenant_id = ? OR tenant_id IS NULL)${skillClause}
          ORDER BY updated_at DESC`,
        params,
      );
      return rows.map((row: any) => ({
        ...row,
        metadata: this.parseJson(row.metadata),
      }));
    } catch {
      // Keep old installations usable before migration 25.
      const docs = await this.collection
        .find(skill ? { tenantId, skill } : { tenantId }, { projection: { skill: 1, content_type: 1, metadata: 1, updated_at: 1 } })
        .sort({ updated_at: -1 })
        .toArray();
      return docs.map((d: any) => ({
        id: d._id?.toString(), skill: d.skill, contentType: d.content_type,
        title: d.skill, schemaVersion: d.schemaVersion || 1,
        lifecycleStatus: 'published', metadata: d.metadata || null,
        updatedAt: d.updated_at,
      }));
    }
  }

  /** 获取讲义 Markdown — 对齐 Python get_lecture() */
  async getLecture(skill: string, tenantId = 1): Promise<string | null> {
    const doc = await this.getContent(skill, 'lecture', tenantId);
    return doc?.content?.markdown || null;
  }

  /** 获取练习题列表 — 对齐 Python get_quiz() */
  async getQuiz(skill: string, tenantId = 1): Promise<any[] | null> {
    const doc = await this.getContent(skill, 'quiz', tenantId);
    return doc?.content?.questions || null;
  }

  /** 获取编程题列表 — 对齐 Python get_coding() */
  async getCoding(skill: string, tenantId = 1): Promise<any[] | null> {
    const doc = await this.getContent(skill, 'coding', tenantId);
    return doc?.content?.problems || null;
  }

  /** 获取 HTML 动画（多模态） */
  async getAnimation(skill: string, tenantId = 1): Promise<{ title: string; html: string } | null> {
    const doc = await this.getContent(skill, 'animation', tenantId);
    return doc?.content?.html ? { title: doc.content.title || skill, html: doc.content.html } : null;
  }

  /** 获取 Mermaid 图表（多模态） */
  async getDiagram(skill: string, tenantId = 1): Promise<{ title: string; mermaid: string; diagram_type?: string } | null> {
    const doc = await this.getContent(skill, 'diagram', tenantId);
    return doc?.content?.mermaid
      ? { title: doc.content.title || skill, mermaid: doc.content.mermaid, diagram_type: doc.content.diagram_type }
      : null;
  }

  /** 获取短视频元数据（多模态） */
  async getVideo(skill: string, tenantId = 1): Promise<Record<string, any> | null> {
    const doc = await this.getContent(skill, 'video', tenantId);
    return doc?.content || null;
  }

  /** 获取数字人讲解元数据（多模态） */
  async getAvatar(skill: string, tenantId = 1): Promise<Record<string, any> | null> {
    const doc = await this.getContent(skill, 'avatar', tenantId);
    return doc?.content || null;
  }

  /** 获取某技能的所有类型内容摘要 — 对齐 Python list_by_skill() */
  async listBySkill(skill: string, tenantId = 1) {
    const docs = await this.collection
      .find({ skill, tenantId }, { projection: { skill: 1, content_type: 1, metadata: 1, updated_at: 1 } })
      .toArray();
    return docs.map((d) => ({ ...(d as any), _id: d._id?.toString() }));
  }

  /** 获取知识库中所有已有的技能名 — 对齐 Python list_all_skills() */
  async listAllSkills(tenantId = 1): Promise<string[]> {
    return this.collection.distinct('skill', { tenantId });
  }

  // ── 删除 ──

  /** 删除指定内容 — 对齐 Python delete_content() */
  async deleteContent(skill: string, contentType: string, tenantId = 1): Promise<boolean> {
    const result = await this.collection.deleteOne(this.filter(skill, contentType, tenantId));
    try {
      await this.dataSource.query(
        `UPDATE knowledge_assets
            SET lifecycle_status = 'archived', updated_at = ?
          WHERE tenant_id <=> ? AND skill_key = ? AND content_type = ?`,
        [new Date(), tenantId, skill, contentType],
      );
    } catch {
      // Keep legacy installations usable until migration 25 is deployed.
    }
    return result.deletedCount > 0;
  }

  private async upsertMetadata(input: {
    skill: string;
    contentType: string;
    content: Record<string, any>;
    difficulty: string;
    tenantId: number;
    clientApp: string;
    now: number;
  }): Promise<void> {
    const { skill, contentType, content, difficulty, tenantId, clientApp, now } = input;
    const contentHash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    const title = typeof content.title === 'string' ? content.title.slice(0, 500) : skill;
    try {
      await this.dataSource.query(
        `INSERT INTO knowledge_assets
          (public_id, tenant_id, skill_key, content_type, title, source_ref,
           content_hash, schema_version, lifecycle_status, metadata_json,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'published', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), source_ref = VALUES(source_ref),
           content_hash = VALUES(content_hash), schema_version = VALUES(schema_version),
           lifecycle_status = 'published', metadata_json = VALUES(metadata_json),
           updated_at = VALUES(updated_at)`,
        [
          randomUUID(),
          tenantId,
          skill,
          contentType,
          title,
          clientApp,
          contentHash,
          JSON.stringify({ difficulty, clientApp }),
          new Date(now),
          new Date(now),
        ],
      );
    } catch (error: any) {
      // A deploy can start before the optional metadata migration has run.
      // Do not lose the Mongo body; surface a diagnostic for operators.
      if (!String(error?.message || '').includes("knowledge_assets")) {
        console.warn('[KnowledgeBaseService] metadata catalog write failed:', error?.message || error);
      }
    }
  }

  private parseJson(value: any): any {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  }
}
