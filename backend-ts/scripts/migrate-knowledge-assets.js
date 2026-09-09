/* eslint-disable no-console */
const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');
require('dotenv').config();

/** Backfill the MySQL knowledge catalog from Mongo's legacy body store. */
async function main() {
  const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017');
  const mysqlPool = await mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'zhipath',
    connectionLimit: 2,
  });
  await mongoClient.connect();
  try {
    const db = mongoClient.db(process.env.MONGODB_DATABASE || 'zhipath');
    const docs = db.collection('knowledge_base').find({});
    let migrated = 0;
    for await (const doc of docs) {
      const tenantId = Number(doc.tenantId || process.env.MONGO_DEFAULT_TENANT_ID || 1);
      const skill = String(doc.skill || '').trim();
      const contentType = String(doc.content_type || 'unknown').trim();
      if (!skill || !contentType) continue;
      const content = doc.content || {};
      const hash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
      const updatedAt = new Date(Number(doc.updated_at || Date.now()));
      const createdAt = new Date(Number(doc.created_at || doc.updated_at || Date.now()));
      await mysqlPool.execute(
        `INSERT INTO knowledge_assets
          (public_id, tenant_id, skill_key, content_type, title, source_ref,
           content_hash, schema_version, lifecycle_status, metadata_json,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title), source_ref = VALUES(source_ref),
           content_hash = VALUES(content_hash), schema_version = VALUES(schema_version),
           lifecycle_status = 'published', metadata_json = VALUES(metadata_json),
           updated_at = VALUES(updated_at)`,
        [
          crypto.randomUUID(),
          tenantId,
          skill,
          contentType,
          typeof content.title === 'string' ? content.title.slice(0, 500) : skill,
          `mongo:${String(doc._id)}`,
          hash,
          Number(doc.schemaVersion || 1),
          JSON.stringify({ difficulty: doc.metadata?.difficulty || 'beginner', clientApp: doc.clientApp || 'legacy' }),
          createdAt,
          updatedAt,
        ],
      );
      migrated += 1;
    }
    console.log(`Knowledge asset catalog backfill complete: ${migrated} records`);
  } finally {
    await mongoClient.close();
    await mysqlPool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
