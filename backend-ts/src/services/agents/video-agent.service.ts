import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { LlmService } from '../llm.service';
import { TtsService } from '../tts.service';
import { VideoRenderService } from '../video-render.service';
import { AgentCacheService } from './cache.service';
import { TokenTrackerService } from './token-tracker.service';
import { KnowledgeBaseService } from '../knowledge-base.service';
import { extractJson } from '../../common/json-repair';
import {
  VideoScript,
  VideoSegment,
  VideoAgentInput,
  VideoAgentOutput,
  SegmentType,
  SegmentVisual,
  VIDEO_DEFAULTS,
} from './video-agent.types';

/**
 * VideoAgent — 教学视频生成智能体
 *
 * 四阶段管线：
 *   Stage 1: LLM 生成结构化脚本（JSON 按片段拆分）
 *   Stage 2: TTS 逐段配音（拿到精确时长驱动画面节奏）
 *   Stage 3: Remotion 渲染画面（本地计算，无 API 费用）
 *   Stage 4: FFmpeg 合成成片
 *
 * 成本结构：LLM 脚本（便宜）+ TTS 配音（便宜）+ 本地渲染（固定算力）
 * 视频时长增长 ≠ 费用线性增长
 */
@Injectable()
export class VideoAgentService {
  constructor(
    private llmService: LlmService,
    private ttsService: TtsService,
    private renderService: VideoRenderService,
    private cacheService: AgentCacheService,
    private tokenTracker: TokenTrackerService,
    private knowledgeBase: KnowledgeBaseService,
  ) {}

  /**
   * 生成教学视频（完整管线）
   *
   * @param input 视频生成参数
   * @param onProgress 进度回调（stage, progress, message）
   */
  async generate(
    input: VideoAgentInput,
    onProgress?: (stage: string, progress: number, message: string) => void,
  ): Promise<VideoAgentOutput> {
    const startTime = Date.now();
    const { skill_name, difficulty, knowledge_content, task_id } = input;

    if (!skill_name?.trim()) {
      return this.fail(task_id, '请提供技能名称');
    }

    // 尝试缓存
    const cacheKey = this.cacheService.generateKey('VideoAgent', 'generate', {
      skill: skill_name.trim(),
      difficulty,
    });
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      // 验证缓存中的视频文件是否真实存在
      const videoOk = cached.video_file_path && fs.existsSync(cached.video_file_path);
      if (videoOk) {
        console.log(`[VideoAgent] 缓存命中: ${skill_name}`);
        return {
          current_agent: 'VideoAgent',
          task_id,
          status: 'completed',
          result: cached,
        };
      }
      // 视频文件不存在，清除失效缓存，重新生成
      console.warn(`[VideoAgent] 缓存失效（视频文件不存在），清除缓存并重新生成: ${skill_name}`);
      await this.cacheService.del(cacheKey);
    }

    let llmTokens = 0;
    let ttsChars = 0;

    try {
      // ── Stage 1: LLM 脚本生成 ──
      onProgress?.('script', 0, '正在生成视频脚本...');
      console.log(`[VideoAgent] Stage 1: 开始生成脚本 - ${skill_name}`);

      let script: VideoScript;
      try {
        script = await this.generateScript(
          skill_name.trim(),
          difficulty,
          knowledge_content,
          input.target_duration_sec,
        );
        llmTokens = script._usage?.total_tokens || 0;
        console.log(`[VideoAgent] Stage 1: 脚本生成成功 - ${script.total_segments} 个片段`);
      } catch (e: any) {
        console.error(`[VideoAgent] Stage 1: 脚本生成失败:`, e.message);
        // 降级：使用 fallback 脚本
        script = this.fallbackScript(skill_name.trim(), difficulty);
        console.log(`[VideoAgent] Stage 1: 使用降级脚本`);
      }

      onProgress?.('script', 100, `脚本生成完成（${script.total_segments} 个片段）`);

      // ── Stage 2: TTS 逐段配音 ──
      onProgress?.('tts', 0, '正在合成配音...');
      const totalChars = script.segments.reduce((sum, s) => sum + s.narration.length, 0);
      ttsChars = totalChars;

      const ttsSegments = script.segments.map(s => ({
        id: s.id,
        text: s.narration,
      }));

      let doneChars = 0;
      const ttsResults = await this.ttsService.synthesizeBatch(
        ttsSegments,
        {},
        (done, total, currentId) => {
          const seg = script.segments.find(s => s.id === currentId);
          if (seg) doneChars += seg.narration.length;
          const pct = Math.round((doneChars / totalChars) * 100);
          onProgress?.('tts', pct, `配音合成中 ${done + 1}/${total}`);
        },
      );

      // 写回音频时长到脚本
      for (const seg of script.segments) {
        const audio = ttsResults.get(seg.id);
        if (audio) {
          seg.audio = {
            file_path: audio.file_path,
            duration_sec: audio.duration_sec,
            sample_rate: audio.sample_rate,
          };
        }
      }

      const totalDuration = script.segments.reduce(
        (sum, s) => sum + (s.audio?.duration_sec || s.estimated_duration_sec),
        0,
      );
      onProgress?.('tts', 100, `配音合成完成（${totalDuration.toFixed(1)}秒）`);

      // ── Stage 3: Remotion 渲染 ──
      onProgress?.('render', 0, '正在检查渲染环境...');
      const envCheck = this.renderService.checkEnvironment();
      if (!envCheck.ready) {
        console.warn(`[VideoAgent] 渲染环境不完整: ${envCheck.issues.join(', ')}`);
        onProgress?.('render', 50, '渲染环境未就绪，仅保存脚本和音频');
      } else {
        onProgress?.('render', 10, '正在渲染视频...');

        // 准备音频段落数据
        const audioSegmentsData = script.segments
          .filter(s => s.audio?.file_path)
          .map(s => ({
            id: s.id,
            file_path: s.audio!.file_path,
            duration_sec: s.audio!.duration_sec,
          }));

        try {
          const renderResult = await this.renderService.render(
            script as any,
            audioSegmentsData,
            task_id,
          );
          onProgress?.('render', 80, `渲染完成（${renderResult.render_time_sec.toFixed(1)}秒）`);
        } catch (e: any) {
          console.error(`[VideoAgent] 渲染失败:`, e.message);
          onProgress?.('render', 80, `渲染失败: ${e.message}`);
          // 渲染失败不缓存，抛出让外层 catch 处理
          throw new Error(`视频渲染失败: ${e.message}`);
        }
      }

      // ── Stage 4: 持久化 ──
      onProgress?.('compose', 80, '正在保存到知识库...');

      // 合并音频用于播放
      const audioPaths = script.segments
        .map(s => s.audio?.file_path)
        .filter((p): p is string => !!p);

      let mergedAudioPath = '';
      if (audioPaths.length > 0) {
        mergedAudioPath = `${this.renderService.outputDir}/${task_id}_audio.mp3`;
        await this.ttsService.mergeAudioFiles(audioPaths, mergedAudioPath);
      }

      const videoFilePath = `${this.renderService.outputDir}/${task_id}.mp4`;

      const videoData = {
        script,
        audio_file: mergedAudioPath,
        video_file: videoFilePath,
        duration_sec: totalDuration,
        segments_count: script.total_segments,
        style: input.style || 'default',
        width: VIDEO_DEFAULTS.width,
        height: VIDEO_DEFAULTS.height,
        fps: VIDEO_DEFAULTS.fps,
      };

      try {
        await this.knowledgeBase.saveVideo(skill_name.trim(), videoData, difficulty);
        console.log(`[VideoAgent] 知识库保存成功`);
      } catch (saveError: any) {
        console.error(`[VideoAgent] 知识库保存失败:`, saveError.message);
        // 不影响整体流程，继续返回结果
      }

      const renderTime = (Date.now() - startTime) / 1000;
      onProgress?.('compose', 100, `视频生成完成（${totalDuration.toFixed(1)}秒）`);

      const result = {
        video_file_path: videoFilePath,
        audio_file_path: mergedAudioPath,
        duration_sec: totalDuration,
        segments_count: script.total_segments,
        script,
        cost_estimate: {
          llm_tokens: llmTokens,
          tts_characters: ttsChars,
          render_time_sec: renderTime,
        },
      };

      // 写入缓存（2小时）
      await this.cacheService.set(cacheKey, result, 7200);

      return {
        current_agent: 'VideoAgent',
        task_id,
        status: 'completed',
        result,
      };
    } catch (e: any) {
      console.error(`[VideoAgent] 生成失败:`, e.message);
      console.error(`[VideoAgent] 错误堆栈:`, e.stack);

      // 清理残留文件（音频、视频、脚本 JSON）
      try {
        const outputDir = this.renderService.outputDir;
        const patterns = [
          `${outputDir}/${task_id}.mp4`,
          `${outputDir}/${task_id}_audio.mp3`,
          `${outputDir}/${task_id}_script.json`,
          `${outputDir}/${task_id}_audio.json`,
        ];
        for (const f of patterns) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
        // 清理 TTS 音频段落目录
        const segDir = `${outputDir}/${task_id}_segments`;
        if (fs.existsSync(segDir)) fs.rmSync(segDir, { recursive: true, force: true });
        console.log(`[VideoAgent] 已清理残留文件`);
      } catch (cleanupErr: any) {
        console.warn(`[VideoAgent] 清理残留文件失败:`, cleanupErr.message);
      }

      return this.fail(task_id, e.message);
    }
  }

  // ── Stage 1: LLM 脚本生成 ──────────────────────────

  private async generateScript(
    skillName: string,
    difficulty: string,
    knowledgeContent: string,
    targetDuration?: number,
  ): Promise<VideoScript & { _usage?: any }> {
    const duration = targetDuration || VIDEO_DEFAULTS.targetDurationSec;
    const messages = this.buildScriptPrompt(skillName, difficulty, knowledgeContent, duration);

    const result = await this.llmService.chatCompletionWithUsage(messages, {
      temperature: 0.7,
      maxTokens: 8192,
      tier: 'pro',
    });

    // 记录 token 用量
    this.tokenTracker.record({
      agent: 'VideoAgent',
      action: 'generate_script',
      inputTokens: result.usage.prompt_tokens,
      outputTokens: result.usage.completion_tokens,
      totalTokens: result.usage.total_tokens,
      model: result.model,
      tier: result.tier,
      timestamp: Date.now(),
      durationMs: 0,
    });

    // 解析 JSON 脚本
    const script = this.parseScript(result.content, skillName, difficulty);
    script._usage = {
      total_tokens: result.usage.total_tokens,
      model: result.model,
    };

    return script;
  }

  private buildScriptPrompt(
    skillName: string,
    difficulty: string,
    knowledgeContent: string,
    targetDuration: number,
  ): Array<{ role: string; content: string }> {
    const diffConfig: Record<string, { desc: string; style: string }> = {
      beginner: {
        desc: '零基础入门',
        style: '用生活类比引入概念，避免术语堆砌',
      },
      intermediate: {
        desc: '进阶提升',
        style: '假设学生用过但不深入，讲"为什么"',
      },
      advanced: {
        desc: '高级深入',
        style: '讲底层原理和边界情况',
      },
    };
    const config = diffConfig[difficulty] || diffConfig.beginner;

    const systemPrompt = `你是教学视频脚本生成器。为技能「${skillName}」生成结构化视频脚本（${config.desc}）。

## 核心原则：解说词必须讲画面上的东西
narration（解说词）和 visual（画面）是同一段内容的"声音版"和"图像版"，必须严格对应：
- 画面显示几条要点，解说词就按**同样的顺序**逐条展开讲解，一条都不漏、不抢顺序
- 画面显示代码，解说词就讲这段代码在做什么、关键行的作用
- 画面显示对比，解说词就先讲左边再讲右边
- 画面显示标题/关键词，解说词就引出并点题
- 严禁出现画面上没有、解说词却在讲的内容，反之亦然
口语化但不啰嗦，像老师指着屏幕一条条讲（但不要说出"如图""请看屏幕"这种字眼，而是自然地讲到那条内容本身）。

## 输出规则
1. 必须输出合法 JSON，不要包含任何非 JSON 内容
2. narration 是口语化解说词（不是书面语）
3. narration 的句子顺序 = visual 元素的呈现顺序（要点/代码行/对比项一一对应）
4. 每段 narration 按 ${VIDEO_DEFAULTS.ttsCharsPerMinute} 字/分钟估算时长，写进 estimated_duration_sec
5. 单段要点（items）控制在 2-5 条，太多会导致画面浮现节奏和解说词脱节
6. emphasis 标注需要视觉高亮的关键词（必须是 narration 里真实出现的词）
7. 代码片段必须完整可运行，不要省略
8. 总片段数 3-${VIDEO_DEFAULTS.maxSegments} 个，总时长目标：${targetDuration} 秒

## 片段类型（type 字段）

| type | 适用场景 | visual 结构 |
|------|---------|------------|
| title_card | 视频开头 | {"type":"title","title":"...","subtitle":"..."} |
| bullet_points | 概念列举 | {"type":"bullets","items":["..."],"highlight_index":-1} |
| code_walkthrough | 代码讲解 | {"type":"code","language":"ts","code":"...","highlight_lines":[2],"typing_effect":true} |
| diagram | 流程说明 | {"type":"flowchart","nodes":[...],"edges":[...]} |
| formula | 数学公式 | {"type":"formula","latex":"..."} |
| comparison | 概念对比 | {"type":"comparison","left_title":"...","left_items":[...],"right_title":"...","right_items":[...]} |
| summary | 视频结尾 | {"type":"key_points","points":["..."]} |
| highlight_reel | 强调重点 | {"type":"keywords","keywords":["..."]} |

## 对应示例（bullet_points）
{
  "type": "bullet_points",
  "narration": "useEffect 主要用在三个地方。第一，发起数据请求，比如调用接口拿数据。第二，订阅事件，像监听 WebSocket 消息。第三，手动操作 DOM，比如设置标题。",
  "visual": { "type": "bullets", "items": ["发起数据请求（调用接口）", "订阅事件（监听 WebSocket）", "手动操作 DOM"], "highlight_index": -1 },
  "emphasis": ["数据请求", "订阅事件", "DOM"]
}
注意：解说词三句话，画面三条要点，顺序完全一致。

## JSON 结构

{
  "skill_name": "${skillName}",
  "difficulty": "${difficulty}",
  "total_segments": 5,
  "segments": [
    {
      "id": "seg_01",
      "type": "title_card",
      "narration": "口语化解说词",
      "visual": { ... },
      "emphasis": ["关键词"],
      "estimated_duration_sec": 5
    }
  ]
}

## 难度风格：${config.style}

## 参考知识内容
${knowledgeContent.slice(0, 3000)}`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `为「${skillName}」生成教学视频脚本` },
    ];
  }

  private parseScript(raw: string, skillName: string, difficulty: string): VideoScript {
    // 提取 JSON（可能被 markdown 代码块包裹）
    try {
      const parsed = extractJson(raw);

      // 校验基本结构
      if (!parsed.segments || !Array.isArray(parsed.segments)) {
        throw new Error('脚本缺少 segments 数组');
      }

      // 标准化片段
      const segments: VideoSegment[] = parsed.segments.map((seg: any, i: number) => ({
        id: seg.id || `seg_${String(i + 1).padStart(2, '0')}`,
        type: this.validateSegmentType(seg.type),
        narration: String(seg.narration || ''),
        visual: this.normalizeVisual(seg.type, seg.visual),
        emphasis: Array.isArray(seg.emphasis) ? seg.emphasis : [],
        estimated_duration_sec: Number(seg.estimated_duration_sec) || 5,
      }));

      return {
        skill_name: parsed.skill_name || skillName,
        difficulty: parsed.difficulty || difficulty,
        total_segments: segments.length,
        segments,
      };
    } catch (e: any) {
      console.error(`[VideoAgent] JSON 解析失败，尝试修复:`, e.message);
      return this.fallbackScript(skillName, difficulty);
    }
  }

  private validateSegmentType(type: string): SegmentType {
    const valid: SegmentType[] = [
      'title_card', 'bullet_points', 'code_walkthrough',
      'diagram', 'formula', 'comparison', 'summary', 'highlight_reel',
    ];
    return valid.includes(type as SegmentType) ? (type as SegmentType) : 'bullet_points';
  }

  private normalizeVisual(type: string, visual: any): SegmentVisual {
    if (!visual) {
      return { type: 'bullets', items: ['内容加载中...'] };
    }
    return visual as SegmentVisual;
  }

  /** LLM 输出不可用时的降级脚本 */
  private fallbackScript(skillName: string, difficulty: string): VideoScript {
    return {
      skill_name: skillName,
      difficulty: difficulty as any,
      total_segments: 3,
      segments: [
        {
          id: 'seg_01',
          type: 'title_card',
          narration: `今天我们来学习${skillName}。`,
          visual: { type: 'title', title: skillName, subtitle: '快速入门' },
          emphasis: [skillName],
          estimated_duration_sec: 5,
        },
        {
          id: 'seg_02',
          type: 'bullet_points',
          narration: `让我们了解一下${skillName}的核心概念。`,
          visual: { type: 'bullets', items: [`${skillName} 基础`, `核心用法`, `最佳实践`], highlight_index: 0 },
          emphasis: [skillName],
          estimated_duration_sec: 8,
        },
        {
          id: 'seg_03',
          type: 'summary',
          narration: `今天我们学习了${skillName}的基础知识，希望对你有帮助。`,
          visual: { type: 'key_points', points: [`${skillName} 核心概念`] },
          emphasis: [skillName],
          estimated_duration_sec: 5,
        },
      ],
    };
  }

  private fail(taskId: string, error: string): VideoAgentOutput {
    return {
      current_agent: 'VideoAgent',
      task_id: taskId,
      status: 'failed',
      error,
    };
  }
}
