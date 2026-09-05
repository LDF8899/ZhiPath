/**
 * AI 学习权威资料 Evidence RAG 种子导入
 *
 * 用法：
 *   npx ts-node scripts/seed-ai-learning-evidence.ts
 *   TARGET_USERNAME=walkthrough_0903 npx ts-node scripts/seed-ai-learning-evidence.ts
 *   TARGET_USER_ID=123 npx ts-node scripts/seed-ai-learning-evidence.ts
 *
 * 说明：
 *   - 只导入清洗后的中文摘要、学习目标、关键概念与原始 URL，不复制课程/教材原文。
 *   - 默认优先导入 walkthrough_0903；如果账号不存在，则创建 ai_learning_seed 演示账号。
 *   - 重跑会删除本批 sourceId 对应旧 chunk 后重新导入，避免重复污染。
 */
import 'reflect-metadata';
import { DataSource, In } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import { EvidenceChunk } from '../src/entities/evidence-chunk.entity';
import { EvidenceRagService } from '../src/services/evidence-rag.service';
import { ChromaService } from '../src/services/chroma.service';

type AuthoritySeed = {
  sourceId: string;
  title: string;
  organization: string;
  url: string;
  skillTags: string[];
  confidence?: number;
  content: string;
};

const DEFAULT_USERNAME = 'walkthrough_0903';
const FALLBACK_USERNAME = 'ai_learning_seed';
const FALLBACK_EMAIL = 'ai_learning_seed@zhipath.local';

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function envConfig() {
  return {
    get: (key: string, def?: any) => process.env[key] ?? def,
  };
}

function loadSeeds(): AuthoritySeed[] {
  const seedPath = path.join(__dirname, '..', 'test-fixtures', 'evidence-rag', 'ai-learning-authority-seeds.json');
  const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as AuthoritySeed[];
  if (!Array.isArray(seeds) || seeds.length === 0) {
    throw new Error(`No authority seeds found at ${seedPath}`);
  }
  for (const seed of seeds) {
    if (!seed.sourceId || !seed.title || !seed.url || !seed.content) {
      throw new Error(`Invalid seed: ${JSON.stringify(seed)}`);
    }
  }
  return seeds;
}

async function resolveTargetUser(conn: mysql.Connection): Promise<{ userId: number; username: string; created: boolean }> {
  if (process.env.TARGET_USER_ID) {
    const userId = Number(process.env.TARGET_USER_ID);
    if (!Number.isFinite(userId) || userId <= 0) throw new Error(`Invalid TARGET_USER_ID=${process.env.TARGET_USER_ID}`);
    const [rows] = await conn.query('SELECT id, username FROM users_v3 WHERE id = ? AND status = 1 LIMIT 1', [userId]);
    const users = rows as Array<{ id: number; username: string }>;
    if (users.length === 0) throw new Error(`TARGET_USER_ID=${userId} not found in users_v3`);
    return { userId: Number(users[0].id), username: users[0].username, created: false };
  }

  const preferredUsername = process.env.TARGET_USERNAME || DEFAULT_USERNAME;
  const [preferredRows] = await conn.query('SELECT id, username FROM users_v3 WHERE username = ? AND status = 1 LIMIT 1', [preferredUsername]);
  const preferredUsers = preferredRows as Array<{ id: number; username: string }>;
  if (preferredUsers.length > 0) {
    return { userId: Number(preferredUsers[0].id), username: preferredUsers[0].username, created: false };
  }

  const [fallbackRows] = await conn.query('SELECT id, username FROM users_v3 WHERE username = ? LIMIT 1', [FALLBACK_USERNAME]);
  const fallbackUsers = fallbackRows as Array<{ id: number; username: string }>;
  if (fallbackUsers.length > 0) {
    return { userId: Number(fallbackUsers[0].id), username: fallbackUsers[0].username, created: false };
  }

  const now = Date.now();
  const [insertUser] = await conn.query(
    'INSERT INTO users_v3 (username, password, real_name, email, role, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    [FALLBACK_USERNAME, 'seed-password-placeholder', 'AI 学习资料种子账号', FALLBACK_EMAIL, 'student', now, now],
  );
  const userId = Number((insertUser as any).insertId);
  await conn.query(
    'INSERT INTO students_v3 (user_id, name, student_no, school, major, grade, email, interests, skills, onboarding_completed, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)',
    [
      userId,
      'AI 学习资料种子账号',
      'AI-SEED-2026',
      'ZhiPath Seed Lab',
      '人工智能',
      '演示',
      FALLBACK_EMAIL,
      JSON.stringify(['人工智能', '机器学习', '深度学习']),
      JSON.stringify([{ name: '人工智能基础', level: '入门', source: 'authority_seed' }]),
      now,
      now,
    ],
  );
  return { userId, username: FALLBACK_USERNAME, created: true };
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const seeds = loadSeeds();

  const mysqlOptions = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  };

  const conn = await mysql.createConnection(mysqlOptions);
  const target = await resolveTargetUser(conn);

  const dataSource = new DataSource({
    type: 'mysql',
    host: mysqlOptions.host,
    port: mysqlOptions.port,
    username: mysqlOptions.user,
    password: mysqlOptions.password,
    database: mysqlOptions.database,
    synchronize: false,
    entities: [EvidenceChunk],
  });
  await dataSource.initialize();

  const chunkRepo = dataSource.getRepository(EvidenceChunk);
  const config = envConfig();
  const chroma = new ChromaService(config as any);
  const rag = new EvidenceRagService(chunkRepo, chroma, config as any);

  const sourceIds = seeds.map((seed) => seed.sourceId);
  await chunkRepo.delete({ userId: target.userId, sourceType: 'file_qa', sourceId: In(sourceIds), status: 1 } as any);
  for (const sourceId of sourceIds) {
    await chroma.deleteBySource(target.userId, sourceId);
  }

  let chunks = 0;
  for (const seed of seeds) {
    const content = [
      seed.content,
      `发布机构：${seed.organization}`,
      `原始链接：${seed.url}`,
      `适用标签：${seed.skillTags.join('、')}`,
    ].join('\n');
    const saved = await rag.ingest(target.userId, {
      sourceType: 'file_qa',
      sourceId: seed.sourceId,
      title: seed.title,
      content,
      skillTags: seed.skillTags,
      confidence: seed.confidence ?? 0.85,
      visibility: 'private',
    });
    chunks += saved.length;
  }

  const probes = ['机器学习入门路线', 'Transformer 微调怎么学', 'AI 幻觉风险治理', 'PyTorch 训练循环', '强化学习核心概念'];
  const report: Array<{ query: string; total: number; top: string[] }> = [];
  for (const query of probes) {
    const items = await rag.search(target.userId, query, { limit: 5 });
    report.push({ query, total: items.length, top: items.slice(0, 3).map((item) => `${item.title} (${item.score})`) });
  }

  console.log(JSON.stringify({
    target,
    seedCount: seeds.length,
    chunkCount: chunks,
    chromaEnabled: chroma.enabled,
    embeddingProvider: process.env.EMBEDDING_PROVIDER || 'off',
    probes: report,
  }, null, 2));

  await dataSource.destroy();
  await conn.end();
}

main().catch((error) => {
  console.error('[SeedAI] Failed:', error);
  process.exit(1);
});
