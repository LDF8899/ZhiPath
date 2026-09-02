import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * LLM 服务 — 对齐 Python agents/llm.py
 *
 * 支持 Ollama（本地）、OpenAI 兼容 API、DeepSeek
 * 使用 openai npm 包，API 接口与 Python AsyncOpenAI 一致
 */
/**
 * 模型分级策略（依据 2026-08-30 实测，见 docs 与 .workbuddy/memory）：
 * - flash: deepseek-v4-flash — 快速便宜，用于意图路由、日常聊天、画像分析
 * - gen:   deepseek-v4-flash-vision-exp — 内容生成专用。实测同一讲义任务 25s 产出完整 6 章节，
 *          而 pro 在 8k 预算下思考吃掉 76% 预算必然截断。且自带视觉能力。
 * - pro:   deepseek-v4-pro   — 重推理模型（默认开思考、effort=high）。
 *          只留给真正需要链式推理的：学情诊断、差距分析、路径决策、编排决策。
 */
export type ModelTier = 'flash' | 'gen' | 'pro';

/**
 * 思考强度。DeepSeek 默认开启思考且 effort=high。
 * 注意：思考模式下 temperature / top_p / presence_penalty / frequency_penalty 全部不生效。
 */
export type ThinkingEffort = 'low' | 'medium' | 'high' | 'max';

interface LlmOptions {
  model?: string;
  tier?: ModelTier;  // 优先级低于 model，不传默认 flash
  temperature?: number;
  maxTokens?: number;
  jsonObject?: boolean;  // 强制返回合法 JSON（response_format: json_object）
  /**
   * 思考开关：
   * - 'off'：显式关闭（格式化内容生成、视觉任务、工具调用必须关）
   * - 'on' ：显式开启，配合 effort 控制强度
   * - 不传（auto）：JSON 输出自动关闭；其余沿用模型默认（开启）
   */
  thinking?: 'on' | 'off';
  /** 思考强度，仅在 thinking='on' 时生效，默认沿用模型默认 high */
  effort?: ThinkingEffort;
}

interface LlmResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  tier: ModelTier;
  /** 'stop' 正常结束；'length' 表示被 max_tokens 截断，内容不完整 */
  finishReason: string;
}

interface ToolCallingOptions extends LlmOptions {
  toolChoice?: string;
}

@Injectable()
export class LlmService {
  private client: OpenAI;
  private flashModel: string;
  private proModel: string;
  /** 内容生成专用模型（LLM_GEN_MODEL），默认 deepseek-v4-flash-vision-exp */
  private genModel: string;
  private defaultTier: ModelTier;
  /** 当前 provider（用于按模型行为适配，如 DeepSeek 结构化生成关闭思考） */
  private provider = '';
  /** 结构化 JSON 输出专用客户端（MiMo 场景 fallback DeepSeek） */
  private jsonClient: OpenAI;
  private jsonModel: string;
  /** 视觉模型与客户端（智谱 GLM-5V，base64 图片即可） */
  private visionModel: string;
  private visionClient: OpenAI;

  constructor(private config: ConfigService) {
    const provider = this.config.get('LLM_PROVIDER', 'ollama');
    this.provider = provider;

    if (provider === 'ollama') {
      const baseUrl = this.config.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434');
      this.client = new OpenAI({
        baseURL: `${baseUrl}/v1`,
        apiKey: 'ollama',
        timeout: 30000,
      });
      // Ollama 不分级，都用同一个模型
      this.flashModel = this.config.get('OLLAMA_MODEL', 'qwen2.5:7b');
      this.proModel = this.flashModel;
    } else if (provider === 'deepseek') {
      this.client = new OpenAI({
        apiKey: this.config.get('DEEPSEEK_API_KEY', ''),
        baseURL: this.config.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
        timeout: 60000,
        maxRetries: 2,
      });
      this.flashModel = this.config.get('DEEPSEEK_FLASH_MODEL', 'deepseek-v4-flash-vision-exp');
      this.proModel = this.config.get('DEEPSEEK_MODEL', 'deepseek-v4-flash-vision-exp');
    } else if (provider === 'mimo') {
      this.client = new OpenAI({
        apiKey: this.config.get('MIMO_API_KEY', ''),
        baseURL: this.config.get('MIMO_BASE_URL', 'https://token-plan-ams.xiaomimimo.com/v1'),
        timeout: 180000,  // MiMo pro 推理慢，需要更长超时（实测 ~35s）
        maxRetries: 2,
      });
      this.flashModel = this.config.get('MIMO_FLASH_MODEL', 'mimo-v2.5');
      this.proModel = this.config.get('MIMO_MODEL', 'mimo-v2.5-pro');
    } else if (provider === 'zhipu') {
      // 智谱 GLM（OpenAI 兼容端点）——GLM-5.3 为推理模型，响应慢、需较长超时
      this.client = new OpenAI({
        apiKey: this.config.get('ZHIPU_LLM_API_KEY', ''),
        baseURL: this.config.get('ZHIPU_BASE_URL', 'https://open.bigmodel.cn/api/paas/v4'),
        timeout: 120000,
        maxRetries: 2,
      });
      this.flashModel = this.config.get('ZHIPU_LLM_FLASH_MODEL', 'glm-5.3');
      this.proModel = this.config.get('ZHIPU_LLM_MODEL', 'glm-5.3');
    } else {
      this.client = new OpenAI({
        apiKey: this.config.get('OPENAI_API_KEY', ''),
        baseURL: this.config.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        timeout: 30000,
      });
      this.flashModel = this.config.get('OPENAI_MODEL', 'gpt-4o-mini');
      this.proModel = this.flashModel;
    }

    this.defaultTier = (this.config.get('LLM_DEFAULT_TIER') as ModelTier) || 'flash';
    // 内容生成档：DeepSeek 下默认走 Vision Exp（内容生成实测最稳，且自带视觉能力）
    this.genModel = this.config.get('LLM_GEN_MODEL')
      || (provider === 'deepseek' ? 'deepseek-v4-flash-vision-exp' : this.flashModel);
    this.jsonClient = this.client;
    this.jsonModel = this.flashModel;
    const explicitVisionModel = this.config.get('VISION_MODEL');
    this.visionModel = explicitVisionModel
      || (provider === 'deepseek'
        ? 'deepseek-v4-flash-vision-exp'
        : provider === 'zhipu'
          ? this.config.get('ZHIPU_VISION_MODEL', 'glm-5v-turbo')
          : this.flashModel);
    if (!explicitVisionModel) {
      console.warn(`[LLM] VISION_MODEL 未显式配置，临时使用 ${this.visionModel}；视觉任务建议在 .env 固定该值。`);
    }
    // 视觉走当前 provider（DeepSeek 用 deepseek-v4-flash-vision-exp；OpenAI 兼容，base64 图片即可）
    this.visionClient = this.client;
  }

  /** 获取默认模型名称 */
  getModelName(): string {
    return this.flashModel;
  }

  /** 获取 OpenAI 客户端（供 tool calling 等高级用法） */
  getClient(): OpenAI {
    return this.client;
  }

  /** 根据 tier 解析模型名 */
  private resolveModel(options?: { model?: string; tier?: ModelTier }): string {
    if (options?.model) return options.model;
    if (options?.tier === 'pro') return this.proModel;
    if (options?.tier === 'gen') return this.genModel;
    return this.flashModel;
  }

  /** 获取当前使用的模型信息 */
  getModelInfo(options?: LlmOptions): { model: string; tier: ModelTier } {
    const tier = options?.tier || this.defaultTier;
    return {
      model: this.resolveModel(options),
      tier,
    };
  }

  /** 视觉对话补全 — 智谱 GLM-5V，base64 图片即可，用于试卷题目 OCR 提取 */
  async chatCompletionVision(
    text: string,
    imageDataUrls: string[],
    options: Omit<LlmOptions, 'model' | 'tier'> = {},
  ): Promise<string> {
    const content: any[] = [];
    for (const url of imageDataUrls) {
      if (url) content.push({ type: 'image_url', image_url: { url } });
    }
    content.push({ type: 'text', text });
    const vStart = Date.now();
    const resp = await this.visionClient.chat.completions.create({
      model: this.visionModel,
      messages: [{ role: 'user', content }],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.jsonObject ? { response_format: { type: 'json_object' as any } } : {}),
      // 视觉任务默认关思考：实测开启时 18.7s 且正文为空（思考吃光预算）
      ...(this.provider === 'deepseek' && options.thinking !== 'on'
        ? { thinking: { type: 'disabled' as any } }
        : {}),
      ...(options.thinking === 'on' && options.effort && this.provider === 'deepseek'
        ? { reasoning_effort: options.effort }
        : {}),
    } as any);
    const msg = resp.choices[0]?.message;
    const visionContent = this.stripThinking(msg?.content || '');
    console.log(`[LLM-VISION] ${this.visionModel} 图=${imageDataUrls.length} 耗时=${Date.now() - vStart}ms 内容=${visionContent.length}字 推理=${((msg as any)?.reasoning_content || '').length}字`);
    return visionContent;
  }

  /** 单次对话补全 — 对齐 Python chat_completion() */
  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: LlmOptions = {},
  ): Promise<string> {
    const result = await this.chatCompletionWithUsage(messages, options);
    return result.content;
  }

  /**
   * 去掉模型内联的思考块（<think>…</think>）。
   * 推理内容属于模型内部过程，绝不能当作面向用户的内容返回。
   */
  private stripThinking(text: string): string {
    if (!text) return '';
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<\/?think>/gi, '')
      .trim();
  }

  /** 带用量统计的对话补全 */
  async chatCompletionWithUsage(
    messages: Array<{ role: string; content: string }>,
    options: LlmOptions = {},
  ): Promise<LlmResult> {
    const model = this.resolveModel(options);
    const tier = options?.tier || this.defaultTier;
    const llmStart = Date.now();

    const invoke = async (
      thinking: 'on' | 'off',
      maxTokens: number,
      modelName = model,
      effort?: ThinkingEffort,
    ) => {
      const resp = await this.client.chat.completions.create({
        model: modelName,
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: maxTokens,
        ...(options.jsonObject ? { response_format: { type: 'json_object' as any } } : {}),
        // 思考开关与强度（仅 DeepSeek 支持）。注意：思考开启时 temperature 等采样参数会被忽略。
        ...(this.provider === 'deepseek'
          ? thinking === 'off'
            ? { thinking: { type: 'disabled' as any } }
            : {
                thinking: { type: 'enabled' as any },
                ...(effort ? { reasoning_effort: effort } : {}),
              }
          : {}),
      } as any);
      const message = resp.choices[0]?.message;
      return {
        resp,
        content: this.stripThinking(message?.content || ''),
        reasoningLen: ((message as any)?.reasoning_content || '').length,
        finishReason: resp.choices[0]?.finish_reason || '',
      };
    };

    // 结构化输出默认关思考（思考会吃光预算导致 content 为空），其余沿用模型默认（开启）
    const wantThinking: 'on' | 'off' = options.thinking ?? (options.jsonObject ? 'off' : 'on');
    const budget = options.maxTokens ?? 8192;
    let finalModel = model;

    let out = await invoke(wantThinking, budget, finalModel, options.effort);

    // 正文为空的两种已知成因：
    //  1) 思考吃光 token 预算（本次开了思考）
    //  2) JSON Output 官方已知的随机空返回（详见 api-docs/guides/json_mode 注意事项第 4 条）
    // DeepSeek pro 先降低推理强度，再关闭思考，再回退 flash，避免把空正文传给上层。
    if (!out.content && this.provider === 'deepseek' && wantThinking === 'on' && tier === 'pro') {
      console.warn(
        `[LLM] ${model} 正文为空（推理=${out.reasoningLen}字），推理强度 ${options.effort || 'default'} → medium 重试`,
      );
      out = await invoke('on', budget, finalModel, 'medium');
    }

    if (!out.content && (wantThinking === 'on' || options.jsonObject)) {
      console.warn(
        `[LLM] ${model} 正文为空（推理=${out.reasoningLen}字 json=${!!options.jsonObject}），关闭思考重试`,
      );
      out = await invoke('off', budget, finalModel);
    }

    if (!out.content && this.provider === 'deepseek' && tier === 'pro' && this.flashModel !== model) {
      console.warn(
        `[LLM] ${model} 正文仍为空，回退 ${this.flashModel}（thinking=off）`,
      );
      finalModel = this.flashModel;
      out = await invoke('off', budget, finalModel);
    }

    const usage = out.resp.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    console.log(
      `[LLM] ${finalModel} tier=${tier} 思考=${wantThinking}${options.effort ? '/' + options.effort : ''} ` +
      `json=${!!options.jsonObject} 耗时=${Date.now() - llmStart}ms 内容=${out.content.length}字 ` +
      `推理=${out.reasoningLen}字 finish=${out.finishReason} tokens=${JSON.stringify(usage)}`,
    );

    // 推理内容不是内容：宁可报错让上层走降级/重试，也不能把思考过程透出给用户
    if (!out.content) {
      throw new Error('LLM 返回空内容（思考耗尽预算或 JSON 模式随机空返回）');
    }

    return {
      content: out.content,
      usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
      },
      model: finalModel,
      tier,
      finishReason: out.finishReason,
    };
  }

  /**
   * 带完整性校验的对话补全。
   *
   * 解决两类静默损坏：
   *  1) finishReason === 'length' —— 输出被 max_tokens 截断，内容不完整；
   *  2) validate() 返回 false —— 结构不符合预期（如讲义缺少应有章节）。
   * 命中任一种就翻倍预算重生成一次；仍不合格则返回最后一次结果并标记 complete=false，
   * 由调用方决定是继续用还是报错。
   */
  async chatCompletionComplete(
    messages: Array<{ role: string; content: string }>,
    options: LlmOptions = {},
    validate?: (content: string) => boolean,
  ): Promise<LlmResult & { complete: boolean }> {
    const budget = options.maxTokens ?? 8192;
    let result = await this.chatCompletionWithUsage(messages, options);

    const acceptable = (r: LlmResult) =>
      r.finishReason !== 'length' && (validate ? validate(r.content) : true);

    if (acceptable(result)) {
      return { ...result, complete: true };
    }

    console.warn(
      `[LLM] ${result.model} 输出不完整（finish=${result.finishReason} 长度=${result.content.length}），` +
      `预算 ${budget} → ${budget * 2} 重生成`,
    );
    result = await this.chatCompletionWithUsage(messages, {
      ...options,
      maxTokens: budget * 2,
      // 重生成时关掉思考，把预算全部让给正文
      thinking: 'off',
    });

    return { ...result, complete: acceptable(result) };
  }

  /** 流式对话补全 — 对齐 Python chat_completion_stream() */
  async *chatCompletionStream(
    messages: Array<{ role: string; content: string }>,
    options: LlmOptions = {},
  ): AsyncGenerator<string> {
    let stream: AsyncIterable<any>;
    try {
      stream = (await this.client.chat.completions.create({
        model: this.resolveModel(options),
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 8192,
        stream: true,
        // 流式默认关思考：思考内容不会渲染给用户，开启只会让用户盯着空白等待数十秒。
        // 调用方如需思考，显式传 options.thinking='on'。
        ...(this.provider === 'deepseek' && options.thinking !== 'on'
          ? { thinking: { type: 'disabled' as any } }
          : {}),
      } as any)) as any;
    } catch (e: any) {
      console.error('[LlmService] chatCompletionStream create failed:', e.message);
      return;
    }

    // 流式场景同样不能把思考过程吐给前端：跨 chunk 维护 <think> 块状态
    let insideThink = false;
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as any;
        // 推理模型的思考走 reasoning_content，直接丢弃
        const text = delta?.content || '';
        if (!text) continue;

        let buffer = text;
        let output = '';
        while (buffer.length > 0) {
          if (insideThink) {
            const close = buffer.search(/<\/\s*think\s*>/i);
            if (close === -1) {
              buffer = '';
            } else {
              insideThink = false;
              buffer = buffer.slice(close + buffer.match(/<\/\s*think\s*>/i)![0].length);
            }
          } else {
            const open = buffer.search(/<\s*think\s*>/i);
            if (open === -1) {
              output += buffer;
              buffer = '';
            } else {
              output += buffer.slice(0, open);
              insideThink = true;
              buffer = buffer.slice(open + buffer.match(/<\s*think\s*>/i)![0].length);
            }
          }
        }
        if (output) {
          yield output;
        }
      }
    } catch (e: any) {
      console.error('[LlmService] chatCompletionStream iteration failed:', e.message);
    }
  }

  /** Tool Calling — 对齐 Python llm_decide_action() */
  async toolCalling(
    messages: Array<{ role: string; content: string }>,
    tools: any[],
    options: ToolCallingOptions = {},
  ): Promise<{ toolCalls: any[]; content: string }> {
    const resp = await this.client.chat.completions.create({
      model: this.resolveModel(options),
      messages: messages as any,
      tools,
      tool_choice: (options.toolChoice as any) || 'auto',
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 256,
      // 工具调用默认关闭思考：
      // 1) 默认预算仅 256 token，开启思考会被推理吃光导致 tool_calls 为空；
      // 2) 开启思考后，带 tools 的多轮请求必须回传 reasoning_content，否则 API 返回 400。
      // 关闭思考可同时规避这两个问题。调用方如需思考，显式传 options.thinking='on' 并自行回传。
      ...(this.provider === 'deepseek' && options.thinking !== 'on'
        ? { thinking: { type: 'disabled' as any } }
        : {}),
    } as any);

    const msg = resp.choices[0]?.message;
    return {
      toolCalls: msg?.tool_calls || [],
      content: msg?.content || '',
    };
  }
}
