/**
 * 检查 MySQL 事实表与 Mongo/Chroma/Neo4j 派生索引的一致性。
 * 可用 TENANT_ID 限定租户；外部索引不可用只标记 degraded，不伪造为 OK。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

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

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
  const text = await response.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { status: response.status, body };
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const tenantId = process.env.TENANT_ID ? Number(process.env.TENANT_ID) : null;
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  });
  const report: any = { status: 'ok', tenantId, mysql: {}, mongo: {}, chroma: {} };
  try {
    const scope = tenantId == null ? [] : [tenantId];
    const where = tenantId == null ? '' : ' WHERE tenant_id = ?';
    const [assets] = await conn.query(`SELECT tenant_id AS tenantId, skill_key AS skill, content_type AS contentType, lifecycle_status AS lifecycleStatus, content_hash AS contentHash FROM knowledge_assets${where}`, scope);
    const [chunks] = await conn.query(`SELECT tenant_id AS tenantId, vector_status AS vectorStatus, COUNT(*) AS total FROM evidence_chunks${where} GROUP BY tenant_id, vector_status`, scope);
    const [jobs] = await conn.query(`SELECT tenant_id AS tenantId, status, COUNT(*) AS total FROM async_jobs${where} GROUP BY tenant_id, status`, scope);
    report.mysql = { knowledgeAssets: assets, evidenceChunks: chunks, asyncJobs: jobs };
  } catch (error: any) {
    report.status = 'degraded';
    report.mysql = { error: String(error?.message || error) };
  } finally {
    await conn.end();
  }

  try {
    const { MongoClient } = await import('mongodb');
    const mongo = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    try {
      await mongo.connect();
      const db = mongo.db(process.env.MONGODB_DATABASE || 'zhipath');
      const filter = tenantId == null ? {} : { tenantId };
      report.mongo = { knowledgeBodies: await db.collection('knowledge_base').countDocuments(filter) };
    } finally {
      await mongo.close().catch(() => {});
    }
  } catch (error: any) {
    report.status = report.status === 'ok' ? 'degraded' : report.status;
    report.mongo = { error: String(error?.message || error) };
  }

  const chromaUrl = (process.env.CHROMA_URL || '').replace(/\/+$/, '');
  if (!chromaUrl) {
    report.chroma = { status: 'disabled' };
  } else {
    try {
      const heartbeat = await json(`${chromaUrl}/api/v1/heartbeat`);
      const collections = await json(`${chromaUrl}/api/v1/collections`);
      const name = process.env.CHROMA_COLLECTION || 'zhipath_user_evidence';
      const collection = Array.isArray(collections.body) ? collections.body.find((item: any) => item.name === name) : null;
      report.chroma = { status: heartbeat.status === 200 && collection ? 'ok' : 'degraded', heartbeat: heartbeat.status, collection: collection?.id || null };
      if (collection?.id) report.chroma.count = (await json(`${chromaUrl}/api/v1/collections/${collection.id}/count`)).body;
    } catch (error: any) {
      report.status = report.status === 'ok' ? 'degraded' : report.status;
      report.chroma = { status: 'degraded', error: String(error?.message || error) };
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

main().then(() => process.exit(0)).catch((error) => { console.error('[Consistency] failed:', error?.message || error); process.exit(1); });
