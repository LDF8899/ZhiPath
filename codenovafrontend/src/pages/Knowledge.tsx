import { useState } from 'react';
import { Database, FileSearch, Library, RefreshCw, Search } from 'lucide-react';
import { evidenceApi } from '../lib/api';
import { useAsync } from '../components/ui';
import { toast } from '../store/toast';
import {
  Bar,
  Banner,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  Input,
  LoadingBlock,
  Metric,
  Tag,
} from '../components/ui';

/**
 * 知识库页 —— 让"领域知识库约束生成"变得可见。
 *
 * 这里展示两类证据源：领域知识库切片 + 学习者个人学习证据。
 * 所有生成类 Agent（讲义/出题/教练）都必须绑定这里的检索证据，无证据则拒答。
 */

const SOURCE_TYPE_LABEL: Record<string, string> = {
  domain_doc: '领域文档',
  project: '项目实践',
  exam: '考试记录',
  lecture: '讲义',
  github: '代码仓库',
  manual: '手动录入',
};

export default function Knowledge() {
  const summary = useAsync(() => evidenceApi.summary(), []);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<any> | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const data = await evidenceApi.search(q);
      const list = Array.isArray(data) ? data : data?.results || data?.list || [];
      setResults(list);
      setSearchedQuery(q);
    } catch (err: any) {
      toast.error('检索失败', err?.message || '');
    } finally {
      setSearching(false);
    }
  };

  const summaryData = summary.data;
  const byStatus = summaryData?.byStatus || {};
  const bySource = summaryData?.bySource || [];

  return (
    <div className="col" style={{ gap: 18 }}>
      <header>
        <h2 style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={18} style={{ color: 'var(--brand-600)' }} />
          知识库
        </h2>
        <p className="small muted" style={{ marginTop: 4 }}>
          领域知识库切片与个人学习证据都在这里。讲义、出题、教练回答都受它约束：能引用就给出出处，不能引用就明说，从源头压制幻觉。
        </p>
      </header>

      <Card>
        <CardHead icon={<Search size={15} />} title="检索证据" extra={<span className="tiny faint">向量召回 + 关键词兜底</span>} />
        <CardBody>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Input
              placeholder="试试：RAG 引用校验 / NestJS 模块 / React 状态管理"
              value={query}
              onChange={(event: any) => setQuery(event.target.value)}
              onKeyDown={(event: any) => event.key === 'Enter' && runSearch()}
              style={{ flex: 1, minWidth: 220 }}
            />
            <Button variant="primary" onClick={runSearch} disabled={searching || !query.trim()}>
              <FileSearch size={15} />
              {searching ? '检索中…' : '检索'}
            </Button>
          </div>

          {searching && <LoadingBlock text="正在检索知识库" sub="向量召回失败时会自动降级为关键词匹配" />}

          {!searching && results === null && (
            <p className="tiny faint" style={{ marginTop: 10 }}>
              输入关键词检索证据切片，看看智能体生成内容时能引用到什么。
            </p>
          )}

          {!searching && results !== null && (
            <div className="col" style={{ gap: 10, marginTop: 12 }}>
              <p className="small muted">
                「{searchedQuery}」命中 {results.length} 条证据
              </p>
              {results.length === 0 ? (
                <Empty
                  icon={<FileSearch size={20} />}
                  title="没有命中的证据"
                  desc="没有证据时，生成类 Agent 会明确拒答或降级，而不是编造内容。"
                />
              ) : (
                results.map((item: any) => (
                  <div key={item.chunkId} className="col" style={{ gap: 6, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <Tag tone="brand">证据 #{item.chunkId}</Tag>
                      <Tag tone="neutral">{SOURCE_TYPE_LABEL[item.sourceType] || item.sourceType || '证据'}</Tag>
                      <span className="small" style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                    </div>
                    <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{item.snippet}</p>
                    <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                      {typeof item.score === 'number' && (
                        <span className="tiny">相关度 <strong>{Math.round(item.score * 100)}%</strong></span>
                      )}
                      {typeof item.confidence === 'number' && (
                        <span className="tiny">可信度 <strong>{Math.round(item.confidence * 100)}%</strong></span>
                      )}
                      {Array.isArray(item.skillTags) && item.skillTags.length > 0 && (
                        <span className="row tiny faint" style={{ gap: 6, flexWrap: 'wrap' }}>
                          {item.skillTags.slice(0, 4).map((tag: string) => (
                            <Tag key={tag} tone="neutral">{tag}</Tag>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead
          icon={<Library size={15} />}
          title="证据源概览"
          extra={
            <Button size="sm" variant="quiet" onClick={() => summary.reload()}>
              <RefreshCw size={13} />
              刷新
            </Button>
          }
        />
        <CardBody>
          {summary.loading && !summary.data ? (
            <LoadingBlock text="正在读取证据库概览" />
          ) : !summaryData || summaryData.total === 0 ? (
            <Empty
              icon={<Library size={22} />}
              title="证据库还是空的"
              desc="完成学习、考试或导入项目后，系统会把相关内容切片入库，作为生成内容的引用依据。"
            />
          ) : (
            <div className="col" style={{ gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <Metric label="证据切片总数" value={summaryData.total} accent />
                <Metric label="已索引" value={byStatus.indexed ?? 0} foot="可被向量召回" />
                <Metric label="待索引" value={byStatus.pending ?? 0} foot="正在排队" />
                <Metric label="索引失败" value={byStatus.failed ?? 0} foot="会用关键词兜底" />
              </div>

              {bySource.length === 0 ? (
                <p className="tiny faint">暂无来源明细</p>
              ) : (
                <div className="col" style={{ gap: 8 }}>
                  {bySource.map((source: any) => (
                    <div key={source.sourceId} className="col" style={{ gap: 4 }}>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <Tag tone="neutral">{SOURCE_TYPE_LABEL[source.sourceType] || source.sourceType}</Tag>
                        <span className="small grow" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {source.title}
                        </span>
                        <span className="tiny faint">{source.chunkCount} 片段</span>
                        <Tag tone={source.vectorStatus === 'indexed' ? 'green' : source.vectorStatus === 'failed' ? 'rose' : 'amber'}>
                          {source.vectorStatus === 'indexed' ? '已索引' : source.vectorStatus === 'failed' ? '索引失败' : '待索引'}
                        </Tag>
                      </div>
                      <Bar value={Math.min(100, (source.chunkCount / Math.max(1, bySource[0]?.chunkCount || 1)) * 100)} />
                    </div>
                  ))}
                </div>
              )}

              <Banner tone="info">
                生成链路里的引用都来自这些切片：教练回答标注「证据 #ID」，出题走知识库约束，讲义生成前先召回相关片段。
              </Banner>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
