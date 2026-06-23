import type { DashboardData, Job, LearningPath, ChatSession, UserProfile } from '../types';

/** Mock 用户 */
export const mockUser = {
  id: 1,
  username: 'zhangsan',
  realName: '张三',
  phone: '13800138000',
  email: 'zhangsan@example.com',
  avatar: '',
  role: 'student' as const,
  onboardingCompleted: true,
};

/** Mock Dashboard */
export const mockDashboard: DashboardData = {
  student: {
    id: 1, userId: 1, name: '张三', studentNo: '2023001',
    major: '软件工程', grade: '大三', targetJobId: 5,
    skills: [
      { name: 'JavaScript', level: '熟悉' },
      { name: 'HTML/CSS', level: '精通' },
      { name: 'Python', level: '了解' },
    ],
    projects: [], onboardingCompleted: 1,
  },
  targetJob: {
    id: 5, title: '前端开发工程师', company: '腾讯科技',
    location: '深圳', salaryRange: '15-25K', level: 'mid',
    requiredSkills: [{ name: 'JavaScript' }, { name: 'React' }, { name: 'TypeScript' }],
    preferredSkills: [{ name: 'Vue' }, { name: 'Node.js' }, { name: 'Webpack' }],
    matchScore: 65, deliveryThreshold: 60, source: 'manual',
  },
  learningPath: {
    id: 1, userId: 1, targetJobId: 5, currentPhase: 1,
    matchScore: 65, estimatedDate: '2026-09',
    pathData: {
      phases: [
        {
          name: '基础阶段', status: 'done',
          skills: [
            { name: 'HTML/CSS', status: 'done', duration: '2周' },
            { name: 'JavaScript 基础', status: 'done', duration: '3周' },
            { name: 'Git 版本控制', status: 'done', duration: '1周' },
          ],
        },
        {
          name: '进阶阶段',
          skills: [
            { name: 'React', status: 'done', duration: '4周' },
            { name: 'TypeScript', status: 'pending', duration: '3周' },
            { name: '状态管理', status: 'pending', duration: '2周' },
          ],
        },
        {
          name: '实战阶段',
          skills: [
            { name: 'Node.js', status: 'pending', duration: '3周' },
            { name: 'Webpack/Vite', status: 'pending', duration: '2周' },
            { name: '项目实战', status: 'pending', duration: '4周' },
          ],
        },
      ],
    },
    status: 1, createTime: Date.now(),
  },
  stats: { totalSkills: 20, doneSkills: 8, examCount: 3, jobCount: 12 },
  todayTasks: [
    { title: 'TypeScript 泛型', phase: '进阶阶段', duration: '45分钟', status: 'pending' },
    { title: 'TypeScript 类型体操', phase: '进阶阶段', duration: '30分钟', status: 'pending' },
    { title: 'React Hooks 复习', phase: '进阶阶段', duration: '20分钟', status: 'done' },
  ],
  recentNews: [
    { id: 1, title: '2026年前端开发趋势：AI驱动的UI生成', content: '', image: '', type: 'tech', source: '掘金', sourceUrl: '', publishTime: Date.now() },
    { id: 2, title: '腾讯2026校招前端岗位开放申请', content: '', image: '', type: 'recruit', source: '牛客', sourceUrl: '', publishTime: Date.now() - 86400000 },
    { id: 3, title: 'React 20 发布：Server Components 正式稳定', content: '', image: '', type: 'industry', source: 'InfoQ', sourceUrl: '', publishTime: Date.now() - 172800000 },
  ],
};

/** Mock 岗位列表 */
export const mockJobs: Job[] = [
  { id: 1, title: '前端开发工程师', company: '腾讯科技', location: '深圳', salaryRange: '15-25K', level: 'mid', requiredSkills: [{ name: 'JavaScript' }, { name: 'React' }, { name: 'TypeScript' }], preferredSkills: [{ name: 'Vue' }, { name: 'Node.js' }], matchScore: 85, deliveryThreshold: 60, source: 'manual' },
  { id: 2, title: 'Web 前端工程师', company: '阿里巴巴', location: '杭州', salaryRange: '18-30K', level: 'mid', requiredSkills: [{ name: 'JavaScript' }, { name: 'React' }, { name: 'CSS' }], preferredSkills: [{ name: '微前端' }, { name: 'SSR' }], matchScore: 78, deliveryThreshold: 60, source: 'manual' },
  { id: 3, title: '全栈开发工程师', company: '字节跳动', location: '北京', salaryRange: '20-35K', level: 'senior', requiredSkills: [{ name: 'JavaScript' }, { name: 'React' }, { name: 'Node.js' }], preferredSkills: [{ name: 'Go' }, { name: 'Python' }], matchScore: 72, deliveryThreshold: 60, source: 'manual' },
  { id: 4, title: 'React Native 开发', company: '美团', location: '北京', salaryRange: '18-28K', level: 'mid', requiredSkills: [{ name: 'React Native' }, { name: 'JavaScript' }, { name: 'TypeScript' }], preferredSkills: [{ name: 'iOS' }, { name: 'Android' }], matchScore: 68, deliveryThreshold: 60, source: 'manual' },
  { id: 5, title: '前端开发实习生', company: '网易', location: '杭州', salaryRange: '8-12K', level: 'junior', requiredSkills: [{ name: 'HTML' }, { name: 'CSS' }, { name: 'JavaScript' }], preferredSkills: [{ name: 'React' }, { name: 'Vue' }], matchScore: 92, deliveryThreshold: 40, source: 'manual' },
  { id: 6, title: '大模型应用前端开发', company: '百度', location: '北京', salaryRange: '22-38K', level: 'senior', requiredSkills: [{ name: 'JavaScript' }, { name: 'React' }, { name: 'TypeScript' }], preferredSkills: [{ name: 'AI/LLM' }, { name: 'WebSocket' }], matchScore: 65, deliveryThreshold: 60, source: 'manual' },
];

/** Mock 学习路径 */
export const mockPaths: LearningPath[] = [
  {
    id: 1, userId: 1, targetJobId: 5, currentPhase: 1,
    matchScore: 65, estimatedDate: '2026-09', status: 1, createTime: Date.now(),
    pathData: {
      phases: [
        {
          name: '基础阶段', status: 'done',
          skills: [
            { name: 'HTML/CSS', status: 'done', duration: '2周' },
            { name: 'JavaScript 基础', status: 'done', duration: '3周' },
            { name: 'Git 版本控制', status: 'done', duration: '1周' },
          ],
        },
        {
          name: '进阶阶段',
          skills: [
            { name: 'React', status: 'done', duration: '4周' },
            { name: 'TypeScript', status: 'pending', duration: '3周' },
            { name: '状态管理 (Zustand)', status: 'pending', duration: '2周' },
          ],
        },
        {
          name: '高级阶段',
          skills: [
            { name: 'Node.js', status: 'pending', duration: '3周' },
            { name: 'Webpack/Vite', status: 'pending', duration: '2周' },
            { name: '测试 (Jest)', status: 'pending', duration: '2周' },
          ],
        },
        {
          name: '实战阶段',
          skills: [
            { name: '项目实战', status: 'pending', duration: '4周' },
            { name: '简历优化', status: 'pending', duration: '1周' },
            { name: '面试准备', status: 'pending', duration: '2周' },
          ],
        },
      ],
    },
  },
];

/** Mock 用户画像 */
export const mockProfile: UserProfile = {
  userId: 1, name: '张三', studentNo: '2023001',
  major: '软件工程', grade: '大三', targetJobId: 5,
  onboardingCompleted: 1, profileVersion: 5,
  skills: [
    { name: 'JavaScript', level: '熟悉', source: 'onboarding' },
    { name: 'HTML/CSS', level: '精通', source: 'onboarding' },
    { name: 'Python', level: '了解', source: 'onboarding' },
    { name: 'React', level: '熟悉', source: 'chat' },
  ],
  projects: [
    {
      name: 'ZhiPath', description: '人岗匹配系统', role: '核心开发者',
      tech: ['React', 'FastAPI', 'Neo4j'], time: '2025.09 - 至今',
      githubUrl: 'https://github.com/xxx/zhpath', highlights: ['多Agent架构', '知识图谱可视化'],
    },
  ],
  traits: {
    interests: ['前端开发', 'UI设计', 'AI 应用'],
    strengths: ['学习能力强', '逻辑思维好', '团队协作'],
    weaknesses: ['算法薄弱', '项目经验少'],
  },
  chatInsights: [
    { content: '用户提到最近在学 Docker', source: 'chat', extractedAt: Date.now() },
    { content: '对 React 生态比较感兴趣', source: 'chat', extractedAt: Date.now() - 86400000 },
  ],
  goals: { targetJobTitle: '前端开发工程师', direction: '前端' },
};

/** Mock 对话会话 */
export const mockChatSessions: ChatSession[] = [
  {
    sessionId: 'session-1', userId: '1', pageContext: 'chat',
    createdAt: Date.now() - 3600000, updatedAt: Date.now(),
    messages: [
      { role: 'user', content: '推荐一些适合我的前端岗位', timestamp: Date.now() - 300000 },
      { role: 'assistant', content: '根据你的画像，我为你找到了几个匹配度较高的前端岗位：', agent: 'chat', timestamp: Date.now() - 290000, actions: [
        { type: 'jobs', data: [
          { id: 1, title: '前端开发工程师', company: '腾讯科技', matchScore: 85 },
          { id: 2, title: 'Web 前端工程师', company: '阿里巴巴', matchScore: 78 },
        ]},
      ]},
      { role: 'user', content: '腾讯这个看起来不错，设为目标吧', timestamp: Date.now() - 200000 },
      { role: 'assistant', content: '好的！已将「前端开发工程师 - 腾讯科技」设为你的目标岗位。我会根据这个岗位的要求为你规划学习路径。', agent: 'chat', timestamp: Date.now() - 190000, actions: [
        { type: 'target_set', data: { jobId: 1, jobTitle: '前端开发工程师 - 腾讯科技' } },
      ]},
    ],
  },
  {
    sessionId: 'session-2', userId: '1', pageContext: 'chat',
    createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000,
    messages: [
      { role: 'user', content: '帮我制定一个学习计划', timestamp: Date.now() - 86400000 },
      { role: 'assistant', content: '正在为你生成学习路径...', agent: 'chat', timestamp: Date.now() - 86400000 + 1000, actions: [
        { type: 'path_generating', data: { task_id: 'task-123', message: '路径生成中，预计需要 30 秒' } },
      ]},
    ],
  },
];

/** 快捷操作 */
export const quickActions = [
  { label: '今天学什么', icon: '📚', prompt: '今天学什么' },
  { label: '推荐岗位', icon: '💼', prompt: '推荐适合我的岗位' },
  { label: '学习路径', icon: '🗺️', prompt: '查看我的学习路径' },
  { label: '出几道题', icon: '📝', prompt: '出几道 React 题' },
  { label: '匹配度分析', icon: '📊', prompt: '我的匹配度怎么样' },
  { label: '学习资源', icon: '🔗', prompt: '推荐学习资源' },
];
