import { EvidenceRagService } from './evidence-rag.service';
import { ChromaService } from './chroma.service';

describe('EvidenceRagService', () => {
  function setup(overrides: { chunks?: any[]; chromaEnabled?: boolean; embeddingProvider?: string } = {}) {
    let nextId = 1000;
    const chunks: any[] = [...(overrides.chunks || [])];
    const chunkRepo = {
      findOne: jest.fn(async (opts: any) => {
        const where = opts.where;
        return (
          chunks.find(
            (c) =>
              c.userId === where.userId &&
              c.sourceType === where.sourceType &&
              c.sourceId === where.sourceId &&
              c.contentHash === where.contentHash &&
              c.status === 1,
          ) || null
        );
      }),
      find: jest.fn(async (opts: any) => {
        const where = opts.where || {};
        return chunks.filter(
          (c) =>
            (!where.userId || c.userId === where.userId) &&
            (!where.status || c.status === where.status) &&
            (!where.sourceType || c.sourceType === where.sourceType),
        );
      }),
      save: jest.fn(async (value: any) => {
        if (!value.id) value.id = nextId++;
        const idx = chunks.findIndex((c) => c.id === value.id);
        if (idx >= 0) chunks[idx] = { ...chunks[idx], ...value };
        else chunks.push({ ...value });
        return value;
      }),
    };
    const chroma = {
      enabled: overrides.chromaEnabled ?? false,
      upsert: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue([]),
      deleteBySource: jest.fn().mockResolvedValue(true),
    };
    const config = {
      get: jest.fn((key: string, def?: any) => {
        const map: Record<string, any> = {
          EMBEDDING_PROVIDER: overrides.embeddingProvider ?? 'off',
          EMBEDDING_BASE_URL: overrides.embeddingProvider ? 'http://embedding.test/v1' : '',
          EMBEDDING_MODEL: 'nomic-embed-text',
        };
        return map[key] !== undefined ? map[key] : def;
      }),
    };

    const service = new EvidenceRagService(chunkRepo as any, chroma as any, config as any);
    return { service, chunkRepo, chroma, getChunks: () => chunks };
  }

  it('ingest 切分并保存 chunk，重复保存同内容只更新时间', async () => {
    const { service, getChunks } = setup();

    const saved1 = await service.ingest(1, {
      sourceType: 'project',
      sourceId: 'project:看板',
      title: '项目证据：就业看板',
      content: '使用 React 和 TypeScript 完成就业数据分析看板，包含筛选器和图表联动。',
      skillTags: ['React', 'TypeScript'],
    });
    expect(saved1).toHaveLength(1);
    expect(getChunks()).toHaveLength(1);
    expect(saved1[0].vectorStatus).toBe('failed'); // embedding off → failed（不阻塞）

    // 重复保存：同 sourceId + 同 hash → 不新增
    const saved2 = await service.ingest(1, {
      sourceType: 'project',
      sourceId: 'project:看板',
      title: '项目证据：就业看板',
      content: '使用 React 和 TypeScript 完成就业数据分析看板，包含筛选器和图表联动。',
      skillTags: ['React', 'TypeScript'],
    });
    expect(saved2).toHaveLength(1);
    expect(getChunks()).toHaveLength(1);
  });

  it('长内容按 800-1200 字切分（重叠 100 字）', () => {
    const { service } = setup();
    const long = '学习'.repeat(2500); // 5000 字
    const chunks = service.splitChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBe(1000);
    // 重叠：第二块包含第一块尾部
    expect(chunks[1].startsWith(long.slice(900, 1000))).toBe(true);
  });

  it('关键词降级检索：同用户可召回，跨用户隔离', async () => {
    const { service } = setup({
      chunks: [
        { id: 1, userId: 1, sourceType: 'project', sourceId: 'project:看板', title: '项目证据：就业看板', content: '使用 React 和 TypeScript 完成就业数据分析看板，负责筛选器、图表联动和 CSV 导出。', contentHash: 'a', skillTags: ['React', 'TypeScript'], confidence: 0.85, visibility: 'private', vectorStatus: 'failed', status: 1, createTime: Date.now() },
        { id: 2, userId: 2, sourceType: 'project', sourceId: 'project:爬虫', title: '项目证据：爬虫', content: '使用 Python 爬虫抓取招聘数据。', contentHash: 'b', skillTags: ['Python'], confidence: 0.85, visibility: 'private', vectorStatus: 'failed', status: 1, createTime: Date.now() },
      ],
    });

    const items = await service.search(1, 'React 项目');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].chunkId).toBe(1);
    // 不包含用户 2 的证据
    expect(items.some((i) => i.chunkId === 2)).toBe(false);

    // skill 过滤
    const filtered = await service.search(1, '', { skill: 'React' });
    expect(filtered[0].chunkId).toBe(1);
  });

  it('无证据时返回空结果', async () => {
    const { service } = setup();
    const items = await service.search(9, 'React');
    expect(items).toEqual([]);
  });

  it('向量召回可用时按综合分数排序（向量 50% + 技能 20% + 岗位 15% + 可信度 10% + 新鲜度 5%）', async () => {
    const { service, chroma } = setup({
      chromaEnabled: true,
      embeddingProvider: 'ollama',
      chunks: [
        { id: 11, userId: 1, sourceType: 'project', sourceId: 'project:看板', title: '项目证据：就业看板', content: '使用 React 和 TypeScript 完成就业数据分析看板。', contentHash: 'c1', skillTags: ['React'], confidence: 0.85, visibility: 'private', vectorStatus: 'indexed', status: 1, createTime: Date.now() },
        { id: 12, userId: 1, sourceType: 'resume', sourceId: 'resume:1', title: '简历证据', content: '个人简历内容。', contentHash: 'c2', skillTags: [], confidence: 0.6, visibility: 'private', vectorStatus: 'indexed', status: 1, createTime: Date.now() },
      ],
    });
    // mock embedding + chroma query
    chroma.query.mockResolvedValue([
      { id: '11', score: 0.9, metadata: { sourceType: 'project' } },
      { id: '12', score: 0.5, metadata: { sourceType: 'resume' } },
    ]);
    (service as any).embeddingClient = {
      embeddings: { create: jest.fn().mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] }) },
    };

    const items = await service.search(1, 'React 项目', { jobTargetId: 5 });
    expect(items.length).toBe(2);
    // 项目证据（高向量分 + 技能命中 + 高可信度）排第一
    expect(items[0].chunkId).toBe(11);
    expect(items[0].score).toBeGreaterThan(items[1].score);
  });

  it('buildContext 生成可放入 prompt 的短上下文', () => {
    const { service } = setup();
    const context = service.buildContext([
      {
        chunkId: 1,
        sourceType: 'project',
        sourceId: 'project:看板',
        title: '项目证据：就业看板',
        snippet: '使用 React 完成…',
        skillTags: ['React'],
        score: 0.8,
        confidence: 0.85,
        createdAt: Date.now(),
        vectorStatus: 'indexed',
      },
    ]);
    expect(context).toContain('[证据#1');
    expect(context).toContain('项目证据：就业看板');
    expect(context).toContain('使用 React 完成…');
  });
});
