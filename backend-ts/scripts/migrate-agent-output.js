/**
 * 迁移：agent_tasks_v3 增加 output_type / target_entity 列（P1-3 智能体产出闭环）
 *
 * 用法：node scripts/migrate-agent-output.js
 * 幂等：已存在列时跳过。
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv(filePath) {
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

async function hasColumn(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const config = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
  };
  const conn = await mysql.createConnection(config);
  try {
    if (!(await hasColumn(conn, 'agent_tasks_v3', 'output_type'))) {
      await conn.query(
        "ALTER TABLE agent_tasks_v3 ADD COLUMN output_type varchar(40) NULL COMMENT '产物类型：knowledge/project/plan/evaluation/resume' AFTER external_id",
      );
      console.log('[migrate-agent-output] added output_type');
    } else {
      console.log('[migrate-agent-output] output_type exists, skip');
    }

    if (!(await hasColumn(conn, 'agent_tasks_v3', 'target_entity'))) {
      await conn.query(
        "ALTER TABLE agent_tasks_v3 ADD COLUMN target_entity json NULL COMMENT '产物目标实体：如 {skillName, planId, resumeId}' AFTER output_type",
      );
      console.log('[migrate-agent-output] added target_entity');
    } else {
      console.log('[migrate-agent-output] target_entity exists, skip');
    }

    // 存量任务回填 output_type（按 agent_type 推断）
    const [affected] = await conn.query(
      `UPDATE agent_tasks_v3
       SET output_type = CASE agent_type
         WHEN 'lecture' THEN 'knowledge'
         WHEN 'reading' THEN 'knowledge'
         WHEN 'code' THEN 'project'
         WHEN 'path' THEN 'plan'
         WHEN 'assess' THEN 'evaluation'
         ELSE output_type
       END
       WHERE output_type IS NULL OR output_type = ''`,
    );
    console.log(`[migrate-agent-output] backfilled ${affected.affectedRows} rows`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate-agent-output] failed:', e.message);
  process.exit(1);
});
