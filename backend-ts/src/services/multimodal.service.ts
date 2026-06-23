import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { XunfeiAvatarService } from './xunfei-avatar.service';

/**
 * 多模态资源生成 Agent — T5 多模态智能体
 *
 * 四种模态：
 *   - animation：LLM 生成自包含 HTML 动画演示（DeepSeek，同步可用）
 *   - diagram：LLM 生成 Mermaid 图表源码（DeepSeek，同步可用）
 *   - video：智谱 CogVideoX 短视频（需 ZHIPU_API_KEY，缺失则优雅降级）
 *   - avatar：讯飞数字人讲解（需 XFYUN_* key，缺失则优雅降级）
 *
 * 设计约束（对齐宪法 §20.1 / DEVELOPMENT_GUIDELINES）：
 *   所有返回数据用单 token 字段名（html/mermaid/url/title/skill/status/text/poster/script），
 *   这样无论走 chat 路径（前端 snakeToCamel 转换）还是直连端点（不转换），
 *   同一个前端组件都能正确读取字段，避免 snake/camel 不一致导致白屏。
 *
 * 生成结果持久化到 MongoDB knowledge_base（全平台复用，对齐宪法 §3.3）。
 */
@Injectable()
export class MultimodalService {
  private readonly logger = new Logger(MultimodalService.name);

  constructor(
    private config: ConfigService,
    private llmService: LlmService,
    private knowledgeBase: KnowledgeBaseService,
    private xunfeiAvatar: XunfeiAvatarService,
  ) {}

  // ── 1. HTML 动画演示（LLM 同步生成） ──────────────────────────

  /**
   * 生成自包含 HTML 动画演示。
   * 返回 { type:'animation', data:{ skill, title, html, status:'ready' } }
   */
  async generateAnimation(skill: string, difficulty = 'beginner'): Promise<any> {
    // 命中缓存直接复用
    const cached = await this.knowledgeBase.getAnimation(skill);
    if (cached) {
      return { type: 'animation', data: { skill, title: cached.title, html: cached.html, status: 'ready' } };
    }

    const prompt = `请为技术概念「${skill}」生成一个自包含的 HTML 动画演示页面，用于可视化教学。

难度：${difficulty}

严格要求：
1. 输出单个完整 HTML 文档（含 <!DOCTYPE html>、<style>、<script>），所有 CSS/JS 内联，不引用任何外部资源或 CDN
2. 用 CSS animation / requestAnimationFrame 动态演示「${skill}」的核心原理或执行过程
3. 配少量中文文字标注关键步骤，画面简洁、对比清晰，适合${difficulty}水平
4. 背景浅色，自适应铺满容器（body { margin:0 }），不要出现滚动条
5. 禁止 alert/外部网络请求/localStorage
6. 只输出 HTML 代码本身，不要 Markdown 代码块包裹，不要任何额外说明文字`;

    try {
      const raw = await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是创意前端工程师，擅长用纯 HTML+CSS+JS 制作教学动画。只输出 HTML 源码。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.6, maxTokens: 4096, tier: 'pro' },
      );

      const html = this.extractHtml(raw);
      if (!html) {
        return { type: 'error', message: '动画生成失败：未能解析出有效 HTML' };
      }

      const title = `${skill} 动画演示`;
      await this.knowledgeBase.saveAnimation(skill, title, html, difficulty);
      console.log(`[Multimodal] Animation generated: ${skill} (${html.length} chars)`);
      return { type: 'animation', data: { skill, title, html, status: 'ready' } };
    } catch (e: any) {
      console.error(`[Multimodal] Animation generation failed for ${skill}:`, e.message);
      return { type: 'error', message: `动画生成失败：${e.message}` };
    }
  }

  // ── 2. Mermaid 图表（LLM 同步生成） ──────────────────────────

  /**
   * 生成 Mermaid 图表源码（流程图/架构图/时序图）。
   * 返回 { type:'diagram', data:{ skill, title, mermaid, diagram_type, status:'ready' } }
   */
  async generateDiagram(skill: string, diagramType = 'flowchart'): Promise<any> {
    const cached = await this.knowledgeBase.getDiagram(skill);
    if (cached) {
      return {
        type: 'diagram',
        data: { skill, title: cached.title, mermaid: cached.mermaid, diagram_type: cached.diagram_type || diagramType, status: 'ready' },
      };
    }

    const typeHint: Record<string, string> = {
      flowchart: '流程图（graph TD 或 flowchart LR），表达执行流程/决策分支',
      sequence: '时序图（sequenceDiagram），表达多个角色/模块之间的交互顺序',
      architecture: '架构图（graph TB，用 subgraph 分层），表达系统组成与依赖关系',
      mindmap: '思维导图（mindmap），表达知识点的层级结构',
    };
    const hint = typeHint[diagramType] || typeHint.flowchart;

    const prompt = `请为技术主题「${skill}」生成一份 Mermaid 图表源码。

图表类型：${hint}

严格要求：
1. 只输出合法的 Mermaid 源码，第一行必须是合法的图表声明（如 graph TD / sequenceDiagram / mindmap）
2. 节点文字用中文，简洁准确，覆盖「${skill}」的核心要点
3. 节点数量控制在 6-14 个，关系清晰不杂乱
4. 不要使用 Mermaid 不支持的语法，不要中文括号，标签内避免特殊字符
5. 只输出 Mermaid 源码，不要 Markdown 代码块包裹（不要 \`\`\`mermaid），不要任何额外说明`;

    try {
      const raw = await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是技术架构师，擅长用 Mermaid 表达系统关系。只输出 Mermaid 源码。' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.4, maxTokens: 1536, tier: 'pro' },
      );

      const mermaid = this.extractMermaid(raw);
      if (!mermaid) {
        return { type: 'error', message: '图表生成失败：未能解析出有效 Mermaid 源码' };
      }

      const title = `${skill} 图解`;
      await this.knowledgeBase.saveDiagram(skill, title, mermaid, diagramType);
      console.log(`[Multimodal] Diagram generated: ${skill} (${diagramType})`);
      return { type: 'diagram', data: { skill, title, mermaid, diagram_type: diagramType, status: 'ready' } };
    } catch (e: any) {
      console.error(`[Multimodal] Diagram generation failed for ${skill}:`, e.message);
      return { type: 'error', message: `图表生成失败：${e.message}` };
    }
  }

  // ── 3. 短视频（智谱 CogVideoX，缺 key 优雅降级） ──────────────

  /**
   * 生成 5 秒可视化教学短视频（智谱 AI）。
   * 缺少 ZHIPU_API_KEY 时返回 status:'not_configured'，前端展示占位与脚本。
   */
  async generateVideo(skill: string): Promise<any> {
    const cached = await this.knowledgeBase.getVideo(skill);
    if (cached?.status === 'ready' && cached?.url) {
      return { type: 'video', data: { skill, ...cached } };
    }

    // 无论是否配置 key，都先用 LLM 生成视频脚本/分镜，作为占位展示内容
    const script = await this.buildVideoScript(skill);
    const apiKey = this.config.get('ZHIPU_API_KEY', '');

    if (!apiKey) {
      const data = {
        skill,
        title: `${skill} 教学短视频`,
        status: 'not_configured',
        provider: 'zhipu',
        text: '短视频生成依赖智谱 AI（CogVideoX），当前未配置 ZHIPU_API_KEY。配置后即可自动生成 5 秒可视化教学视频。',
        script,
        url: '',
        poster: '',
      };
      await this.knowledgeBase.saveVideo(skill, data);
      return { type: 'video', data };
    }

    // 已配置 key：调用智谱 CogVideoX（异步出片，这里发起任务并返回 pending）
    try {
      const taskId = await this.submitZhipuVideoTask(apiKey, script);
      const data = {
        skill,
        title: `${skill} 教学短视频`,
        status: 'pending',
        provider: 'zhipu',
        task_id: taskId,
        text: '视频生成任务已提交，智谱 AI 正在出片，稍后刷新查看。',
        script,
        url: '',
        poster: '',
      };
      await this.knowledgeBase.saveVideo(skill, data);
      return { type: 'video', data };
    } catch (e: any) {
      console.error(`[Multimodal] Zhipu video task failed for ${skill}:`, e.message);
      return {
        type: 'video',
        data: { skill, title: `${skill} 教学短视频`, status: 'failed', provider: 'zhipu', text: `视频任务提交失败：${e.message}`, script, url: '', poster: '' },
      };
    }
  }

  // ── 4. 数字人讲解（讯飞 RTCPlayer，缺 key 优雅降级） ──────────

  /**
   * 生成数字人虚拟教师讲解（讯飞）。
   * 缺少讯飞 key 时返回 status:'not_configured'，前端展示占位与讲解词。
   * key 存在时创建真实会话，返回 streamUrl 供前端 RTCPlayer 播放。
   */
  async generateAvatar(skill: string): Promise<any> {
    const cached = await this.knowledgeBase.getAvatar(skill);
    if (cached?.status === 'ready' && cached?.sessionId) {
      return { type: 'avatar', data: { skill, ...cached } };
    }

    const text = await this.buildAvatarScript(skill);

    if (!this.xunfeiAvatar.isConfigured()) {
      const data = {
        skill,
        title: `${skill} 数字人讲解`,
        status: 'not_configured',
        provider: 'xfyun',
        text: '数字人讲解依赖讯飞 RTCPlayer 虚拟人服务，当前未配置 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET。配置后即可生成虚拟教师讲解视频。',
        script: text,
        url: '',
        poster: '',
        avatar_id: this.config.get('XFYUN_AVATAR_ID', '110017'),
      };
      await this.knowledgeBase.saveAvatar(skill, data);
      return { type: 'avatar', data };
    }

    // 已配置：调用讯飞数字人 API 创建会话 + 驱动生成
    try {
      const session = await this.xunfeiAvatar.createSession();

      // 发送讲解词驱动生成（数字人朗读）
      await this.xunfeiAvatar.sendText(session.sessionId, text);

      const data = {
        skill,
        title: `${skill} 数字人讲解`,
        status: 'ready',
        provider: 'xfyun',
        script: text,
        text,
        sessionId: session.sessionId,
        streamUrl: session.streamUrl,
        rtcToken: session.token,
        roomId: session.roomId,
        avatar_id: this.config.get('XFYUN_AVATAR_ID', '110017'),
        url: session.streamUrl,
        poster: '',
      };
      await this.knowledgeBase.saveAvatar(skill, data);
      this.logger.log(`[Multimodal] Avatar session created for ${skill}: ${session.sessionId}`);
      return { type: 'avatar', data };
    } catch (e: any) {
      this.logger.error(`[Multimodal] Avatar generation failed for ${skill}: ${e.message}`);
      // 降级：返回讲解词占位，不阻断流程
      const data = {
        skill,
        title: `${skill} 数字人讲解`,
        status: 'error',
        provider: 'xfyun',
        text: `数字人会话创建失败：${e.message}。以下为讲解词占位。`,
        script: text,
        url: '',
        poster: '',
        avatar_id: this.config.get('XFYUN_AVATAR_ID', '110017'),
      };
      await this.knowledgeBase.saveAvatar(skill, data);
      return { type: 'avatar', data };
    }
  }

  // ── 聚合查询（KnowledgeDetail 多模态 Tab 用） ─────────────────

  /** 获取某技能已有的全部多模态资源（不触发生成） */
  async getMultimodal(skill: string): Promise<any> {
    const [animation, diagram, video, avatar] = await Promise.all([
      this.knowledgeBase.getAnimation(skill),
      this.knowledgeBase.getDiagram(skill),
      this.knowledgeBase.getVideo(skill),
      this.knowledgeBase.getAvatar(skill),
    ]);
    return {
      skill,
      animation: animation ? { skill, ...animation, status: 'ready' } : null,
      diagram: diagram ? { skill, ...diagram, status: 'ready' } : null,
      video: video ? { skill, ...video } : null,
      avatar: avatar ? { skill, ...avatar } : null,
    };
  }

  // ── 内部工具 ──────────────────────────────────────────────

  /** 生成视频分镜脚本（5 秒短视频用） */
  private async buildVideoScript(skill: string): Promise<string> {
    try {
      return await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是教学视频导演，用一句话描述适合文生视频模型的画面提示词。' },
          { role: 'user', content: `为技术概念「${skill}」设计一个 5 秒可视化教学短视频的画面描述（中文，60 字以内，强调可视化比喻与动态过程）。只输出描述本身。` },
        ],
        { temperature: 0.7, maxTokens: 256 },
      );
    } catch (e: any) {
      console.warn('[Multimodal] buildVideoScript LLM failed:', e.message);
      return `用动态可视化方式演示「${skill}」的核心原理。`;
    }
  }

  /** 生成数字人讲解词 */
  private async buildAvatarScript(skill: string): Promise<string> {
    try {
      return await this.llmService.chatCompletion(
        [
          { role: 'system', content: '你是亲切的虚拟教师，用口语化中文讲解技术概念。' },
          { role: 'user', content: `请用 100 字左右、适合朗读的口语化中文，讲解「${skill}」是什么、为什么重要、怎么入门。只输出讲解词本身。` },
        ],
        { temperature: 0.6, maxTokens: 512 },
      );
    } catch (e: any) {
      console.warn('[Multimodal] buildAvatarScript LLM failed:', e.message);
      return `同学你好，今天我们来认识「${skill}」。`;
    }
  }

  /** 调用智谱 CogVideoX 提交文生视频任务，返回 task_id */
  private async submitZhipuVideoTask(apiKey: string, prompt: string): Promise<string> {
    const baseUrl = this.config.get('ZHIPU_BASE_URL', 'https://open.bigmodel.cn/api/paas/v4');
    const model = this.config.get('ZHIPU_VIDEO_MODEL', 'cogvideox');
    const resp = await fetch(`${baseUrl}/videos/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt }),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }
    const json: any = await resp.json();
    return json.id || json.request_id || '';
  }

  /** 从 LLM 回复中提取纯 HTML 文档 */
  private extractHtml(text: string): string | null {
    let t = (text || '').trim();
    // 去掉 ```html ... ``` 包裹
    const fence = t.match(/```(?:html)?\s*\n([\s\S]*?)\n```/i);
    if (fence) t = fence[1].trim();
    const idx = t.search(/<!DOCTYPE html>|<html[\s>]/i);
    if (idx >= 0) {
      const end = t.lastIndexOf('</html>');
      return end > idx ? t.substring(idx, end + 7) : t.substring(idx);
    }
    // 没有 <html> 但包含标签，包一层骨架
    if (/<\w+[\s>]/.test(t)) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:system-ui}</style></head><body>${t}</body></html>`;
    }
    return null;
  }

  /** 从 LLM 回复中提取 Mermaid 源码 */
  private extractMermaid(text: string): string | null {
    let t = (text || '').trim();
    const fence = t.match(/```(?:mermaid)?\s*\n([\s\S]*?)\n```/i);
    if (fence) t = fence[1].trim();
    // 校验首行是否为合法图表声明
    const valid = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph)\b/i;
    const firstLine = t.split('\n')[0].trim();
    if (valid.test(firstLine)) return t;
    // 尝试从文本中定位声明起点
    const m = t.match(valid);
    if (m && typeof m.index === 'number') return t.substring(m.index).trim();
    return null;
  }
}
