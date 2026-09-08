const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('../node_modules/mysql2/promise');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const json = (v) => JSON.stringify(v);
const md5 = (t) => crypto.createHash('md5').update(t).digest('hex');
const now = Date.now();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  });

  const [userRows] = await conn.query('SELECT id FROM users_v3 WHERE username = ? LIMIT 1', ['zhangsan']);
  if (!userRows.length) throw new Error('zhangsan user not found');
  const userId = Number(userRows[0].id);

  const [jobRows] = await conn.query('SELECT id FROM job_positions_v3 WHERE source = ? ORDER BY id DESC LIMIT 1', ['zhangsan_rich_demo_seed']);
  const jobId = jobRows.length ? Number(jobRows[0].id) : null;

  const resources = [
    {
      external_id: 'zhangsan-demo:resource:overview',
      resource_type: 'lecture',
      title: '张三演示总览讲义',
      skill_name: '学习复盘表达',
      agent_type: 'expert',
      payload: {
        title: '张三演示总览讲义',
        summary: '一页讲清张三的岗位、路径、成果和证据',
        sections: ['个人画像', '目标岗位', '学习路径', '关键证据', '演示顺序'],
      },
      preview_meta: { display: 'demo', panel: 'overview' },
    },
    {
      external_id: 'zhangsan-demo:resource:quiz-20',
      resource_type: 'quiz',
      title: '张三演示题库 20 题',
      skill_name: '严格出题质量评估',
      agent_type: 'reviewer',
      payload: { questions: Array.from({ length: 20 }, (_, i) => ({ question: `演示题 ${i + 1}`, options: ['A', 'B', 'C', 'D'], answer: 'B', explanation: '用于路演演示' })) },
      preview_meta: { display: 'demo', panel: 'quiz' },
    },
    {
      external_id: 'zhangsan-demo:resource:graph',
      resource_type: 'diagram',
      title: '张三能力雷达图谱',
      skill_name: '前端可视化',
      agent_type: 'maker',
      payload: { diagramType: 'flowchart', nodes: ['画像', '计划', '任务', '考试', '证据'], edges: [['画像', '计划'], ['计划', '任务'], ['任务', '考试'], ['考试', '证据']] },
      preview_meta: { display: 'demo', panel: 'graph' },
    },
    {
      external_id: 'zhangsan-demo:resource:video-1',
      resource_type: 'video',
      title: '张三演示视频',
      skill_name: '学习复盘表达',
      agent_type: 'VideoAgent',
      payload: { video_file_path: 'zhangsan-demo.mp4', videoFilePath: 'zhangsan-demo.mp4', url: '/api/video/zhangsan-demo.mp4', summary: '演示视频资源占位', title: '张三演示视频' },
      preview_meta: { display: 'demo', panel: 'video' },
    },
    {
      external_id: 'zhangsan-demo:resource:video-2',
      resource_type: 'video',
      title: '张三岗位匹配视频',
      skill_name: '系统设计入门',
      agent_type: 'VideoAgent',
      payload: { video_file_path: 'zhangsan-demo-2.mp4', videoFilePath: 'zhangsan-demo-2.mp4', url: '/api/video/zhangsan-demo-2.mp4', summary: '岗位匹配视频资源占位', title: '张三岗位匹配视频' },
      preview_meta: { display: 'demo', panel: 'video' },
    },
    {
      external_id: 'zhangsan-demo:resource:roadmap',
      resource_type: 'lecture',
      title: '张三 AI 全栈路线复盘',
      skill_name: '系统设计入门',
      agent_type: 'expert',
      payload: { title: '张三 AI 全栈路线复盘', summary: '从画像到投递的闭环复盘', sections: ['起点画像', '技能补齐', '任务闭环', '证据入库', '投递准备'] },
      preview_meta: { display: 'demo', panel: 'overview' },
    },
    {
      external_id: 'zhangsan-demo:resource:quiz-weak',
      resource_type: 'quiz',
      title: '张三基础补弱练习',
      skill_name: 'React 状态管理',
      agent_type: 'reviewer',
      payload: { questions: Array.from({ length: 8 }, (_, i) => ({ question: `补弱题 ${i + 1}`, options: ['A', 'B', 'C', 'D'], answer: 'A', explanation: '用于补弱' })) },
      preview_meta: { display: 'demo', panel: 'quiz' },
    },
    {
      external_id: 'zhangsan-demo:resource:evidence-graph',
      resource_type: 'diagram',
      title: '张三知识库证据图',
      skill_name: 'RAG 基础',
      agent_type: 'maker',
      payload: { diagramType: 'mindmap', nodes: ['来源', '切片', '质检', '入库'], links: [['来源', '切片'], ['切片', '质检'], ['质检', '入库']] },
      preview_meta: { display: 'demo', panel: 'graph' },
    },
    {
      external_id: 'zhangsan-demo:resource:defense',
      resource_type: 'lecture',
      title: '张三面试答辩讲义',
      skill_name: '学习复盘表达',
      agent_type: 'expert',
      payload: { title: '张三面试答辩讲义', summary: '答辩话术、项目亮点、证据链和Q&A', sections: ['自我介绍', '项目亮点', '学习闭环', '证据链', '面试问答'] },
      preview_meta: { display: 'demo', panel: 'overview' },
    },
    {
      external_id: 'zhangsan-demo:resource:video-3',
      resource_type: 'video',
      title: '张三项目展示视频',
      skill_name: 'React 状态管理',
      agent_type: 'VideoAgent',
      payload: { video_file_path: 'zhangsan-demo.mp4', videoFilePath: 'zhangsan-demo.mp4', url: '/api/video/zhangsan-demo.mp4', summary: '项目展示视频资源占位', title: '张三项目展示视频' },
      preview_meta: { display: 'demo', panel: 'video' },
    },
  ];

  for (const r of resources) {
    const [exists] = await conn.query('SELECT id FROM generated_resources_v3 WHERE user_id=? AND external_id=? LIMIT 1', [userId, r.external_id]);
    if (exists.length) {
      await conn.query(
        'UPDATE generated_resources_v3 SET resource_type=?, title=?, skill_name=?, source=?, agent_type=?, resource_status=?, payload=?, preview_meta=?, provider=?, cost_tokens=?, cost_credits=?, duration_ms=?, update_time=? WHERE id=?',
        [r.resource_type, r.title, r.skill_name, 'manual', r.agent_type, 'success', json(r.payload), json(r.preview_meta), 'seed', 1600, 0, 1200, now, exists[0].id],
      );
    } else {
      await conn.query(
        'INSERT INTO generated_resources_v3 (user_id, resource_type, title, skill_name, source, external_id, agent_type, resource_status, payload, preview_meta, provider, cost_tokens, cost_credits, duration_ms, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [userId, r.resource_type, r.title, r.skill_name, 'manual', r.external_id, r.agent_type, 'success', json(r.payload), json(r.preview_meta), 'seed', 1600, 0, 1200, now, now],
      );
    }
  }

  const ingestions = [
    { task_id: 'zhangsan-demo:knowledge:overview', title: '张三完整画像', source_kind: 'upload_text', ingestion_status: 'ingested', raw_text: '张三是演示账号，用于展示完整学习闭环。', cleaned_text: '张三是演示账号，用于展示完整学习闭环。', summary: '演示账号画像', skill_tags: ['画像', '岗位目标', '学习路径'], source_type: 'resume' },
    { task_id: 'zhangsan-demo:knowledge:project', title: '张三项目实践', source_kind: 'upload_text', ingestion_status: 'ingested', raw_text: '项目实践描述', cleaned_text: '项目实践描述', summary: '项目实践证据', skill_tags: ['项目', 'React', 'NestJS'], source_type: 'project' },
    { task_id: 'zhangsan-demo:knowledge:rag', title: '张三RAG证据', source_kind: 'upload_text', ingestion_status: 'ingested', raw_text: 'RAG 证据说明', cleaned_text: 'RAG 证据说明', summary: 'RAG 证据', skill_tags: ['RAG', '证据引用'], source_type: 'evaluation' },
    { task_id: 'zhangsan-demo:knowledge:agent', title: '张三Agent产物', source_kind: 'news_manual', ingestion_status: 'approved', raw_text: 'Agent 产物说明', cleaned_text: 'Agent 产物说明', summary: 'Agent 产物', skill_tags: ['Agent', '质检'], source_type: 'agent_output' },
    { task_id: 'zhangsan-demo:knowledge:video', title: '张三视频说明', source_kind: 'upload_text', ingestion_status: 'ingested', raw_text: '视频演示说明', cleaned_text: '视频演示说明', summary: '视频演示说明', skill_tags: ['视频', '演示'], source_type: 'learning_commit' },
    { task_id: 'zhangsan-demo:knowledge:skills', title: '张三技能复盘', source_kind: 'upload_text', ingestion_status: 'ingested', raw_text: '技能复盘说明', cleaned_text: '技能复盘说明', summary: '技能复盘', skill_tags: ['技能', '复盘'], source_type: 'learning_commit' },
  ];

  for (const t of ingestions) {
    const content = `${t.cleaned_text}\n用户：张三\n目标岗位：AI 全栈应用工程师\n演示标签：zhangsan-demo`;
    const chunkHash = md5(content);
    const [chunkExists] = await conn.query('SELECT id FROM evidence_chunks WHERE user_id=? AND source_id=? LIMIT 1', [userId, t.task_id]);
    let chunkId;
    if (chunkExists.length) {
      chunkId = chunkExists[0].id;
      await conn.query(
        'UPDATE evidence_chunks SET source_type=?, title=?, content=?, content_hash=?, skill_tags=?, job_target_id=?, confidence=?, update_time=? WHERE id=?',
        [t.source_type, t.title, content, chunkHash, json(t.skill_tags), jobId, 0.9, now, chunkId],
      );
    } else {
      const [ins] = await conn.query(
        'INSERT INTO evidence_chunks (user_id, source_type, source_id, chunk_index, title, content, content_hash, skill_tags, job_target_id, confidence, visibility, vector_status, status, create_time, update_time) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, \'private\', \'pending\', 1, ?, ?)',
        [userId, t.source_type, t.task_id, t.title, content, chunkHash, json(t.skill_tags), jobId, 0.9, now, now],
      );
      chunkId = ins.insertId;
    }

    const [taskExists] = await conn.query('SELECT id FROM knowledge_ingestion_tasks WHERE task_id=? LIMIT 1', [t.task_id]);
    if (taskExists.length) {
      await conn.query(
        'UPDATE knowledge_ingestion_tasks SET source_kind=?, ingestion_status=?, title=?, raw_text=?, cleaned_text=?, summary=?, skill_tags=?, chunk_preview=?, curator_result=?, inspection_result=?, ingested_chunk_ids=?, update_time=? WHERE id=?',
        [t.source_kind, t.ingestion_status, t.title, t.raw_text, content, t.summary, json(t.skill_tags), json([{ title: t.title, content: content.slice(0, 180), tags: t.skill_tags }]), json({ agent: 'knowledge-curator', status: 'approved' }), json({ agent: 'knowledge-inspector', status: 'approved', checks: { relevance: true, sourceTraceable: true, safety: true, duplicate: false, citationReady: true }, score: 92 }), json([chunkId]), now, taskExists[0].id],
      );
    } else {
      await conn.query(
        'INSERT INTO knowledge_ingestion_tasks (task_id, user_id, source_kind, ingestion_status, title, source_url, source_name, raw_text, cleaned_text, summary, skill_tags, chunk_preview, curator_result, inspection_result, ingested_chunk_ids, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        [t.task_id, userId, t.source_kind, t.ingestion_status, t.title, null, 'zhangsan demo', t.raw_text, content, t.summary, json(t.skill_tags), json([{ title: t.title, content: content.slice(0, 180), tags: t.skill_tags }]), json({ agent: 'knowledge-curator', status: 'approved' }), json({ agent: 'knowledge-inspector', status: 'approved', checks: { relevance: true, sourceTraceable: true, safety: true, duplicate: false, citationReady: true }, score: 92 }), json([chunkId]), now, now],
      );
    }
  }

  const [r1] = await conn.query('SELECT COUNT(*) c FROM generated_resources_v3 WHERE user_id=?', [userId]);
  const [r2] = await conn.query('SELECT COUNT(*) c FROM knowledge_ingestion_tasks WHERE user_id=?', [userId]);
  const [r3] = await conn.query('SELECT COUNT(*) c FROM evidence_chunks WHERE user_id=?', [userId]);

  console.log(JSON.stringify({ ok: true, userId, generatedResources: r1[0].c, knowledgeTasks: r2[0].c, evidenceChunks: r3[0].c }, null, 2));
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
