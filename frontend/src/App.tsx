import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import UserLayout from './layouts/UserLayout'
import AdminLayout from './layouts/AdminLayout'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import PlanCreate from './pages/PlanCreate'
import PlanHub from './pages/PlanHub'

// User pages
import Chat from './pages/user/Chat'
import Dashboard from './pages/user/Dashboard'
import LearningPaths from './pages/user/LearningPaths'
import KnowledgeDetail from './pages/user/KnowledgeDetail'
import Jobs from './pages/user/Jobs'
import JobDetail from './pages/user/JobDetail'
import Exams from './pages/user/Exams'
import ExamTake from './pages/user/ExamTake'
import News from './pages/user/News'
import NewsDetail from './pages/user/NewsDetail'
import Graph from './pages/user/Graph'
import Profile from './pages/user/Profile'
import Projects from './pages/user/Projects'
import Progress from './pages/user/Progress'
import Resume from './pages/user/Resume'
import AgentOffice from './pages/user/AgentOffice'
import QuickTest from './pages/user/QuickTest'
import WrongAnswers from './pages/user/WrongAnswers'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminJobs from './pages/admin/AdminJobs'
import AdminApplications from './pages/admin/AdminApplications'
import AdminEnterprises from './pages/admin/AdminEnterprises'
import AdminNews from './pages/admin/AdminNews'
import AdminExams from './pages/admin/AdminExams'
import AdminQuestions from './pages/admin/AdminQuestions'
import AdminResumes from './pages/admin/AdminResumes'
import AdminSettings from './pages/admin/AdminSettings'

// Global components
import AIFloatingChat from './components/AIFloatingChat'

function ProtectedRoute({ children, role, skipOnboardingCheck }: { children: React.ReactNode; role?: 'admin' | 'student'; skipOnboardingCheck?: boolean }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/" replace />
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/user/home'} replace />
  }
  // 学生未完成 Onboarding → 重定向到引导页
  if (!skipOnboardingCheck && role === 'student' && user?.role === 'student' && !user?.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, user } = useAuthStore()

  return (
    <>
      <Routes>
        {/* Landing page (includes login/register) */}
        <Route path="/" element={isAuthenticated ? <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/user/home'} replace /> : <Landing />} />
        {/* Legacy routes — redirect to landing auth section */}
        <Route path="/login" element={isAuthenticated ? <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/user/home'} replace /> : <Landing />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/user/home'} replace /> : <Landing />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={<ProtectedRoute skipOnboardingCheck><Onboarding /></ProtectedRoute>} />
        {/* Plan creation */}
        <Route path="/plan/create" element={<ProtectedRoute role="student" skipOnboardingCheck><PlanCreate /></ProtectedRoute>} />
        {/* Plan hub — login后计划检测中间页 */}
        <Route path="/user/plan-hub" element={<ProtectedRoute role="student"><PlanHub /></ProtectedRoute>} />

        {/* User routes */}
        <Route path="/user" element={<ProtectedRoute role="student"><UserLayout /></ProtectedRoute>}>
          <Route path="chat" element={<Chat />} />
          <Route path="home" element={<Dashboard />} />
          <Route path="learning" element={<LearningPaths />} />
          <Route path="learning/:pathId" element={<LearningPaths />} />
          <Route path="knowledge/:skill" element={<KnowledgeDetail />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          <Route path="exams" element={<Exams />} />
          <Route path="exams/:id/take" element={<ExamTake />} />
          <Route path="news" element={<News />} />
          <Route path="news/:id" element={<NewsDetail />} />
          <Route path="graph" element={<Graph />} />
          <Route path="profile" element={<Profile />} />
          <Route path="projects" element={<Projects />} />
          <Route path="progress" element={<Progress />} />
          <Route path="resume" element={<Resume />} />
          <Route path="agent-office" element={<AgentOffice />} />
          <Route path="quick-test" element={<QuickTest />} />
          <Route path="wrong-answers" element={<WrongAnswers />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="applications" element={<AdminApplications />} />
          <Route path="enterprises" element={<AdminEnterprises />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="exams" element={<AdminExams />} />
          <Route path="questions" element={<AdminQuestions />} />
          <Route path="resumes" element={<AdminResumes />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* AI floating chat — only for authenticated students */}
      {isAuthenticated && user?.role === 'student' && <AIFloatingChat />}
    </>
  )
}
