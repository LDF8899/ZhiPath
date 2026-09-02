import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { Toaster } from './components/ui';
import { useAuthStore } from './store/auth';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import PlanCreate from './pages/PlanCreate';
import Today from './pages/Today';
import Paths from './pages/Paths';
import SkillStudio from './pages/SkillStudio';
import Coach from './pages/Coach';
import Resources from './pages/Resources';
import Agents from './pages/Agents';
import Report from './pages/Report';
import QuestionGenerator from './pages/QuestionGenerator';
import Remediation from './pages/Remediation';
import Exams from './pages/Exams';
import Knowledge from './pages/Knowledge';
import Profile from './pages/Profile';

function BootGate({ children }: { children: ReactNode }) {
  const ready = useAuthStore((state) => state.ready);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div className="col" style={{ alignItems: 'center', gap: 12 }}>
          <Loader2 size={24} className="btn__spinner" style={{ color: 'var(--brand-600)', borderWidth: 2.5 }} />
          <span className="small muted">正在恢复会话…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * 受保护路由
 *
 * 分流的唯一依据是 onboardingCompleted —— 和后端 login 返回值保持一致，
 * 不在前端另存一份"是否完成画像"的状态。
 */
function ProtectedRoute({ skipOnboardingCheck = false }: { skipOnboardingCheck?: boolean }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!token || !user) return <Navigate to="/" replace state={{ from: location.pathname }} />;

  if (!skipOnboardingCheck && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  if (token && user) {
    return <Navigate to={user.onboardingCompleted ? '/today' : '/onboarding'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BootGate>
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnly>
              <Landing />
            </PublicOnly>
          }
        />

        {/* 画像与建计划：已登录但画像未完成时也必须能进 */}
        <Route element={<ProtectedRoute skipOnboardingCheck />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/plan/new" element={<PlanCreate />} />
        </Route>

        {/* 工作台：要求已完成画像，套在工作台外壳里 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/today" element={<Today />} />
            <Route path="/path" element={<Paths />} />
            <Route path="/skill/:skill" element={<SkillStudio />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/questions" element={<QuestionGenerator />} />
            <Route path="/exams" element={<Exams />} />
            <Route path="/remediation" element={<Remediation />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/report" element={<Report />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BootGate>
  );
}
