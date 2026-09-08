/**
 * LLM 服务商注册表 — 供"个人中心自选服务商"读写与前端展示共用
 *
 * 用户按预算自选服务商并自带 API Key；平台 env 配置作为兜底。
 * id 保持与 LlmService 的 provider 分支一致。
 */

export interface LlmProviderOption {
  id: string;
  label: string;
  /** 默认官方 base URL（OpenAI 兼容端点，可自定义 baseUrl 覆盖） */
  defaultBaseUrl: string;
  /** 该服务商在 LlmService 里按 tier 用的模型名 */
  models: { flash: string; pro: string; gen?: string };
  /** 给用户看的定位/预算说明 */
  note: string;
  /** 是否需要显式 copy 图标/品牌色（前端用） */
  accent?: string;
}

export const LLM_PROVIDER_OPTIONS: LlmProviderOption[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    models: { flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' },
    note: '性价比高，推理强，适合日常学习与出题。',
    accent: '#4D6BFE',
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: { flash: 'glm-5.2', pro: 'glm-5.3', gen: 'glm-5v-turbo' },
    note: '综合均衡，自带视觉能力，适合图文与视频相关任务。',
    accent: '#6B5BFF',
  },
  {
    id: 'mimo',
    label: '小米 MiMo',
    defaultBaseUrl: 'https://token-plan-ams.xiaomimimo.com/v1',
    models: { flash: 'mimo-v2.5', pro: 'mimo-v2.5-pro' },
    note: '长上下文与推理能力均衡，适合复杂规划和综合分析。',
    accent: '#FF6900',
  },
  {
    id: 'openai',
    label: 'OpenAI 兼容',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: { flash: 'gpt-4o-mini', pro: 'gpt-4o' },
    note: '任意 OpenAI 兼容端点（OpenAI / 硅基流动 / DashScope 等），可自定义 Base URL。',
    accent: '#10A37F',
  },
  {
    id: 'ollama',
    label: '本地 Ollama',
    defaultBaseUrl: 'http://127.0.0.1:11434',
    models: { flash: 'qwen2.5:7b', pro: 'qwen2.5:7b' },
    note: '本地部署，零成本零外发，无需 API Key，适合本地跑通。',
    accent: '#8B5CF6',
  },
];

export const LLM_PROVIDER_IDS = LLM_PROVIDER_OPTIONS.map((p) => p.id);

export function getLlmProvider(id: string): LlmProviderOption | undefined {
  return LLM_PROVIDER_OPTIONS.find((p) => p.id === id);
}
