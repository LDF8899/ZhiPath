import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { login, register } from '../api/user';
import {
  IconTarget, IconPath, IconRobot, IconRadar,
  IconDoc, IconBuilding, IconTrendUp, IconCheck,
} from './LandingIcons';
import './landing.css';
import '../styles/hand-draw.css';

/* ──────────────────────────────────────────
   智途 ZhiPath — Landing Page
   Faithfully reproduces zhipath-landing.html
   ────────────────────────────────────────── */

// 简易消息提示
function useLpMessage() {
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timer.current);
    setMsg({ text, type });
    timer.current = setTimeout(() => setMsg(null), 2500);
  }, []);

  const el = msg ? (
    <div className={`lp-message lp-msg-${msg.type}`}>{msg.text}</div>
  ) : null;

  return { el, show };
}

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, isAuthenticated, user } = useAuthStore();
  const { el: msgEl, show: showMsg } = useLpMessage();

  // ── Auth tab state ──
  const [activeTab, setActiveTab] = useState<'register' | 'login'>('register');

  // ── Register form ──
  const [regForm, setRegForm] = useState({ realName: '', username: '', password: '' });
  const [regLoading, setRegLoading] = useState(false);

  // ── Login form ──
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  // 已登录则跳转
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/user/home', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // 从 /login 或 /register 进入时自动滚动到 auth 区域
  useEffect(() => {
    if (location.pathname === '/login' || location.pathname === '/register') {
      // 延迟一帧确保 DOM 已渲染
      requestAnimationFrame(() => {
        document.getElementById('lp-auth')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      if (location.pathname === '/register') setActiveTab('register');
      if (location.pathname === '/login') setActiveTab('login');
    }
  }, [location.pathname]);

  // ── 平滑滚动 ──
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── 注册 ──
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.username || !regForm.password) {
      showMsg('请填写用户名和密码', 'error');
      return;
    }
    if (regForm.password.length < 6) {
      showMsg('密码至少 6 位', 'error');
      return;
    }
    setRegLoading(true);
    try {
      const res = await register({
        username: regForm.username,
        password: regForm.password,
        realName: regForm.realName || undefined,
      });
      if (res.code === 200) {
        showMsg('注册成功，请登录');
        setActiveTab('login');
        setLoginForm({ username: regForm.username, password: '' });
      }
    } catch (err: any) {
      showMsg(err?.message || '注册失败，请稍后重试', 'error');
    } finally {
      setRegLoading(false);
    }
  };

  // ── 登录 ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      showMsg('请填写用户名和密码', 'error');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await login(loginForm.username, loginForm.password);
      if (res.code === 200) {
        const d = res.data;
        const u = {
          id: d.userId,
          username: d.username,
          realName: d.realName,
          phone: '',
          email: '',
          avatar: '',
          role: d.role,
          onboardingCompleted: d.onboardingCompleted,
        };
        setAuth(d.token, u);
        showMsg('登录成功');
        setTimeout(() => {
          if (d.role === 'admin') navigate('/admin/dashboard');
          else if (d.onboardingCompleted) navigate('/user/home');
          else navigate('/onboarding');
        }, 600);
      }
    } catch (err: any) {
      showMsg(err?.message || '登录失败，请稍后重试', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="lp">
      {msgEl}

      {/* ═══ 导航栏 ═══ */}
      <nav className="lp-nav">
        <a className="lp-nav-brand" href="/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <span className="logo-mark">智</span>
          <span>智途</span>
        </a>
        <ul className="lp-nav-links">
          <li><a onClick={() => scrollTo('lp-features')}>核心功能</a></li>
          <li><a onClick={() => scrollTo('lp-pathways')}>学习路径</a></li>
          <li><a onClick={() => scrollTo('lp-testimonials')}>用户评价</a></li>
          <li><a onClick={() => scrollTo('lp-auth')}>登录 / 注册</a></li>
        </ul>
        <a className="lp-nav-cta" onClick={() => scrollTo('lp-auth')}>开始学习</a>
      </nav>

      <div className="lp-landing">
        {/* ═══ Hero ═══ */}
        <section className="lp-hero">
          <div className="lp-hero-content">
            <div className="lp-hero-badge">
              <span className="lp-pulse" />
              AI LEARNING & GROWTH PLATFORM
            </div>
            <h1>
              每个专业，都有一条<br /><em>适合你的学习路径</em>
            </h1>
            <p className="lp-hero-desc">
              面向考试、课程、证书、项目、兴趣与职业发展的 AI 学习平台。从目标诊断到路径规划，从每日学习到能力验证，持续陪你把目标变成真正掌握的能力。
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={() => scrollTo('lp-auth')}>免费注册</button>
              <button className="lp-btn-secondary" onClick={() => scrollTo('lp-features')}>了解更多</button>
            </div>
            <div className="lp-hero-note lp-n1">
              <div className="lp-tape" />
              一个能力档案，连接你的每段学习经历
            </div>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-hero-sketch">
              <div className="lp-sketch-header">
                <div className="lp-sketch-dots">
                  <span /><span /><span />
                </div>
                <div className="lp-sketch-url">zhipath.com / dashboard</div>
              </div>
              <div className="lp-sketch-content">
                <div className="lp-sketch-card">
                  <h3>学习进度</h3>
                  <div className="lp-sketch-lines">
                    <span /><span /><span />
                  </div>
                </div>
                <div className="lp-sketch-card">
                  <h3>能力成长</h3>
                  <div className="lp-sketch-chart">
                    <div className="lp-sketch-bar" style={{ height: '60%' }} />
                    <div className="lp-sketch-bar lp-accent" style={{ height: '85%' }} />
                    <div className="lp-sketch-bar" style={{ height: '45%' }} />
                    <div className="lp-sketch-bar lp-accent" style={{ height: '70%' }} />
                    <div className="lp-sketch-bar" style={{ height: '55%' }} />
                  </div>
                </div>
                <div className="lp-sketch-card">
                  <h3>学习证据</h3>
                  <div className="lp-sketch-lines">
                    <span /><span />
                  </div>
                </div>
                <div className="lp-sketch-card">
                  <h3>今日任务</h3>
                  <div className="lp-sketch-lines">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            </div>
            <div className="lp-hero-note lp-n2">
              <div className="lp-tape" />
              目标、路径、练习与反馈始终连贯
            </div>
          </div>
        </section>

        {/* ═══ 数据统计 ═══ */}
        <section className="lp-stats">
          <div className="lp-stats-grid">
            <div className="lp-stat-card">
              <div className="lp-stat-value">6</div>
              <div className="lp-stat-label">学习目标类型</div>
              <div className="lp-stat-sub">EXAM · COURSE · CAREER · MORE</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-value">1</div>
              <div className="lp-stat-label">持续能力档案</div>
              <div className="lp-stat-sub">EVIDENCE-BASED GROWTH</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-value">24/7</div>
              <div className="lp-stat-label">AI 学习伙伴</div>
              <div className="lp-stat-sub">CONTEXT-AWARE SUPPORT</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-value">∞</div>
              <div className="lp-stat-label">可扩展专业领域</div>
              <div className="lp-stat-sub">DOMAIN PACK ARCHITECTURE</div>
            </div>
          </div>
        </section>

        <div className="lp-section-divider"><div className="lp-line" /></div>

        {/* ═══ 核心功能 ═══ */}
        <section className="lp-features" id="lp-features">
          <div className="lp-section-header">
            <div className="lp-section-tag">CORE FEATURES</div>
            <h2 className="lp-section-title">为什么选择智途？</h2>
            <p className="lp-section-desc">围绕真实目标组织学习，用证据记录每一次成长</p>
          </div>
          <div className="lp-features-grid">
            <div className="lp-feature-card">
              <div className="lp-feature-icon orange"><IconTarget /></div>
              <div className="lp-feature-note">AI 诊断</div>
              <div className="lp-feature-title">目标与起点识别</div>
              <div className="lp-feature-desc">理解你的专业背景、当前水平、目标类型和时间预算，找到真正适合开始的位置。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon green"><IconPath /></div>
              <div className="lp-feature-title">个性化学习路径</div>
              <div className="lp-feature-desc">按领域目标拆分阶段与能力项，核心目标和并行目标独立推进，进度可追溯。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon pink"><IconRobot /></div>
              <div className="lp-feature-note">7×24</div>
              <div className="lp-feature-title">AI 智能辅导员</div>
              <div className="lp-feature-desc">结合你的领域、当前阶段和学习记录答疑，提供讲解、练习、反馈与复盘建议。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon yellow"><IconRadar /></div>
              <div className="lp-feature-title">领域能力画像</div>
              <div className="lp-feature-desc">不同专业使用不同评价维度，同时沉淀可迁移的通用学习能力与成长趋势。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon blue"><IconDoc /></div>
              <div className="lp-feature-title">学习证据沉淀</div>
              <div className="lp-feature-desc">练习结果、作文版本、模拟成绩、项目产物与评估反馈统一进入能力档案。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon purple"><IconBuilding /></div>
              <div className="lp-feature-note">按需延伸</div>
              <div className="lp-feature-title">多目标成长</div>
              <div className="lp-feature-desc">考试、课程、证书、项目、兴趣和职业可以并存，不再用单一岗位定义你的学习。</div>
            </div>
          </div>
        </section>

        <div className="lp-section-divider"><div className="lp-line" /></div>

        {/* ═══ 学习路径 ═══ */}
        <section className="lp-pathways" id="lp-pathways">
          <div className="lp-section-header">
            <div className="lp-section-tag">LEARNING PATHWAYS</div>
            <h2 className="lp-section-title">热门学习路径</h2>
            <p className="lp-section-desc">不同专业使用不同阶段、练习与评价方式</p>
          </div>
          <div className="lp-pathway-cards">
            {/* 英语考试 */}
            <div className="lp-pathway-card">
              <div className="lp-pathway-header">
                <div className="lp-pathway-icon" style={{ background: 'var(--highlight)' }}><IconDoc /></div>
                <div>
                  <div className="lp-pathway-title">大学英语六级 CET-6</div>
                  <div className="lp-pathway-sub">ENGLISH · EXAM</div>
                </div>
              </div>
              <div className="lp-pathway-body">
                <div className="lp-pathway-steps">
                  {[
                    { n: '01', t: '诊断与词汇', d: '识别薄弱项，建立高频词汇语境' },
                    { n: '02', t: '听力与阅读', d: '分项训练、题型策略与限时练习' },
                    { n: '03', t: '写作与翻译', d: '多版本批改，积累表达与翻译方法' },
                    { n: '04', t: '模拟与复盘', d: '全真模拟、错因归类与冲刺调整' },
                  ].map((s) => (
                    <div className="lp-pathway-step" key={s.n}>
                      <div className="lp-step-num">{s.n}</div>
                      <div className="lp-step-content">
                        <div className="lp-step-title">{s.t}</div>
                        <div className="lp-step-desc">{s.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="lp-pathway-tags">
                  <span className="lp-pathway-tag hot">考试</span>
                  <span className="lp-pathway-tag">听力</span>
                  <span className="lp-pathway-tag">写作</span>
                  <span className="lp-pathway-tag">能力证据</span>
                </div>
              </div>
            </div>
            {/* 考研数学 */}
            <div className="lp-pathway-card">
              <div className="lp-pathway-header">
                <div className="lp-pathway-icon" style={{ background: 'var(--note-green)' }}><IconTrendUp /></div>
                <div>
                  <div className="lp-pathway-title">考研数学</div>
                  <div className="lp-pathway-sub">MATHEMATICS · EXAM</div>
                </div>
              </div>
              <div className="lp-pathway-body">
                <div className="lp-pathway-steps">
                  {[
                    { n: '01', t: '基础诊断', d: '按章节识别概念、计算与方法薄弱项' },
                    { n: '02', t: '高数主干', d: '极限、导数、积分与多元函数' },
                    { n: '03', t: '线代与概率', d: '矩阵方法、随机变量与典型题型' },
                    { n: '04', t: '真题与复盘', d: '限时训练、步骤评分与错因归类' },
                  ].map((s) => (
                    <div className="lp-pathway-step" key={s.n}>
                      <div className="lp-step-num">{s.n}</div>
                      <div className="lp-step-content">
                        <div className="lp-step-title">{s.t}</div>
                        <div className="lp-step-desc">{s.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="lp-pathway-tags">
                  <span className="lp-pathway-tag hot">备考</span>
                  <span className="lp-pathway-tag">高等数学</span>
                  <span className="lp-pathway-tag">线性代数</span>
                  <span className="lp-pathway-tag">步骤评价</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-section-divider"><div className="lp-line" /></div>

        {/* ═══ 用户评价 ═══ */}
        <section className="lp-testimonials" id="lp-testimonials">
          <div className="lp-section-header">
            <div className="lp-section-tag">SUCCESS STORIES</div>
            <h2 className="lp-section-title">听听他们怎么说</h2>
            <p className="lp-section-desc">真实用户的真实反馈</p>
          </div>
          <div className="lp-testimonials-grid">
            {[
              { note: '六级突破', quote: '听力和写作不再混在一起刷题。每周的证据和复盘让我知道具体进步在哪里，最后一次模拟终于稳定过线。', avatar: '王', name: '王雪', role: '英语备考 · 大二' },
              { note: '数学提分', quote: '系统把错题按概念、计算和方法重新归类，我第一次能区分“不会”和“做不对”，复习重点终于稳定下来。', avatar: '周', name: '周然', role: '考研数学 · 大三' },
              { note: '项目完成', quote: '我把想做的校园项目拆成了阶段，每次提交都有反馈。最后得到的不只是一个作品，还有一份能说明自己能力的档案。', avatar: '张', name: '张伟', role: '项目实践 · 软件工程' },
            ].map((t) => (
              <div className="lp-testimonial-card" key={t.name}>
                <div className="lp-testimonial-note">{t.note}</div>
                <div className="lp-testimonial-quote">{t.quote}</div>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="lp-testimonial-name">{t.name}</div>
                    <div className="lp-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="lp-section-divider"><div className="lp-line" /></div>

        {/* ═══ 登录注册 ═══ */}
        <section className="lp-auth" id="lp-auth">
          <div className="lp-auth-container">
            {/* 左侧说明 */}
            <div className="lp-auth-left">
              <div className="lp-section-tag">GET STARTED</div>
              <h2 className="lp-auth-title">
                开启你的<br /><em>个性化学习旅程</em>
              </h2>
              <p className="lp-auth-desc">
                从一个真实目标开始，建立学习路径、每日节奏和持续更新的能力档案。
              </p>
              <div className="lp-auth-benefits">
                {[
                  '完整学习路径规划与进度追踪',
                  'AI 智能辅导员 7×24 在线答疑',
                  '领域化练习、评价与复盘反馈',
                  '学习证据与能力趋势持续沉淀',
                  '考试、项目、兴趣与职业目标并行',
                ].map((b) => (
                  <div className="lp-benefit-item" key={b}>
                    <span className="lp-benefit-check"><IconCheck /></span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <div className="lp-auth-note">
                <div className="lp-tape" />
                先完成目标诊断，再开始第一条学习路径
              </div>
            </div>

            {/* 右侧表单卡片 */}
            <div className="lp-auth-card">
              <div className="lp-auth-tabs">
                <button
                  className={`lp-auth-tab ${activeTab === 'register' ? 'lp-active' : ''}`}
                  onClick={() => setActiveTab('register')}
                >
                  注册
                </button>
                <button
                  className={`lp-auth-tab ${activeTab === 'login' ? 'lp-active' : ''}`}
                  onClick={() => setActiveTab('login')}
                >
                  登录
                </button>
              </div>

              {/* ── 注册表单 ── */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegister}>
                  <div className="lp-form-group">
                    <label className="lp-form-label">姓名</label>
                    <input
                      type="text"
                      className="lp-form-input"
                      placeholder="请输入真实姓名（选填）"
                      value={regForm.realName}
                      onChange={(e) => setRegForm({ ...regForm, realName: e.target.value })}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-form-label">用户名</label>
                    <input
                      type="text"
                      className="lp-form-input"
                      placeholder="请输入用户名"
                      value={regForm.username}
                      onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-form-label">密码</label>
                    <input
                      type="password"
                      className="lp-form-input"
                      placeholder="至少 6 位，包含字母和数字"
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="lp-btn-submit" disabled={regLoading}>
                    {regLoading ? '注册中...' : '免费注册'}
                  </button>
                  <div className="lp-form-footer">
                    已有账号？
                    <a className="lp-form-link" onClick={() => setActiveTab('login')}>立即登录</a>
                  </div>
                </form>
              )}

              {/* ── 登录表单 ── */}
              {activeTab === 'login' && (
                <form onSubmit={handleLogin}>
                  <div className="lp-form-group">
                    <label className="lp-form-label">用户名</label>
                    <input
                      type="text"
                      className="lp-form-input"
                      placeholder="请输入用户名"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label className="lp-form-label">密码</label>
                    <input
                      type="password"
                      className="lp-form-input"
                      placeholder="请输入密码"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="lp-btn-submit" disabled={loginLoading}>
                    {loginLoading ? '登录中...' : '登录'}
                  </button>
                  <div className="lp-form-footer">
                    还没有账号？
                    <a className="lp-form-link" onClick={() => setActiveTab('register')}>免费注册</a>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ═══ 页脚 ═══ */}
      <footer className="lp-footer">
        <div className="lp-footer-content">
          <div className="lp-footer-brand">智途 ZhiPath</div>
          <div className="lp-footer-links">
            <a onClick={() => {}}>关于我们</a>
            <a onClick={() => {}}>帮助中心</a>
            <a onClick={() => {}}>隐私政策</a>
            <a onClick={() => {}}>用户协议</a>
            <a onClick={() => {}}>联系我们</a>
          </div>
          <div className="lp-footer-copy">© 2026 ZHIPATH · ALL RIGHTS RESERVED</div>
        </div>
      </footer>
    </div>
  );
}
