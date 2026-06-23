/**
 * 学习计划模板 — 方向 → 阶段 → 技能点
 * MVP 版本：基于预定义模板生成，后续迭代接入 LLM
 */

export interface SkillTemplate {
  name: string;
  estimatedMin: number;   // 预估学习时长（分钟）
  priority: number;       // 1-10
}

export interface PhaseTemplate {
  name: string;
  skills: SkillTemplate[];
}

export interface PlanTemplate {
  direction: string;
  planName: string;
  targetJobTitle: string;  // 用于匹配 job_positions_v3
  phases: PhaseTemplate[];
  estimatedDays: number;   // 预估总天数
}

/** 8 个方向的学习计划模板 */
export const PLAN_TEMPLATES: Record<string, PlanTemplate> = {
  frontend: {
    direction: 'frontend',
    planName: '前端开发学习计划',
    targetJobTitle: '前端开发工程师',
    estimatedDays: 90,
    phases: [
      {
        name: '阶段1：HTML/CSS/JavaScript 基础',
        skills: [
          { name: 'HTML/CSS', estimatedMin: 180, priority: 9 },
          { name: 'JavaScript 基础', estimatedMin: 240, priority: 9 },
          { name: 'DOM 操作', estimatedMin: 120, priority: 7 },
          { name: 'ES6+ 特性', estimatedMin: 150, priority: 8 },
        ],
      },
      {
        name: '阶段2：React + TypeScript',
        skills: [
          { name: 'React 基础', estimatedMin: 240, priority: 9 },
          { name: 'React Hooks', estimatedMin: 180, priority: 8 },
          { name: 'TypeScript', estimatedMin: 200, priority: 8 },
          { name: 'React Router', estimatedMin: 90, priority: 6 },
        ],
      },
      {
        name: '阶段3：工程化 + 项目实战',
        skills: [
          { name: 'Webpack/Vite', estimatedMin: 120, priority: 6 },
          { name: 'Git 工作流', estimatedMin: 90, priority: 7 },
          { name: '前端测试', estimatedMin: 120, priority: 5 },
          { name: '性能优化', estimatedMin: 150, priority: 5 },
        ],
      },
    ],
  },

  backend: {
    direction: 'backend',
    planName: '后端开发学习计划',
    targetJobTitle: '后端开发工程师',
    estimatedDays: 90,
    phases: [
      {
        name: '阶段1：Java 基础 + 数据库',
        skills: [
          { name: 'Java 基础', estimatedMin: 240, priority: 9 },
          { name: 'SQL 基础', estimatedMin: 180, priority: 9 },
          { name: 'MySQL', estimatedMin: 150, priority: 8 },
          { name: 'Linux 基础', estimatedMin: 120, priority: 7 },
        ],
      },
      {
        name: '阶段2：Spring Boot 框架',
        skills: [
          { name: 'Spring Boot', estimatedMin: 300, priority: 9 },
          { name: 'MyBatis', estimatedMin: 150, priority: 7 },
          { name: 'Redis', estimatedMin: 120, priority: 7 },
          { name: 'RESTful API 设计', estimatedMin: 90, priority: 8 },
        ],
      },
      {
        name: '阶段3：微服务 + 部署',
        skills: [
          { name: 'Docker', estimatedMin: 120, priority: 7 },
          { name: '消息队列', estimatedMin: 150, priority: 6 },
          { name: '微服务架构', estimatedMin: 180, priority: 5 },
          { name: 'CI/CD', estimatedMin: 90, priority: 5 },
        ],
      },
    ],
  },

  fullstack: {
    direction: 'fullstack',
    planName: '全栈开发学习计划',
    targetJobTitle: '全栈开发工程师',
    estimatedDays: 120,
    phases: [
      {
        name: '阶段1：前端基础',
        skills: [
          { name: 'HTML/CSS', estimatedMin: 150, priority: 8 },
          { name: 'JavaScript', estimatedMin: 200, priority: 9 },
          { name: 'React', estimatedMin: 240, priority: 9 },
        ],
      },
      {
        name: '阶段2：后端基础',
        skills: [
          { name: 'Node.js', estimatedMin: 200, priority: 9 },
          { name: 'Express/Koa', estimatedMin: 150, priority: 7 },
          { name: 'MongoDB', estimatedMin: 120, priority: 7 },
          { name: 'SQL 基础', estimatedMin: 120, priority: 7 },
        ],
      },
      {
        name: '阶段3：全栈进阶',
        skills: [
          { name: 'TypeScript', estimatedMin: 180, priority: 8 },
          { name: 'Docker', estimatedMin: 120, priority: 7 },
          { name: 'Git 工作流', estimatedMin: 90, priority: 7 },
          { name: '项目部署', estimatedMin: 120, priority: 6 },
        ],
      },
    ],
  },

  mobile: {
    direction: 'mobile',
    planName: '移动端开发学习计划',
    targetJobTitle: '前端开发工程师',
    estimatedDays: 90,
    phases: [
      {
        name: '阶段1：基础准备',
        skills: [
          { name: 'JavaScript', estimatedMin: 200, priority: 9 },
          { name: 'TypeScript', estimatedMin: 180, priority: 8 },
          { name: 'React 基础', estimatedMin: 200, priority: 9 },
        ],
      },
      {
        name: '阶段2：React Native',
        skills: [
          { name: 'React Native', estimatedMin: 300, priority: 9 },
          { name: '移动端 UI 组件', estimatedMin: 150, priority: 7 },
          { name: '移动端调试', estimatedMin: 90, priority: 6 },
        ],
      },
      {
        name: '阶段3：进阶 + 发布',
        skills: [
          { name: '原生模块集成', estimatedMin: 150, priority: 6 },
          { name: '性能优化', estimatedMin: 120, priority: 5 },
          { name: 'App 发布流程', estimatedMin: 90, priority: 5 },
        ],
      },
    ],
  },

  ai: {
    direction: 'ai',
    planName: 'AI/机器学习学习计划',
    targetJobTitle: 'AI工程师',
    estimatedDays: 120,
    phases: [
      {
        name: '阶段1：Python + 数学基础',
        skills: [
          { name: 'Python 基础', estimatedMin: 200, priority: 9 },
          { name: 'NumPy/Pandas', estimatedMin: 150, priority: 8 },
          { name: '线性代数基础', estimatedMin: 120, priority: 7 },
          { name: '概率统计基础', estimatedMin: 120, priority: 7 },
        ],
      },
      {
        name: '阶段2：机器学习',
        skills: [
          { name: '机器学习基础', estimatedMin: 240, priority: 9 },
          { name: 'Scikit-learn', estimatedMin: 150, priority: 7 },
          { name: '特征工程', estimatedMin: 120, priority: 6 },
        ],
      },
      {
        name: '阶段3：深度学习',
        skills: [
          { name: '深度学习基础', estimatedMin: 240, priority: 8 },
          { name: 'PyTorch', estimatedMin: 200, priority: 8 },
          { name: 'NLP 基础', estimatedMin: 150, priority: 6 },
        ],
      },
    ],
  },

  data: {
    direction: 'data',
    planName: '数据分析学习计划',
    targetJobTitle: 'Python开发工程师',
    estimatedDays: 90,
    phases: [
      {
        name: '阶段1：Python + SQL',
        skills: [
          { name: 'Python 基础', estimatedMin: 200, priority: 9 },
          { name: 'SQL 基础', estimatedMin: 180, priority: 9 },
          { name: 'Pandas', estimatedMin: 150, priority: 8 },
        ],
      },
      {
        name: '阶段2：数据分析技能',
        skills: [
          { name: '数据可视化', estimatedMin: 150, priority: 8 },
          { name: '统计分析', estimatedMin: 150, priority: 7 },
          { name: 'Excel/数据处理', estimatedMin: 90, priority: 6 },
        ],
      },
      {
        name: '阶段3：进阶工具',
        skills: [
          { name: '机器学习基础', estimatedMin: 180, priority: 6 },
          { name: '数据仓库', estimatedMin: 120, priority: 5 },
          { name: 'BI 工具', estimatedMin: 90, priority: 5 },
        ],
      },
    ],
  },

  devops: {
    direction: 'devops',
    planName: 'DevOps 学习计划',
    targetJobTitle: '后端开发工程师',
    estimatedDays: 90,
    phases: [
      {
        name: '阶段1：Linux + 网络',
        skills: [
          { name: 'Linux 基础', estimatedMin: 180, priority: 9 },
          { name: 'Shell 脚本', estimatedMin: 120, priority: 8 },
          { name: '计算机网络', estimatedMin: 150, priority: 7 },
        ],
      },
      {
        name: '阶段2：容器化',
        skills: [
          { name: 'Docker', estimatedMin: 180, priority: 9 },
          { name: 'Docker Compose', estimatedMin: 120, priority: 7 },
          { name: 'Kubernetes 基础', estimatedMin: 200, priority: 7 },
        ],
      },
      {
        name: '阶段3：CI/CD + 监控',
        skills: [
          { name: 'CI/CD 流水线', estimatedMin: 150, priority: 8 },
          { name: '监控与日志', estimatedMin: 120, priority: 6 },
          { name: '云服务基础', estimatedMin: 120, priority: 5 },
        ],
      },
    ],
  },

  design: {
    direction: 'design',
    planName: 'UI/UX 设计学习计划',
    targetJobTitle: '前端开发工程师',
    estimatedDays: 75,
    phases: [
      {
        name: '阶段1：设计基础',
        skills: [
          { name: '设计原理', estimatedMin: 150, priority: 9 },
          { name: 'Figma', estimatedMin: 200, priority: 9 },
          { name: '色彩理论', estimatedMin: 90, priority: 7 },
        ],
      },
      {
        name: '阶段2：前端实现',
        skills: [
          { name: 'HTML/CSS', estimatedMin: 180, priority: 8 },
          { name: 'JavaScript 基础', estimatedMin: 150, priority: 7 },
          { name: '响应式设计', estimatedMin: 120, priority: 7 },
        ],
      },
      {
        name: '阶段3：进阶',
        skills: [
          { name: '设计系统', estimatedMin: 120, priority: 6 },
          { name: '用户研究', estimatedMin: 90, priority: 5 },
          { name: '交互设计', estimatedMin: 120, priority: 5 },
        ],
      },
    ],
  },
};

/** 获取方向对应的模板，fallback 到 frontend */
export function getPlanTemplate(direction: string): PlanTemplate {
  return PLAN_TEMPLATES[direction] || PLAN_TEMPLATES['frontend'];
}
