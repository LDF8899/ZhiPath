/**
 * VideoAgent 类型定义
 *
 * 视频脚本 JSON 结构 + TTS 音频元数据 + 渲染配置
 */

// ── 片段视觉类型 ──────────────────────────────────

export type SegmentType =
  | 'title_card'
  | 'bullet_points'
  | 'code_walkthrough'
  | 'diagram'
  | 'formula'
  | 'comparison'
  | 'summary'
  | 'highlight_reel';

// ── 片段视觉配置（按 type 区分） ──────────────────

export interface TitleVisual {
  type: 'title';
  title: string;
  subtitle?: string;
  background?: string;
}

export interface BulletPointsVisual {
  type: 'bullets';
  items: string[];
  highlight_index?: number; // -1 = 所有高亮，>=0 = 指定索引
}

export interface CodeWalkthroughVisual {
  type: 'code';
  language: string;
  code: string;
  highlight_lines?: number[];
  typing_effect?: boolean;
}

export interface DiagramVisual {
  type: 'flowchart';
  nodes: Array<{ id: string; label: string; x: number; y: number }>;
  edges: Array<{ from: string; to: string; label?: string }>;
}

export interface FormulaVisual {
  type: 'formula';
  latex: string;
  highlight_parts?: string[];
}

export interface ComparisonVisual {
  type: 'comparison';
  left_title: string;
  left_items: string[];
  right_title: string;
  right_items: string[];
}

export interface SummaryVisual {
  type: 'key_points';
  points: string[];
}

export interface HighlightReelVisual {
  type: 'keywords';
  keywords: string[];
}

export type SegmentVisual =
  | TitleVisual
  | BulletPointsVisual
  | CodeWalkthroughVisual
  | DiagramVisual
  | FormulaVisual
  | ComparisonVisual
  | SummaryVisual
  | HighlightReelVisual;

// ── 脚本片段 ──────────────────────────────────

export interface VideoSegment {
  id: string;
  type: SegmentType;
  narration: string;           // 口语化解说词
  visual: SegmentVisual;
  emphasis: string[];          // 需要视觉高亮的关键词
  estimated_duration_sec: number; // LLM 预估时长（仅参考，实际由 TTS 驱动）

  // TTS 阶段写入
  audio?: {
    file_path: string;
    duration_sec: number;      // 精确时长，驱动 Remotion 渲染
    sample_rate: number;
  };
}

// ── 脚本（LLM 输出） ──────────────────────────────

export interface VideoScript {
  skill_name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  total_segments: number;
  segments: VideoSegment[];
  _usage?: {
    total_tokens: number;
    model: string;
  };
}

// ── VideoAgent 输入 ──────────────────────────────

export interface VideoAgentInput {
  task_id: string;
  skill_name: string;
  knowledge_content: string;      // 知识库内容（讲义文本）
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  target_duration_sec?: number;   // 目标时长（默认 60-90 秒）
  style?: 'default' | 'dark' | 'light';
  tts_provider?: 'edge' | 'mimo';
}

// ── VideoAgent 输出 ──────────────────────────────

export interface VideoAgentOutput {
  current_agent: 'VideoAgent';
  task_id: string;
  status: 'completed' | 'failed';
  result?: {
    video_file_path: string;
    audio_file_path?: string;
    duration_sec: number;
    segments_count: number;
    script: VideoScript;
    cost_estimate: {
      llm_tokens: number;
      tts_characters: number;
      render_time_sec: number;
    };
  };
  error?: string;
}

// ── SSE 进度事件 ──────────────────────────────

export interface VideoProgressEvent {
  event: 'agent_progress';
  agent: 'VideoAgent';
  task_id: string;
  stage: 'script' | 'tts' | 'render' | 'compose';
  progress: number;  // 0-100
  message: string;
}

// ── 渲染配置 ──────────────────────────────

export const VIDEO_DEFAULTS = {
  width: 1920,
  height: 1080,
  fps: 30,
  backgroundColor: '#0F172A',
  targetDurationSec: 75,       // 默认目标时长
  minDurationSec: 30,
  maxDurationSec: 120,
  maxSegments: 8,
  ttsCharsPerMinute: 150,     // 中文语速估算
} as const;
