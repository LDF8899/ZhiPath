/**
 * Evidence RAG 真实召回率测试 — 使用测试账号填入种子证据并评测检索
 *
 * 用法：npx ts-node scripts/test-evidence-recall.ts
 *
 * 流程：
 *   1. 创建/复用测试账号（users_v3 + students_v3，用户名 evidence_test）
 *   2. 清理该账号旧证据，用 EvidenceRagService.ingest 填入 10 条种子证据
 *   3. 用 EvidenceRagService.search（真实检索逻辑）跑 12 个查询
 *   4. 输出 Recall@5 / MRR / Source Accuracy / No-Evidence / User Isolation 报告
 *
 * 说明：未配置 EMBEDDING/CHROMA 时走关键词降级路径（真实业务默认行为）。
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { EvidenceChunk } from '../src/entities/evidence-chunk.entity';
import { EvidenceRagService } from '../src/services/evidence-rag.service';
import { ChromaService } from '../src/services/chroma.service';
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

const TEST_USERNAME = 'evidence_test';
const TEST_EMAIL = 'evidence_test@zhipath.local';

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

/** 种子证据：10 条，覆盖多技能、多来源类型 */
const SEED_EVIDENCE: Array<{ sourceType: any; title: string; content: string; skillTags: string[] }> = [
  {
    sourceType: 'project',
    title: '校园就业数据分析看板',
    content: '我使用 React、TypeScript 和 ECharts 完成校园就业数据分析看板，负责筛选器、图表联动和 CSV 导出，支持按专业和年级查看就业去向，项目已部署上线。',
    skillTags: ['React', 'TypeScript', 'ECharts'],
  },
  {
    sourceType: 'project',
    title: '电商管理后台',
    content: '基于 React 前端框架和 Redux 开发的电商管理后台，负责商品管理、订单列表与接口联调，使用 axios 封装请求，处理了分页和权限拦截。',
    skillTags: ['React', 'Redux', '接口联调'],
  },
  {
    sourceType: 'project',
    title: '招聘数据爬虫',
    content: '使用 Python 和 Scrapy 爬取招聘网站数据，清洗后存入 MySQL 数据库，编写 RESTful API 供前端查询，支持关键词过滤和分页。',
    skillTags: ['Python', 'Scrapy', 'MySQL'],
  },
  {
    sourceType: 'file_qa',
    title: 'React Hooks 学习笔记',
    content: 'React Hooks 核心：useState 管理组件状态，useEffect 处理副作用，自定义 Hook 复用逻辑。问题：如何在项目中使用 Hooks 管理状态？回答：把状态提升到组件顶层，用 useEffect 监听依赖变化。',
    skillTags: ['React', 'Hooks'],
  },
  {
    sourceType: 'file_qa',
    title: 'Node.js 接口开发笔记',
    content: '使用 Node.js 和 Express 开发 RESTful 接口，包括路由设计、中间件、错误处理，以及前后端接口联调的注意事项（CORS、token 鉴权）。',
    skillTags: ['Node.js', 'Express', '接口联调'],
  },
  {
    sourceType: 'project',
    title: '学生选课系统',
    content: '使用 Java 和 Spring Boot 开发学生选课系统，实现课程管理、选课冲突检测，数据存储使用 MySQL，编写了基础单元测试。',
    skillTags: ['Java', 'Spring Boot', 'MySQL'],
  },
  {
    sourceType: 'file_qa',
    title: 'SQL 查询优化笔记',
    content: 'SQL 查询优化要点：索引使用、避免 SELECT *、EXPLAIN 分析执行计划，优化慢查询的经验总结，含订单表百万级数据分页优化案例。',
    skillTags: ['SQL', 'MySQL'],
  },
  {
    sourceType: 'evaluation',
    title: '接口联调测评',
    content: '接口联调测评结果：RESTful API 设计 8/10，错误处理 7/10，鉴权流程 9/10，整体通过。薄弱项：超时重试机制。',
    skillTags: ['接口联调', 'API'],
  },
  {
    sourceType: 'project',
    title: '个人博客系统',
    content: '使用 Node.js、Vue 和 Markdown 构建个人博客系统，实现文章发布、标签归档，通过 Nginx 反向代理部署到云服务器并配置 HTTPS。',
    skillTags: ['Node.js', 'Vue', '项目部署'],
  },
  {
    sourceType: 'project',
    title: '微信小程序商城',
    content: '开发微信小程序商城，实现商品浏览、购物车与订单支付流程，后端接口联调使用 Promise 封装，包含登录态与支付回调处理。',
    skillTags: ['小程序', 'Vue', '接口联调'],
  },
];

/** 评测查询：query + 期望命中证据（title 关键词） */
const QUERIES: Array<{ query: string; expectTitle: string | null }> = [
  { query: '我有什么 React 项目', expectTitle: '校园就业数据分析看板' },
  { query: 'React Hooks 怎么用', expectTitle: 'React Hooks 学习笔记' },
  { query: 'Python 爬虫项目', expectTitle: '招聘数据爬虫' },
  { query: '接口联调经验', expectTitle: '接口联调测评' },
  { query: 'Node.js 后端开发', expectTitle: 'Node.js 接口开发笔记' },
  { query: 'SQL 查询优化', expectTitle: 'SQL 查询优化笔记' },
  { query: '项目部署上线', expectTitle: '个人博客系统' },
  { query: '小程序开发', expectTitle: '微信小程序商城' },
  { query: 'Java 后端课程系统', expectTitle: '学生选课系统' },
  { query: '电商管理后台开发', expectTitle: '电商管理后台' },
  { query: '前端框架经验', expectTitle: '电商管理后台' },
  { query: '机器学习相关经验', expectTitle: null }, // 无证据 → 期望空
];

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));

  // 1. 连接 MySQL
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  });

  // 2. 创建/复用测试账号
  const [existUsers] = await conn.query('SELECT id FROM users_v3 WHERE username = ? LIMIT 1', [TEST_USERNAME]);
  let userId: number;
  if ((existUsers as any[]).length > 0) {
    userId = Number((existUsers as any[])[0].id);
    console.log(`[Test] 复用测试账号 userId=${userId} (${TEST_USERNAME})`);
  } else {
    const now = Date.now();
    const [ins] = await conn.query(
      'INSERT INTO users_v3 (username, password, email, role, status, create_time, update_time) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [TEST_USERNAME, 'test-password-placeholder', TEST_EMAIL, 'student', now, now],
    );
    userId = Number((ins as any).insertId);
    await conn.query(
      'INSERT INTO students_v3 (user_id, name, student_no, school, major, grade, email, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [userId, '证据测试', 'TEST2026001', 'ZhiPath 测试大学', '软件工程', '大三', TEST_EMAIL, now, now],
    );
    console.log(`[Test] 创建测试账号 userId=${userId} (${TEST_USERNAME})`);
  }

  // 3. TypeORM 初始化 EvidenceRagService（真实 repo）
  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
    synchronize: false,
    entities: [EvidenceChunk],
  });
  await dataSource.initialize();
  const chunkRepo = dataSource.getRepository(EvidenceChunk);

  const config = envConfig();
  const chroma = new ChromaService(config as any);
  const rag = new EvidenceRagService(chunkRepo, chroma, config as any);

  // 4. 清理旧证据（幂等重跑）
  await chunkRepo.delete({ userId });
  for (const seed of SEED_EVIDENCE) {
    await chroma.deleteBySource(userId, `${seed.sourceType}:${seed.title}`);
  }
  console.log(`[Test] 已清理 userId=${userId} 旧证据`);

  // 5. 填入种子证据
  let ingested = 0;
  for (const seed of SEED_EVIDENCE) {
    const saved = await rag.ingest(userId, {
      sourceType: seed.sourceType,
      sourceId: `${seed.sourceType}:${seed.title}`,
      title: `${seed.sourceType === 'file_qa' ? '文件证据' : seed.sourceType === 'evaluation' ? '测评证据' : '项目证据'}：${seed.title}`,
      content: seed.content,
      skillTags: seed.skillTags,
    });
    ingested += saved.length;
  }
  console.log(`[Test] 已入库 ${ingested} 个 evidence chunk（10 条种子证据）`);
  console.log(`[Test] Chroma enabled=${chroma.enabled}, EMBEDDING_PROVIDER=${process.env.EMBEDDING_PROVIDER || 'off'}\n`);

  // 6. 跑评测查询
  const results: Array<{ query: string; expected: string | null; hit: boolean; topTitle: string; rank: number; scores: number[] }> = [];
  let recallHits = 0;
  let mrrSum = 0;
  let sourceHits = 0;
  let noEvidenceCorrect = 0;
  let noEvidenceTotal = 0;
  let queryCount = 0;

  for (const q of QUERIES) {
    const items = await rag.search(userId, q.query, { limit: 5 });
    queryCount++;

    const topTitles = items.map((i) => i.title);
    const scores = items.map((i) => i.score);
    const expectedMatch = q.expectTitle ? topTitles.findIndex((t) => t.includes(q.expectTitle) || q.expectTitle.includes(t.split('：')[1] || '')) : -1;

    if (!q.expectTitle) {
      // No-Evidence：期望返回空
      noEvidenceTotal++;
      if (items.length === 0) noEvidenceCorrect++;
      results.push({ query: q.query, expected: null, hit: items.length === 0, topTitle: topTitles[0] || '', rank: -1, scores });
      continue;
    }

    const hit = expectedMatch >= 0;
    if (hit) {
      recallHits++;
      mrrSum += 1 / (expectedMatch + 1);
    }
    // Source Accuracy：期望来源类型与 top1 一致（project/file_qa 类型一致视为正确）
    const expectedType = SEED_EVIDENCE.find((s) => s.title === q.expectTitle)?.sourceType;
    if (items[0]?.sourceType === expectedType) sourceHits++;
    if (expectedMatch < 0) {
      // 期望命中但没召回 → 打印排查信息
      console.warn(`  [MISS] query="${q.query}" expected="${q.expectTitle}" → top: ${topTitles.join(' | ') || '(空)'}`);
    }
    results.push({ query: q.query, expected: q.expectTitle, hit, topTitle: topTitles[0] || '', rank: expectedMatch, scores });
  }

  // 7. User Isolation：用其他 userId 查询该测试账号证据应返回空
  const otherUserId = userId + 100000;
  const isolation = await rag.search(otherUserId, 'React 项目');
  const isolationOk = isolation.length === 0;

  // 8. 输出报告
  const recall = recallHits / Math.max(1, queryCount - noEvidenceTotal);
  const mrr = mrrSum / Math.max(1, queryCount - noEvidenceTotal);
  const sourceAccuracy = sourceHits / Math.max(1, queryCount - noEvidenceTotal);
  const noEvidenceAccuracy = noEvidenceTotal > 0 ? noEvidenceCorrect / noEvidenceTotal : 1;

  console.log('='.repeat(72));
  console.log('Evidence RAG 真实召回率报告（测试账号 evidence_test / userId=' + userId + '）');
  console.log('='.repeat(72));
  console.log(`种子证据：${SEED_EVIDENCE.length} 条 → ${ingested} chunks（Chroma enabled=${chroma.enabled}, EMBEDDING_PROVIDER=${process.env.EMBEDDING_PROVIDER || 'off'}）`);
  console.log('');
  console.log('─'.repeat(72));
  console.log('查询明细（top1 命中率按 title 匹配）：');
  for (const r of results) {
    const mark = r.hit ? '✓' : r.expected === null ? (r.hit ? '✓' : '✗') : '✗';
    console.log(
      `  ${mark} "${r.query}"${r.expected ? ` 期望[${r.expected}]` : ' 期望[无证据]'}  ` +
        `→ ${r.hit ? `命中 rank#${r.rank + 1}` : '未命中'}  top1="${r.topTitle.slice(0, 30)}"  scores=[${r.scores.slice(0, 3).join(', ')}]`,
    );
  }
  console.log('─'.repeat(72));
  console.log('');
  console.log('评测指标（P0 合格线 / 实测）：');
  console.log(`  Recall@5        ≥85%   → ${(recall * 100).toFixed(1)}%  (${recallHits}/${queryCount - noEvidenceTotal})`);
  console.log(`  MRR             ≥0.70  → ${mrr.toFixed(3)}`);
  console.log(`  Source Accuracy ≥90%   → ${(sourceAccuracy * 100).toFixed(1)}%  (${sourceHits}/${queryCount - noEvidenceTotal})`);
  console.log(`  User Isolation  100%   → ${isolationOk ? '100% ✓' : 'FAILED ✗'}`);
  console.log(`  No-Evidence     ≥95%   → ${(noEvidenceAccuracy * 100).toFixed(1)}%  (${noEvidenceCorrect}/${noEvidenceTotal})`);
  console.log('');

  const pass = recall >= 0.85 && mrr >= 0.7 && sourceAccuracy >= 0.9 && isolationOk && noEvidenceAccuracy >= 0.95;
  console.log(pass ? '✅ 全部指标达到 P0 合格线' : '⚠️ 存在未达标指标，请检查上方 MISS 明细');
  console.log(`\n测试账号保留：users_v3.username=${TEST_USERNAME}（可登录前端查看证据链/聊天引用效果）`);

  await dataSource.destroy();
  await conn.end();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('[Test] 失败:', e.message);
  process.exit(1);
});
