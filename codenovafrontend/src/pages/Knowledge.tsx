import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Database, FileSearch, Library, Link2, RefreshCw, Search, ShieldCheck, UploadCloud } from 'lucide-react';
import { evidenceApi, knowledgeIngestionApi } from '../lib/api';
import RagEngine3D from '../components/RagEngine3D';
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
 * 知识库页 —— 展示领域知识库切片与学习者个人学习证据。
 *
 * 页面用于查看证据源、索引状态和检索结果。
 */

const SOURCE_TYPE_LABEL: Record<string, string> = {
  domain_doc: '领域文档',
  project: '项目实践',
  exam: '考试记录',
  lecture: '讲义',
  github: '代码仓库',
  manual: '手动录入',
  file_qa: '文件问答',
  knowledge_upload: '上传资料',
  news_article: '资讯资料',
  agent_output: 'Agent 产物',
  learning_commit: '学习记录',
  resume: '简历画像',
};

const INGESTION_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  cleaning: '清洗中',
  inspecting: '质检中',
  approved: '已通过',
  rejected: '已拒绝',
  ingested: '已入库',
  failed: '失败',
};

function statusTone(status?: string): 'brand' | 'green' | 'amber' | 'rose' | 'neutral' {
  if (status === 'ingested' || status === 'approved') return 'green';
  if (status === 'rejected' || status === 'failed') return 'rose';
  if (status === 'cleaning' || status === 'inspecting' || status === 'pending') return 'amber';
  return 'neutral';
}

export default function Knowledge() {
  const [searchParams] = useSearchParams();
  const summary = useAsync(() => evidenceApi.summary(), []);
  const graph = useAsync(() => evidenceApi.graph(140), []);
  const tasks = useAsync(() => knowledgeIngestionApi.listTasks({ limit: 12 }), []);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<any> | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadText, setUploadText] = useState('');
  const [uploadTags, setUploadTags] = useState('人工智能');
  const [sourceUrl, setSourceUrl] = useState('');
  const [newsKeywords, setNewsKeywords] = useState('AI Agent, RAG');
  const [ingesting, setIngesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q) setQuery(q);
  }, [searchParams]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const data = await evidenceApi.search(q, true);
      const list = Array.isArray(data) ? data : data?.items || data?.results || data?.list || [];
      setResults(list);
      setSearchedQuery(q);
      graph.reload();
    } catch (err: any) {
      toast.error('检索失败', err?.message || '');
    } finally {
      setSearching(false);
    }
  };

  const splitTags = (text: string) => text.split(/[，,、\s]+/).map((tag) => tag.trim()).filter(Boolean);

  const refreshKnowledgeViews = () => {
    tasks.reload();
    summary.reload();
    graph.reload();
  };

  const submitText = async () => {
    const content = uploadText.trim();
    if (content.length < 30) {
      toast.info('资料内容太短', '请粘贴更完整的学习资料。');
      return;
    }
    setIngesting(true);
    try {
      const task = await knowledgeIngestionApi.uploadText({
        title: uploadTitle.trim() || '上传资料',
        content,
        skillTags: splitTags(uploadTags),
      });
      toast.success(task?.ingestionStatus === 'ingested' ? '资料已入库' : '资料已提交', task?.failureReason || '已完成清洗和质检流程');
      setUploadText('');
      refreshKnowledgeViews();
    } catch (err: any) {
      toast.error('提交失败', err?.message || '');
    } finally {
      setIngesting(false);
    }
  };

  const submitUrl = async () => {
    const url = sourceUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.info('请输入有效链接', '链接需要以 http:// 或 https:// 开头。');
      return;
    }
    setIngesting(true);
    try {
      const task = await knowledgeIngestionApi.ingestUrl({ url, skillTags: splitTags(uploadTags) });
      toast.success(task?.ingestionStatus === 'ingested' ? '链接资料已入库' : '链接资料已处理', task?.failureReason || '已完成清洗和质检流程');
      setSourceUrl('');
      refreshKnowledgeViews();
    } catch (err: any) {
      toast.error('链接处理失败', err?.message || '');
    } finally {
      setIngesting(false);
    }
  };

  const refreshNews = async () => {
    setIngesting(true);
    try {
      const data = await knowledgeIngestionApi.refreshNews({ keywords: splitTags(newsKeywords), limit: 5 });
      toast.success('资讯处理完成', `入库 ${data?.ingested || 0} 条，拒绝 ${data?.rejected || 0} 条`);
      refreshKnowledgeViews();
    } catch (err: any) {
      toast.error('资讯刷新失败', err?.message || '');
    } finally {
      setIngesting(false);
    }
  };

  const onFileChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.info('文件过大', '首版支持 2MB 以内的文本文件。');
      event.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
      setUploadText(text.slice(0, 50000));
      toast.success('文件已读取', '请确认内容后提交给知识库智能体。');
    } catch (err: any) {
      toast.error('文件读取失败', err?.message || '');
    } finally {
      event.target.value = '';
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
          领域知识库切片与个人学习证据都在这里，可用于查看资料来源、索引状态和检索结果。
        </p>
      </header>

      <Card>
        <CardHead
          icon={<Database size={15} />}
          title="RAG 可视化数据引擎"
          extra={
            <Button size="sm" variant="quiet" onClick={() => graph.reload()}>
              <RefreshCw size={13} />
              刷新图谱
            </Button>
          }
        />
        <CardBody>
          <p className="small muted" style={{ marginTop: -2, marginBottom: 12 }}>
            展示知识库的索引结构：中心是 Chroma 向量核心，外圈按资料来源、证据切片和知识主题组织。搜索后会高亮相关 chunk，便于查看检索路径。
          </p>
          {graph.loading && !graph.data ? (
            <LoadingBlock text="正在读取 RAG 图谱" sub="加载 Evidence chunks、来源和知识标签关系" />
          ) : (
            <RagEngine3D graph={graph.data} results={results || []} query={searchedQuery} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead
          icon={<ShieldCheck size={15} />}
          title="知识库智能体"
          extra={
            <Button size="sm" variant="quiet" onClick={() => tasks.reload()}>
              <RefreshCw size={13} />
              刷新任务
            </Button>
          }
        />
        <CardBody>
          <div className="knowledge-ingest-grid">
            <div className="col" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <Input placeholder="资料标题" value={uploadTitle} onChange={(event: any) => setUploadTitle(event.target.value)} style={{ flex: 1, minWidth: 180 }} />
                <Input placeholder="标签，如：AI Agent, RAG" value={uploadTags} onChange={(event: any) => setUploadTags(event.target.value)} style={{ flex: 1, minWidth: 180 }} />
              </div>
              <textarea
                className="input"
                rows={6}
                placeholder="粘贴学习资料、课程摘要、技术笔记或代码说明。提交后会先清洗与质检，通过后再入库。"
                value={uploadText}
                onChange={(event) => setUploadText(event.target.value)}
                style={{ resize: 'vertical', minHeight: 128 }}
              />
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.vue,.html,.css" onChange={onFileChange} style={{ display: 'none' }} />
                <Button variant="soft" onClick={() => fileInputRef.current?.click()} disabled={ingesting}>
                  <UploadCloud size={15} />
                  读取文本文件
                </Button>
                <Button variant="primary" onClick={submitText} disabled={ingesting || uploadText.trim().length < 30}>
                  <ShieldCheck size={15} />
                  {ingesting ? '处理中…' : '提交清洗入库'}
                </Button>
              </div>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <Input placeholder="https://... 资料链接" value={sourceUrl} onChange={(event: any) => setSourceUrl(event.target.value)} style={{ flex: 1, minWidth: 220 }} />
                <Button variant="soft" onClick={submitUrl} disabled={ingesting || !sourceUrl.trim()}>
                  <Link2 size={15} />
                  处理链接
                </Button>
              </div>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <Input placeholder="资讯关键词" value={newsKeywords} onChange={(event: any) => setNewsKeywords(event.target.value)} style={{ flex: 1, minWidth: 220 }} />
                <Button variant="soft" onClick={refreshNews} disabled={ingesting}>
                  <RefreshCw size={15} />
                  抓取最新资讯
                </Button>
              </div>
            </div>

            <div className="col" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <ShieldCheck size={15} style={{ color: 'var(--brand-600)' }} />
                <strong className="small">入库任务</strong>
                {tasks.loading && <span className="tiny faint">同步中</span>}
              </div>
              {tasks.loading && !tasks.data ? (
                <LoadingBlock text="正在读取任务" />
              ) : (tasks.data?.items || []).length === 0 ? (
                <Empty icon={<ShieldCheck size={20} />} title="暂无入库任务" desc="提交资料后会显示清洗、质检和入库状态。" />
              ) : (
                <div className="col" style={{ gap: 8, maxHeight: 360, overflow: 'auto', paddingRight: 2 }}>
                  {(tasks.data?.items || []).map((task: any) => (
                    <div key={task.taskId} className="col" style={{ gap: 5, border: '1px solid var(--border)', borderRadius: 10, padding: '9px 10px' }}>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <Tag tone={statusTone(task.ingestionStatus)}>{INGESTION_STATUS_LABEL[task.ingestionStatus] || task.ingestionStatus}</Tag>
                        {typeof task.inspectionResult?.score === 'number' && <Tag tone="neutral">质检 {task.inspectionResult.score}</Tag>}
                        <span className="small grow truncate" style={{ minWidth: 0 }}>{task.title}</span>
                      </div>
                      {task.failureReason && <span className="tiny muted">{task.failureReason}</span>}
                      {Array.isArray(task.ingestedChunkIds) && task.ingestedChunkIds.length > 0 && (
                        <span className="tiny faint">已入库 {task.ingestedChunkIds.length} 个切片</span>
                      )}
                      {Array.isArray(task.skillTags) && task.skillTags.length > 0 && (
                        <div className="row wrap" style={{ gap: 5 }}>
                          {task.skillTags.slice(0, 4).map((tag: string) => <Tag key={tag} tone="neutral">{tag}</Tag>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead icon={<Search size={15} />} title="检索证据" extra={<span className="tiny faint">向量召回 + 关键词兜底 + 可解释重排</span>} />
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
                  desc="可以尝试更换关键词，或先导入更多相关资料。"
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
                这些切片会作为检索、引用展示和学习资源组织的基础数据。
              </Banner>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
