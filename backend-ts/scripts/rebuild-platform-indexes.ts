/**
 * 从 MySQL 事实表重建派生索引。
 *
 * 用法：
 *   npm run rebuild:platform-indexes
 *   TENANT_ID=2 npm run rebuild:platform-indexes
 *   USER_ID=49 TENANT_ID=1 npm run rebuild:platform-indexes
 *
 * MySQL 是唯一事实源；Chroma/Neo4j 不可用时返回 degraded，不阻塞主库。
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import neo4j from 'neo4j-driver';
import { DataSource } from 'typeorm';
import { EvidenceChunk } from '../src/entities/evidence-chunk.entity';
import { JobPosition } from '../src/entities/job.entity';
import { EvidenceRagService } from '../src/services/evidence-rag.service';
import { ChromaService } from '../src/services/chroma.service';
import { GraphImportService } from '../src/services/graph-import.service';

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const config = { get: (key: string, fallback?: any) => process.env[key] ?? fallback };

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const mysql = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  };
  const ds = new DataSource({ type: 'mysql', ...mysql, synchronize: false, entities: [EvidenceChunk, JobPosition] });
  await ds.initialize();
  const chroma = new ChromaService(config as any);
  const rag = new EvidenceRagService(ds.getRepository(EvidenceChunk), chroma, config as any);
  const tenantId = process.env.TENANT_ID ? Number(process.env.TENANT_ID) : undefined;
  const userId = process.env.USER_ID ? Number(process.env.USER_ID) : undefined;
  const report: any = { sourceOfTruth: 'mysql', chroma: null, neo4j: null };
  try {
    let chromaReady = chroma.enabled;
    if (chromaReady) {
      try {
        const heartbeat = await fetch(`${(process.env.CHROMA_URL || '').replace(/\/+$/, '')}/api/v1/heartbeat`, { signal: AbortSignal.timeout(4000) });
        chromaReady = heartbeat.ok;
      } catch { chromaReady = false; }
    }
    report.chroma = chromaReady
      ? { enabled: true, ...(await rag.reindexExisting({ tenantId, userId })) }
      : { enabled: chroma.enabled, status: 'degraded', reason: 'Chroma heartbeat unavailable; MySQL vector_status left unchanged' };
  } finally {
    await ds.destroy();
  }

  let driver: any = null;
  try {
    driver = neo4j.driver(
      process.env.NEO4J_URI || 'bolt://127.0.0.1:7687',
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'neo4j123'),
    );
    await driver.verifyConnectivity();
    const graphDs = new DataSource({ type: 'mysql', ...mysql, synchronize: false, entities: [JobPosition] });
    await graphDs.initialize();
    report.neo4j = await new GraphImportService(driver, graphDs.getRepository(JobPosition)).rebuildFromMySQL();
    await graphDs.destroy();
  } catch (error: any) {
    report.neo4j = { available: false, reason: String(error?.message || error) };
  } finally {
    await driver?.close().catch(() => {});
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[RebuildIndexes] failed:', error?.message || error);
  process.exit(1);
});
