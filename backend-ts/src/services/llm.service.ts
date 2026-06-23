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
 * 模型分级策略：
 * - flash: deepseek-v4-flash — 快速便宜，用于意图路由、日常聊天、画像分析
 * - pro:   deepseek-v4-pro   — 推理模型，用于出题、生成讲义、编程题
 */
export type ModelTier = 'flash' | 'pro';

interface LlmOptions {
  model?: string;
  tier?: ModelTier;  // 优先级低于 model，不传默认 flash
  temperature?: number;
  maxTokens?: number;
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
}

interface ToolCallingOptions extends LlmOptions {
  toolChoice?: string;
}

@Injectable()
export class LlmService {
  private client: OpenAI;
  private flashModel: string;
  private proModel: string;
  private defaultTier: ModelTier;
  /** 结构化 JSON 输出专用客户端（MiMo 场景 fallback DeepSeek） */
  private jsonClient: OpenAI;
  private jsonModel: string;

  constructor(private config: ConfigService) {
    const provider = this.config.get('LLM_PROVIDER', 'ollama');

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
        timeout: 30000,
      });
      this.flashModel = this.config.get('DEEPSEEK_FLASH_MODEL', 'deepseek-v4-flash');
      this.proModel = this.config.get('DEEPSEEK_MODEL', 'deepseek-v4-pro');
    } else if (provider === 'mimo') {
      this.client = new OpenAI({
        apiKey: this.config.get('MIMO_API_KEY', ''),
        baseURL: this.config.get('MIMO_BASE_URL', 'https://token-plan-ams.xiaomimimo.com/v1'),
        timeout: 180000,  // MiMo pro 推理慢，需要更长超时（实测 ~35s）
        maxRetries: 2,
      });
      this.flashModel = this.config.get('MIMO_FLASH_MODEL', 'mimo-v2.5');
      this.proModel = this.config.get('MIMO_MODEL', 'mimo-v2.5-pro');
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
    this.jsonClient = this.client;
    this.jsonModel = this.flashModel;
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
    return options?.tier === 'pro' ? this.proModel : this.flashModel;
  }

  /** 获取当前使用的模型信息 */
  getModelInfo(options?: LlmOptions): { model: string; tier: ModelTier } {
    const tier = options?.tier || this.defaultTier;
    return {
      model: this.resolveModel(options),
      tier,
    };
  }

  /** 单次对话补全 — 对齐 Python chat_completion() */
  async chatCompletion(
    messages: Array<{ role: string; content: string }>,
    options: LlmOptions = {},
  ): Promise<string> {
    const result = await this.chatCompletionWithUsage(messages, options);
    return result.content;
  }

  /** 带用量统计的对话补全 */
  async chatCompletionWithUsage(
    messages: Array<{ role: string; content: string }>,
    options: LlmOptions = {},
  ): Promise<LlmResult> {
    const model = this.resolveModel(options);
    const tier = options?.tier || this.defaultTier;

    const resp = await this.client.chat.completions.create({
      model,
      messages: messages as any,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 8192,
    });

    const usage = resp.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const msg = resp.choices[0]?.message;

    // MiMo 返回 reasoning_content 而非 content，优先取 content，fallback 到 reasoning_content
    const content = msg?.content || (msg as any)?.reasoning_content || '';

    return {
      content,
      usage: {
        prompt_tokens: usage.prompt_tokens || 0,
        completion_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
      },
      model,
      tier,
    };
  }

  /** 流式对话补全 — 对齐 Python chat_completion_stream() */
  async *chatCompletionStream(
    messages: Array<{ role: string; content: string }>,
    options: LlmOptions = {},
  ): AsyncGenerator<string> {
    let stream: AsyncIterable<any>;
    try {
      stream = await this.client.chat.completions.create({
        model: this.resolveModel(options),
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 8192,
        stream: true,
      });
    } catch (e: any) {
      console.error('[LlmService] chatCompletionStream create failed:', e.message);
      return;
    }

    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
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
    });

    const msg = resp.choices[0]?.message;
    return {
      toolCalls: msg?.tool_calls || [],
      content: msg?.content || '',
    };
  }
}
