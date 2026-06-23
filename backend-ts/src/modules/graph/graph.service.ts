import { Injectable, Inject } from '@nestjs/common';
import neo4j from 'neo4j-driver';
import { NEO4J_DRIVER } from '../../database/neo4j.module';

/**
 * Graph 服务 — 对齐 Python api/user/graph.py
 * Neo4j 知识图谱查询（ReactFlow 格式）
 */
@Injectable()
export class GraphService {
  constructor(@Inject(NEO4J_DRIVER) private driver: any) {}

  async getGraph(options: { skill?: string; jobId?: number; limit?: number }) {
    if (!this.driver) {
      return { nodes: [], edges: [] };
    }
    const { skill, jobId, limit = 50 } = options;
    const session = this.driver.session();
    try {
      let query = '';
      // LIMIT 必须为整数 — neo4j-driver 要求用 neo4j.int() 包装，否则 JS number 变成 10.0 报错
      const params: any = { limit: neo4j.int(Math.floor(limit)) };

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
      } else {
        query = `
          MATCH (n)-[r]->(m)
          RETURN n, r, m LIMIT $limit
        `;
      }

      const result = await session.run(query, params);

      const nodesMap = new Map<string, any>();
      const edges: any[] = [];

      for (const record of result.records) {
        const n = record.get('n') || record.get('s');
        const m = record.get('m') || record.get('t');
        const r = record.get('r');

        if (n) {
          const nodeId = n.identity?.toString() || n.properties?.id;
          if (!nodesMap.has(nodeId)) {
            const labels = n.labels || [];
            nodesMap.set(nodeId, {
              id: nodeId,
              type: labels.includes('Job') ? 'job' : 'skill',
              label: n.properties?.name || n.properties?.title || nodeId,
              company: n.properties?.company,
            });
          }
        }

        if (m) {
          const nodeId = m.identity?.toString() || m.properties?.id;
          if (!nodesMap.has(nodeId)) {
            const labels = m.labels || [];
            nodesMap.set(nodeId, {
              id: nodeId,
              type: labels.includes('Job') ? 'job' : 'skill',
              label: m.properties?.name || m.properties?.title || nodeId,
              company: m.properties?.company,
            });
          }
        }

        if (n && m && r) {
          edges.push({
            source: n.identity?.toString() || n.properties?.id,
            target: m.identity?.toString() || m.properties?.id,
            type: r.type || 'RELATED',
          });
        }
      }

      return { nodes: Array.from(nodesMap.values()), edges };
    } catch (error) {
      console.warn('[GraphService] Neo4j query failed:', error.message);
      return { nodes: [], edges: [] };
    } finally {
      await session.close();
    }
  }
}
