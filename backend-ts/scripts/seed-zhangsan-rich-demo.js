const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('../node_modules/bcryptjs');
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

const now = Date.now();
const json = (v) => JSON.stringify(v);
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const ts = (offset = 0, hour = 9, minute = 0) => {
  const d = new Date(Date.now() + offset * 86400000);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
};
const md5 = (text) => crypto.createHash('md5').update(text).digest('hex');

const skills = [
  { name: 'React 状态管理', before: 44, after: 82, trust: 0.86, source: 'github' },
  { name: 'TypeScript 工程化', before: 40, after: 78, trust: 0.82, source: 'github' },
  { name: 'NestJS 后端开发', before: 36, after: 74, trust: 0.8, source: 'exam' },
  { name: 'MySQL 数据建模', before: 34, after: 73, trust: 0.78, source: 'exam' },
  { name: 'AI Agent 设计', before: 24, after: 69, trust: 0.77, source: 'conversation' },
  { name: 'RAG 基础', before: 22, after: 68, trust: 0.8, source: 'exam' },
  { name: '前端可视化', before: 38, after: 72, trust: 0.72, source: 'github' },
  { name: '算法与数据结构', before: 30, after: 61, trust: 0.66, source: 'exam' },
  { name: '系统设计入门', before: 25, after: 63, trust: 0.7, source: 'conversation' },
  { name: '服务部署与排障', before: 28, after: 66, trust: 0.74, source: 'github' },
  { name: '严格出题质量评估', before: 18, after: 64, trust: 0.72, source: 'exam' },
  { name: '学习复盘表达', before: 42, after: 79, trust: 0.76, source: 'self_report' },
];

const weakTopics = [
  { label: 'React 异步状态边界', beforeMastery: 48, afterMastery: 72 },
  { label: 'RAG 引用证据校验', beforeMastery: 34, afterMastery: 68 },
  { label: 'Agent 工具失败降级', beforeMastery: 31, afterMastery: 65 },
  { label: 'SQL 索引与慢查询', beforeMastery: 42, afterMastery: 70 },
  { label: 'TypeScript 泛型约束', beforeMastery: 45, afterMastery: 73 },
  { label: '算法复杂度分析', beforeMastery: 37, afterMastery: 60 },
];

const resources = [
  ['lecture', 'React 状态流与边界态讲义', 'React 状态管理', 'expert', '围绕 loading/error/empty/retry 四种边界态给出组件组织方式。'],
  ['code', 'TypeScript API 类型封装示例', 'TypeScript 工程化', 'maker', '将后端响应、分页、错误码和业务实体封装成稳定类型。'],
  ['diagram', 'RAG 检索链路解释图', 'RAG 基础', 'maker', '展示切片、向量索引、召回、重排、引用与拒答边界。'],
  ['quiz', 'NestJS 模块化 15 题速测', 'NestJS 后端开发', 'exam', '覆盖 Module/Provider/Controller/Guard/Interceptor。'],
  ['report', '岗位匹配差距报告', '系统设计入门', 'reviewer', '把岗位要求拆成能力、证据、项目、补弱任务四类。'],
  ['runbook', '本地服务联调排障手册', '服务部署与排障', 'reviewer', '覆盖端口、环境变量、数据库连接、跨域和代理。'],
  ['flashcard', 'MySQL 索引记忆卡', 'MySQL 数据建模', 'expert', '整理联合索引、最左前缀、EXPLAIN 和慢查询定位。'],
  ['worksheet', 'Agent 失败恢复练习单', 'AI Agent 设计', 'planner', '设计超时、空结果、权限失败、低置信度四类降级路径。'],
  ['lecture', '严格出题质量审核规范', '严格出题质量评估', 'reviewer', '用答案唯一、解析回证据、难度贴合、结构完整做质量门。'],
  ['project', 'CodeNova 个人演示作品说明', '学习复盘表达', 'maker', '整理演示路径、核心价值、数据闭环和答辩话术。'],
  ['quiz', '算法复杂度与常见结构小测', '算法与数据结构', 'exam', '覆盖数组、哈希表、栈队列、树和时间复杂度。'],
  ['diagram', '前端可视化信息架构图', '前端可视化', 'maker', '将学习进度、证据图谱、岗位匹配和 Agent 工作流分层展示。'],
];

const agents = [
  ['diagnose', 'cat', '#dbeafe', 'Mira', 'Learning Diagnostician', 1],
  ['expert', 'owl', '#dcfce7', 'Sage', 'Domain Expert', 2],
  ['maker', 'rabbit', '#ede9fe', 'Nova', 'Resource Maker', 3],
  ['reviewer', 'fox', '#fef3c7', 'Guard', 'Quality Reviewer', 4],
  ['planner', 'deer', '#fce7f3', 'Pathy', 'Path Planner', 5],
  ['knowledge', 'owl', '#dbeafe', 'Indexa', 'Knowledge Curator', 6],
  ['inspector', 'fox', '#fee2e2', 'Guard', 'Quality Inspector', 7],
];

async function tableExists(conn, table) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [table]);
  return rows.length > 0;
}

async function columnSet(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM ${table}`);
  return new Set(rows.map((r) => r.Field));
}

async function insertFlexible(conn, table, row) {
  if (!(await tableExists(conn, table))) return null;
  const cols = await columnSet(conn, table);
  const entries = Object.entries(row).filter(([k, v]) => cols.has(k) && v !== undefined);
  if (!entries.length) return null;
  const names = entries.map(([k]) => `\`${k}\``).join(', ');
  const qs = entries.map(() => '?').join(', ');
  const vals = entries.map(([, v]) => v);
  const [result] = await conn.query(`INSERT INTO ${table} (${names}) VALUES (${qs})`, vals);
  return Number(result.insertId || 0);
}

async function resetUserScoped(conn, userId) {
  const tables = [
    'students_v3', 'learning_tasks_v3', 'learning_sessions_v3', 'user_skills_v3', 'learning_plans_v3',
    'learning_branches_v3', 'learning_commits_v3', 'skill_snapshots_v3', 'exam_records_v3',
    'question_generation_snapshots', 'question_generation_tasks', 'knowledge_ingestion_tasks',
    'generated_resources_v3', 'agent_profiles_v3', 'agent_tasks_v3', 'remediation_runs', 'evidence_chunks',
    'match_history_v3', 'job_applications_v3', 'evaluation_attempts_v3', 'evaluation_evidence_v3',
    'evaluation_results_v3', 'evaluation_dimension_scores_v3', 'evaluation_impacts_v3', 'resume_v3'
  ];
  for (const table of tables) {
    if (await tableExists(conn, table)) {
      try { await conn.query(`DELETE FROM ${table} WHERE user_id = ?`, [userId]); } catch (_) {}
    }
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  });

  const passwordHash = await bcrypt.hash('123456', 10);
  const [userRows] = await conn.query('SELECT id FROM users_v3 WHERE username = ? LIMIT 1', ['zhangsan']);
  let userId;
  if (userRows.length) {
    userId = Number(userRows[0].id);
    await conn.query('UPDATE users_v3 SET password=?, real_name=?, email=?, role=?, status=1, update_time=? WHERE id=?', [passwordHash, '张三', 'zhangsan@test.com', 'student', now, userId]);
  } else {
    const [ins] = await conn.query('INSERT INTO users_v3 (username, password, real_name, email, role, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', ['zhangsan', passwordHash, '张三', 'zhangsan@test.com', 'student', now, now]);
    userId = Number(ins.insertId);
  }

  await resetUserScoped(conn, userId);

  const [jobIns] = await conn.query(
    'INSERT INTO job_positions_v3 (title, company, level, jd_text, required_skills, preferred_skills, salary_range, location, delivery_threshold, source, confidence_score, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [
      'AI 全栈应用工程师', 'CodeNova Demo Lab', 'junior',
      '负责 React/TypeScript 前端、NestJS API、MySQL 数据建模、RAG 知识库和 AI Agent 工作流。要求能够把学习证据、测评、补弱计划和岗位匹配串成闭环。',
      json(skills.slice(0, 8).map((s) => ({ name: s.name, weight: Math.round((s.after / 100) * 100) / 100 }))),
      json([{ name: '作品复盘', weight: 0.72 }, { name: '演示表达', weight: 0.68 }, { name: '数据看板', weight: 0.7 }]),
      '10k-18k', '广州 / 深圳 / 远程', 70, 'zhangsan_rich_demo_seed', 0.92, now, now,
    ]
  );
  const jobId = Number(jobIns.insertId);

  const studentId = await insertFlexible(conn, 'students_v3', {
    user_id: userId,
    name: '张三',
    student_no: 'DEMO-ZHANGSAN-001',
    school: '广州软件学院',
    major: '软件工程 / AI 应用方向',
    grade: '大三',
    email: 'zhangsan@test.com',
    target_job_id: jobId,
    interests: json(['AI 全栈应用', 'RAG 知识库', 'Agent 工作流', '前端可视化', '岗位匹配']),
    skills: json(skills.map((s) => ({ name: s.name, level: s.after >= 78 ? '熟练' : s.after >= 68 ? '进阶' : '入门', source: s.source, masteryPct: s.after }))),
    projects: json([
      { name: 'CodeNova 学习闭环演示台', role: '全栈负责人', desc: '打通画像诊断、岗位匹配、学习任务、严格出题、错题补弱、证据入库与 Agent 编排。', stack: ['React', 'TypeScript', 'NestJS', 'MySQL', 'RAG'] },
      { name: 'RAG 证据图谱工作台', role: '前端开发', desc: '展示知识切片、引用来源、命中解释和质量审核状态。', stack: ['React', 'ECharts', 'Three.js'] },
      { name: '智能岗位匹配报告', role: '后端开发', desc: '根据简历、项目和测评结果计算岗位差距并生成补弱路径。', stack: ['NestJS', 'MySQL', 'Redis'] },
    ]),
    github_username: 'zhangsan-demo',
    work_experience: json([{ company: 'CodeNova Demo Lab', role: 'AI 全栈应用实习生', period: '2026.07-2026.09', description: '负责演示数据链路、前端页面联调和后端 API 排障。' }]),
    awards: json([{ name: 'CodeNova 阶段性学习闭环优秀样本', date: '2026-09' }, { name: 'RAG 应用实践营 Top 10%', date: '2026-08' }]),
    self_intro: '张三是一个用于路演演示的高完整度学生账号：有明确目标岗位、丰富能力画像、学习轨迹、考试记录、错题补弱、生成资源、知识库证据和 Agent 任务记录。',
    daily_hours: 2.5,
    target_deadline: '2026-10-30',
    onboarding_completed: 1,
    status: 1,
    create_time: now,
    update_time: now,
  });

  for (const s of skills) {
    await insertFlexible(conn, 'user_skills_v3', {
      user_id: userId, skill_name: s.name, mastery_pct: s.after, trust_weight: s.trust, source: s.source,
      last_activity: ts(0, 18), decay_start: ts(14, 0), status: 1, create_time: now, update_time: now,
    });
  }

  const pathData = {
    phases: [
      { title: '画像诊断', status: 'done', skills: ['学习复盘表达', 'React 状态管理'] },
      { title: '核心工程补强', status: 'done', skills: ['TypeScript 工程化', 'NestJS 后端开发', 'MySQL 数据建模'] },
      { title: 'AI 能力闭环', status: 'active', skills: ['RAG 基础', 'AI Agent 设计', '严格出题质量评估'] },
      { title: '作品答辩冲刺', status: 'next', skills: ['前端可视化', '系统设计入门', '服务部署与排障'] },
    ],
    milestones: [
      { name: '完成个人画像', date: day(-12), status: 'done' },
      { name: '完成岗位匹配', date: day(-10), status: 'done' },
      { name: '完成知识库入库', date: day(-7), status: 'done' },
      { name: '完成严格出题', date: day(-3), status: 'done' },
      { name: '准备演示答辩', date: day(2), status: 'active' },
    ],
    generatedBy: 'zhangsan_rich_demo_seed',
  };

  const [planIns] = await conn.query(
    'INSERT INTO learning_plans_v3 (user_id, plan_name, plan_type, target_job_id, domain_id, goal_type, goal_title, plan_status, schedule_enabled, path_data, current_phase, daily_hours, main_ratio, match_score, estimated_date, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [userId, '张三 · AI 全栈应用工程师冲刺主线', 'main', jobId, 'ai-native-engineering', 'career', '4 周完成 AI 全栈应用演示闭环', 'active', json(pathData), 2, 2.5, 75, 82, '2026-10-30', now, now]
  );
  const planId = Number(planIns.insertId);

  const learningDays = [
    [-13, 72, 43, 48], [-12, 86, 48, 53], [-10, 95, 53, 59], [-9, 70, 59, 62], [-7, 108, 62, 69], [-6, 92, 69, 72], [-4, 115, 72, 77], [-3, 88, 77, 79], [-1, 126, 79, 82], [0, 64, 82, 84],
  ];
  const taskStatuses = ['lecture_done', 'practice_done', 'code_done', 'exam_done', 'done'];
  let sortOrder = 0;
  for (let i = 0; i < learningDays.length; i++) {
    const [offset, minutes, before, after] = learningDays[i];
    const taskSnapshot = [];
    const daySkills = [skills[i % skills.length], skills[(i + 3) % skills.length], skills[(i + 6) % skills.length]];
    for (let j = 0; j < daySkills.length; j++) {
      const s = daySkills[j];
      const status = taskStatuses[(i + j) % taskStatuses.length];
      const actual = Math.round(minutes / 3) + j * 5;
      const taskId = await insertFlexible(conn, 'learning_tasks_v3', {
        user_id: userId, plan_id: planId, skill_name: s.name, task_type: j === 2 ? 'side' : 'main', task_status: status,
        estimated_min: actual + 10, actual_min: actual, sort_order: sortOrder++, priority: j === 0 ? 9 : 6,
        plan_date: day(offset), start_time: ts(offset, 19, j * 10), complete_time: ts(offset, 20, j * 10), is_active: offset >= -1 ? 1 : 0,
        status: 1, create_time: now + offset, update_time: now + offset,
      });
      taskSnapshot.push({ id: taskId, skillName: s.name, status, minutes: actual });
    }
    await insertFlexible(conn, 'learning_sessions_v3', {
      user_id: userId, plan_id: planId, session_date: day(offset), started_at: ts(offset, 19), ended_at: ts(offset, 21),
      total_duration_ms: minutes * 60000,
      tasks_snapshot: json(taskSnapshot),
      skill_changes: json(daySkills.map((s, idx) => ({ name: s.name, before: Math.max(s.before, before - idx * 2), after: Math.min(s.after, after + idx) }))),
      match_score_before: before, match_score_after: after, status: 1, create_time: now + offset, update_time: now + offset,
    });
  }
  for (let i = 0; i < 12; i++) {
    const s = skills[(i + 4) % skills.length];
    await insertFlexible(conn, 'learning_tasks_v3', {
      user_id: userId, plan_id: planId, skill_name: s.name, task_type: i % 3 === 0 ? 'side' : 'main', task_status: i < 3 ? 'in_progress' : 'pending',
      estimated_min: 35 + (i % 4) * 15, actual_min: i < 2 ? 10 + i * 6 : null, sort_order: sortOrder++, priority: i < 4 ? 9 : 5,
      plan_date: day(Math.floor(i / 3)), start_time: i < 3 ? ts(0, 10 + i) : null, complete_time: null, is_active: 1,
      status: 1, create_time: now, update_time: now,
    });
  }

  const branchId = await insertFlexible(conn, 'learning_branches_v3', {
    user_id: userId, branch_name: '张三 AI 全栈能力主干', branch_type: 'main', plan_id: planId, base_commit_id: null, head_commit_id: null,
    status: 1, create_time: now, update_time: now,
  });
  let parentCommitId = null;
  const commitTypes = ['baseline', 'lecture_read', 'quiz_passed', 'code_done', 'task_done', 'skill_complete'];
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    const commitId = await insertFlexible(conn, 'learning_commits_v3', {
      user_id: userId, branch_id: branchId, parent_commit_id: parentCommitId, merge_source_commit_id: null,
      commit_type: i === 0 ? 'baseline' : commitTypes[i % commitTypes.length], skill_name: s.name,
      message: `${s.name} 从 ${s.before}% 提升到 ${s.after}%：完成讲义、练习、测评与复盘`,
      payload_json: json({ before: s.before, after: s.after, trust: s.trust, source: s.source, evidence: ['考试', '项目', '学习提交'], generatedBy: 'zhangsan_rich_demo_seed' }),
      delta_json: json({ masteryPct: s.after - s.before, trustWeight: s.trust }), snapshot_id: null,
      status: 1, create_time: now + i, update_time: now + i,
    });
    parentCommitId = commitId;
    const partialSkills = skills.slice(0, i + 1).map((x) => ({ name: x.name, masteryPct: Math.min(x.after, x.before + Math.round((x.after - x.before) * ((i + 1) / skills.length))), trustWeight: x.trust, source: x.source }));
    const avg = Math.round(partialSkills.reduce((sum, x) => sum + x.masteryPct, 0) / partialSkills.length);
    await insertFlexible(conn, 'skill_snapshots_v3', {
      user_id: userId, branch_id: branchId, commit_id: commitId, skills_json: json(partialSkills),
      radar_json: json(partialSkills.map((x) => ({ name: x.name, value: x.masteryPct }))),
      ability_metrics_json: json({ avgMastery: avg, reliableEvidenceCount: i + 5, weakTopicCount: Math.max(1, weakTopics.length - Math.floor(i / 2)), dailyHours: 2.5 }),
      match_summary_json: json({ targetJob: 'AI 全栈应用工程师', matchBefore: 43, matchAfter: Math.min(84, 43 + i * 4), delta: Math.min(41, i * 4) }),
      total_mastery: avg, skill_count: partialSkills.length, depth_score: Math.max(...partialSkills.map((x) => x.masteryPct)), breadth_score: partialSkills.length * 12,
      balance_score: Math.max(55, 100 - (Math.max(...partialSkills.map((x) => x.masteryPct)) - Math.min(...partialSkills.map((x) => x.masteryPct)))),
      status: 1, create_time: now + i, update_time: now + i,
    });
  }
  if (branchId && parentCommitId) await conn.query('UPDATE learning_branches_v3 SET head_commit_id=?, update_time=? WHERE id=?', [parentCommitId, now, branchId]);

  const questionTaskId = await insertFlexible(conn, 'question_generation_tasks', {
    user_id: userId, subject: 'AI 全栈应用工程师严格出题', curriculum: 'CodeNova Demo Curriculum', locale: 'zh-CN', grade: '大三',
    question_types: json(['choice', 'essay', 'coding']), question_count: 18, difficulty: 4,
    difficulty_mix: json({ easy: 0.2, medium: 0.55, hard: 0.25 }),
    topics: json(weakTopics.map((t) => t.label)),
    instructions: '基于张三画像、错题、岗位要求和 Evidence RAG 证据生成，题目必须结构完整、答案唯一、解析可回证据。',
    metadata: json({ generatedBy: 'zhangsan_rich_demo_seed', qualityGate: ['结构完整', '答案唯一', '解析可回证据', '难度贴合'] }),
    reference_library: 1, task_status: 'completed', progress: json({ current: 18, total: 18, failed: 0, message: '演示题库已生成并通过审核' }),
    result_count: 18, started_at: ts(-2, 15), completed_at: ts(-2, 16), status: 1, create_time: now, update_time: now,
  });

  const examQuestionIds = [];
  const snapshotQuestions = [];
  for (let i = 0; i < 18; i++) {
    const s = skills[i % skills.length];
    const qType = i % 6 === 0 ? 'essay' : i % 5 === 0 ? 'coding' : 'choice';
    const content = qType === 'choice'
      ? { stem: `${s.name} 场景题：下面哪一项最适合用于 AI 全栈演示闭环？`, options: ['只展示静态页面', '结合用户画像、证据、任务和结果解释决策', '跳过错误态', '只描述模型很强'], citations: [`证据#${(i % 10) + 1}`], generatedBy: 'zhangsan_rich_demo_seed' }
      : { stem: `请结合张三的 ${s.name} 学习记录，说明如何把该能力用于 AI 全栈应用工程师岗位演示。`, rubric: ['说明业务场景', '引用学习证据', '给出质量指标', '指出下一步补弱'], generatedBy: 'zhangsan_rich_demo_seed' };
    const qId = await insertFlexible(conn, 'exam_questions_v3', {
      generation_task_id: questionTaskId, source_order: i + 1, exam_type: 1, skill_name: s.name, job_id: jobId,
      question_type: qType, title: `${s.name} 严格出题样例 ${i + 1}`, content: json(content),
      answer: json(qType === 'choice' ? { correct: 1, explanation: '演示闭环需要结合画像、证据、任务和结果，而不是只展示静态页面。', citationRequired: true } : { keyPoints: ['业务场景', '证据引用', '质量指标', '补弱建议'], citationRequired: true }),
      difficulty: 2 + (i % 4), confidence_score: 0.82 + (i % 4) * 0.03, pass_rate: 55 + (i % 8) * 5,
      status: 1, created_by: 'agent', reviewed_by: null, reviewed_at: ts(-2, 16), create_time: now + i, update_time: now + i,
    });
    examQuestionIds.push(qId);
    snapshotQuestions.push({ id: qId, type: qType, skillName: s.name, title: `${s.name} 严格出题样例 ${i + 1}`, content, review: { status: 'approved', citationValid: true, answerUnique: true, difficultyFit: true, score: 88 - (i % 5) } });
  }
  await insertFlexible(conn, 'question_generation_snapshots', {
    task_id: questionTaskId, user_id: userId, questions: json(snapshotQuestions),
    config: json({ subject: 'AI 全栈应用工程师严格出题', topics: weakTopics, referenceLibrary: true, generatedBy: 'zhangsan_rich_demo_seed' }),
    review_statuses: json(snapshotQuestions.map(() => 'approved')), version: 1, status: 1, create_time: now, update_time: now,
  });

  for (let i = 0; i < 9; i++) {
    const s = skills[(i * 2) % skills.length];
    const score = [72, 86, 64, 91, 78, 83, 69, 88, 75][i];
    const passed = score >= 70;
    const qids = examQuestionIds.slice(i * 2, i * 2 + 2);
    await insertFlexible(conn, 'exam_records_v3', {
      user_id: userId, exam_type: i % 3 === 0 ? 2 : 1, skill_name: s.name, job_id: jobId, question_ids: json(qids),
      score, passed: passed ? 1 : 0,
      answers: json(Object.fromEntries(qids.map((id, idx) => [String(id), passed || idx === 0 ? 1 : 0]))),
      wrong_analysis: json({ wrong: [{ topic: weakTopics[i % weakTopics.length].label, reason: passed ? '细节表达仍可优化' : '概念边界和证据引用不足', next: `安排 ${weakTopics[i % weakTopics.length].label} 补弱任务` }], weakTopics: [weakTopics[i % weakTopics.length].label], nextAction: '生成补弱讲义与练习题', evidenceBound: true, citationValid: true }),
      retry_count: passed ? 0 : 1, next_retry_time: passed ? null : ts(2, 20), status: 1, create_time: ts(-9 + i, 20), update_time: now,
    });
  }

  for (let i = 0; i < resources.length; i++) {
    const r = resources[i];
    await insertFlexible(conn, 'generated_resources_v3', {
      user_id: userId, resource_type: r[0], title: r[1], skill_name: r[2], source: 'manual', external_id: `zhangsan-rich-demo:resource:${i}`,
      agent_type: r[3], resource_status: 'success',
      payload: json({ summary: r[4], outline: ['学习目标', '关键概念', '演示动作', '检查标准'], evidenceChunkIds: [], generatedBy: 'zhangsan_rich_demo_seed' }),
      preview_meta: json({ display: 'demo', skill: r[2], user: '张三' }), provider: 'seed', cost_tokens: 1200 + i * 180, cost_credits: 0, duration_ms: 900 + i * 100,
      status: 1, create_time: now + i, update_time: now + i,
    });
  }

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    await insertFlexible(conn, 'agent_profiles_v3', {
      user_id: userId, agent_type: a[0], animal_type: a[1], color: a[2], nickname: a[3], display_role: a[4], station_id: a[5],
      agent_status: i >= 5 ? 'busy' : 'idle', status: 1, create_time: now, update_time: now,
    });
  }
  for (let i = 0; i < 28; i++) {
    const a = agents[i % agents.length][0];
    const s = skills[i % skills.length].name;
    const statuses = ['success', 'success', 'success', 'running', 'pending'];
    const taskStatus = statuses[i % statuses.length];
    await insertFlexible(conn, 'agent_tasks_v3', {
      user_id: userId, agent_type: a, title: `${agents[i % agents.length][4]} · ${s} 演示任务 ${i + 1}`,
      description: `围绕 ${s} 生成讲解、练习、审核或补弱建议，用于张三账号路演演示。`,
      params: json({ demoUser: 'zhangsan', targetJob: 'AI 全栈应用工程师', skill: s }),
      task_status: taskStatus, progress: taskStatus === 'success' ? 100 : taskStatus === 'running' ? 65 : 15,
      result: json({ summary: `${s} 相关演示内容已${taskStatus === 'success' ? '完成' : '进入队列'}`, quality: taskStatus === 'success' ? 'passed' : 'pending' }),
      error_message: null, is_urgent: i % 9 === 0 ? 1 : 0, sort_order: i,
      started_at: ts(-Math.floor(i / 4), 9 + (i % 6)), completed_at: taskStatus === 'success' ? ts(-Math.floor(i / 4), 10 + (i % 6)) : null,
      group_id: 'zhangsan-rich-demo', external_id: `zhangsan-rich-demo:agent-task:${i}`, output_type: ['evaluation', 'knowledge', 'resource', 'plan'][i % 4],
      target_entity: json({ skillName: s, planId, jobId }), status: 1, create_time: now + i, update_time: now + i,
    });
  }

  for (let i = 0; i < 4; i++) {
    await insertFlexible(conn, 'remediation_runs', {
      user_id: userId, topics: json(weakTopics.slice(i, i + 3)), task_id: examQuestionIds[i] || null,
      run_status: i === 3 ? 'running' : 'completed', status: 1, create_time: ts(-5 + i, 18), update_time: now,
    });
  }

  const evidenceTexts = [
    ['resume', '张三完整画像', ['画像', '岗位目标', '学习规划'], '张三，广州软件学院软件工程大三学生，目标岗位为 AI 全栈应用工程师。具备 React、TypeScript 和基础后端经验，近期重点补强 RAG、Agent 工作流、MySQL 建模和演示表达。每天可投入 2.5 小时，目标是在 4 周内形成可路演的学习闭环作品。'],
    ['project', 'CodeNova 学习闭环演示台项目记录', ['React', 'NestJS', 'MySQL', 'AI Agent'], '用户完成 CodeNova 学习闭环演示台的主流程联调：登录后展示个人画像、岗位匹配、学习任务、考试记录、错题补弱、生成资源和 Agent 工作台。项目能体现从诊断到行动再到证据沉淀的完整闭环。'],
    ['evaluation', 'RAG 基础测评与引用证据复盘', ['RAG 基础', '证据引用'], '张三在 RAG 基础测评中从 52 分提升到 78 分。主要进步是能解释切片、向量召回、重排和引用展示；仍需补强 TopK 命中率、引用覆盖率和无证据拒答边界。'],
    ['learning_commit', 'React 状态管理学习提交', ['React 状态管理', '前端工程化'], '学习提交显示张三已经能够把异步请求拆成 loading、success、empty、error、retry 五种状态，并在任务页、知识库页、岗位页复用统一的状态组件。'],
    ['agent_output', '岗位匹配智能体输出摘要', ['岗位匹配', 'AI Agent'], '岗位匹配智能体判断张三与 AI 全栈应用工程师岗位匹配度为 82%。优势是前端实现、项目复盘和持续学习记录；短板是 Agent 工具失败恢复、RAG 评估指标和系统设计表达。'],
    ['project', 'RAG 证据图谱工作台记录', ['前端可视化', 'RAG 基础'], '用户用图谱视角展示来源文档、知识切片、技能标签和检索命中，能够在搜索后突出显示证据来源与命中原因，适合演示“为什么推荐这个任务”。'],
    ['evaluation', 'NestJS 与 MySQL 联调测评', ['NestJS 后端开发', 'MySQL 数据建模'], '测评显示张三能完成 Controller、Service、Entity、DTO 的基本组织，并能说明用户、任务、考试、资源之间的关系。需要继续练习索引设计和事务边界。'],
    ['learning_commit', '服务部署与排障复盘', ['服务部署与排障'], '张三定位过 Vite 前端端口变化、Nest 后端环境变量、Redis 与 Neo4j 连接检查问题，形成了本地演示前的启动检查清单。'],
    ['agent_output', '严格出题质量审核结果', ['严格出题质量评估'], '审核智能体确认张三的演示题库满足结构完整、答案唯一、解析可回证据、难度贴合四个要求。少数题目需要补充更明确的引用编号。'],
    ['project', '演示答辩路线设计', ['学习复盘表达'], '张三的答辩路线为：先展示个人画像和岗位目标，再展示任务推荐依据，随后进行一次严格出题和错题补弱，最后打开知识库证据说明系统不是“凭空推荐”。'],
    ['evaluation', '算法与复杂度补弱记录', ['算法与数据结构'], '张三完成数组、哈希表、栈队列和二叉树的基础练习。复杂度分析从 37% 提升到 60%，仍需加强动态规划和图遍历。'],
    ['agent_output', '下一阶段学习计划', ['系统设计入门', 'AI Agent 设计'], '规划智能体建议接下来 7 天围绕“系统设计入门 + Agent 工具失败降级”进行冲刺，每天 2 个主线任务和 1 个复盘任务，并在第 7 天进行综合测评。'],
  ];
  const chunkIds = [];
  for (let i = 0; i < evidenceTexts.length; i++) {
    const e = evidenceTexts[i];
    const content = `${e[3]}\n用户：张三\n目标岗位：AI 全栈应用工程师\n关联技能：${e[2].join('、')}\n演示标签：zhangsan-rich-demo`;
    const chunkId = await insertFlexible(conn, 'evidence_chunks', {
      user_id: userId, source_type: e[0], source_id: `zhangsan-rich-demo:${e[0]}:${i}`, chunk_index: 0,
      title: e[1], content, content_hash: md5(content), skill_tags: json(e[2]), job_target_id: jobId, confidence: 0.76 + (i % 5) * 0.04,
      visibility: 'private', vector_status: 'pending', status: 1, create_time: now + i, update_time: now + i,
    });
    chunkIds.push(chunkId);
    await insertFlexible(conn, 'knowledge_ingestion_tasks', {
      task_id: `zhangsan-rich-demo:knowledge:${i}`, user_id: userId, source_kind: i % 2 === 0 ? 'upload_text' : 'news_manual', ingestion_status: 'ingested',
      title: e[1], source_url: null, source_name: 'CodeNova zhangsan demo evidence', raw_text: e[3], cleaned_text: content,
      summary: `${e[1]} 已经清洗并入库，可用于张三账号演示推荐依据。`, skill_tags: json(e[2]),
      chunk_preview: json([{ title: e[1], content: content.slice(0, 180), chunkType: e[0], tags: e[2] }]),
      curator_result: json({ agent: 'knowledge-curator', status: 'approved', normalizedTitle: e[1], chunkCount: 1 }),
      inspection_result: json({ agent: 'knowledge-inspector', status: 'approved', checks: { relevance: true, sourceTraceable: true, safety: true, duplicate: false, citationReady: true }, score: 88 + (i % 8) }),
      ingested_chunk_ids: json([chunkId]), status: 1, create_time: now + i, update_time: now + i,
    });
  }

  const optionalInserts = [
    'match_history_v3',
    'job_applications_v3',
    'evaluation_attempts_v3',
    'evaluation_evidence_v3',
    'evaluation_results_v3',
    'evaluation_dimension_scores_v3',
    'evaluation_impacts_v3',
    'resume_v3'
  ];
  for (let i = 0; i < 6; i++) {
    await insertFlexible(conn, 'match_history_v3', {
      user_id: userId, job_id: jobId, match_score: 58 + i * 5, gap_score: 42 - i * 4,
      matched_skills: json(skills.slice(0, 5 + i).map((s) => s.name)),
      missing_skills: json(weakTopics.slice(i % weakTopics.length, i % weakTopics.length + 2).map((t) => t.label)),
      evidence_summary: json({ evidenceCount: chunkIds.length, resourceCount: resources.length, trend: 'up' }),
      status: 1, create_time: ts(-10 + i * 2, 12), update_time: now,
    });
    await insertFlexible(conn, 'job_applications_v3', {
      user_id: userId, job_id: jobId, application_status: ['viewed', 'matched', 'prepared', 'applied', 'interviewing', 'offer_ready'][i] || 'prepared',
      match_score: 58 + i * 5, note: `张三演示投递阶段 ${i + 1}`,
      status: 1, create_time: ts(-10 + i * 2, 13), update_time: now,
    });
  }

  console.log(JSON.stringify({ ok: true, userId, studentId, jobId, planId, evidenceChunks: chunkIds.length }, null, 2));
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
