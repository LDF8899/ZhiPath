import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { login, register } from '../api/user';
import {
  IconTarget, IconPath, IconRobot, IconRadar,
  IconDoc, IconBuilding, IconCode, IconTrendUp, IconCheck,
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
              STUDENT CAREER PLATFORM
            </div>
            <h1>
              找到你的<em>职业方向</em>，<br />智途陪你走每一步
            </h1>
            <p className="lp-hero-desc">
              基于 AI 的学生职业匹配与学习路径规划平台。从技能评估到岗位推荐，从学习计划到智能辅导——一站式解决你的职业焦虑。
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={() => scrollTo('lp-auth')}>免费注册</button>
              <button className="lp-btn-secondary" onClick={() => scrollTo('lp-features')}>了解更多</button>
            </div>
            <div className="lp-hero-note lp-n1">
              <div className="lp-tape" />
              已帮助 12,000+ 学生找到理想工作
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
                  <h3>技能匹配</h3>
                  <div className="lp-sketch-chart">
                    <div className="lp-sketch-bar" style={{ height: '60%' }} />
                    <div className="lp-sketch-bar lp-accent" style={{ height: '85%' }} />
                    <div className="lp-sketch-bar" style={{ height: '45%' }} />
                    <div className="lp-sketch-bar lp-accent" style={{ height: '70%' }} />
                    <div className="lp-sketch-bar" style={{ height: '55%' }} />
                  </div>
                </div>
                <div className="lp-sketch-card">
                  <h3>岗位推荐</h3>
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
              智能推荐准确率 92%
            </div>
          </div>
        </section>

        {/* ═══ 数据统计 ═══ */}
        <section className="lp-stats">
          <div className="lp-stats-grid">
            <div className="lp-stat-card">
              <div className="lp-stat-value">12K+</div>
              <div className="lp-stat-label">注册学生</div>
              <div className="lp-stat-sub">ACROSS 200+ UNIVERSITIES</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-value">89%</div>
              <div className="lp-stat-label">匹配成功率</div>
              <div className="lp-stat-sub">WITHIN 30 DAYS</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-value">500+</div>
              <div className="lp-stat-label">合作企业</div>
              <div className="lp-stat-sub">FORTUNE 500 INCLUDED</div>
            </div>
            <div className="lp-stat-card">
              <div className="lp-stat-value">2.5x</div>
              <div className="lp-stat-label">面试通过率提升</div>
              <div className="lp-stat-sub">VS TRADITIONAL APPROACH</div>
            </div>
          </div>
        </section>

        <div className="lp-section-divider"><div className="lp-line" /></div>

        {/* ═══ 核心功能 ═══ */}
        <section className="lp-features" id="lp-features">
          <div className="lp-section-header">
            <div className="lp-section-tag">CORE FEATURES</div>
            <h2 className="lp-section-title">为什么选择智途？</h2>
            <p className="lp-section-desc">我们不只是一个学习平台，而是你的职业规划伙伴</p>
          </div>
          <div className="lp-features-grid">
            <div className="lp-feature-card">
              <div className="lp-feature-icon orange"><IconTarget /></div>
              <div className="lp-feature-note">AI 驱动</div>
              <div className="lp-feature-title">智能岗位匹配</div>
              <div className="lp-feature-desc">基于你的技能、兴趣和学习轨迹，AI 实时推荐最适合的岗位方向，匹配度持续优化。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon green"><IconPath /></div>
              <div className="lp-feature-title">个性化学习路径</div>
              <div className="lp-feature-desc">Git 分支式学习规划，主线目标岗位技能，支线兴趣拓展，比例可调，进度可追溯。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon pink"><IconRobot /></div>
              <div className="lp-feature-note">7×24</div>
              <div className="lp-feature-title">AI 智能辅导员</div>
              <div className="lp-feature-desc">随时解答学习疑问，提供代码审查，模拟面试场景，像真人导师一样陪伴你的成长。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon yellow"><IconRadar /></div>
              <div className="lp-feature-title">技能雷达图</div>
              <div className="lp-feature-desc">可视化你的技能掌握度，清晰看到优势与短板，针对性提升核心竞争力。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon blue"><IconDoc /></div>
              <div className="lp-feature-title">智能简历生成</div>
              <div className="lp-feature-desc">基于学习成果和项目经验，自动生成专业简历，一键投递心仪岗位。</div>
            </div>
            <div className="lp-feature-card">
              <div className="lp-feature-icon purple"><IconBuilding /></div>
              <div className="lp-feature-note">500+</div>
              <div className="lp-feature-title">企业直连</div>
              <div className="lp-feature-desc">与 500+ 知名企业建立人才通道，实习、校招、内推机会实时同步。</div>
            </div>
          </div>
        </section>

        <div className="lp-section-divider"><div className="lp-line" /></div>

        {/* ═══ 学习路径 ═══ */}
        <section className="lp-pathways" id="lp-pathways">
          <div className="lp-section-header">
            <div className="lp-section-tag">LEARNING PATHWAYS</div>
            <h2 className="lp-section-title">热门学习路径</h2>
            <p className="lp-section-desc">从零基础到 offer 收割，每一步都有规划</p>
          </div>
          <div className="lp-pathway-cards">
            {/* 前端开发 */}
            <div className="lp-pathway-card">
              <div className="lp-pathway-header">
                <div className="lp-pathway-icon" style={{ background: 'var(--highlight)' }}><IconCode /></div>
                <div>
                  <div className="lp-pathway-title">前端开发工程师</div>
                  <div className="lp-pathway-sub">FRONTEND DEVELOPER</div>
                </div>
              </div>
              <div className="lp-pathway-body">
                <div className="lp-pathway-steps">
                  {[
                    { n: '01', t: 'HTML + CSS 基础', d: '掌握网页结构与样式，响应式布局' },
                    { n: '02', t: 'JavaScript 核心', d: 'ES6+、DOM 操作、异步编程' },
                    { n: '03', t: 'React / Vue 框架', d: '组件化开发、状态管理、路由' },
                    { n: '04', t: '项目实战 + 面试', d: '真实项目经验、简历优化、模拟面试' },
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
                  <span className="lp-pathway-tag hot">热门</span>
                  <span className="lp-pathway-tag">React</span>
                  <span className="lp-pathway-tag">TypeScript</span>
                  <span className="lp-pathway-tag">4-6 个月</span>
                </div>
              </div>
            </div>
            {/* 数据分析 */}
            <div className="lp-pathway-card">
              <div className="lp-pathway-header">
                <div className="lp-pathway-icon" style={{ background: 'var(--note-green)' }}><IconTrendUp /></div>
                <div>
                  <div className="lp-pathway-title">数据分析师</div>
                  <div className="lp-pathway-sub">DATA ANALYST</div>
                </div>
              </div>
              <div className="lp-pathway-body">
                <div className="lp-pathway-steps">
                  {[
                    { n: '01', t: 'Python 基础', d: '语法、数据结构、Pandas 入门' },
                    { n: '02', t: 'SQL 数据库', d: '查询优化、数据建模、实战练习' },
                    { n: '03', t: '数据可视化', d: 'Matplotlib、Tableau、BI 工具' },
                    { n: '04', t: '业务分析实战', d: '真实数据集、案例研究、报告撰写' },
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
                  <span className="lp-pathway-tag hot">高薪</span>
                  <span className="lp-pathway-tag">Python</span>
                  <span className="lp-pathway-tag">SQL</span>
                  <span className="lp-pathway-tag">3-5 个月</span>
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
              { note: '已入职字节', quote: '智途的学习路径规划太棒了！从零基础到拿到字节跳动前端 offer，只用了 5 个月。AI 辅导员帮我解决了无数技术问题。', avatar: '李', name: '李明', role: '前端开发 · 2025 届' },
              { note: '转行成功', quote: '作为文科生转行数据分析，智途的路径规划让我少走了很多弯路。技能雷达图帮我清晰看到需要提升的地方。', avatar: '王', name: '王雪', role: '数据分析师 · 2025 届' },
              { note: '3 个 offer', quote: '智能简历生成功能太实用了！一键生成针对不同岗位的简历，投递效率提升 3 倍。最终拿到 3 个心仪公司的 offer。', avatar: '张', name: '张伟', role: 'Java 后端 · 2024 届' },
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
                开启你的<br /><em>职业成长之旅</em>
              </h2>
              <p className="lp-auth-desc">
                注册即可获得完整的学习路径规划、AI 辅导员、技能评估等核心功能。完全免费，无隐藏费用。
              </p>
              <div className="lp-auth-benefits">
                {[
                  '完整学习路径规划与进度追踪',
                  'AI 智能辅导员 7×24 在线答疑',
                  '技能雷达图与岗位匹配分析',
                  '500+ 企业实习与校招机会',
                  '智能简历生成与优化建议',
                ].map((b) => (
                  <div className="lp-benefit-item" key={b}>
                    <span className="lp-benefit-check"><IconCheck /></span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              <div className="lp-auth-note">
                <div className="lp-tape" />
                注册即送 7 天 VIP 体验，解锁全部高级功能
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
