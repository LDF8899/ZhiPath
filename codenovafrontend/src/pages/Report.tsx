import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookMarked,
  CheckCircle2,
  Clock3,
  FileSearch,
  Gauge,
  Layers3,
  LineChart as ChartIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  evaluationApi,
  matchApi,
  planApi,
  remediationApi,
  studentApi,
  workbenchApi,
} from '../lib/api';
import { toast } from '../store/toast';
import { ChartLegend, LineChart, RadarChart } from '../components/charts';
import {
  Bar,
  Button,
  Card,
  CardBody,
  CardHead,
  Empty,
  LoadingBlock,
  Metric,
  StatCard,
  Tag,
  useAsync,
} from '../components/ui';
import { useStagger } from '../lib/motion';

export default function Report() {
  const navigate = useNavigate();
  const metricRef = useStagger<HTMLDivElement>();

  const radar = useAsync<any>(() => studentApi.radar(), []);
  const weakPoints = useAsync<any[]>(() => remediationApi.weakPoints(), []);
  const evaluations = useAsync<any[]>(() => evaluationApi.list(), []);
  const plans = useAsync<any[]>(() => planApi.list(50), []);
  const growth = useAsync<any>(() => workbenchApi.growthReport(30), []);
  const summary = useAsync<any>(() => workbenchApi.dashboard(), []);
  const best = useAsync<any>(() => matchApi.best(), []);

  // 难度匹配曲线：用真实测评记录算，没有记录就明确说明，不伪造
  const curve = useMemo(() => {
    // 测评记录是 { attempt, result, impact } 的嵌套结构，分数在 result 里而不是顶层
    const records = (evaluations.data || [])
      .map((item) => {
        const result = item?.result || {};
        const attempt = item?.attempt || {};
        const score = Number(
          result.normalizedScore ??
            result.score ??
            item.normalizedScore ??
            item.score ??
            attempt.score ??
            NaN,
        );
        return Number.isFinite(score) ? { score, passScore: Number(result.passScore ?? item.passScore ?? 70) } : null;
      })
      .filter(Boolean)
      .slice(-12)
      .reverse() as Array<{ score: number; passScore: number }>;

    if (records.length === 0) return null;

    return {
      labels: records.map((_, index) => `${index + 1}`),
      actual: records.map((item) => Math.round(item.score)),
      passLine: records.map((item) => (Number.isFinite(item.passScore) ? item.passScore : 70)),
    };
  }, [evaluations.data]);

  /**
   * 能力雷达数据
   *
   * 只认后端 /user/profile/radar 返回的领域维度。维度不足三个时返回空，
   * 由页面给出"数据还不够"的说明 —— 不拿别的数据拼一个看起来像雷达的图，
   * 那属于伪造证据。
   */
  const radarPoints = useMemo(() => {
    const dims = radar.data?.radarDimensions || [];
    if (!Array.isArray(dims) || dims.length < 3) return [];
    return dims.map((dimension: any) => ({
      name: dimension.name || dimension.dimension || '维度',
      value: Number(dimension.score ?? dimension.value ?? 0),
    }));
  }, [radar.data]);

  const blindSpots = (weakPoints.data || []).slice(0, 8);
  const planPhases = plans.data?.[0]?.pathData?.phases || [];
  const stats = summary.data?.stats;

  if (radar.loading && summary.loading && !summary.data) {
    return (
      <div className="page">
        <LoadingBlock text="正在汇总成长数据" sub="能力雷达、知识盲区、难度曲线和路径规划会一起加载" />
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <div className="page-head">
        <div className="row-between wrap">
          <div>
            <h1>成长报告</h1>
            <p>
              这里汇总了你所有的学习证据：能力结构、知识盲区、难度匹配变化，以及每条结论的来源可信度。
              数据全部来自真实记录，没有记录的地方会直接说明，不会给你一条编出来的曲线。
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/coach')}>
            <Sparkles size={14} />
            让教练解读这份报告
          </Button>
        </div>
      </div>

      {/* 顶部指标（数字滚动 + 级联入场） */}
      <div className="grid grid--4 stagger" ref={metricRef}>
        <StatCard
          gradient="var(--grad-nova)"
          icon={<Gauge size={15} />}
          label="目标岗位匹配度"
          value={best.data?.totalScore ?? summary.data?.learning_path?.matchScore ?? 0}
          unit="%"
          foot={best.data?.job?.title ? `对照：${best.data.job.title}` : '未绑定目标岗位'}
        />
        <StatCard
          gradient="linear-gradient(90deg,#22d3ee,#6366f1)"
          icon={<Layers3 size={14} />}
          label="能力项完成"
          value={stats?.done_skills ?? 0}
          unit={`/${stats?.total_skills ?? 0}`}
          foot={
            stats?.total_skills
              ? `完成率 ${Math.round(((stats?.done_skills ?? 0) / stats.total_skills) * 100)}%` +
                (stats?.in_progress_skills ? ` · ${stats.in_progress_skills} 项进行中` : '')
              : undefined
          }
        />
        <StatCard
          gradient="linear-gradient(90deg,#f59e0b,#ec4899)"
          icon={<Clock3 size={14} />}
          label="累计学时"
          value={stats?.total_learned_hours ?? 0}
          unit="h"
          foot={`活跃 ${stats?.active_days ?? 0} 天`}
        />
        <StatCard
          gradient="linear-gradient(90deg,#a855f7,#6366f1)"
          icon={<FileSearch size={14} />}
          label="测评记录"
          value={(evaluations.data || []).length}
          unit="次"
          foot="用于计算掌握度与盲区"
        />
      </div>

      <div className="grid grid--hero">
        {/* 能力雷达 */}
        <Card>
          <CardHead icon={<Target size={15} />} title="能力结构" />
          <CardBody>
            {radarPoints.length >= 3 ? (
              <div className="col" style={{ alignItems: 'center', gap: 8 }}>
                <RadarChart points={radarPoints} />
                <span className="tiny faint">按领域定义的加权维度计算</span>
              </div>
            ) : (
              <Empty
                icon={<Target size={20} />}
                title="还没有足够的能力数据"
                desc="能力雷达需要至少三个维度的测评记录。完成几个能力项的学习和测验后，这里会自动生成。"
                action={
                  <Button variant="soft" onClick={() => navigate('/path')}>
                    去完成一个能力项
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>

        {/* 知识盲区 */}
        <Card>
          <CardHead
            icon={<ShieldCheck size={15} />}
            title="知识盲区"
            extra={<Tag tone={blindSpots.length ? 'rose' : 'green'}>{blindSpots.length} 项</Tag>}
          />
          <CardBody>
            {weakPoints.loading && !weakPoints.data ? (
              <LoadingBlock text="正在分析薄弱项" />
            ) : blindSpots.length === 0 ? (
              <Empty
                icon={<CheckCircle2 size={20} />}
                title="暂时没有检测到盲区"
                desc="盲区来自测评错题和实操未通过的记录。继续保持，或者做一次速测让系统更了解你。"
              />
            ) : (
              <div>
                {blindSpots.map((item: any, index: number) => {
                  // weak-points 返回的是 { label, masteryPct }，没有 skill/skillName 字段
                  const skill = item.skill || item.skillName || item.name || item.label || '未命名';
                  // 掌握度越低越该优先补，用「未掌握度」当严重度，别写死 60
                  const mastery = Number(item.masteryPct ?? item.mastery ?? 0);
                  const severity = Number(item.severity ?? item.score ?? 100 - mastery);
                  return (
                    <div className="gap-row" key={`${skill}-${index}`}>
                      <div className="gap-row__head">
                        <span className="gap-row__name">{skill}</span>
                        <span className="gap-row__val">{Math.round(mastery)}</span>
                      </div>
                      <Bar value={severity} tone="rose" />
                      <p className="gap-row__reason">
                        {item.reason || item.question || `掌握度 ${Math.round(mastery)}%，建议优先补齐`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 难度匹配曲线 */}
      <Card>
        <CardHead
          icon={<ChartIcon size={15} />}
          title="资源难度匹配曲线"
          extra={
            curve ? (
              <ChartLegend
                items={[
                  { label: '你的得分', color: '#4f46e5' },
                  { label: '通过线', color: '#f59e0b' },
                ]}
              />
            ) : undefined
          }
        />
        <CardBody>
          {curve ? (
            <>
              <LineChart
                labels={curve.labels}
                series={[
                  { key: 'actual', label: '你的得分', color: '#4f46e5', values: curve.actual },
                  { key: 'pass', label: '通过线', color: '#f59e0b', values: curve.passLine },
                ]}
              />
              <p className="small muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
                横轴是按时间排列的测评记录（共 {curve.labels.length} 次）。
                得分持续低于通过线时，系统会判定为「降维解释」，自动把后续资源难度调低；
                连续高于通过线则会触发「进阶挑战」。
              </p>
            </>
          ) : (
            <Empty
              icon={<ChartIcon size={20} />}
              title="还没有测评记录"
              desc="难度匹配曲线需要至少一次测评。完成学习闭环里的测验或评估后，这里会画出你的真实曲线。"
              action={
                <Button variant="soft" onClick={() => navigate('/path')}>
                  去做一个能力项
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>

      {/* 路径规划图 */}
      <Card>
        <CardHead
          icon={<Layers3 size={15} />}
          title="学习路径规划图"
          extra={plans.data?.[0]?.goalTitle ? <Tag tone="brand">{plans.data[0].goalTitle}</Tag> : undefined}
        />
        <CardBody>
          {planPhases.length === 0 ? (
            <Empty
              icon={<Layers3 size={20} />}
              title="还没有路径数据"
              desc="生成训练路径后，这里会按阶段展示你的推进情况。"
              action={
                <Button variant="primary" onClick={() => navigate('/plan/new')}>
                  生成路径
                </Button>
              }
            />
          ) : (
            <div className="path-map">
              {planPhases.map((phase: any, index: number) => {
                const skills = phase.skills || [];
                const done = skills.filter((skill: any) => skill.status === 'done').length;
                const isDone = skills.length > 0 && done === skills.length;
                const isActive = !isDone && (skills.some((s: any) => s.read_at) || index === 0);

                return (
                  <div style={{ display: 'contents' }} key={`${phase.name}-${index}`}>
                    <div className={`path-node ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
                      <span className="path-node__dot">
                        {isDone ? <CheckCircle2 size={15} strokeWidth={2.5} /> : index + 1}
                      </span>
                      <span className="path-node__title">{phase.name}</span>
                      <span className="path-node__level">
                        {done}/{skills.length} 项
                      </span>
                    </div>
                    {index < planPhases.length - 1 && (
                      <span className={`path-node__link ${isDone ? 'is-done' : ''}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid--2">
        {/* 可信生成 */}
        <Card>
          <CardHead icon={<ShieldCheck size={15} />} title="可信生成" />
          <CardBody className="col" style={{ gap: 12 }}>
            <p className="small muted" style={{ lineHeight: 1.7 }}>
              所有生成内容都要求命中知识库片段。这里汇总当前的证据沉淀情况 ——
              证据越充分，后续生成的可信度越高，幻觉风险越低。
            </p>
            <div className="grid grid--2" style={{ gap: 10 }}>
              <Metric
                label="生成资源"
                value={(summary.data?.stats?.exam_count ?? 0) + (evaluations.data || []).length}
                unit="条"
              />
              <Metric
                label="测评记录"
                value={(evaluations.data || []).length}
                unit="次"
                foot="构成证据链主体"
              />
            </div>
            {(evaluations.data || []).length > 0 && (
              <div className="col" style={{ gap: 8 }}>
                <span className="small strong">最近的测评</span>
                {(evaluations.data || []).slice(0, 5).map((item: any, index: number) => (
                  <div className="row-between" key={index} style={{ fontSize: 12.5 }}>
                    <span className="truncate">{item.skillName || '综合能力'}</span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="strong">{Math.round(Number(item.normalizedScore ?? item.score ?? 0))}</span>
                      <Tag tone={item.passed ? 'green' : 'rose'}>
                        {item.passed ? '通过' : '未通过'}
                      </Tag>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 阶段成长 */}
        <Card>
          <CardHead icon={<TrendingUp size={15} />} title="近 30 天" />
          <CardBody>
            {growth.loading && !growth.data ? (
              <LoadingBlock text="正在统计" />
            ) : (
              <div className="col" style={{ gap: 12 }}>
                <div className="grid grid--2" style={{ gap: 10 }}>
                  <Metric
                    label="活跃天数"
                    value={stats?.active_days ?? 0}
                    unit="天"
                  />
                  <Metric
                    label="完成能力项"
                    value={stats?.done_skills ?? 0}
                    unit="项"
                  />
                </div>
                <p className="small muted" style={{ lineHeight: 1.7 }}>
                  成长数据来自学习 commit 与测评记录。随着你完成更多能力项，
                  这里会给出阶段性的变化对比和下一步建议。
                </p>
                <Button
                  variant="soft"
                  size="sm"
                  onClick={() => {
                    toast.info('已刷新', '成长数据已更新到最新');
                    growth.reload();
                    summary.reload();
                  }}
                >
                  <BookMarked size={14} />
                  刷新数据
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
