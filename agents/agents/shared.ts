/**
 * 共享工具模块（所有 Agent 复用）
 *
 * 包含：大模型调用（带重试）、JSON 提取、通用类型
 */

// ============================================================
// 通用类型
// ============================================================

export interface ActionResult {
  type: string;
  data: any;
}

export interface LLMConfig {
  apiUrl: string;
  apiKey?: string;
  model: string;
}

// ============================================================
// 大模型调用（带重试 + 超时 + clearTimeout）
// ============================================================

export async function callLLM(
  config: LLMConfig,
  messages: { role: string; content: string }[],
  maxRetries: number = 3,
  timeoutMs: number = 180000,
  retryWaitMs: number = 20000
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.7,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);  // 成功时清除

      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      const data = await response.json();
      return data.choices?.[0]?.message?.content
        || data.message?.content
        || data.response
        || '';
    } catch (e: any) {
      clearTimeout(timeout);  // 失败时也清除（修复内存泄漏）

      console.log(`  ⚠️ 第${attempt}次失败: ${e.message}`);
      if (attempt < maxRetries) {
        console.log(`  🔄 ${retryWaitMs / 1000}秒后重试...`);
        await new Promise(r => setTimeout(r, retryWaitMs));
      } else {
        throw e;
      }
    }
  }

  throw new Error('调用失败');
}

// ============================================================
// JSON 提取（处理各种边界情况）
// ============================================================

export function extractJson(raw: string): string {
  // 1. 尝试直接解析
  try { JSON.parse(raw); return raw; } catch {}

  // 2. 提取 ```json ... ``` 代码块
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { JSON.parse(codeBlock[1].trim()); return codeBlock[1].trim(); } catch {}
  }

  // 3. 提取第一个 { ... } 块
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { JSON.parse(jsonMatch[0]); return jsonMatch[0]; } catch {}
  }

  return '{}';
}
