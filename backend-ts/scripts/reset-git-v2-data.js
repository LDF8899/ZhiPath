const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const CONFIRM_FLAG = '--confirm-clear-learning-history';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function config() {
  return {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
    multipleStatements: true,
  };
}

function backupDatabase(cfg) {
  const rootDir = path.resolve(__dirname, '..', '..');
  const backupDir = path.join(rootDir, 'deploy', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backupPath = path.join(backupDir, `backup_before_git_v2_${timestamp}.sql`);
  const args = [
    `--host=${cfg.host}`,
    `--port=${cfg.port}`,
    `--user=${cfg.user}`,
    `--password=${cfg.password}`,
    '--single-transaction',
    '--skip-lock-tables',
    cfg.database,
  ];
  const dump = spawnSync('mysqldump', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 200 });
  if (dump.status !== 0) {
    throw new Error(`backup failed: ${dump.stderr || 'mysqldump not available'}`);
  }
  fs.writeFileSync(backupPath, dump.stdout, 'utf8');
  return backupPath;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [table]);
  return Array.isArray(rows) && rows.length > 0;
}

async function deleteIfExists(conn, table) {
  if (await tableExists(conn, table)) {
    await conn.query(`DELETE FROM \`${table}\``);
  }
}

async function main() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`refusing to clear learning history without ${CONFIRM_FLAG}`);
  }
  const rootDir = path.resolve(__dirname, '..', '..');
  loadEnv(path.join(__dirname, '..', '.env'));
  const cfg = config();
  const backupPath = backupDatabase(cfg);
  const conn = await mysql.createConnection(cfg);
  try {
    const migrationSql = fs.readFileSync(path.join(rootDir, 'deploy', '20260718-git-learning-v2.sql'), 'utf8');
    await conn.query(migrationSql);
    await conn.beginTransaction();
    for (const table of [
      'learning_sessions_v3',
      'learning_session_progress_v3',
      'learning_progress_v3',
      'skill_snapshots',
      'match_history_v3',
      'learning_commits_v3',
      'skill_snapshots_v3',
      'learning_branches_v3',
      'user_skills_v3',
    ]) {
      await deleteIfExists(conn, table);
    }
    const now = Date.now();
    await conn.query(`
      INSERT INTO learning_branches_v3
        (status, create_time, update_time, user_id, branch_name, branch_type, base_commit_id, head_commit_id, source_branch_id, merged_at)
      SELECT 1, ?, ?, id, 'main', 'main', NULL, NULL, NULL, NULL
      FROM users_v3
      WHERE status = 1
    `, [now, now]);
    await conn.query(`
      INSERT INTO learning_commits_v3
        (status, create_time, update_time, user_id, branch_id, parent_commit_id, merge_source_commit_id, commit_type, skill_name, message, payload_json, snapshot_id, delta_json)
      SELECT 1, ?, ?, b.user_id, b.id, NULL, NULL, 'baseline', NULL, 'baseline', JSON_OBJECT('initialized', true), NULL, NULL
      FROM learning_branches_v3 b
      WHERE b.branch_type = 'main' AND b.status = 1
    `, [now, now]);
    await conn.query(`
      INSERT INTO skill_snapshots_v3
        (status, create_time, update_time, user_id, branch_id, commit_id, skills_json, radar_json, ability_metrics_json, match_summary_json, total_mastery, skill_count, depth_score, breadth_score, balance_score)
      SELECT 1, ?, ?, c.user_id, c.branch_id, c.id, JSON_ARRAY(), JSON_ARRAY(), JSON_OBJECT(
        'overallScore', 0, 'frontendScore', 0, 'backendScore', 0, 'toolingScore', 0, 'softSkillScore', 0,
        'depth', 0, 'breadth', 0, 'balance', 0, 'learningSpeed', 0, 'consistency', 0
      ), NULL, 0, 0, 0, 0, 0
      FROM learning_commits_v3 c
      WHERE c.commit_type = 'baseline' AND c.status = 1
    `, [now, now]);
    await conn.query(`
      UPDATE learning_commits_v3 c
      JOIN skill_snapshots_v3 s ON s.commit_id = c.id
      SET c.snapshot_id = s.id,
          c.delta_json = JSON_OBJECT('skillChanges', JSON_ARRAY(), 'metricsChange', JSON_OBJECT('overallScore', 0, 'matchScore', 0, 'depthScore', 0, 'breadthScore', 0), 'radarChanges', JSON_ARRAY())
    `);
    await conn.query(`
      UPDATE learning_branches_v3 b
      JOIN learning_commits_v3 c ON c.branch_id = b.id AND c.commit_type = 'baseline'
      SET b.base_commit_id = c.id, b.head_commit_id = c.id
    `);
    await conn.commit();
    console.log(`git learning v2 data reset complete. backup: ${backupPath}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`git learning v2 reset failed: ${err.message}`);
  process.exit(1);
});
