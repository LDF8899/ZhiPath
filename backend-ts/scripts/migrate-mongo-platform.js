/* eslint-disable no-console */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const url = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const database = process.env.MONGODB_DATABASE || 'zhipath';
const tenantId = Number(process.env.MONGO_DEFAULT_TENANT_ID || 1);

async function main() {
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(database);
  const common = { $set: { schemaVersion: 1, tenantId, clientApp: 'legacy' } };
  for (const name of ['user_profiles', 'knowledge_base', 'chat_sessions', 'learning_sessions']) {
    const collection = db.collection(name);
    await collection.updateMany(
      { $or: [{ schemaVersion: { $exists: false } }, { tenantId: { $exists: false } }] },
      common,
    );
  }
  await db.collection('user_profiles').createIndex({ tenantId: 1, user_id: 1 }, { unique: true, name: 'uq_user_profiles_tenant_user' });
  await db.collection('user_profiles').createIndex({ tenantId: 1, updated_at: -1 }, { name: 'idx_user_profiles_tenant_updated' });
  await db.collection('knowledge_base').createIndex({ tenantId: 1, skill: 1, content_type: 1 }, { unique: true, name: 'uq_knowledge_tenant_skill_type' });
  await db.collection('knowledge_base').createIndex({ tenantId: 1, updated_at: -1 }, { name: 'idx_knowledge_tenant_updated' });
  await db.collection('chat_sessions').createIndex({ tenantId: 1, user_id: 1, session_id: 1 }, { unique: true, name: 'uq_chat_tenant_user_session' });
  await db.collection('chat_sessions').createIndex({ tenantId: 1, user_id: 1, updated_at: -1 }, { name: 'idx_chat_tenant_user_updated' });
  await db.collection('learning_sessions').createIndex({ tenantId: 1, user_id: 1, date: 1 }, { unique: true, name: 'uq_learning_session_tenant_user_date' });
  await db.collection('learning_sessions').createIndex({ tenantId: 1, user_id: 1, expire_at: 1 }, { name: 'idx_learning_session_tenant_expire' });
  console.log(`Mongo platform migration complete: ${database}, tenant=${tenantId}`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
