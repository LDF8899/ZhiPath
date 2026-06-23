import { Injectable, Inject } from '@nestjs/common';
import { NEO4J_DRIVER } from '../database/neo4j.module';

/**
 * 增强版图谱服务
 *
 * 对齐 CONSTITUTION.md 附录D.3：
 *   - addSkillNode(skillData) — 添加技能节点
 *   - addJobNode(jobData) — 添加岗位节点
 *   - addDependency(fromSkillId, toSkillId) — 添加技能依赖
 *   - addSkillJobRelation(skillId, jobId, type, weight) — 技能-岗位关系
 *   - getSkillDependencies(skillId) — 获取前置依赖链
 *   - getJobRequiredSkills(jobId) — 获取岗位所有必须技能
 *   - updateUserMastered(userId, skillId, level) — 更新用户掌握状态
 */
@Injectable()
export class GraphEnhancedService {
  constructor(@Inject(NEO4J_DRIVER) private driver: any) {}

  /** 检查 Neo4j 是否可用 */
  private get available(): boolean {
    return !!this.driver;
  }

  /**
   * 查询图谱（ReactFlow 格式）
   */
  async getGraph(options: { skill?: string; jobId?: number; userId?: number; limit?: number }) {
    if (!this.available) return { nodes: [], edges: [] };

    const { skill, jobId, userId, limit = 50 } = options;
    const session = this.driver.session();
    try {
      let query = '';
      const params: any = { limit };

      if (skill) {
        query = `
          MATCH (s:Skill)-[r]->(t)
          WHERE toLower(s.name) CONTAINS toLower($skill)
          RETURN s, r, t LIMIT $limit
        `;
        params.skill = skill;
      } else if (jobId) {
        query = `
          MATCH (j:Job)-[r]->(s:Skill)
          WHERE j.id = $jobId
          RETURN j, r, s LIMIT $limit
        `;
        params.jobId = String(jobId);
      } else if (userId) {
        query = `
          MATCH (u:User {id: $userId})-[r:MASTERED]->(s:Skill)
          OPTIONAL MATCH (s)-[r2]->(s2:Skill)
          RETURN u, r, s, r2, s2 LIMIT $limit
        `;
        params.userId = String(userId);
      } else {
        query = `
          MATCH (n)-[r]->(m)
          RETURN n, r, m LIMIT $limit
        `;
      }

      const result = await session.run(query, params);
      return this.formatResult(result.records);
    } catch (error: any) {
      console.warn('[GraphEnhanced] Neo4j query failed:', error.message);
      return { nodes: [], edges: [] };
    } finally {
      await session.close();
    }
  }

  /**
   * 添加技能节点
   */
  async addSkillNode(skillData: { id: string; name: string; category?: string; level?: string }): Promise<boolean> {
    if (!this.available) return false;

    const session = this.driver.session();
    try {
      await session.run(
        `MERGE (s:Skill {id: $id})
         SET s.name = $name, s.category = $category, s.level = $level, s.updatedAt = datetime()`,
        skillData,
      );
      return true;
    } catch (e: any) {
      console.warn('[GraphEnhanced] addSkillNode failed:', e.message);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * 添加岗位节点
   */
  async addJobNode(jobData: { id: string; title: string; company?: string; level?: string }): Promise<boolean> {
    if (!this.available) return false;

    const session = this.driver.session();
    try {
      await session.run(
        `MERGE (j:Job {id: $id})
         SET j.title = $title, j.company = $company, j.level = $level, j.updatedAt = datetime()`,
        jobData,
      );
      return true;
    } catch (e: any) {
      console.warn('[GraphEnhanced] addJobNode failed:', e.message);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * 添加技能依赖关系
   */
  async addDependency(fromSkillId: string, toSkillId: string): Promise<boolean> {
    if (!this.available) return false;

    const session = this.driver.session();
    try {
      await session.run(
        `MATCH (a:Skill {id: $fromId}), (b:Skill {id: $toId})
         MERGE (a)-[r:PREREQUISITE]->(b)
         SET r.updatedAt = datetime()`,
        { fromId: fromSkillId, toId: toSkillId },
      );
      return true;
    } catch (e: any) {
      console.warn('[GraphEnhanced] addDependency failed:', e.message);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * 添加技能-岗位关系
   */
  async addSkillJobRelation(
    skillId: string,
    jobId: string,
    type: 'required' | 'preferred' = 'required',
    weight: number = 1.0,
  ): Promise<boolean> {
    if (!this.available) return false;

    const session = this.driver.session();
    try {
      const relType = type === 'required' ? 'REQUIRES' : 'PREFERS';
      await session.run(
        `MATCH (j:Job {id: $jobId}), (s:Skill {id: $skillId})
         MERGE (j)-[r:${relType}]->(s)
         SET r.weight = $weight, r.updatedAt = datetime()`,
        { jobId, skillId, weight },
      );
      return true;
    } catch (e: any) {
      console.warn('[GraphEnhanced] addSkillJobRelation failed:', e.message);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取技能前置依赖链
   */
  async getSkillDependencies(skillId: string): Promise<string[]> {
    if (!this.available) return [];

    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (s:Skill {id: $skillId})<-[:PREREQUISITE*]-(dep:Skill)
         RETURN DISTINCT dep.id AS id, dep.name AS name
         ORDER BY dep.name`,
        { skillId },
      );
      return result.records.map((r: any) => r.get('name'));
    } catch (e: any) {
      console.warn('[GraphEnhanced] getSkillDependencies failed:', e.message);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * 获取岗位所有必须技能
   */
  async getJobRequiredSkills(jobId: string): Promise<Array<{ name: string; type: string; weight: number }>> {
    if (!this.available) return [];

    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (j:Job {id: $jobId})-[r]->(s:Skill)
         RETURN s.name AS name, type(r) AS relType, r.weight AS weight
         ORDER BY r.weight DESC`,
        { jobId },
      );
      return result.records.map((r: any) => ({
        name: r.get('name'),
        type: r.get('relType') === 'REQUIRES' ? 'required' : 'preferred',
        weight: r.get('weight')?.toNumber?.() || 1.0,
      }));
    } catch (e: any) {
      console.warn('[GraphEnhanced] getJobRequiredSkills failed:', e.message);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * 更新用户掌握状态
   */
  async updateUserMastered(userId: string, skillId: string, level: number): Promise<boolean> {
    if (!this.available) return false;

    const session = this.driver.session();
    try {
      await session.run(
        `MERGE (u:User {id: $userId})
         WITH u
         MATCH (s:Skill {id: $skillId})
         MERGE (u)-[r:MASTERED]->(s)
         SET r.level = $level, r.updatedAt = datetime()`,
        { userId, skillId, level },
      );
      return true;
    } catch (e: any) {
      console.warn('[GraphEnhanced] updateUserMastered failed:', e.message);
      return false;
    } finally {
      await session.close();
    }
  }

  // ── 内部方法 ──────────────────────────────────

  /**
   * 格式化查询结果为 ReactFlow 格式
   */
  private formatResult(records: any[]): { nodes: any[]; edges: any[] } {
    const nodesMap = new Map<string, any>();
    const edges: any[] = [];

    for (const record of records) {
      // 收集所有节点
      for (const key of ['n', 'm', 's', 's2', 'u', 'j', 't']) {
        const node = record.get(key);
        if (node) {
          const nodeId = node.identity?.toString() || node.properties?.id;
          if (nodeId && !nodesMap.has(nodeId)) {
            const labels = node.labels || [];
            nodesMap.set(nodeId, {
              id: nodeId,
              type: labels.includes('Job') ? 'job' : labels.includes('User') ? 'user' : 'skill',
              label: node.properties?.name || node.properties?.title || node.properties?.username || nodeId,
              company: node.properties?.company,
              category: node.properties?.category,
            });
          }
        }
      }

      // 收集所有边
      for (const key of ['r', 'r2']) {
        const rel = record.get(key);
        const source = record.get('n') || record.get('u') || record.get('j');
        const target = record.get('m') || record.get('s') || record.get('s2') || record.get('t');
        if (rel && source && target) {
          edges.push({
            source: source.identity?.toString() || source.properties?.id,
            target: target.identity?.toString() || target.properties?.id,
            type: rel.type || 'RELATED',
            weight: rel.properties?.weight?.toNumber?.(),
          });
        }
      }
    }

    return { nodes: Array.from(nodesMap.values()), edges };
  }
}
