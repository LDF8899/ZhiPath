import { EvidenceRagService } from './evidence-rag.service';

/**
 * LLM 回答质量评测（方案 §9.3 / 评审建议：answer-quality）
 *
 * 指标：Citation Coverage / Citation Precision / No Fabrication / Evidence Faithfulness
 * 合格线：Coverage >= 90%，Faithfulness >= 90%，No Fabrication >= 98%
 *
 * 评测对象是「引用校验护栏」逻辑（parseCitations / validateCitations / requiresCitation）
 * 与模拟 LLM 输出，不依赖真实 LLM 调用。
 */

/** 模拟检索结果（与真实 search 返回同构） */
function makeItems(): Array<{
  chunkId: number;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  skillTags: string[];
  score: number;
  confidence: number;
  createdAt: number;
  vectorStatus: string;
}> {
  return [
    {
      chunkId: 1,
      sourceType: 'project',
      sourceId: 'project:就业分析看板',
      title: '项目证据：校园就业数据分析看板',
      snippet: '我使用 React、TypeScript 和 ECharts 完成校园就业数据分析看板，负责筛选器、图表联动和 CSV 导出。',
      skillTags: ['React', 'TypeScript'],
      score: 0.9,
      confidence: 0.85,
      createdAt: Date.now(),
      vectorStatus: 'indexed',
    },
    {
      chunkId: 2,
      sourceType: 'file_qa',
      sourceId: 'file_qa:React Hooks 笔记',
      title: '文件证据：React Hooks 学习笔记',
      snippet: 'useState 管理组件状态，useEffect 处理副作用，自定义 Hook 复用逻辑。',
      skillTags: ['React', 'Hooks'],
      score: 0.85,
      confidence: 0.7,
      createdAt: Date.now(),
      vectorStatus: 'indexed',
    },
    {
      chunkId: 3,
      sourceType: 'evaluation',
      sourceId: 'evaluation:接口联调',
      title: '测评证据：接口联调',
      snippet: '接口联调测评结果：RESTful API 设计 8/10，整体通过。',
      skillTags: ['接口联调'],
      score: 0.6,
      confidence: 0.95,
      createdAt: Date.now(),
      vectorStatus: 'indexed',
    },
  ];
}

function setup() {
  const chunkRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (v: any) => v),
  };
  const chroma = { enabled: false, upsert: jest.fn(), query: jest.fn(), deleteBySource: jest.fn() };
  const config = { get: jest.fn((k: string, d?: any) => (k === 'EMBEDDING_PROVIDER' ? 'off' : d)) };
  const service = new EvidenceRagService(chunkRepo as any, chroma as any, config as any);
  return { service };
}

describe('Evidence answer quality (方案 §9.3)', () => {
  const items = makeItems();

  it('parseCitations 解析 [证据#ID] 与多引用格式', () => {
    const { service } = setup();
    expect(service.parseCitations('我做了看板 [证据#1]，用到了 Hooks [证据#2]')).toEqual([1, 2]);
    expect(service.parseCitations('引用了 [证据#1, #2] 和 [#3]')).toEqual([1, 2, 3]);
    expect(service.parseCitations('没有引用的回答')).toEqual([]);
    expect(service.parseCitations('重复 [证据#1] 再 [证据#1]')).toEqual([1]);
  });

  it('validateCitations：有效/无效引用、覆盖率与精度', () => {
    const { service } = setup();
    // 引用 2 条有效 + 1 条无效
    const result = service.validateCitations('看板 [证据#1] 和笔记 [证据#2]，假引用 [证据#999]', items);
    expect(result.citedIds).toEqual([1, 2, 999]);
    expect(result.validIds).toEqual([1, 2]);
    expect(result.invalidIds).toEqual([999]);
    expect(result.coverage).toBe(0.67); // 2/3 四舍五入到 2 位
    expect(result.precision).toBeCloseTo(2 / 3, 5);
    // 无引用
    const empty = service.validateCitations('我觉得 React 不错', items);
    expect(empty.citedIds).toEqual([]);
    expect(empty.precision).toBe(1);
  });

  it('requiresCitation 识别涉及个人经历的表达', () => {
    const { service } = setup();
    expect(service.requiresCitation('你的 React 项目经验很适合')).toBe(true);
    expect(service.requiresCitation('我做过接口联调的测评')).toBe(true);
    expect(service.requiresCitation('React 是一种前端框架')).toBe(false);
  });

  it('好回答：覆盖率 100%、无假引用（模拟 LLM 输出）', () => {
    const { service } = setup();
    const goodReply = '你有一个 React 数据分析看板项目 [证据#1]，负责筛选器和图表联动；还学过 Hooks [证据#2]，并完成接口联调测评 [证据#3]。';
    const result = service.validateCitations(goodReply, items);
    expect(result.invalidIds).toEqual([]);
    expect(result.coverage).toBe(1);
    expect(result.precision).toBe(1);
  });

  it('坏回答：涉及个人内容但零引用 → 护栏判定需重试', () => {
    const { service } = setup();
    const badReply = '你的 React 项目经验很丰富，我建议重点写进简历。';
    expect(service.requiresCitation(badReply)).toBe(true);
    const result = service.validateCitations(badReply, items);
    expect(result.citedIds).toEqual([]);
    expect(result.coverage).toBe(0);
    // 护栏触发条件：需引用且零引用
    expect(result.citedIds.length === 0 && service.requiresCitation(badReply)).toBe(true);
  });

  it('假引用回答：引用不存在的证据 → 护栏判定需重试', () => {
    const { service } = setup();
    const fabricatedReply = '你的项目拿了 95 分 [证据#888]，非常优秀。';
    const result = service.validateCitations(fabricatedReply, items);
    expect(result.invalidIds).toEqual([888]);
    expect(result.validIds).toEqual([]);
    expect(result.precision).toBe(0);
  });

  it('No Fabrication：回答提到的证据标题/分数必须能在检索集合中找到', () => {
    const { service } = setup();
    const availableText = items.map((i) => (i.title + i.snippet).toLowerCase());

    const faithful = '我完成了校园就业数据分析看板 [证据#1]，用了 React 和 ECharts。';
    const fabricated = '我开发了一个 AI 自动驾驶项目 [证据#1]，准确率 99%。';

    // Faithfulness：回答中的证据相关内容与 snippet 有足够重叠
    const checkFaithfulness = (reply: string): boolean => {
      const cited = service.parseCitations(reply);
      if (cited.length === 0) return false;
      return cited.every((id) => {
        const item = items.find((i) => i.chunkId === id);
        if (!item) return false;
        const text = (item.title + item.snippet).toLowerCase();
        // 句子中与证据文本重叠的关键词（>= 2 个）
        const tokens = reply
          .toLowerCase()
          .replace(/[证据#\d\[\]，。、！？]/g, ' ')
          .split(/\s+/)
          .filter((t) => t.length >= 2 && t !== '我' && t !== '了' && t !== '的' && t !== '一个' && t !== '开发' && t !== '项目');
        const overlap = tokens.filter((t) => availableText.some((a) => a.includes(t)) || text.includes(t)).length;
        return overlap >= 2;
      });
    };

    expect(checkFaithfulness(faithful)).toBe(true);
    expect(checkFaithfulness(fabricated)).toBe(false);
  });
});
