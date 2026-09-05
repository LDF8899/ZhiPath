/**
 * Chroma / Evidence RAG 健康检查
 *
 * 用法：
 *   npm run check:chroma
 *   TARGET_USER_ID=49 npm run check:chroma
 */
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(filePath: string) {
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

async function requestJson(url: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body };
}

async function main() {
  loadEnv(path.join(__dirname, '..', '.env'));
  const baseUrl = (process.env.CHROMA_URL || '').replace(/\/+$/, '');
  const collectionName = process.env.CHROMA_COLLECTION || 'zhipath_user_evidence';
  const targetUserId = process.env.TARGET_USER_ID || '49';

  if (!baseUrl) {
    throw new Error('CHROMA_URL is empty. Chroma is disabled.');
  }

  const heartbeat = await requestJson(`${baseUrl}/api/v1/heartbeat`);
  if (heartbeat.status !== 200) {
    throw new Error(`Chroma heartbeat failed: ${heartbeat.status} ${JSON.stringify(heartbeat.body).slice(0, 300)}`);
  }

  const collectionsResp = await requestJson(`${baseUrl}/api/v1/collections`);
  if (collectionsResp.status !== 200 || !Array.isArray(collectionsResp.body)) {
    throw new Error(`Chroma collections failed: ${collectionsResp.status} ${JSON.stringify(collectionsResp.body).slice(0, 300)}`);
  }
  const collection = collectionsResp.body.find((item: any) => item.name === collectionName);
  if (!collection?.id) {
    throw new Error(`Collection ${collectionName} not found.`);
  }

  const countResp = await requestJson(`${baseUrl}/api/v1/collections/${collection.id}/count`);
  const userDataResp = await requestJson(`${baseUrl}/api/v1/collections/${collection.id}/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ where: { userId: String(targetUserId) }, limit: 5, include: ['metadatas'] }),
  });

  if (userDataResp.status !== 200) {
    throw new Error(`Chroma get user data failed: ${userDataResp.status} ${JSON.stringify(userDataResp.body).slice(0, 300)}`);
  }

  const titles = (userDataResp.body.metadatas || []).map((item: any) => item.title).filter(Boolean);
  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    heartbeat: heartbeat.body,
    collection: { id: collection.id, name: collection.name },
    collectionCount: countResp.body,
    targetUserId,
    sampleTitles: titles,
  }, null, 2));
}

main().catch((error) => {
  console.error('[CheckChroma] Failed:', error.message || error);
  process.exit(1);
});
