// 智途 ZhiPath 智能体类型定义
// 复制到前端项目中使用

// 多模态资源
export interface MultimodalResources {
  skill: string;
  resources: {
    video: VideoResource;
    animation: AnimationResource;
    diagram: DiagramResource;
    avatar: AvatarResource;
  };
  generated_at: number;
}

export interface VideoResource {
  type: 'video';
  title: string;
  duration: string;
  overview: string;
  scenes: VideoScene[];
  video_url: string | null;
  video_status: 'not_started' | 'generated' | 'failed';
  source: string;
}

export interface VideoScene {
  time: string;
  title: string;
  description: string;
  narration: string;
}

export interface AnimationResource {
  type: 'animation';
  title: string;
  code: string;
  language: string;
  framework: string;
  render_command?: string;
  video_url: string | null;
  video_status: string;
  description: string;
}

export interface DiagramResource {
  type: 'diagram';
  diagrams: {
    flowchart: DiagramItem | null;
    architecture: DiagramItem | null;
    sequence: DiagramItem | null;
  };
  format: string;
}

export interface DiagramItem {
  title: string;
  code: string;
}

export interface AvatarResource {
  type: 'avatar_video';
  title: string;
  script: string;
  word_count: number;
  estimated_duration: string;
  video_url: string | null;
  video_status: 'not_started' | 'generated' | 'failed';
  source: string;
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actions?: ActionResult[];
  photoUrl?: string;
}

export interface ActionResult {
  type: string;
  data: any;
}

// API 响应
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// 数字人形象/声音选项
export interface AvatarOption {
  id: string;
  name: string;
  description: string;
  style: string;
  gender: 'male' | 'female';
}

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female';
}
