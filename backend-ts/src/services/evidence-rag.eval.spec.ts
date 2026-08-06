import { EvidenceRagService } from './evidence-rag.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Evidence RAG 检索评测（方案 §9.2）
 *
 * 运行：npx jest src/services/evidence-rag.eval.spec.ts
 * 指标：Recall@5 >= 85%，No-Evidence Accuracy >= 95%，User Isolation 100%
 *
 * 说明：无 embedding/Chroma 时走关键词降级路径评测（离线可跑）。
 */
describe('EvidenceRAG retrieval eval (方案 §9)', () => {
  const cases = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', '..', 'test-fixtures', 'evidence-rag', 'eval-cases.json'), 'utf8'),
  );

  /** 内存版 service：seed 证据直接作为 chunk，复用 search 打分逻辑 */
  function buildService(userId: number, seedEvidence: any[]) {
    const chunks: any[] = [];
    let nextId = 1;
    for (const seed of seedEvidence || []) {
      chunks.push({
        id: nextId++,
        userId,
        sourceType: seed.sourceType,
        sourceId: seed.sourceId,
        title: seed.title,
        content: seed.content,
        contentHash: String(chunks.length),
        skillTags: seed.skillTags || [],
        confidence: 0.85,
        visibility: 'private',
        vectorStatus: 'failed',
        status: 1,
        createTime: Date.now() - nextId * 1000,
      });
    }
    const chunkRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn(async (opts: any) => {
        const where = opts?.where || {};
        return chunks.filter((c) => !where.userId || c.userId === where.userId);
      }),
      save: jest.fn(async (v: any) => v),
    };
    const chroma = { enabled: false, upsert: jest.fn(), query: jest.fn(), deleteBySource: jest.fn() };
    const config = { get: jest.fn((k: string, d?: any) => (k === 'EMBEDDING_PROVIDER' ? 'off' : d)) };
    const service = new EvidenceRagService(chunkRepo as any, chroma as any, config as any);
    return service;
  }

  it('Recall@5 / Source Accuracy / User Isolation / No-Evidence 达标', async () => {
    let recallHits = 0;
    let recallTotal = 0;
    let sourceHits = 0;
    let noEvidenceCorrect = 0;
    let noEvidenceTotal = 0;

    for (const c of cases) {
      const service = buildService(c.userId, c.seedEvidence);

      // 其他用户的证据不应被召回（User Isolation）
      const otherService = buildService(c.userId + 1000, [
        { sourceType: 'project', title: '他人项目', content: 'Python 爬虫抓取招聘数据', skillTags: ['Python'] },
      ]);
      const foreign = await otherService.search(c.userId, '爬虫 项目');
      expect(foreign).toEqual([]);

      for (const q of c.queries) {
        const items = await service.search(c.userId, q.query, { limit: 5 });

        if (q.expectedSourceTypes.length === 0) {
          // No-Evidence Accuracy
          noEvidenceTotal++;
          if (items.length === 0) noEvidenceCorrect++;
          continue;
        }

        // Recall@5：期望证据是否出现在前 5
        const expectedHit = items.some((item) =>
          q.expectedKeywords.every((kw: string) =>
            (item.title + item.snippet).toLowerCase().includes(kw.toLowerCase()),
          ),
        );
        recallTotal++;
        if (expectedHit) recallHits++;

        // Source Accuracy：首条来源类型正确
        const topSourceType = items[0]?.sourceType;
        if (q.expectedSourceTypes.includes(topSourceType)) sourceHits++;

        // mustNotContain：不返回无关证据
        for (const forbidden of q.mustNotContain || []) {
          const bad = items.some((item) =>
            (item.title + item.snippet).toLowerCase().includes(forbidden.toLowerCase()),
          );
          expect(bad).toBe(false);
        }
      }
    }

    const recall = recallTotal > 0 ? recallHits / recallTotal : 1;
    const sourceAccuracy = sourceHits / recallTotal;
    const noEvidenceAccuracy = noEvidenceTotal > 0 ? noEvidenceCorrect / noEvidenceTotal : 1;

    console.log(`[Eval] Recall@5=${(recall * 100).toFixed(1)}% (${recallHits}/${recallTotal})`);
    console.log(`[Eval] SourceAccuracy=${(sourceAccuracy * 100).toFixed(1)}% (${sourceHits}/${recallTotal})`);
    console.log(`[Eval] NoEvidenceAccuracy=${(noEvidenceAccuracy * 100).toFixed(1)}% (${noEvidenceCorrect}/${noEvidenceTotal})`);

    // P0 合格线：Recall@5 >= 85%，No-Evidence >= 95%
    expect(recall).toBeGreaterThanOrEqual(0.85);
    expect(noEvidenceAccuracy).toBeGreaterThanOrEqual(0.95);
  });
});
