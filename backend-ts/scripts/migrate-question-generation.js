/**
 * 用法：node scripts/migrate-question-generation.js
 *
 * 补齐严格出题管线所需表结构：
 * - question_generation_tasks
 * - question_generation_snapshots
 * - exam_questions_v3 的生成来源追踪字段
 */
const mysql = require('mysql2/promise');

const cfg = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root123',
  database: process.env.MYSQL_DATABASE || 'zhipath',
};

async function hasColumn(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [cfg.database, table, column],
  );
  return Number(rows[0]?.n || 0) > 0;
}

async function addColumn(conn, table, column, ddl) {
  if (await hasColumn(conn, table, column)) {
    console.log(`[migrate-question-generation] ${table}.${column} exists, skip`);
    return;
  }
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  console.log(`[migrate-question-generation] added ${table}.${column}`);
}

async function main() {
  const conn = await mysql.createConnection(cfg);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS question_generation_tasks (
      status tinyint NOT NULL DEFAULT 1 COMMENT '1=正常 0=删除',
      id bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
      create_time bigint NULL COMMENT '创建时间戳ms',
      update_time bigint NULL COMMENT '更新时间戳ms',
      user_id bigint NOT NULL,
      subject varchar(120) NOT NULL DEFAULT '',
      curriculum varchar(120) NOT NULL DEFAULT '',
      locale varchar(20) NOT NULL DEFAULT 'zh-CN',
      grade varchar(80) NOT NULL DEFAULT '',
      question_types json NOT NULL,
      question_count tinyint NOT NULL,
      difficulty tinyint NOT NULL DEFAULT 5,
      difficulty_mix json NULL,
      topics json NULL,
      instructions text NULL,
      metadata json NULL,
      reference_library tinyint NOT NULL DEFAULT 0,
      task_status enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
      progress json NULL,
      result_count int NOT NULL DEFAULT 0,
      error_message text NULL,
      started_at bigint NULL,
      completed_at bigint NULL,
      PRIMARY KEY (id),
      KEY idx_question_generation_user_status (user_id, task_status),
      KEY idx_question_generation_user_time (user_id, create_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[migrate-question-generation] question_generation_tasks ready');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS question_generation_snapshots (
      status tinyint NOT NULL DEFAULT 1 COMMENT '1=正常 0=删除',
      id bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
      create_time bigint NULL COMMENT '创建时间戳ms',
      update_time bigint NULL COMMENT '更新时间戳ms',
      task_id bigint NOT NULL,
      user_id bigint NOT NULL,
      questions json NOT NULL,
      config json NULL,
      review_statuses json NULL,
      version int NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY uq_question_generation_snapshot_task (task_id),
      KEY idx_question_generation_snapshot_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[migrate-question-generation] question_generation_snapshots ready');

  await addColumn(conn, 'exam_questions_v3', 'generation_task_id', 'generation_task_id bigint NULL AFTER id');
  await addColumn(conn, 'exam_questions_v3', 'source_order', 'source_order int NULL AFTER generation_task_id');
  await addColumn(conn, 'exam_questions_v3', 'reviewed_at', 'reviewed_at bigint NULL AFTER reviewed_by');

  await conn.end();
}

main().catch((error) => {
  console.error('[migrate-question-generation] failed:', error.message);
  process.exit(1);
});
