import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Layers3,
  Loader2,
  PenLine,
  Route as RouteIcon,
  Sparkles,
  Target,
} from 'lucide-react';
import { planApi, studentApi, type LearningDomain, type StarterPath } from '../lib/api';
import { toast } from '../store/toast';
import { AgentTrace, type TraceStep } from '../components/AgentTrace';
import { Banner, Button, Card, CardBody, CardHead, Field, Range, Segmented, Tag, Textarea } from '../components/ui';

type Journey = 'domain' | 'topic' | 'career';

const DEFAULT_DOMAIN_ID = 'ai-native-software';

/** 生成过程中的 Agent 阶段 —— 让用户看得见后台在做什么 */
const GEN_STAGES: Array<{ key: string; label: string }> = [
  { key: 'diagnose', label: '读取你的画像与自评基础' },
  { key: 'expert', label: '检索领域知识库，确定能力项边界' },
  { key: 'maker', label: '生成阶段划分、能力项与预估时长' },
  { key: 'reviewer', label: '校验难度梯度与岗位相关性' },
  { key: 'planner', label: '按每天投入时间排期，生成今日任务' },
];

export default function PlanCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const preset = (location.state || {}) as {
    domainId?: string;
    goalType?: string;
    starterPathId?: string;
    dailyHours?: number;
  };

  const [journey, setJourney] = useState<Journey>('domain');
  const [domains, setDomains] = useState<LearningDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [domainId, setDomainId] = useState(preset.domainId || DEFAULT_DOMAIN_ID);
  const [starterPathId, setStarterPathId] = useState(preset.starterPathId || '');
  const [dailyHours, setDailyHours] = useState(preset.dailyHours || 2);

  const [topicText, setTopicText] = useState('');
  const [topicName, setTopicName] = useState('');

  const [generating, setGenerating] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    studentApi
      .domains()
      .then((list) => {
        if (!alive) return;
        setDomains(list);
        if (!preset.domainId) {
          const preferred = list.find((item) => item.id === DEFAULT_DOMAIN_ID) || list[0];
          if (preferred) {
            setDomainId(preferred.id);
            setStarterPathId(preferred.starterPaths?.[0]?.id || '');
          }
        }
      })
      .catch((err: any) => {
        if (alive) setLoadError(err?.message || '无法获取学习领域，请确认后端已启动');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const domain = useMemo(
    () => domains.find((item) => item.id === domainId) || null,
    [domains, domainId],
  );
  const starterPath = useMemo<StarterPath | null>(
    () => domain?.starterPaths?.find((item) => item.id === starterPathId) || domain?.starterPaths?.[0] || null,
    [domain, starterPathId],
  );

  const totalMin = useMemo(
    () =>
      (starterPath?.phases || []).reduce(
        (sum, phase) => sum + phase.abilities.reduce((acc, item) => acc + item.estimatedMin, 0),
        0,
      ),
    [starterPath],
  );
  const abilityCount = useMemo(
    () => (starterPath?.phases || []).reduce((sum, phase) => sum + phase.abilities.length, 0),
    [starterPath],
  );
  const estimatedDays = Math.max(1, Math.ceil(totalMin / 60 / Math.max(0.5, dailyHours)));

  const topicList = useMemo(
    () =>
      Array.from(
        new Set(
          topicText
            .split(/[,，、\n]/)
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ),
    [topicText],
  );

  // 生成过程中推进 Agent 阶段指示（真实进度由后端决定，这里只是阶段可视化）
  useEffect(() => {
    if (!generating) return;
    setStageIndex(0);
    const timers = GEN_STAGES.slice(1).map((_, index) =>
      setTimeout(() => setStageIndex(index + 1), (index + 1) * 2600),
    );
    return () => timers.forEach(clearTimeout);
  }, [generating]);

  const traceSteps: TraceStep[] = GEN_STAGES.map((stage, index) => ({
    id: stage.key,
    role: stage.key as TraceStep['role'],
    output: stage.label,
    status: !generating ? 'pending' : index < stageIndex ? 'done' : index === stageIndex ? 'working' : 'pending',
  }));

  const canGenerate = journey === 'domain' ? Boolean(domainId && starterPathId) : topicList.length > 0;

  const generate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const body =
        journey === 'domain'
          ? {
              planType: 'main' as const,
              domainId,
              goalType: starterPath?.goalType || 'project',
              starterPathId,
              goalTitle: starterPath?.title || '',
              dailyHours,
            }
          : {
              planType: 'side' as const,
              planName: topicName.trim() || topicList[0] || '自选训练',
              skills: topicList,
              dailyHours,
            };

      const result = await planApi.create(body);
      const count =
        result?.totalSkills ??
        (result?.pathData?.phases || []).reduce(
          (sum: number, phase: any) => sum + (phase.skills?.length || 0),
          0,
        );

      toast.success('路径已生成', `共 ${count || abilityCount} 个能力项，预计 ${estimatedDays} 天`);
      navigate('/path', { replace: true });
    } catch (err: any) {
      setError(err?.message || '生成失败，请重试');
      toast.error('路径生成失败', err?.message || '');
    } finally {
      setGenerating(false);
      setStageIndex(0);
    }
  };

  return (
    <div className="page page--narrow" style={{ margin: '0 auto' }}>
      <div className="page-head">
        <span className="tag tag--brand" style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
          <Sparkles size={11} />
          最后一步
        </span>
        <h1>生成你的训练路径</h1>
        <p>
          确认下面的选择，五个 Agent 会协作生成分阶段路径。
          生成过程完全可见 —— 每一步在做什么、依据什么，都能看到。
        </p>
      </div>

      {loadError && <Banner tone="error">{loadError}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <div className="row" style={{ justifyContent: 'center' }}>
        <Segmented
          value={journey}
          onChange={(next) => setJourney(next)}
          options={[
            { value: 'domain', label: '按领域路线' },
            { value: 'topic', label: '自定义主题' },
          ]}
        />
      </div>

      {journey === 'domain' ? (
        <Card>
          <CardHead
            icon={<RouteIcon size={15} />}
            title="领域路线"
            extra={starterPath && <Tag tone="brand">{starterPath.title}</Tag>}
          />
          <CardBody className="col" style={{ gap: 18 }}>
            {loading ? (
              <div className="empty">
                <Loader2 size={22} className="btn__spinner" style={{ color: 'var(--brand-600)' }} />
                <p className="small muted">正在读取领域配置…</p>
              </div>
            ) : (
              <>
                <Field label="训练领域" required>
                  <div className="choice-grid choice-grid--2">
                    {domains.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="choice"
                        aria-pressed={domainId === item.id}
                        onClick={() => {
                          setDomainId(item.id);
                          setStarterPathId(item.starterPaths?.[0]?.id || '');
                        }}
                      >
                        {domainId === item.id && (
                          <span className="choice__check">
                            <CheckCircle2 size={12} strokeWidth={3} />
                          </span>
                        )}
                        <span className="choice__title">{item.name}</span>
                        <span className="choice__desc">{item.description}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                {domain && (
                  <Field label="起步路线" required>
                    <div className="choice-grid">
                      {(domain.starterPaths || []).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="choice"
                          aria-pressed={starterPathId === item.id}
                          onClick={() => setStarterPathId(item.id)}
                        >
                          {starterPathId === item.id && (
                            <span className="choice__check">
                              <CheckCircle2 size={12} strokeWidth={3} />
                            </span>
                          )}
                          <span className="choice__title">{item.title}</span>
                          <span className="choice__desc">{item.description}</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                {starterPath && (
                  <>
                    <div className="grid grid--3">
                      <div className="metric">
                        <span className="metric__label">
                          <Layers3 size={12} />
                          阶段
                        </span>
                        <span className="metric__value">{starterPath.phases.length}</span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">
                          <Target size={12} />
                          能力项
                        </span>
                        <span className="metric__value">{abilityCount}</span>
                      </div>
                      <div className="metric">
                        <span className="metric__label">
                          <Clock3 size={12} />
                          预计周期
                        </span>
                        <span className="metric__value">
                          {estimatedDays}
                          <small>天</small>
                        </span>
                      </div>
                    </div>

                    <div className="phase">
                      <div className="row" style={{ marginBottom: 2 }}>
                        <PenLine size={13} style={{ color: 'var(--text-faint)' }} />
                        <span className="small muted">将按这个顺序展开</span>
                      </div>
                      {starterPath.phases.map((phase, index) => (
                        <div key={phase.name} className="phase" style={{ gap: 4 }}>
                          <div className="phase__head">
                            <span className="phase__marker">{index + 1}</span>
                            <span className="phase__name">{phase.name}</span>
                            <span className="tiny faint" style={{ marginLeft: 'auto' }}>
                              {phase.abilities.length} 项 ·{' '}
                              {Math.round(
                                phase.abilities.reduce((sum, item) => sum + item.estimatedMin, 0) / 60,
                              )}
                              h
                            </span>
                          </div>
                          <div className="phase__spine">
                            {phase.abilities.map((ability) => (
                              <div
                                key={ability.id}
                                className="tiny muted"
                                style={{ padding: '3px 0' }}
                              >
                                {ability.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Field
                  label="每天能投入多少小时"
                  hint="只影响排期密度。跟不上可以在路径页调慢，不会推倒重来。"
                >
                  <div className="row" style={{ gap: 14 }}>
                    <Range value={dailyHours} onChange={setDailyHours} min={0.5} max={8} step={0.5} />
                    <strong style={{ minWidth: 46, textAlign: 'right' }}>{dailyHours} h</strong>
                  </div>
                </Field>
              </>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHead icon={<PenLine size={15} />} title="自定义主题" />
          <CardBody className="col" style={{ gap: 18 }}>
            <Field label="这组训练叫什么" hint="选填，默认用第一个主题命名">
              <input
                className="input"
                value={topicName}
                onChange={(event) => setTopicName(event.target.value)}
                placeholder="例如：RAG 检索链路专项"
              />
            </Field>

            <Field
              label="你想练的具体内容"
              required
              hint="用逗号、顿号或换行分隔，每项会成为一个能力项"
            >
              <Textarea
                value={topicText}
                onChange={(event) => setTopicText(event.target.value)}
                placeholder={'例如：\n文档切片策略\n召回与重排\n引用校验与拒答\n评测集设计'}
                style={{ minHeight: 130 }}
              />
            </Field>

            {topicList.length > 0 && (
              <div className="col" style={{ gap: 8 }}>
                <span className="small muted">将生成 {topicList.length} 个能力项</span>
                <div className="row wrap" style={{ gap: 7 }}>
                  {topicList.map((topic) => (
                    <Tag key={topic} tone="brand">
                      {topic}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {generating && (
        <Card>
          <CardHead
            icon={<Loader2 size={15} className="btn__spinner" />}
            title="正在生成路径"
            extra={<Tag tone="amber">预计 20-60 秒</Tag>}
          />
          <CardBody>
            <AgentTrace steps={traceSteps} />
          </CardBody>
        </Card>
      )}

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="quiet" onClick={() => navigate('/today')} disabled={generating}>
          以后再说
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={generate}
          disabled={!canGenerate || generating || loading}
          loading={generating}
        >
          {generating ? '生成中…' : '生成训练路径'}
          {!generating && <ArrowRight size={16} />}
        </Button>
      </div>
    </div>
  );
}
