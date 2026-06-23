import { Injectable, Logger } from '@nestjs/common';

/**
 * 输入安全验证器 — 防止 SQL注入 / XSS / 日志注入
 *
 * 功能：
 *   - SQL 注入检测（严格模式 + 上下文模式）
 *   - XSS 攻击模式检测
 *   - 日志注入防护（CRLF / ANSI 注入）
 *   - 学习内容清理（保留合法内容，过滤攻击）
 *   - 字段长度限制
 *
 * 用法：
 *   - 直接注入使用: constructor(private sanitizer: InputSanitizer) {}
 *   - 配合 InputSanitizerGuard 做全局请求拦截
 */
@Injectable()
export class InputSanitizer {
  private readonly logger = new Logger(InputSanitizer.name);

  // ─────────────────────────── SQL 注入模式 ───────────────────────────

  /** 严格模式：匹配常见 SQL 关键字组合 */
  private static readonly SQL_PATTERNS_STRICT: RegExp[] = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|UNION|DECLARE)\b)/i,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,                      // OR 1=1
    /(--|#|\/\*|\*\/)/,                                        // SQL 注释
    /(;|\b)(\s)*(SELECT|INSERT|UPDATE|DELETE|DROP)\b/i,        // 分号+关键字
    /'\s*(OR|AND)\s+'?\w/i,                                   // ' OR '1'='1
    /\bSLEEP\s*\(/i,                                           // SLEEP() 时间盲注
    /\bBENCHMARK\s*\(/i,                                       // BENCHMARK() 时间盲注
    /\bWAITFOR\s+DELAY\b/i,                                    // SQL Server 延迟
    /\bLOAD_FILE\s*\(/i,                                       // MySQL 文件读取
    /\bINTO\s+(OUT|DUMP)FILE\b/i,                              // MySQL 文件写入
    /\bINFORMATION_SCHEMA\b/i,                                 // 系统表查询
    /\b(pg_sleep|pg_terminate)\b/i,                            // PostgreSQL 攻击
  ];

  /** 上下文模式：需要引号包裹上下文才生效 */
  private static readonly SQL_PATTERNS_CONTEXT: RegExp[] = [
    /'\s*;\s*(DROP|DELETE|UPDATE|INSERT|ALTER)\b/i,            // '; DROP TABLE
    /'\s*(OR|AND)\s+'\w/i,                                     // ' OR 'a
    /'\s*UNION\s+(ALL\s+)?SELECT\b/i,                          // ' UNION SELECT
  ];

  // ─────────────────────────── XSS 模式 ───────────────────────────

  private static readonly XSS_PATTERNS: RegExp[] = [
    /<script[\s>]/i,                                           // <script> 标签
    /<\/script>/i,                                              // </script>
    /javascript\s*:/i,                                          // javascript: 协议
    /vbscript\s*:/i,                                            // vbscript: 协议
    /on\w+\s*=\s*["'][^"']*["']/i,                             // on事件="..."
    /on\w+\s*=\s*[^\s>]*/i,                                    // on事件=无引号
    /<\s*iframe[\s>]/i,                                         // <iframe>
    /<\s*object[\s>]/i,                                         // <object>
    /<\s*embed[\s>]/i,                                          // <embed>
    /<\s*form[\s>]/i,                                           // <form>（学习平台不需要）
    /<\s*img[^>]+onerror/i,                                     // <img onerror>
    /expression\s*\(/i,                                         // CSS expression()
    /data\s*:\s*text\/html/i,                                   // data:text/html
    /document\.(cookie|domain|write)/i,                         // document 属性访问
    /window\.(location|open|eval)/i,                            // window 方法
    /\beval\s*\(/i,                                             // eval()
    /\\u00[0-9a-f]{2}/i,                                        // Unicode 转义绕过
  ];

  // ─────────────────────────── 日志注入模式 ───────────────────────────

  private static readonly LOG_INJECTION_PATTERNS: RegExp[] = [
    /[\r\n]/,                                                   // CRLF 注入
    /\x1b\[[0-9;]*m/,                                          // ANSI 转义序列
    /\x00/,                                                     // NULL 字节
  ];

  // ─────────────────────────── 危险字符集 ───────────────────────────

  /** 通用危险字符 — 用于 sanitizeForLog 等场景 */
  private static readonly DANGEROUS_CHARS = /[<>'"&;\\{}[\]`|*~$!()]/g;

  // ─────────────────────────── 敏感表名（防止泄漏探测） ───────────────────────────

  private static readonly SENSITIVE_TABLES: RegExp[] = [
    /\b(user|admin|password|secret|token|key|credential|session|auth)\b/i,
    /\b(sys|system|information_schema|mysql|pg_catalog)\b/i,
  ];

  // ─────────────────────────── 长度限制 ───────────────────────────

  private static readonly DEFAULT_MAX_LENGTH = 1000;
  private static readonly LOG_MAX_LENGTH = 500;

  // ═══════════════════════════ 公开方法 ═══════════════════════════

  /**
   * 清理单个输入值
   *
   * @param value     原始输入
   * @param options   maxLength: 最大长度(默认1000)  allowHtml: 是否允许HTML(默认false)
   * @returns clean: 清理后的字符串  safe: 是否安全  risks: 发现的风险列表
   */
  sanitizeInput(
    value: any,
    options?: { maxLength?: number; allowHtml?: boolean },
  ): { clean: string; safe: boolean; risks: string[] } {
    const maxLength = options?.maxLength ?? InputSanitizer.DEFAULT_MAX_LENGTH;
    const allowHtml = options?.allowHtml ?? false;
    const risks: string[] = [];

    if (value === null || value === undefined) {
      return { clean: '', safe: true, risks: [] };
    }

    // 类型强制转换
    let str = typeof value === 'string' ? value : String(value);

    // 长度截断
    if (str.length > maxLength) {
      str = str.slice(0, maxLength);
      risks.push(`TRUNCATED: exceeded ${maxLength} chars`);
    }

    // SQL 注入检测
    for (const pattern of InputSanitizer.SQL_PATTERNS_STRICT) {
      if (pattern.test(str)) {
        risks.push(`SQL_INJECT_STRICT: ${pattern.source}`);
      }
    }
    for (const pattern of InputSanitizer.SQL_PATTERNS_CONTEXT) {
      if (pattern.test(str)) {
        risks.push(`SQL_INJECT_CONTEXT: ${pattern.source}`);
      }
    }

    // XSS 检测
    if (!allowHtml) {
      for (const pattern of InputSanitizer.XSS_PATTERNS) {
        if (pattern.test(str)) {
          risks.push(`XSS: ${pattern.source}`);
        }
      }
    }

    // 日志注入检测
    for (const pattern of InputSanitizer.LOG_INJECTION_PATTERNS) {
      if (pattern.test(str)) {
        risks.push(`LOG_INJECT: ${pattern.source}`);
      }
    }

    // 清理输出
    let clean = str;
    if (!allowHtml) {
      clean = this.escapeHtml(clean);
    }
    clean = this.stripLogInjection(clean);

    const safe = risks.length === 0;

    if (!safe) {
      this.logger.warn(`Input risk detected: [${risks.join(', ')}] raw="${str.slice(0, 100)}"`);
    }

    return { clean, safe, risks };
  }

  /**
   * 批量清理字典中的指定字段
   *
   * @param data    原始字典
   * @param fields  需要清理的字段名列表
   * @returns clean: 清理后的字典  risks: 所有发现的风险
   */
  sanitizeDict(
    data: Record<string, any>,
    fields: string[],
  ): { clean: Record<string, any>; risks: string[] } {
    const clean: Record<string, any> = { ...data };
    const allRisks: string[] = [];

    for (const field of fields) {
      if (clean[field] !== undefined) {
        const result = this.sanitizeInput(clean[field]);
        clean[field] = result.clean;
        if (result.risks.length > 0) {
          allRisks.push(...result.risks.map((r) => `${field}: ${r}`));
        }
      }
    }

    return { clean, risks: allRisks };
  }

  /**
   * 清理日志内容 — 防止日志注入 + 截断
   *
   * @param text      原始文本
   * @param maxLength 最大长度(默认500)
   * @returns 安全的日志文本
   */
  sanitizeForLog(text: string, maxLength?: number): string {
    if (!text) return '';

    const limit = maxLength ?? InputSanitizer.LOG_MAX_LENGTH;

    let safe = text
      .replace(/[\r\n\x00]/g, ' ')                              // 移除 CRLF / NULL
      .replace(/\x1b\[[0-9;]*m/g, '')                          // 移除 ANSI 转义
      .replace(InputSanitizer.DANGEROUS_CHARS, '_')             // 替换危险字符
      .trim();

    if (safe.length > limit) {
      safe = safe.slice(0, limit) + '...[truncated]';
    }

    return safe;
  }

  /**
   * 验证请求参数安全性 — 供 Guard 快速调用
   *
   * @param params  请求参数字典 (body / query / params)
   * @returns true=安全  false=有风险
   */
  validateParams(params: Record<string, any>): boolean {
    if (!params || typeof params !== 'object') return true;

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        const result = this.sanitizeInput(value);
        if (!result.safe) {
          this.logger.warn(`Unsafe param "${key}": [${result.risks.join(', ')}]`);
          return false;
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            const result = this.sanitizeInput(item);
            if (!result.safe) {
              this.logger.warn(`Unsafe param "${key}[]" : [${result.risks.join(', ')}]`);
              return false;
            }
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        // 递归检查嵌套对象（最多一层）
        const nestedSafe = this.validateParams(value);
        if (!nestedSafe) return false;
      }
    }

    return true;
  }

  /**
   * 检查文本中是否包含敏感表名 — 防止数据库探测
   */
  containsSensitiveTable(text: string): boolean {
    if (!text) return false;
    return InputSanitizer.SENSITIVE_TABLES.some((p) => p.test(text));
  }

  // ═══════════════════════════ 内部方法 ═══════════════════════════

  /** HTML 实体转义 */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /** 移除日志注入字符 */
  private stripLogInjection(str: string): string {
    return str
      .replace(/[\r\n\x00]/g, '')
      .replace(/\x1b\[[0-9;]*m/g, '');
  }
}
