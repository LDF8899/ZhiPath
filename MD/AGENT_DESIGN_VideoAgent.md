# VideoAgent 设计说明

> 所属项目：智途 ZhiPath
> 设计日期：2026-06-17
> 更新日期：2026-06-17（API 测试验证）
> 状态：已验证

---

## 一、定位与目标

### 1.1 一句话定义

**VideoAgent 是学习资源生成管线中的视频子智能体，负责将技能知识点转化为结构化的教学短视频。**

### 1.2 核心思路

把"生成视频"拆解为可控的四个环节，**完全绕开按秒计费的视频生成模型**：

| 环节 | 负责者 | 成本模型 |
|------|--------|----------|
| 脚本生成 | LLM | 按 token 计费（便宜） |
| 配音合成 | TTS | 按字符计费（便宜，可自部署） |
| 画面渲染 | Remotion（本地计算） | 固定算力开销 |
| 成片合成 | FFmpeg | 固定算力开销 |

**成本结构：** 视频时长增长 ≠ 费用线性增长。唯一的可变成本是 LLM 脚本和 TTS 配音，画面合成全程本地计算。

### 1.3 在 Agent 体系中的位置

```
ResourceAgent（学习资源生成总控）
    ├── VideoAgent    ← 本设计（教学视频）
    ├── LectureAgent  （讲义生成）
    ├── QuestionAgent （题目生成）
    └── GraphAgent    （知识图谱）

触发链路：
PlannerAgent 创建学习计划
    → ResourceAgent 拆解技能点
        → VideoAgent 为每个技能点生成教学视频
```

---

## 二、四阶段管线

### 2.1 全景流程

```
输入：技能点名称 + 知识库内容 + 难度级别
                    ↓
┌─────────────────────────────────────────────────┐
│  Stage 1: LLM 脚本生成                           │
│  输入：技能点知识内容                              │
│  输出：结构化 JSON 脚本（按片段拆分）               │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Stage 2: TTS 逐段配音                           │
│  输入：每段解说词文本                              │
│  输出：每段音频文件 + 精确时长（秒）                │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Stage 3: Remotion 画面渲染                       │
│  输入：脚本 JSON + 音频时长                        │
│  输出：视频帧序列                                  │
└──────────────────────┬──────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────┐
│  Stage 4: FFmpeg 合成成片                         │
│  输入：视频帧 + 音频轨                            │
│  输出：最终 .mp4 文件                             │
└─────────────────────────────────────────────────┘
```

---

## 三、Stage 1：LLM 脚本生成

### 3.1 输出 JSON 结构

```json
{
  "skill_name": "React Hooks — useEffect",
  "difficulty": "beginner",
  "total_segments": 5,
  "segments": [
    {
      "id": "seg_01",
      "type": "title_card",
      "narration": "今天我们来学习 React Hooks 中最重要的一个——useEffect。",
      "visual": {
        "type": "title",
        "title": "React Hooks: useEffect",
        "subtitle": "副标题文字",
        "background": "gradient_blue"
      },
      "emphasis": ["useEffect"],
      "estimated_duration_sec": 5
    },
    {
      "id": "seg_02",
      "type": "bullet_points",
      "narration": "useEffect 主要用于三个场景：第一，数据获取；第二，订阅事件；第三，手动修改 DOM。",
      "visual": {
        "type": "bullets",
        "items": [
          "数据获取（API 调用）",
          "订阅事件（WebSocket / 事件监听）",
          "手动修改 DOM"
        ],
        "highlight_index": -1
      },
      "emphasis": ["数据获取", "订阅事件", "修改 DOM"],
      "estimated_duration_sec": 8
    },
    {
      "id": "seg_03",
      "type": "code_walkthrough",
      "narration": "来看一个基本用法。useEffect 接收两个参数：第一个是副作用函数，第二个是依赖数组。",
      "visual": {
        "type": "code",
        "language": "typescript",
        "code": "useEffect(() => {\n  fetchData();\n}, [userId]);",
        "highlight_lines": [2],
        "typing_effect": true
      },
      "emphasis": ["副作用函数", "依赖数组"],
      "estimated_duration_sec": 10
    },
    {
      "id": "seg_04",
      "type": "diagram",
      "narration": "执行流程是这样的：组件渲染后，React 检查依赖数组是否变化，如果变化了就执行副作用函数。",
      "visual": {
        "type": "flowchart",
        "nodes": [
          {"id": "a", "label": "组件渲染", "x": 100, "y": 200},
          {"id": "b", "label": "检查依赖", "x": 350, "y": 200},
          {"id": "c", "label": "执行副作用", "x": 600, "y": 200}
        ],
        "edges": [
          {"from": "a", "to": "b", "label": ""},
          {"from": "b", "to": "c", "label": "依赖变化"}
        ]
      },
      "emphasis": ["依赖数组", "副作用函数"],
      "estimated_duration_sec": 8
    },
    {
      "id": "seg_05",
      "type": "summary",
      "narration": "总结一下：useEffect 是处理副作用的 Hook，通过依赖数组控制执行时机，记得在清理函数中取消订阅。",
      "visual": {
        "type": "key_points",
        "points": [
          "useEffect = 副作用 Hook",
          "依赖数组控制执行时机",
          "清理函数防止内存泄漏"
        ]
      },
      "emphasis": ["副作用", "依赖数组", "清理函数"],
      "estimated_duration_sec": 7
    }
  ]
}
```

### 3.2 片段类型清单

| type 值 | 视觉表现 | 适用场景 |
|---------|---------|---------|
| `title_card` | 标题 + 副标题 + 渐变背景 | 视频开头 |
| `bullet_points` | 逐条浮现的要点列表 | 概念列举 |
| `code_walkthrough` | 代码逐行/逐字高亮 | 代码讲解 |
| `diagram` | 流程图/关系图动画 | 流程说明 |
| `formula` | 数学公式渲染 | 算法/数学 |
| `comparison` | 左右对比布局 | 概念对比 |
| `summary` | 关键点收束 | 视频结尾 |
| `highlight_reel` | 关键词大字居中 | 强调重点 |

### 3.3 Prompt 模板

```typescript
const SCRIPT_GENERATION_PROMPT = `
你是教学视频脚本生成器。

## 输入
- 技能名称：{skill_name}
- 知识内容：{knowledge_content}
- 难度级别：{difficulty}
- 目标时长：{target_duration}秒（30-120秒）

## 输出规则
1. 必须输出合法 JSON，结构如下
2. 每个 segment 的 narration 是口语化的解说词（不是书面语）
3. narration 不要出现"如图所示""请看屏幕"这类指代词（画面是程序生成的，不是真人拍摄）
4. 每段 estimated_duration_sec 按 150 字/分钟估算（中文）
5. emphasis 标注需要视觉高亮的关键词
6. 代码片段必须完整可运行，不要省略
7. 总片段数 3-8 个

## 输出 JSON 结构
{
  "skill_name": "string",
  "difficulty": "beginner|intermediate|advanced",
  "total_segments": number,
  "segments": [
    {
      "id": "seg_XX",
      "type": "title_card|bullet_points|code_walkthrough|diagram|formula|comparison|summary|highlight_reel",
      "narration": "口语化解说词",
      "visual": { ... },
      "emphasis": ["关键词1", "关键词2"],
      "estimated_duration_sec": number
    }
  ]
}
`;
```

---

## 四、Stage 2：TTS 逐段配音

### 4.1 流程

```
遍历 segments[]
    ↓
提取每段 narration 文本
    ↓
调用 TTS API → 生成音频文件
    ↓
获取音频精确时长（ffprobe 或 TTS 返回的 duration）
    ↓
写回 segment.audio = { file_path, duration_sec }
```

### 4.2 数据结构（写回 JSON）

```json
{
  "id": "seg_01",
  "narration": "...",
  "audio": {
    "file_path": "/tmp/video_gen/seg_01.mp3",
    "duration_sec": 4.82,
    "sample_rate": 24000
  }
}
```

### 4.3 MiMo TTS API 调用规范（已验证 2026-06-17）

**⚠️ 关键发现：TTS 走 `/chat/completions` 接口，不是 `/audio/speech`！**

| 模型 | 接口 | Messages 格式 | 延迟 | 状态 |
|------|------|--------------|------|------|
| mimo-v2.5-tts-voicedesign | `/chat/completions` | `{role:'user', content:'文本'}` | 3.4s | ✅ 推荐 |
| mimo-v2.5-tts | `/chat/completions` | 需要 assistant 预设 | 5.8s | ✅ |
| mimo-v2-tts | `/chat/completions` | 需要 assistant 预设 | 4.1s | ✅ |
| mimo-v2.5-tts-voiceclone | `/chat/completions` | 需要音频输入 | - | ❌ 不可用 |

**正确调用方式：**
```javascript
// ✅ 正确 — 走 /chat/completions
const resp = await fetch(`${BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: 'mimo-v2.5-tts-voicedesign',  // 推荐：无需 assistant 预设
    messages: [{ role: 'user', content: '要合成的文本' }],
    // ❌ 不能有 system role！
    max_tokens: 1000,
    stream: false,
  }),
});
const data = await resp.json();
const audioBase64 = data.choices[0].message.audio.data;  // base64 WAV

// ❌ 错误 — /audio/speech 返回 404
fetch(`${BASE_URL}/audio/speech`, { ... })
```

**响应结构：**
```json
{
  "choices": [{
    "message": {
      "content": "",
      "audio": {
        "id": "xxx",
        "data": "UklGR...",       // base64 编码的 WAV 音频
        "transcript": "...",       // 转录文本
        "expires_at": 1234567890
      }
    }
  }],
  "usage": { "total_tokens": 55 }
}
```

**模型配置要求：**
- ❌ 不能有 `system` role（返回 400）
- mimo-v2.5-tts / mimo-v2-tts 需要 `assistant` 预设（空 content）
- mimo-v2.5-tts-voicedesign 直接 `user` 即可（推荐默认）

### 4.4 时长驱动画面节奏

```
TTS 返回的 duration_sec 直接作为 Remotion Composition 的时长：

segment.audio.duration_sec → <Composition durationInFrames={fps * duration_sec} />

音画天然对齐，无需额外处理。
```

---

## 五、Stage 3：Remotion 画面渲染

### 5.1 为什么选 Remotion

| 对比项 | Remotion | FFmpeg 滤镜 | Canvas API |
|--------|----------|------------|------------|
| 开发体验 | React 组件，热更新 | 字符串拼接，调试痛苦 | 命令式，代码量大 |
| 动画能力 | Spring/CSS/JS 全支持 | 基础变换 | 自己实现 |
| 与现有栈一致性 | ✅ React + TS | ❌ | ❌ |
| 渲染质量 | 逐帧精确 | 有丢帧风险 | 取决于实现 |
| 学习成本 | 低（会 React 就会） | 中 | 中 |

### 5.2 组件架构

```
src/video/
├── VideoGenerator.tsx          # 根 Composition
├── compositions/
│   ├── TitleCard.tsx           # 标题卡片
│   ├── BulletPoints.tsx        # 要点列表
│   ├── CodeWalkthrough.tsx     # 代码走读
│   ├── Diagram.tsx             # 流程图
│   ├── Formula.tsx             # 公式渲染
│   ├── Comparison.tsx          # 对比布局
│   ├── Summary.tsx             # 总结收束
│   └── HighlightReel.tsx       # 关键词大字
├── components/
│   ├── TextReveal.tsx          # 逐字浮现动画
│   ├── CodeHighlight.tsx       # 代码高亮 + 打字机
│   ├── FlowChart.tsx           # 流程图渲染
│   ├── AnimatedBullets.tsx     # 逐条浮现列表
│   └── KeywordEmphasis.tsx     # 关键词高亮脉冲
├── styles/
│   ├── theme.ts                # 主题配色
│   └── fonts.ts                # 字体配置
└── types.ts                    # 脚本 JSON 类型定义
```

### 5.3 核心组件示例

```tsx
// compositions/BulletPoints.tsx
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { AnimatedBullets } from '../components/AnimatedBullets';
import type { BulletPointsSegment } from '../types';

interface Props {
  segment: BulletPointsSegment;
}

export const BulletPoints: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div className="bullet-points-composition">
      {/* 标题区域 */}
      <h2 className="section-title">
        {segment.visual.title || segment.emphasis[0]}
      </h2>

      {/* 逐条浮现的列表 */}
      <AnimatedBullets
        items={segment.visual.items}
        frame={frame}
        fps={fps}
        staggerFrames={15}       // 每条间隔 15 帧
        highlightIndex={segment.visual.highlight_index}
        emphasis={segment.emphasis}
      />
    </div>
  );
};
```

```tsx
// components/AnimatedBullets.tsx
import { spring, interpolate } from 'remotion';

interface Props {
  items: string[];
  frame: number;
  fps: number;
  staggerFrames: number;
  highlightIndex: number;
  emphasis: string[];
}

export const AnimatedBullets: React.FC<Props> = ({
  items, frame, fps, staggerFrames, highlightIndex, emphasis
}) => {
  return (
    <ul className="animated-bullets">
      {items.map((item, i) => {
        const delay = i * staggerFrames;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 12, stiffness: 80 },
        });

        const opacity = interpolate(progress, [0, 1], [0, 1]);
        const translateX = interpolate(progress, [0, 1], [40, 0]);

        // 关键词高亮
        const isHighlighted = emphasis.some(kw => item.includes(kw));
        const shouldPulse = highlightIndex === i || highlightIndex === -1 && isHighlighted;

        return (
          <li
            key={i}
            style={{
              opacity,
              transform: `translateX(${translateX}px)`,
              color: shouldPulse ? '#4F46E5' : '#1F2937',
              fontWeight: shouldPulse ? 700 : 400,
              fontSize: shouldPulse ? '1.1em' : '1em',
            }}
          >
            {item}
          </li>
        );
      })}
    </ul>
  );
};
```

```tsx
// compositions/CodeWalkthrough.tsx
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { CodeHighlight } from '../components/CodeHighlight';
import type { CodeSegment } from '../types';

interface Props {
  segment: CodeSegment;
}

export const CodeWalkthrough: React.FC<Props> = ({ segment }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 打字机效果：逐字显示代码
  const totalChars = segment.visual.code.length;
  const charsToShow = Math.floor(
    interpolate(frame, [0, durationInFrames * 0.6], [0, totalChars], {
      extrapolateRight: 'clamp',
    })
  );

  return (
    <div className="code-composition">
      <CodeHighlight
        code={segment.visual.code.slice(0, charsToShow)}
        language={segment.visual.language}
        highlightLines={segment.visual.highlight_lines}
        frame={frame}
        fps={fps}
      />
    </div>
  );
};
```

### 5.4 动画效果清单

| 效果 | 实现方式 | 适用片段类型 |
|------|---------|------------|
| 逐字浮现 | `interpolate` + 文本切片 | narration 字幕 |
| 要点逐条滑入 | `spring` + `translateX` | bullet_points |
| 代码打字机 | `interpolate` 控制字符数 | code_walkthrough |
| 关键词高亮脉冲 | `spring` + `scale` + 颜色变化 | emphasis 字段 |
| 流程图节点依次点亮 | `spring` + 节点颜色插值 | diagram |
| 背景渐变过渡 | CSS `transition` + Remotion `interpolate` | 所有类型 |
| 页面切换 | `translateX` + `opacity` 淡入淡出 | 片段间过渡 |

### 5.5 视觉规范

```typescript
// styles/theme.ts
export const VIDEO_THEME = {
  // 画布
  canvas: {
    width: 1920,
    height: 1080,
    fps: 30,
    backgroundColor: '#0F172A',  // 深蓝黑
  },

  // 文字
  text: {
    primary: '#F8FAFC',      // 主文字（白）
    secondary: '#94A3B8',    // 辅助文字（灰）
    accent: '#818CF8',       // 强调色（紫）
    code: '#34D399',         // 代码文字（绿）
  },

  // 代码块
  codeBlock: {
    background: '#1E293B',
    border: '#334155',
    lineNumberColor: '#475569',
    highlightBackground: '#1E1B4B',
  },

  // 字体
  fonts: {
    heading: 'Noto Sans SC Bold',
    body: 'Noto Sans SC Regular',
    code: 'JetBrains Mono',
  },

  // 动画节奏
  timing: {
    segmentTransition: 15,     // 片段切换帧数
    bulletStagger: 12,         // 要点间隔帧数
    codeTypingSpeed: 2,        // 代码打字每帧字符数
    emphasisPulseDuration: 20, // 强调脉冲帧数
  },
};
```

---

## 六、Stage 4：FFmpeg 合成成片

### 6.1 流程

```
Remotion 渲染输出：
├── /tmp/video_gen/frames/    → 视频帧序列（PNG）
└── /tmp/video_gen/audio/seg_XX.mp3 → 各段音频

Step 1: 拼接音频轨
  ffmpeg -i "concat:seg_01.mp3|seg_02.mp3|..." -acodec copy full_audio.mp3

Step 2: 帧序列 + 音频合成视频
  ffmpeg -framerate 30 -i frames/%04d.png -i full_audio.mp3 \
    -c:v libx264 -pix_fmt yuv420p -c:a aac \
    output.mp4

输出：
└── /tmp/video_gen/output.mp4 → 最终成片
```

### 6.2 Remotion 渲染命令

```typescript
// render.ts
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

async function renderVideo(scriptJson: VideoScript, audioSegments: AudioSegment[]) {
  const bundled = await bundle({
    entryPoint: './src/video/VideoGenerator.tsx',
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'VideoGenerator',
    inputProps: { script: scriptJson, audioSegments },
  });

  // 总时长 = 所有段音频时长之和
  const totalDuration = audioSegments.reduce((sum, seg) => sum + seg.duration_sec, 0);
  composition.durationInFrames = Math.ceil(totalDuration * 30); // 30fps

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: '/tmp/video_gen/output.mp4',
  });
}
```

---

## 七、Agent 接口定义

### 7.1 输入

```typescript
interface VideoAgentInput {
  task_id: string;                    // BullMQ 任务 ID
  skill_name: string;                 // 技能点名称
  knowledge_content: string;          // 知识库内容（讲义文本）
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  target_duration_sec?: number;       // 目标时长（默认 60-90 秒）
  style?: 'default' | 'dark' | 'light';  // 视觉风格
  tts_provider?: 'edge' | 'azure' | 'fish';  // TTS 提供商
}
```

### 7.2 输出

```typescript
interface VideoAgentOutput {
  current_agent: 'VideoAgent';        // 必须设置（宪法 2.5）
  task_id: string;
  status: 'completed' | 'failed';
  result: {
    video_file_path: string;          // 成片路径
    duration_sec: number;             // 视频时长
    segments_count: number;           // 片段数
    script: VideoScript;              // 完整脚本 JSON
    cost_estimate: {
      llm_tokens: number;             // LLM token 消耗
      tts_characters: number;         // TTS 字符数
      render_time_sec: number;        // 渲染耗时
    };
  };
  error?: string;
}
```

### 7.3 进度上报（SSE）

```typescript
// 通过 BullMQ + SSE 向前端推送进度
interface VideoProgressEvent {
  event: 'agent_progress';
  agent: 'VideoAgent';
  task_id: string;
  stage: 'script' | 'tts' | 'render' | 'compose';
  progress: number;  // 0-100
  message: string;   // "正在生成脚本..." / "正在合成音频..."
}
```

---

## 八、BullMQ 任务编排

### 8.1 任务结构

```json
{
  "task_id": "uuid",
  "agent": "VideoAgent",
  "action": "generate_video",
  "user_id": "123",
  "priority": 5,
  "params": {
    "skill_name": "React Hooks — useEffect",
    "knowledge_content": "...",
    "difficulty": "beginner",
    "target_duration_sec": 60
  },
  "status": "pending",
  "progress": 0
}
```

### 8.2 内部子任务编排

```
VideoAgent 接收任务
    ↓
Sub-task 1: LLM 脚本生成（progress: 0-25%）
    ↓
Sub-task 2: TTS 配音（progress: 25-40%，可并行处理多段）
    ↓
Sub-task 3: Remotion 渲染（progress: 40-85%，CPU 密集）
    ↓
Sub-task 4: FFmpeg 合成（progress: 85-100%）
    ↓
上报完成，video_file_path 存入 knowledge_base_v3
```

---

## 九、与现有系统集成

### 9.1 知识库写入

```typescript
// 视频生成完毕后写入知识库（全平台复用，宪法 3.3）
await db.knowledge_base_v3.save({
  skill_name: 'React Hooks — useEffect',
  resource_type: 'video',
  content: JSON.stringify({
    video_path: '/minio/videos/react-useeffect.mp4',
    script: scriptJson,
    duration_sec: 72,
    segments_count: 5,
  }),
});
```

### 9.2 学习页面集成

```
用户进入技能学习页
    ↓
检查 knowledge_base_v3 是否有该技能的 video 资源
    ├── 有 → 直接播放
    └── 没有 → 提交 BullMQ 异步生成 → 显示"视频生成中..."
```

### 9.3 智能体办公室展示

```
🏢 智能体办公室
├── 🟡 VideoAgent    正在工作 — Stage 3 (Remotion 渲染 60%)
├── 任务队列：
│   ├── ⏳ 生成 "useState" 视频（排队中）
│   └── ⏳ 生成 "CSS Grid" 视频（排队中）
└── 已完成：
    └── ✅ "useEffect" 视频（72秒）— 查看
```

---

## 十、API 测试验证记录（2026-06-17）

### 10.1 MiMo LLM 模型

| 模型 | 参数 | 上下文 | 延迟 | 状态 |
|------|------|--------|------|------|
| mimo-v2.5-pro | 1T | 1M | 3.4s | ✅ |
| mimo-v2.5 | - | - | 1.9s | ✅ |
| mimo-v2-pro | - | - | 2.7s | ✅ |
| mimo-v2-omni | - | - | 2.3s | ✅ |

**调用格式：** 标准 OpenAI `/chat/completions`，支持 `reasoning_content` 字段。

### 10.2 实施状态

| 组件 | 文件 | 状态 |
|------|------|------|
| 类型定义 | `video-agent.types.ts` | ✅ 完成 |
| VideoAgent 服务 | `video-agent.service.ts` | ✅ 完成（降级模式） |
| TTS 服务 | `tts.service.ts` | ✅ 完成（已修复 API 格式） |
| 渲染服务 | `video-render.service.ts` | ✅ 完成 |
| Remotion 组件 | `video-renderer/` | ✅ 完成（7 组件） |
| BullMQ 集成 | `resource.processor.ts` | ✅ 完成 |
| 模块注册 | `agents.module.ts` | ✅ 完成 |
| 测试端点 | `agents-test.controller.ts` | ✅ 完成 |

### 10.3 待解决

| 问题 | 优先级 | 说明 |
|------|--------|------|
| LLM 连接问题 | P1 | 后端调用 LLM 报 "Command update requires authentication"，Node.js 直接调用正常 |
| Remotion 渲染 | P2 | 需要 `cd video-renderer && npm install` |
| TTS 真实音频 | P2 | API 格式已确认，需集成到 VideoAgent |

## 十一、技术依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Remotion | ^4.0 | React 组件 → 视频帧 |
| @remotion/renderer | ^4.0 | 服务端渲染 |
| @remotion/bundler | ^4.0 | 打包 React 组件 |
| FFmpeg | 6.x+ | 音视频合成 |
| edge-tts / azure-tts | - | TTS 配音 |
| BullMQ | ^5.0 | 任务队列 |

### 安装命令

```bash
# Remotion
npm install remotion @remotion/cli @remotion/renderer @remotion/bundler

# TTS（以 Edge TTS 为例，Python 实现）
pip install edge-tts

# FFmpeg（Windows）
winget install ffmpeg
```

---

## 十一、成本估算

### 11.1 单条 60 秒视频

| 环节 | 资源消耗 | 成本 |
|------|---------|------|
| LLM 脚本 | ~2000 tokens（输入+输出） | ¥0.01（本地 Ollama 免费） |
| TTS 配音 | ~300 字中文 | ¥0.005（Edge TTS 免费） |
| Remotion 渲染 | ~30 秒 CPU 时间 | 服务器算力，固定成本 |
| FFmpeg 合成 | ~2 秒 | 固定成本 |
| **总计** | | **¥0.015/条（本地部署趋近于 0）** |

### 11.2 对比方案

| 方案 | 60 秒视频成本 | 质量 | 可控性 |
|------|-------------|------|--------|
| Sora/可灵等视频生成 | ¥1-5/秒 × 60 = ¥60-300 | 高（逼真） | 低（黑盒） |
| **VideoAgent（本方案）** | **¥0.015** | 中（Motion Graphics） | **高（全链路可控）** |
| PPT 录屏 | 人工成本 | 低 | 中 |

**核心优势：** 成本降低 4000-20000 倍，质量足够用于教学场景（Motion Graphics 比真人视频更适合技术教学）。

---

## 十二、扩展路径

### V1（当前设计）
- LLM 脚本 + TTS + Remotion Motion Graphics
- 支持 8 种片段类型
- 中文教学视频

### V2
- 英文/多语言支持（TTS 切换 + 字幕）
- 更多片段类型（动画演示、交互式代码）
- 视频模板系统（不同学科风格）

### V3
- 语音克隆（教师声音定制）
- 自动生成系列课程（一个技能点 → 多集视频）
- 用户反馈驱动优化（完播率低的片段自动缩短）

---

*文档结束 — VideoAgent 设计说明*
