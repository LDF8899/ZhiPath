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

async function hasIndex(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [table, indexName],
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
    if (!(await hasColumn(conn, 'learning_plans_v3', 'plan_status'))) {
      await conn.query(
        "ALTER TABLE learning_plans_v3 ADD COLUMN plan_status enum('active','paused','archived') NOT NULL DEFAULT 'active' AFTER target_job_id",
      );
    }
    if (!(await hasColumn(conn, 'learning_plans_v3', 'schedule_enabled'))) {
      await conn.query(
        'ALTER TABLE learning_plans_v3 ADD COLUMN schedule_enabled tinyint NOT NULL DEFAULT 1 AFTER plan_status',
      );
    }
    if (!(await hasColumn(conn, 'learning_branches_v3', 'plan_id'))) {
      await conn.query('ALTER TABLE learning_branches_v3 ADD COLUMN plan_id bigint NULL AFTER branch_type');
    }
    await conn.query(
      "ALTER TABLE learning_branches_v3 MODIFY COLUMN branch_type enum('main','plan','side','experiment') NOT NULL DEFAULT 'main'",
    );
    if (!(await hasIndex(conn, 'learning_branches_v3', 'idx_learning_branches_user_plan'))) {
      await conn.query('CREATE INDEX idx_learning_branches_user_plan ON learning_branches_v3 (user_id, plan_id)');
    }
    if (!(await hasIndex(conn, 'learning_plans_v3', 'idx_learning_plans_schedule'))) {
      await conn.query('CREATE INDEX idx_learning_plans_schedule ON learning_plans_v3 (user_id, plan_status, schedule_enabled)');
    }

    await conn.query(
      "UPDATE learning_plans_v3 SET plan_type = 'side' WHERE status = 1 AND plan_type = 'main' AND target_job_id IS NULL",
    );
    await conn.query(
      `UPDATE learning_tasks_v3 task
       INNER JOIN learning_plans_v3 plan ON plan.id = task.plan_id
       SET task.task_type = plan.plan_type
       WHERE task.task_type <> plan.plan_type`,
    );

    const [duplicateMainUsers] = await conn.query(
      `SELECT user_id FROM learning_plans_v3
       WHERE status = 1 AND plan_status = 'active' AND plan_type = 'main'
       GROUP BY user_id HAVING COUNT(*) > 1`,
    );
    for (const { user_id: userId } of duplicateMainUsers) {
      const [plans] = await conn.query(
        `SELECT id FROM learning_plans_v3
         WHERE user_id = ? AND status = 1 AND plan_status = 'active' AND plan_type = 'main'
         ORDER BY create_time DESC, id DESC`,
        [userId],
      );
      const archivedIds = plans.slice(1).map((plan) => plan.id);
      if (archivedIds.length) {
        await conn.query(
          "UPDATE learning_plans_v3 SET plan_status = 'archived', schedule_enabled = 0 WHERE id IN (?)",
          [archivedIds],
        );
      }
    }

    console.log(`learning portfolio migration complete on ${config.host}:${config.port}/${config.database}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`learning portfolio migration failed: ${error.message}`);
  process.exit(1);
});
