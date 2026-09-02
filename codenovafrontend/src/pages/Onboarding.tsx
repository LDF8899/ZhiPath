import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, Loader2, Sparkles } from 'lucide-react';
import {
  studentApi,
  type LearningAbility,
  type LearningDomain,
  type StarterPath,
} from '../lib/api';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import { Banner, Button, Choice, Field, Input, Range, Steps } from '../components/ui';
import { Logo } from '../components/Logo';

const STEP_LABELS = ['你是谁', '你要去哪', '你现在会什么'];

/** 面向职业训练的经历分档，比"大一大二"更贴合 AI 原生软件开发的受众 */
const STAGES = [
  { value: '零基础 / 刚入门', desc: '会写一点代码，没做过完整项目' },
  { value: '在校学生', desc: '有课程作业或实习经历' },
  { value: '1-3 年开发经验', desc: '能独立交付模块，想补齐 AI 工程能力' },
  { value: '3 年以上开发经验', desc: '能主导项目，想转向 AI 应用方向' },
  { value: '其他岗位转过来', desc: '产品、测试、数据等非开发背景' },
];

const SKILL_LEVELS = [
  { label: '没接触', value: null },
  { label: '了解', value: '了解' },
  { label: '熟悉', value: '熟悉' },
  { label: '熟练', value: '熟练' },
] as const;

const GOAL_TYPE_LABEL: Record<string, string> = {
  project: '做出一个能交付的项目',
  career: '拿到目标岗位的能力',
  course: '系统学完一套课程',
  exam: '通过一场考试',
  certificate: '拿下一张证书',
  interest: '先把兴趣变成能力',
};

const DEFAULT_DOMAIN_ID = 'ai-native-software';

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const markOnboarded = useAuthStore((state) => state.markOnboarded);

  const [step, setStep] = useState(0);
  const [domains, setDomains] = useState<LearningDomain[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 第 1 步：背景
  const [name, setName] = useState(user?.realName || user?.username || '');
  const [stage, setStage] = useState(STAGES[0].value);
  const [background, setBackground] = useState('');

  // 第 2 步：目标
  const [domainId, setDomainId] = useState(DEFAULT_DOMAIN_ID);
  const [starterPathId, setStarterPathId] = useState('');
  const [dailyHours, setDailyHours] = useState(2);

  // 第 3 步：基础
  const [skillLevels, setSkillLevels] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    studentApi
      .domains()
      .then((list) => {
        if (!alive) return;
        setDomains(list);
        // 优先选中产品聚焦的 AI 原生领域，没有就退回第一个
        const preferred = list.find((item) => item.id === DEFAULT_DOMAIN_ID) || list[0];
        if (preferred) {
          setDomainId(preferred.id);
          setStarterPathId(preferred.starterPaths?.[0]?.id || '');
        }
      })
      .catch((err: any) => {
        if (alive) setLoadError(err?.message || '无法获取学习领域，请确认后端已启动');
      })
      .finally(() => {
        if (alive) setLoadingDomains(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const domain = useMemo(
    () => domains.find((item) => item.id === domainId) || null,
    [domains, domainId],
  );
  const starterPath = useMemo<StarterPath | null>(
    () => domain?.starterPaths?.find((item) => item.id === starterPathId) || domain?.starterPaths?.[0] || null,
    [domain, starterPathId],
  );

  // 起步路线变化时同步 goalType，并把可选能力项铺到第三步
  const abilities = useMemo<LearningAbility[]>(() => {
    if (!starterPath) return [];
    return starterPath.phases.flatMap((phase) => phase.abilities).slice(0, 12);
  }, [starterPath]);

  const canNext = (() => {
    if (step === 0) return name.trim().length > 0 && Boolean(stage);
    if (step === 1) return Boolean(domainId && starterPath?.id);
    return true; // 第 3 步允许一个都不选
  })();

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const skills = Object.entries(skillLevels)
        .filter(([, level]) => Boolean(level))
        .map(([skillName, level]) => ({ name: skillName, level }));

      await studentApi.onboarding({
        name: name.trim(),
        school: '',
        major: background.trim(),
        grade: stage,
        direction: domainId,
        domainId,
        goalType: starterPath?.goalType || 'project',
        starterPathId: starterPath?.id || '',
        goalTitle: starterPath?.title || '',
        dailyHours,
        skills,
      });

      markOnboarded();
      toast.success('画像已建立', `共 ${abilities.length} 个能力项，下一步生成你的专属路径`);
      navigate('/plan/new', {
        replace: true,
        state: { domainId, goalType: starterPath?.goalType, starterPathId: starterPath?.id, dailyHours },
      });
    } catch (err: any) {
      setError(err?.message || '保存画像失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (step < STEP_LABELS.length - 1) {
      setStep((value) => value + 1);
    } else {
      submit();
    }
  };

  return (
    <div className="wizard">
      {/* 深空品牌场景：与 Landing 同一套星空语言 */}
      <div className="space-layer" aria-hidden="true" />
      <div className="landing__stars landing__stars--far" aria-hidden="true" />
      <div className="landing__stars" aria-hidden="true" />
      <div className="landing__nova" aria-hidden="true" />

      <div className="wizard__inner">
        <div className="wizard__brand anim-rise" style={{ ['--d' as any]: '60ms' }}>
          <span className="anim-burst" style={{ ['--d' as any]: '140ms', display: 'inline-flex' }}>
            <Logo size={30} />
          </span>
          CodeNova · 建立你的学习者画像
        </div>

        <Steps items={STEP_LABELS} current={step} />

        <div className="wizard-card anim-rise" style={{ ['--d' as any]: '220ms' }}>
          <header className="wizard-card__head">
            <span className="tag tag--brand" style={{ marginBottom: 10 }}>
              <Sparkles size={11} />
              第 {step + 1} / {STEP_LABELS.length} 步
            </span>
            <h2>
              {step === 0 && '先告诉我们你是谁'}
              {step === 1 && '你想走到哪一步'}
              {step === 2 && '你现在的基础怎么样'}
            </h2>
            <p>
              {step === 0 && '只需要两项必填。说得越具体，后面生成的讲义和实操就越贴你的情况。'}
              {step === 1 && '选一个方向和目标，我们会据此生成分阶段的训练路径。'}
              {step === 2 && '没接触过也没关系 —— 留空就表示从零开始，路径会从第一阶段讲起。'}
            </p>
          </header>

          <div className="wizard-card__body">
            {loadError && <Banner tone="error">{loadError}</Banner>}
            {error && <Banner tone="error">{error}</Banner>}

            {step === 0 && (
              <>
                <Field label="怎么称呼你" required>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例如：林澄"
                  />
                </Field>

                <Field label="你现在处于哪个阶段" required>
                  <div className="choice-grid choice-grid--2">
                    {STAGES.map((item) => (
                      <Choice
                        key={item.value}
                        title={item.value}
                        desc={item.desc}
                        selected={stage === item.value}
                        onClick={() => setStage(item.value)}
                      />
                    ))}
                  </div>
                </Field>

                <Field label="现在主要做什么" hint="选填，比如：前端开发 / 数据分析 / 产品运营">
                  <Input
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                    placeholder="一句话描述你的日常工作或专业"
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                {loadingDomains ? (
                  <div className="empty">
                    <Loader2 size={22} className="btn__spinner" style={{ color: 'var(--brand-600)' }} />
                    <p className="small muted">正在读取可用领域…</p>
                  </div>
                ) : (
                  <>
                    <Field label="训练领域" required>
                      <div className="choice-grid choice-grid--2">
                        {domains.map((item) => (
                          <Choice
                            key={item.id}
                            title={item.name}
                            desc={item.description}
                            selected={domainId === item.id}
                            onClick={() => {
                              setDomainId(item.id);
                              setStarterPathId(item.starterPaths?.[0]?.id || '');
                            }}
                          />
                        ))}
                      </div>
                    </Field>

                    {domain && (
                      <Field
                        label="起步路线"
                        required
                        hint={starterPath ? `目标类型：${GOAL_TYPE_LABEL[starterPath.goalType] || starterPath.goalType}` : undefined}
                      >
                        <div className="choice-grid">
                          {(domain.starterPaths || []).map((item) => (
                            <Choice
                              key={item.id}
                              title={item.title}
                              desc={item.description}
                              selected={starterPathId === item.id}
                              onClick={() => setStarterPathId(item.id)}
                            />
                          ))}
                        </div>
                      </Field>
                    )}

                    {starterPath && (
                      <div className="tip-note">
                        <Info size={14} />
                        <span>
                          这条路线共 {starterPath.phases.length} 个阶段、{abilities.length} 个能力项，
                          按每天 {dailyHours} 小时估算，大约需要{' '}
                          <strong>
                            {Math.max(
                              1,
                              Math.ceil(
                                starterPath.phases.reduce(
                                  (sum, phase) =>
                                    sum + phase.abilities.reduce((acc, item) => acc + item.estimatedMin, 0),
                                  0,
                                ) /
                                  60 /
                                  dailyHours,
                              ),
                            )}
                          </strong>{' '}
                          天。后面随时可以调。
                        </span>
                      </div>
                    )}

                    <Field
                      label="每天能投入多少小时"
                      hint="影响任务拆分粒度，不是硬性约束 —— 跟不上可以调慢"
                    >
                      <div className="row" style={{ gap: 14 }}>
                        <Range value={dailyHours} onChange={setDailyHours} min={0.5} max={8} step={0.5} />
                        <strong style={{ minWidth: 46, textAlign: 'right' }}>{dailyHours} h</strong>
                      </div>
                    </Field>
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                {abilities.length === 0 ? (
                  <Banner tone="warning">没有读到能力项，请返回上一步重新选择起步路线。</Banner>
                ) : (
                  <>
                    <div className="tip-note">
                      <Info size={14} />
                      <span>
                        这一项会写进能力档案，直接影响路径起点。不确定就选「了解」，
                        后面的测验会帮你校准 —— 不用现在就把自己判断得很准。
                      </span>
                    </div>

                    <div className="self-rate">
                      {abilities.map((ability) => (
                        <div className="self-rate__row" key={ability.id}>
                          <span className="self-rate__name">{ability.name}</span>
                          <div className="self-rate__group">
                            {SKILL_LEVELS.map((level) => (
                              <button
                                key={level.label}
                                type="button"
                                className="self-rate__btn"
                                aria-pressed={(skillLevels[ability.name] ?? null) === level.value}
                                onClick={() =>
                                  setSkillLevels((prev) => {
                                    const next = { ...prev };
                                    if (level.value === null) {
                                      delete next[ability.name];
                                    } else {
                                      next[ability.name] = level.value;
                                    }
                                    return next;
                                  })
                                }
                              >
                                {level.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <footer className="wizard-card__foot">
            <Button
              variant="quiet"
              onClick={() => (step === 0 ? navigate('/') : setStep((value) => value - 1))}
              disabled={submitting}
            >
              <ArrowLeft size={15} />
              {step === 0 ? '返回' : '上一步'}
            </Button>

            <div className="row" style={{ gap: 10 }}>
              {step === 2 && (
                <span className="tiny faint">
                  已选 {Object.values(skillLevels).filter(Boolean).length} / {abilities.length} 项
                </span>
              )}
              <Button variant="primary" onClick={next} disabled={!canNext || submitting || loadingDomains}>
                {submitting ? '正在建立画像…' : step === STEP_LABELS.length - 1 ? '建立画像并生成路径' : '下一步'}
                {!submitting && <ArrowRight size={15} />}
              </Button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
