import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Code2,
  FileQuestion,
  MessageSquareText,
  Image as ImageIcon,
  Library,
  Package,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Video,
  XCircle,
} from 'lucide-react';
import { resourceApi, resourceUseful, type GeneratedResource } from '../lib/api';
import { useStagger } from '../lib/motion';
import { useStreamEvents, EVENT_TYPES } from '../lib/sse';
import { toast } from '../store/toast';
import {
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  LoadingBlock,
  Segmented,
  Tag,
  useAsync,
} from '../components/ui';

type Filter = 'all' | 'lecture' | 'quiz' | 'coding' | 'reading' | 'media';

const TYPE_META: Record<string, { label: string; icon: ReactNode; tone: 'brand' | 'teal' | 'violet' | 'amber' }> = {
  lecture: { label: '讲义', icon: <BookOpen size={14} />, tone: 'brand' },
  quiz: { label: '测试题', icon: <FileQuestion size={14} />, tone: 'violet' },
  coding: { label: '实操', icon: <Code2 size={14} />, tone: 'teal' },
  reading: { label: '拓展阅读', icon: <Library size={14} />, tone: 'teal' },
  diagram: { label: '图表', icon: <ImageIcon size={14} />, tone: 'amber' },
  video: { label: '视频', icon: <Video size={14} />, tone: 'amber' },
  animation: { label: '动画', icon: <Sparkles size={14} />, tone: 'amber' },
  exam: { label: '测评', icon: <FileQuestion size={14} />, tone: 'violet' },
};

const MEDIA_TYPES = ['diagram', 'video', 'animation', 'avatar'];

function metaFor(resource: GeneratedResource) {
  const key = String(resource.resourceType || resource.outputType || '').toLowerCase();
  return TYPE_META[key] || { label: key || '资源', icon: <Package size={14} />, tone: 'brand' as const };
}

function timeLabel(resource: GeneratedResource) {
  const raw = resource.createTime || resource.createdAt;
  if (!raw) return '';
  const value = Number(raw);
  if (!Number.isFinite(value)) return '';
  // 后端可能给秒级或毫秒级时间戳
  const ms = value > 1e12 ? value : value * 1000;
  return new Date(ms).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compactPayload(resource: GeneratedResource) {
  const payload = resource.payload ?? resource.content ?? resource.rawResponse ?? null;
  if (!payload) return resource.errorMessage || '暂无详情内容';
  if (typeof payload === 'string') return payload.slice(0, 1200);
  if (Array.isArray(payload)) {
    return payload
      .slice(0, 6)
      .map((item) => (typeof item === 'string' ? item : item.title || item.question || JSON.stringify(item).slice(0, 160)))
      .join('\n');
  }
  const title = payload.title || payload.planName || payload.skill || payload.skillName || '';
  const text = payload.lecture || payload.summary || payload.text || payload.message || payload.script || payload.content || '';
  if (text) return `${title ? `${title}\n` : ''}${String(text).slice(0, 1200)}`;
  // 结构化产物的语义提取：分维度/清单/章节，避免把 JSON 原文怼给用户
  const lines: string[] = [];
  if (Array.isArray(payload.dimensions)) {
    payload.dimensions.forEach((dim: any) => {
      const name = dim?.dimension || dim?.name || '维度';
      const score = dim?.score ?? '?';
      const max = dim?.maxScore ?? 100;
      const detail = dim?.detail || '';
      lines.push(`${name}：${score}/${max}${detail ? ` —— ${detail}` : ''}`);
    });
  }
  if (Array.isArray(payload.keyPoints)) {
    lines.push(`要点：${payload.keyPoints.slice(0, 5).join('；')}`);
  }
  if (Array.isArray(payload.sections)) {
    payload.sections.slice(0, 8).forEach((section: any) => {
      lines.push(typeof section === 'string' ? section : section?.title || section?.heading || '');
    });
  }
  if (Array.isArray(payload.items)) {
    payload.items.slice(0, 6).forEach((item: any) => {
      lines.push(typeof item === 'string' ? item : [item?.title, item?.summary || item?.why].filter(Boolean).join(' —— '));
    });
  }
  if (Array.isArray(payload.examples)) {
    payload.examples.slice(0, 5).forEach((example: any) => {
      lines.push(typeof example === 'string' ? example : example?.title || example?.description || '');
    });
  }
  if (lines.some((line) => line.trim())) {
    return `${title ? `${title}\n` : ''}${lines.filter(Boolean).join('\n')}`.slice(0, 1200);
  }
  return '这条资源是结构化数据，没有纯文本预览。可在 Agent 工作台的任务详情中查看它的产出。';
}

export default function Resources() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionFilter = searchParams.get('sessionId') || '';
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GeneratedResource | null>(null);
  const resources = useAsync<GeneratedResource[]>(
    () => resourceApi.list({ limit: 100, chatSessionId: sessionFilter || undefined, search: search || undefined }),
    [sessionFilter, search],
  );
  const ledgerRef = useStagger<HTMLDivElement>();

  useStreamEvents([EVENT_TYPES.RESOURCE_READY, EVENT_TYPES.TASK_PROGRESS, EVENT_TYPES.AGENT_PROGRESS], () => {
    resources.reload();
  });

  const feedback = async (resource: GeneratedResource, useful: boolean) => {
    try {
      await resourceApi.feedback(resource.id, useful);
      toast.success(useful ? '已标记为有用' : '已标记为没用', '这条反馈会用于调整后续生成策略');
      resources.reload();
    } catch (err: any) {
      toast.error('反馈失败', err?.message || '');
    }
  };

  const toggleDetail = async (resource: GeneratedResource) => {
    if (openId === resource.id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(resource.id);
    setDetail(resource);
    try {
      const next = await resourceApi.detail(resource.id);
      setDetail(next || resource);
    } catch (err: any) {
      toast.error('详情读取失败', err?.message || '');
    }
  };

  const clearSessionFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('sessionId');
    setSearchParams(next);
  };

  const list = (resources.data || []).filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'media') return MEDIA_TYPES.includes(String(item.resourceType || '').toLowerCase());
    return String(item.resourceType || '').toLowerCase() === filter;
  });

  return (
    <div className="page">
      <div className="page-head">
        <h1>资源库</h1>
        <p>
          所有由 Agent 生成的讲义、测试题、实操任务和多媒体内容都会沉淀在这里。
          <strong>标记「有用 / 没用」会直接影响后续生成策略</strong> —— 这是反馈迭代闭环的输入。
        </p>
      </div>

      {sessionFilter && (
        <div className="notice notice--soft">
          <MessageSquareText size={15} />
          正在查看当前会话生成的资源
          <button type="button" className="link-btn" onClick={clearSessionFilter}>
            显示全部
          </button>
        </div>
      )}

      <div className="row-between wrap">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `全部 ${(resources.data || []).length}` },
            { value: 'lecture', label: '讲义' },
            { value: 'quiz', label: '测试题' },
            { value: 'coding', label: '实操' },
            { value: 'media', label: '多媒体' },
          ]}
        />
        <input
          className="input"
          style={{ maxWidth: 280 }}
          value={search}
          placeholder="搜索标题、能力项或类型"
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button variant="ghost" size="sm" onClick={() => navigate('/coach')}>
          <Sparkles size={14} />
          让教练生成新资源
        </Button>
      </div>

      <Card>
        <CardHead icon={<Package size={15} />} title="生成台账" />
        {resources.loading && !resources.data ? (
          <LoadingBlock text="正在读取资源台账" />
        ) : list.length === 0 ? (
          <Empty
            icon={<Package size={22} />}
            title="还没有生成过资源"
            desc="进入任意能力项开始学习，或者在教练页直接说「帮我生成 X 的讲义」，生成结果会自动出现在这里。"
            action={
              <Button variant="primary" onClick={() => navigate('/coach')}>
                <Sparkles size={15} />
                去教练页试试
              </Button>
            }
          />
        ) : (
          <div className="ledger stagger" ref={ledgerRef}>
            {list.map((resource) => {
              const meta = metaFor(resource);
              const failed = String(resource.resourceStatus || '').toLowerCase() === 'failed';
              const running = ['pending', 'running', 'processing'].includes(
                String(resource.resourceStatus || '').toLowerCase(),
              );
              const target = resource.targetEntity;

              return (
                <div className="ledger__row" key={resource.id}>
                  <span
                    className="ledger__icon"
                    style={{
                      background:
                        meta.tone === 'brand'
                          ? 'var(--brand-100)'
                          : meta.tone === 'teal'
                            ? 'var(--teal-100)'
                            : meta.tone === 'violet'
                              ? 'var(--violet-100)'
                              : 'var(--amber-100)',
                      color:
                        meta.tone === 'brand'
                          ? 'var(--brand-600)'
                          : meta.tone === 'teal'
                            ? 'var(--teal-600)'
                            : meta.tone === 'violet'
                              ? 'var(--violet-600)'
                              : 'var(--amber-600)',
                    }}
                  >
                    {meta.icon}
                  </span>

                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="ledger__title truncate" style={{ display: 'block' }}>
                      {resource.title || '未命名资源'}
                    </span>
                    <span className="ledger__meta">
                      <Tag tone={meta.tone}>{meta.label}</Tag>
                      {resource.source && <span>来源：{resource.source === 'chat' ? '对话' : resource.source}</span>}
                      {resource.skillName && <span>能力项：{resource.skillName}</span>}
                      {resource.chatSessionId && <span>会话资源</span>}
                      {timeLabel(resource) && (
                        <>
                          <span>·</span>
                          <span>{timeLabel(resource)}</span>
                        </>
                      )}
                      {failed && (
                        <Tag tone="rose" icon={<XCircle size={10} />}>
                          {resource.errorMessage || '生成失败'}
                        </Tag>
                      )}
                      {running && (
                        <Tag tone="amber" icon={<Clock3 size={10} />}>
                          生成中
                        </Tag>
                      )}
                    </span>
                  </span>

                  {target?.skillName && !failed && (
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => navigate(`/skill/${encodeURIComponent(target.skillName!)}`)}
                    >
                      去学习
                    </Button>
                  )}

                  {resource.chatSessionId && (
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => navigate(`/coach?sessionId=${encodeURIComponent(resource.chatSessionId!)}`)}
                    >
                      回会话
                    </Button>
                  )}

                  <Button size="sm" variant="ghost" onClick={() => toggleDetail(resource)}>
                    {openId === resource.id ? '收起' : '查看'}
                  </Button>

                  {!failed && !running && (
                    <div className="feedback-pair">
                      <button
                        type="button"
                        className={`feedback-btn ${resourceUseful(resource) === true ? 'is-on--up' : ''}`}
                        onClick={() => feedback(resource, true)}
                        aria-label="有用"
                        title="有用"
                      >
                        <ThumbsUp size={13} />
                      </button>
                      <button
                        type="button"
                        className={`feedback-btn ${resourceUseful(resource) === false ? 'is-on--down' : ''}`}
                        onClick={() => feedback(resource, false)}
                        aria-label="没用"
                        title="没用"
                      >
                        <ThumbsDown size={13} />
                      </button>
                    </div>
                  )}

                  {resourceUseful(resource) === true && (
                    <Tag tone="green" icon={<CheckCircle2 size={10} />}>
                      已标记有用
                    </Tag>
                  )}

                  {openId === resource.id && (
                    <div className="ledger__detail">
                      <pre>{compactPayload(detail || resource)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
