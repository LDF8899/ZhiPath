import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Layers3,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { toast } from '../store/toast';
import { Banner, Button, Field, Input, Segmented } from '../components/ui';
import { useStagger } from '../lib/motion';
import { Logo } from '../components/Logo';

type Mode = 'login' | 'register';

const FLOW = [
  {
    icon: <Target size={15} />,
    title: '先看清自己在哪',
    desc: '背景、理论基础、实践能力、目标岗位、可投入时间 —— 五问建立先验画像，不靠猜。',
  },
  {
    icon: <Bot size={15} />,
    title: '多 Agent 接手诊断与生成',
    desc: '学情诊断、领域专家、资源生成、审核纠偏、路径决策五个角色闭环协作，每一步都在你眼前。',
  },
  {
    icon: <Layers3 size={15} />,
    title: '拿到只属于你的资源',
    desc: '定制讲义、实操指南、分阶测试题，全部带知识库溯源，能看见依据，不再是无来由的结论。',
  },
  {
    icon: <LineChart size={15} />,
    title: '做完就反馈，反馈就调整',
    desc: '正确率与学习反馈直接决定下一步：降维解释、补弱巩固，还是进阶挑战。',
  },
];

const TRUST = [
  { icon: <ShieldCheck size={14} />, text: '知识库溯源 · 引用可查' },
  { icon: <Bot size={14} />, text: '多智能体交叉校验' },
  { icon: <Sparkles size={14} />, text: '难度随正确率自适应' },
];

/** hero 标题逐词入场：词间 90ms 级联， blur+rise 揭示 */
function HeroTitle() {
  const words = ['把', 'AI 原生软件开发', '练成', '可验证的', '能力'];
  return (
    <h1>
      {words.map((word, index) => (
        <span
          key={word}
          className={`anim-word ${index === 1 ? 'accent' : ''}`}
          style={{ display: 'inline-block', '--d': `${240 + index * 95}ms`, marginRight: '0.28em' } as React.CSSProperties}
        >
          {word}
        </span>
      ))}
    </h1>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const refresh = useAuthStore((state) => state.refresh);
  const flowRef = useStagger<HTMLDivElement>();

  const [mode, setMode] = useState<Mode>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const name = username.trim();
    if (!name || !password) {
      setError('请填写用户名和密码');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('密码至少 6 位');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        await authApi.register(name, password, realName.trim() || undefined);
        toast.success('注册成功', '正在为你建立学习者画像');
      }

      const result = await authApi.login(name, password);
      setSession(result.token, {
        id: result.userId,
        username: result.username,
        realName: result.realName,
        role: result.role,
        onboardingCompleted: Boolean(result.onboardingCompleted),
      });
      // 立刻拉一次 /me，确保 onboarding 状态和后端一致
      await refresh();
      navigate(result.onboardingCompleted ? '/today' : '/onboarding', { replace: true });
    } catch (err: any) {
      setError(err?.message || (mode === 'register' ? '注册失败' : '登录失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing">
      <section className="landing__left">
        {/* 深空场景：远/近两层星野 + 超新星核心 */}
        <div className="landing__stars landing__stars--far" aria-hidden />
        <div className="landing__stars" aria-hidden />
        <div className="landing__nova" aria-hidden />

        <div className="row anim-fade" style={{ gap: 10, '--d': '80ms' } as React.CSSProperties}>
          <span className="anim-burst" style={{ '--d': '160ms', display: 'inline-flex' } as React.CSSProperties}>
            <Logo size={38} />
          </span>
          <div>
            <div className="brand__name" style={{ fontSize: 15 }}>CodeNova</div>
            <div className="brand__sub">AI 原生能力成长工作台</div>
          </div>
        </div>

        <div className="landing__hero">
          <span className="tag tag--brand anim-rise" style={{ marginBottom: 14, '--d': '320ms' } as React.CSSProperties}>
            <Sparkles size={12} />
            面向垂直领域的技能训练
          </span>
          <HeroTitle />
          <p className="anim-rise" style={{ '--d': '760ms' } as React.CSSProperties}>
            不是又一套课程列表。先诊断你现在的真实水平，再由五个 Agent 协作生成讲义、实操和测试题，
            每一步的依据都能查到来源，做完立刻决定下一步是补弱还是进阶。
          </p>
        </div>

        <div className="landing__flow stagger" ref={flowRef} style={{ '--stagger': '110ms' } as React.CSSProperties}>
          {FLOW.map((item, index) => (
            <div className="landing__flow-item" key={item.title} style={{ animationDelay: `${900 + index * 110}ms` }}>
              <span className="landing__flow-num">{index + 1}</span>
              <span style={{ marginTop: 3 }}>{item.icon}</span>
              <div>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="landing__trust anim-fade" style={{ '--d': '1500ms' } as React.CSSProperties}>
          {TRUST.map((item) => (
            <span className="landing__trust-item" key={item.text}>
              {item.icon}
              {item.text}
            </span>
          ))}
        </div>
      </section>

      <section className="landing__right">
        <div className="landing__stars landing__stars--far" aria-hidden style={{ opacity: 0.35 }} />
        <div className="auth-card anim-rise" style={{ '--d': '420ms' } as React.CSSProperties}>
          <div className="auth-card__head">
            <h2>{mode === 'register' ? '开始训练' : '欢迎回来'}</h2>
            <p>{mode === 'register' ? '注册后先花 1 分钟建立画像，越具体，生成的资源越准。' : '继续上次的训练进度。'}</p>
          </div>

          <div style={{ marginBottom: 18 }}>
            <Segmented
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError(null);
              }}
              options={[
                { value: 'register', label: '注册' },
                { value: 'login', label: '登录' },
              ]}
            />
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && (
              <Field label="怎么称呼你" hint="不填就用用户名">
                <Input
                  value={realName}
                  onChange={(event) => setRealName(event.target.value)}
                  placeholder="例如：林澄"
                  autoComplete="name"
                />
              </Field>
            )}

            <Field label="用户名" required>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="字母或数字，用于登录"
                autoComplete="username"
              />
            </Field>

            <Field label="密码" required hint={mode === 'register' ? '至少 6 位' : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            </Field>

            {error && <Banner tone="error">{error}</Banner>}

            <Button type="submit" variant="primary" size="lg" block loading={busy} magnetic>
              {mode === 'register' ? '注册并开始' : '登录'}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </form>

          <p className="tiny faint center" style={{ marginTop: 14, lineHeight: 1.7 }}>
            首次使用建议直接注册。注册后需要完成一次画像，
            <br />
            之后每次登录都会回到你今天的训练任务。
          </p>
        </div>
      </section>
    </div>
  );
}
