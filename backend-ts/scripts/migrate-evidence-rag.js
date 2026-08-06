/**
 * 迁移：新建 evidence_chunks 表（Evidence RAG P0 证据索引）
 *
 * 用法：node scripts/migrate-evidence-rag.js
 * 幂等：表已存在时跳过。
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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS evidence_chunks (
        id bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
        user_id bigint NOT NULL COMMENT '关联用户',
        source_type varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '证据来源：project/file_qa/evaluation/learning_commit/agent_output/resume',
        source_id varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '来源唯一ID，如 project:45 / file_qa:1:1720000000',
        chunk_index int NOT NULL DEFAULT 0 COMMENT '第几个分块',
        title varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '证据标题',
        content text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原文片段',
        content_hash varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容哈希，用于去重',
        skill_tags json NULL COMMENT '技能标签',
        job_target_id bigint NULL DEFAULT NULL COMMENT '关联目标岗位',
        confidence decimal(4,2) NOT NULL DEFAULT 0.70 COMMENT '证据可信度',
        visibility varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'private' COMMENT 'private=仅本人 school_aggregate=可聚合',
        vector_status varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending/indexed/failed',
        status tinyint NOT NULL DEFAULT 1 COMMENT '1=正常 0=删除',
        create_time bigint NULL DEFAULT NULL COMMENT '创建时间戳ms',
        update_time bigint NULL DEFAULT NULL COMMENT '更新时间戳ms',
        PRIMARY KEY (id) USING BTREE,
        INDEX idx_user_source (user_id, source_type, source_id) USING BTREE,
        INDEX idx_user_skill (user_id, skill_tags) USING BTREE,
        INDEX idx_status (status) USING BTREE
      ) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '个人证据索引（Evidence RAG）' ROW_FORMAT = Dynamic
    `);
    console.log('[migrate-evidence-rag] evidence_chunks table ready');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate-evidence-rag] failed:', e.message);
  process.exit(1);
});
