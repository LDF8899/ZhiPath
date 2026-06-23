/**
 * MiMo JSON 修复工具
 *
 * MiMo 模型输出 JSON 常见问题：
 * 1. 包裹在 ```json ``` 代码块中
 * 2. JSON 前后有中文解释文字
 * 3. 字符串值中包含未转义的中文引号（"" ''）
 * 4. 尾部多余逗号
 */

/** 从 LLM 原始输出中提取并修复 JSON */
export function extractJson(raw: string): any {
  // 空输入快速失败
  if (!raw || !raw.trim()) {
    throw new Error('无法从 LLM 输出中提取有效 JSON');
  }

  let s = raw;

  // 1. 提取 code block
  const codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    s = codeBlockMatch[1].trim();
  }

  // 2. 提取最外层 { } 或 [ ]
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  let start = -1;
  let end = -1;

  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = s.lastIndexOf('}');
  } else if (firstBracket >= 0) {
    start = firstBracket;
    end = s.lastIndexOf(']');
  }

  if (start >= 0 && end > start) {
    s = s.substring(start, end + 1);
  }

  // 3. 尝试直接解析
  try {
    return JSON.parse(s);
  } catch {
    // 继续修复
  }

  // 4. 修复常见问题
  let fixed = s;

  // 修复未转义的中文引号 → 替换为转义双引号
  // 中文左双引号 “ → \"
  // 中文右双引号 ” → \"
  // 中文左单引号 ‘ → \'
  // 中文右单引号 ’ → \'
  // 但只在字符串值内部替换，不能破坏 JSON 结构
  fixed = fixChineseQuotes(fixed);

  // 移除尾部逗号  ,} → }  ,] → ]
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');

  // 5. 再次尝试解析
  try {
    return JSON.parse(fixed);
  } catch {
    // 最后尝试逐行修复
  }

  // 6. 尝试修复截断的 JSON（MiMo 输出常被截断）
  const repaired = fixTruncatedJson(fixed);
  try {
    return JSON.parse(repaired);
  } catch {
    // 继续暴力提取
  }

  // 7. 暴力提取：找所有完整的 { } 块
  return forceExtract(s);
}

/**
 * 修复字符串值中的中文引号
 * 策略：找到所有 JSON 字符串值（两个引号之间的内容），在其中替换中文引号
 */
function fixChineseQuotes(json: string): string {
  const result: string[] = [];
  let inString = false;
  let escaped = false;
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    if (escaped) {
      result.push(ch);
      escaped = false;
      i++;
      continue;
    }

    if (ch === '\\' && inString) {
      result.push(ch);
      escaped = true;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result.push(ch);
      i++;
      continue;
    }

    if (inString) {
      // 在字符串内部，替换中文引号
      if (ch === '“' || ch === '”') {
        result.push('\\"');
      } else if (ch === '‘' || ch === '’') {
        result.push("\\'");
      } else if (ch === '\n') {
        result.push('\\n');
      } else if (ch === '\r') {
        result.push('\\r');
      } else if (ch === '\t') {
        result.push('\\t');
      } else {
        result.push(ch);
      }
    } else {
      result.push(ch);
    }

    i++;
  }

  return result.join('');
}

/**
 * 修复截断的 JSON
 * MiMo 输出常因 max_tokens 不足而被截断，导致缺少闭合括号
 */
function fixTruncatedJson(json: string): string {
  // 移除尾部逗号
  let s = json.replace(/,\s*$/, '');

  // 统计未闭合的括号
  const stack: string[] = [];
  let inStr = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inStr) { escaped = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  // 如果在字符串中间截断，先闭合字符串
  if (inStr) {
    s += '"';
  }

  // 移除尾部可能的不完整键值对
  // 例如 "key": "value" 或 "key":
  s = s.replace(/:\s*"[^"]*$/, ': ""');
  s = s.replace(/:\s*$/, ': null');

  // 添加缺失的闭合括号
  while (stack.length > 0) {
    s += stack.pop();
  }

  // 移除尾部逗号（可能在闭合前产生）
  s = s.replace(/,\s*([}\]])/g, '$1');

  return s;
}

/** 暴力提取：尝试从混乱的文本中提取 JSON */
function forceExtract(text: string): any {
  // 尝试找到最长的合法 JSON 子串
  const candidates: string[] = [];

  // 找所有 { 开始的位置
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;

    let depth = 0;
    let inStr = false;
    let esc = false;

    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (esc) { esc = false; continue; }
      if (c === '\\' && inStr) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) {
          candidates.push(text.substring(i, j + 1));
          break;
        }
      }
    }
  }

  // 按长度降序，尝试解析
  candidates.sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // 尝试修复后解析
      try {
        const fixed = fixChineseQuotes(candidate).replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
      } catch {
        continue;
      }
    }
  }

  throw new Error('无法从 LLM 输出中提取有效 JSON');
}
