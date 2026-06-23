import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * TTS 服务 — 对接 MiMo TTS API
 *
 * 正确的调用格式（mimo-v2.5-tts）：
 *   messages:
 *     role: user       → 风格控制指令（可选）
 *     role: assistant  → 待合成的目标文本
 *   audio:
 *     format: wav
 *     voice: 冰糖       ← 预置精品音色名
 *
 * 关键设计：
 * 1. 用 user message 控制语气风格，让模型自然处理中英文混排
 * 2. 不做专有名词音译替换 — MiMo 原生支持英文术语发音
 * 3. 默认使用「冰糖」中文女声
 */

export interface TtsResult {
  file_path: string;
  duration_sec: number;
  sample_rate: number;
  characters: number;
}

export interface TtsOptions {
  model?: string;
  voice?: string;
  output_dir?: string;
  style?: string;       // 自然语言风格指令
}

@Injectable()
export class TtsService {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultVoice: string;
  private outputDir: string;

  /** 默认风格指令：教学场景女声 */
  private static readonly DEFAULT_STYLE =
    '你是一位温柔、专业的中文女老师，正在录制编程教学视频的旁白。' +
    '用标准普通话朗读，吐字清晰、语速适中偏慢、语气亲切有耐心。' +
    '遇到英文单词、技术术语、函数名（如 useEffect、Flexbox、async）时，按地道的英文读音读出来，不要用中文谐音去拼读，也不要逐个字母拼读；' +
    '中英文之间自然衔接，不要刻意停顿或放慢。' +
    '正确处理标点节奏，句末语调自然下沉，不要念出标点符号本身。';

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get('MIMO_API_KEY', '');
    this.baseUrl = this.config.get('MIMO_BASE_URL', 'https://token-plan-ams.xiaomimimo.com/v1');
    this.defaultModel = this.config.get('MIMO_TTS_MODEL', 'mimo-v2.5-tts');
    this.defaultVoice = this.config.get('MIMO_TTS_VOICE', '冰糖');
    this.outputDir = this.config.get('TTS_OUTPUT_DIR', '/tmp/zhipath/tts');

    console.log(`[TTS] Init: baseUrl=${this.baseUrl}, model=${this.defaultModel}, voice=${this.defaultVoice}`);
    console.log(`[TTS] API key loaded: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' + this.apiKey.slice(-4) : 'EMPTY'}`);

    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * 文本转语音
   */
  async synthesize(text: string, options: TtsOptions = {}): Promise<TtsResult> {
    if (!text?.trim()) throw new Error('TTS 文本不能为空');

    const model = options.model || this.defaultModel;
    const voice = options.voice || this.defaultVoice;
    const outDir = options.output_dir || this.outputDir;
    const style = options.style || TtsService.DEFAULT_STYLE;

    const timestamp = Date.now();
    const hash = this.simpleHash(text);
    const filePath = path.join(outDir, `tts_${timestamp}_${hash}.wav`);

    try {
      const result = await this.callTTSApi(text, voice, model, style);

      const audioBuffer = Buffer.from(result.audioData, 'base64');
      fs.writeFileSync(filePath, audioBuffer);

      const durationSec = this.getAudioDuration(filePath);

      console.log(`[TTS] 合成完成: ${text.substring(0, 30)}... → ${filePath} (${durationSec.toFixed(2)}s)`);

      return {
        file_path: filePath,
        duration_sec: durationSec,
        sample_rate: 24000,
        characters: text.length,
      };
    } catch (e: any) {
      console.warn(`[TTS] API 调用失败，降级为时长估算: ${e.message}`);
      return {
        file_path: '',
        duration_sec: this.estimateDuration(text),
        sample_rate: 24000,
        characters: text.length,
      };
    }
  }

  /**
   * 调用 MiMo TTS API
   *
   * 正确格式（mimo-v2.5-tts 预置音色）：
   *   user message      → 风格控制指令
   *   assistant message → 待合成文本
   *   audio.voice       → 预置音色名
   *   audio.format      → wav
   */
  private async callTTSApi(
    text: string,
    voice: string,
    model: string,
    style: string,
  ): Promise<{ audioData: string; transcript: string }> {
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model,
      messages: [
        { role: 'user', content: style },
        { role: 'assistant', content: text },
      ],
      audio: {
        format: 'wav',
        voice,
      },
      stream: false,
    };

    const bodyStr = JSON.stringify(body);
    console.log(`[TTS] Calling ${url}`);
    console.log(`[TTS] Body preview: model=${model}, voice=${voice}, audio.format=wav`);
    console.log(`[TTS] Body bytes (voice region): ${Buffer.from(JSON.stringify(body.audio)).toString('hex')}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: bodyStr,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TTS API ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const msg = data.choices?.[0]?.message;

    if (!msg?.audio?.data) {
      throw new Error('TTS API 返回无音频数据');
    }

    return {
      audioData: msg.audio.data,
      transcript: msg.audio.transcript || '',
    };
  }

  /**
   * 批量合成（并发执行，最多 3 路同时请求）
   */
  async synthesizeBatch(
    segments: Array<{ id: string; text: string }>,
    options: TtsOptions = {},
    onProgress?: (done: number, total: number, current: string) => void,
  ): Promise<Map<string, TtsResult>> {
    const results = new Map<string, TtsResult>();
    const total = segments.length;
    let doneCount = 0;
    const CONCURRENCY = 3; // 最多 3 路并发，避免 API 限流

    // 分批并发执行
    for (let i = 0; i < segments.length; i += CONCURRENCY) {
      const batch = segments.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (seg) => {
          onProgress?.(doneCount, total, seg.id);
          try {
            const result = await this.synthesize(seg.text, options);
            return { id: seg.id, result };
          } catch (e: any) {
            console.error(`[TTS] 段落 ${seg.id} 合成失败:`, e.message);
            return {
              id: seg.id,
              result: {
                file_path: '',
                duration_sec: this.estimateDuration(seg.text),
                sample_rate: 24000,
                characters: seg.text.length,
              } as TtsResult,
            };
          }
        }),
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.set(r.value.id, r.value.result);
        }
        doneCount++;
      }
    }

    onProgress?.(total, total, 'done');
    return results;
  }

  /**
   * 获取音频时长
   */
  private getAudioDuration(filePath: string): number {
    try {
      const result = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
        { encoding: 'utf-8', timeout: 5000 },
      ).trim();
      const duration = parseFloat(result);
      if (!isNaN(duration) && duration > 0) return duration;
    } catch (e: any) {
      console.warn('[TTS] ffprobe failed, trying file size estimation:', e.message);
    }

    try {
      const stats = fs.statSync(filePath);
      const dataBytes = stats.size - 44;
      const durationSec = dataBytes / (2 * 24000);
      return Math.max(durationSec, 1);
    } catch (e: any) {
      console.warn('[TTS] file stat failed, using default 5s:', e.message);
      return 5;
    }
  }

  /**
   * 文本时长估算
   */
  estimateDuration(text: string): number {
    const charsPerSec = 150 / 60;
    return Math.max(text.length / charsPerSec, 1);
  }

  /** 简单哈希 */
  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36).slice(0, 8);
  }

  /**
   * 合并音频文件
   */
  async mergeAudioFiles(audioPaths: string[], outputPath: string): Promise<number> {
    const validPaths = audioPaths.filter(p => p && fs.existsSync(p));

    if (validPaths.length === 0) {
      console.warn('[TTS] 无有效音频文件可合并');
      return 0;
    }

    const listPath = outputPath + '.list.txt';
    // ffmpeg concat demuxer 需要正斜杠路径，Windows 的 path.join 会产生反斜杠
    const listContent = validPaths
      .map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
      .join('\n');

    fs.writeFileSync(listPath, listContent);

    try {
      // 不能用 -c copy：输入是 wav(PCM)，目标是 mp3 容器，直接拷贝流是非法封装、
      // 时长与可播放性都不可靠。必须重新编码为 mp3。
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c:a libmp3lame -q:a 2 "${outputPath}"`,
        { encoding: 'utf-8', timeout: 30000 },
      );

      return this.getAudioDuration(outputPath);
    } finally {
      try { fs.unlinkSync(listPath); } catch {}
    }
  }
}
