const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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

async function main() {
  const rootDir = path.resolve(__dirname, '..', '..');
  loadEnv(path.join(__dirname, '..', '.env'));
  const sql = fs.readFileSync(path.join(rootDir, 'deploy', '20260718-git-learning-v2.sql'), 'utf8');
  const config = {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
    multipleStatements: true,
  };
  const conn = await mysql.createConnection(config);
  try {
    await conn.query(sql);
    for (const table of ['learning_branches_v3', 'learning_commits_v3', 'skill_snapshots_v3']) {
      const [rows] = await conn.query(`SHOW TABLES LIKE '${table}'`);
      if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${table} was not found after migration`);
    }
    console.log(`git learning v2 migration complete on ${config.host}:${config.port}/${config.database}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`git learning v2 migration failed: ${err.message}`);
  process.exit(1);
});
