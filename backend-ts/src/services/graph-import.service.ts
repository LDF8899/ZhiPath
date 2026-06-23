import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NEO4J_DRIVER } from '../database/neo4j.module';
import { JobPosition } from '../entities/job.entity';

/**
 * 知识图谱导入服务 — 业务深度设计 §19
 *
 * 将 MySQL 的岗位/技能数据同步进 Neo4j，建立：
 *   (:Skill {id,name,category})
 *   (:Job {id,title,company,level,salaryRange,location})
 *   (:Skill)-[:REQUIRED_FOR {weight}]->(:Job)   必须技能
 *   (:Skill)-[:PREFERRED_FOR {weight}]->(:Job)  加分技能
 *   (:Skill)-[:DEPENDS_ON]->(:Skill)            前置依赖（按内置依赖表）
 *
 * 图谱是全平台共享资产；驱动不可用时静默跳过。
 */
@Injectable()
export class GraphImportService {
  /** 内置技能前置依赖表（§6.4 依赖拓扑），name 小写匹配 */
  private readonly SKILL_DEPS: Record<string, string[]> = {
    'react': ['javascript'],
    'react hooks': ['react', 'javascript'],
    'react router': ['react'],
    'next.js': ['react', 'node.js'],
    'vue': ['javascript'],
    'typescript': ['javascript'],
    'node.js': ['javascript'],
    'express': ['node.js'],
    'nestjs': ['node.js', 'typescript'],
    'redux': ['react'],
    'webpack': ['javascript'],
    'css': ['html'],
    'sass': ['css'],
    'spring': ['java'],
    'spring boot': ['spring', 'java'],
    'mybatis': ['java', 'sql'],
    'django': ['python'],
    'flask': ['python'],
    'fastapi': ['python'],
    'pandas': ['python'],
    'docker': ['linux'],
    'kubernetes': ['docker'],
    'redis': ['数据库'],
    'mongodb': ['数据库'],
    'mysql': ['sql', '数据库'],
  };

  constructor(
    @Inject(NEO4J_DRIVER) private driver: any,
    @InjectRepository(JobPosition) private jobRepo: Repository<JobPosition>,
  ) {}

  get available(): boolean {
    return !!this.driver;
  }

  /**
   * 全量重建图谱：清空已有 Skill/Job 节点后从 MySQL 重新导入。
   * @returns 统计信息
   */
  async rebuildFromMySQL(): Promise<{
    available: boolean;
    jobs: number;
    skills: number;
    requiredRels: number;
    preferredRels: number;
    dependsRels: number;
  }> {
    if (!this.driver) {
      return { available: false, jobs: 0, skills: 0, requiredRels: 0, preferredRels: 0, dependsRels: 0 };
    }

    const jobs = await this.jobRepo.find({ where: { status: 1 } });
    const session = this.driver.session();
    const stats = { available: true, jobs: 0, skills: 0, requiredRels: 0, preferredRels: 0, dependsRels: 0 };
    const skillSet = new Set<string>();

    try {
      // 1. 清空旧的 Skill/Job 节点（保留 User 等其他节点）
      await session.run('MATCH (n) WHERE n:Skill OR n:Job DETACH DELETE n');

      // 2. 导入岗位 + 技能 + 关系
      for (const job of jobs) {
        const jobId = String(job.id);
        await session.run(
          `MERGE (j:Job {id: $id})
           SET j.title=$title, j.company=$company, j.level=$level,
               j.salaryRange=$salaryRange, j.location=$location, j.status='active'`,
          {
            id: jobId,
            title: job.title || '',
            company: job.company || '',
            level: job.level || 'junior',
            salaryRange: job.salaryRange || '',
            location: job.location || '',
          },
        );
        stats.jobs++;

        // 必须技能
        for (const sk of job.requiredSkills || []) {
          const name = typeof sk === 'string' ? sk : sk.name;
          if (!name) continue;
          const weight = (typeof sk === 'object' && sk.weight) || 0.8;
          await this.mergeSkill(session, name);
          skillSet.add(name.toLowerCase());
          await session.run(
            `MATCH (s:Skill {id:$sid}), (j:Job {id:$jid})
             MERGE (s)-[r:REQUIRED_FOR]->(j) SET r.weight=$weight`,
            { sid: name.toLowerCase(), jid: jobId, weight },
          );
          stats.requiredRels++;
        }

        // 加分技能
        for (const sk of job.preferredSkills || []) {
          const name = typeof sk === 'string' ? sk : sk.name;
          if (!name) continue;
          const weight = (typeof sk === 'object' && sk.weight) || 0.3;
          await this.mergeSkill(session, name);
          skillSet.add(name.toLowerCase());
          await session.run(
            `MATCH (s:Skill {id:$sid}), (j:Job {id:$jid})
             MERGE (s)-[r:PREFERRED_FOR]->(j) SET r.weight=$weight`,
            { sid: name.toLowerCase(), jid: jobId, weight },
          );
          stats.preferredRels++;
        }
      }
      stats.skills = skillSet.size;

      // 3. 建立技能前置依赖（§6.4）
      for (const [skill, deps] of Object.entries(this.SKILL_DEPS)) {
        if (!skillSet.has(skill)) continue;
        for (const dep of deps) {
          await this.mergeSkill(session, dep);
          await session.run(
            `MATCH (a:Skill {id:$a}), (b:Skill {id:$b})
             MERGE (a)-[:DEPENDS_ON]->(b)`,
            { a: skill, b: dep.toLowerCase() },
          );
          stats.dependsRels++;
        }
      }

      return stats;
    } catch (e: any) {
      console.warn('[GraphImport] rebuild failed:', e.message);
      return stats;
    } finally {
      await session.close();
    }
  }

  /** MERGE 一个技能节点（id 用小写名，name 保留原文） */
  private async mergeSkill(session: any, name: string): Promise<void> {
    await session.run(
      `MERGE (s:Skill {id:$id}) ON CREATE SET s.name=$name, s.category=$category`,
      { id: name.toLowerCase(), name, category: this.guessCategory(name) },
    );
  }

  /** 粗分类（仅用于图谱着色/分组） */
  private guessCategory(name: string): string {
    const n = name.toLowerCase();
    if (/react|vue|css|html|前端|webpack|vite|sass/.test(n)) return 'frontend';
    if (/java|spring|node|python|go|后端|express|django|flask|nestjs/.test(n)) return 'backend';
    if (/docker|kubernetes|linux|运维|ci/.test(n)) return 'devops';
    if (/ai|机器学习|深度学习|llm|大模型|pandas/.test(n)) return 'ai';
    if (/sql|mysql|redis|mongodb|数据库/.test(n)) return 'database';
    return 'general';
  }
}
