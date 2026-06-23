/**
 * 视频脚本类型定义（与 backend-ts 对齐）
 */

export type SegmentType =
  | 'title_card'
  | 'bullet_points'
  | 'code_walkthrough'
  | 'diagram'
  | 'formula'
  | 'comparison'
  | 'summary'
  | 'highlight_reel';

export interface TitleVisual {
  type: 'title';
  title: string;
  subtitle?: string;
  background?: string;
}

export interface BulletPointsVisual {
  type: 'bullets';
  items: string[];
  highlight_index?: number;
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

export interface VideoSegment {
  id: string;
  type: SegmentType;
  narration: string;
  visual: SegmentVisual;
  emphasis: string[];
  estimated_duration_sec: number;
  audio?: {
    file_path: string;
    duration_sec: number;
    sample_rate: number;
  };
}

export interface VideoScript {
  skill_name: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  total_segments: number;
  segments: VideoSegment[];
}

export interface AudioSegment {
  id: string;
  file_path: string;
  duration_sec: number;
  start_frame: number;
  end_frame: number;
  /** 渲染前由 render.ts 暂存到 public 后写入的 staticFile 相对路径 */
  staticSrc?: string;
}

export const VIDEO_THEME = {
  canvas: {
    width: 1920,
    height: 1080,
    fps: 30,
    backgroundColor: '#0F172A',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    accent: '#818CF8',
    code: '#34D399',
  },
  codeBlock: {
    background: '#1E293B',
    border: '#334155',
    lineNumberColor: '#475569',
    highlightBackground: '#1E1B4B',
  },
  fonts: {
    heading: 'Noto Sans SC, sans-serif',
    body: 'Noto Sans SC, sans-serif',
    code: 'JetBrains Mono, monospace',
  },
  timing: {
    segmentTransition: 15,
    bulletStagger: 12,
    codeTypingSpeed: 2,
    emphasisPulseDuration: 20,
  },
} as const;
