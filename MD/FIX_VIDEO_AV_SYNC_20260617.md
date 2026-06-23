# 教学视频音画不同步修复记录

> 日期：2026-06-17
> 模块：VideoAgent 教学视频生成管线
> 问题：TTS 输出的语音与视频画面对不上，且旁白没有在讲画面内容
> 状态：✅ 代码已修复，待端到端实跑验证

---

## 一、问题现象

用户反馈：「tts 输出的语音和视频画面不匹配，我希望是对画面进行讲解」。

拆解为三个独立问题：
1. 语音和画面时间轴对不上（越往后越漂）
2. 旁白泛泛而谈，没在逐条讲解屏幕上的要点/代码
3. （bug.txt 遗留）女声中文念不准、专有名词乱读、英文单词用中文谐音发声

---

## 二、根因分析

### 根因一：渲染出的 MP4 根本没有声音，音频是另一个独立文件

完整管线追踪结论：

- `video-renderer/src/render.ts` 调 `renderMedia` 时**完全没传音频**，Remotion 组件里也没有任何 `<Audio>`。
- `audioSegments` 在 `VideoGenerator.tsx` 里**只被用来算每段时长**，从没渲染进画面 → 产出的 `task_id.mp4` 是**纯静音视频**。
- 后端 `video-agent.service.ts` 把所有 wav 合并成一个**独立的** `task_id_audio.mp3`，然后把无声 mp4 和 mp3 **当成两个文件**返回。
- **整条管线没有任何一步把它们 mux 成带声音的成片**（bug.txt 里画的「Step 4 FFmpeg 合并音视频」在代码里根本不存在）。

只要前端分别加载 mp4 + mp3 两个轨道播放，必然漂移，且叠加两个放大因素：

1. **逐段 `Math.ceil` 向上取整累积漂移**：`VideoGenerator.tsx` 每段都 `Math.ceil(durationSec * fps)`，每段最多多出 1 帧；段数越多画面总时长比音频越长，越往后越对不上。
2. **合并音频命令是坏的**：`tts.service.ts` 用 `-c copy` 把 wav 的 PCM 流直接塞进 `.mp3` 容器，非法封装，时长/可播放性都不可靠。

### 根因二：解说词没在讲屏幕上的东西

- `video-agent.service.ts` 旧提示词明确写「不要出现『如图所示』『请看屏幕』」，且 `narration` 和 `visual` 各自独立生成，没有约束让解说词逐条对应画面元素。
- 结果：画面显示三个 bullet，旁白却在讲别的概述。对「讲解视频」恰恰反了。

### 根因三：TTS 风格指令太泛

- 旧 `DEFAULT_STYLE` 只笼统说「清晰自然的年轻女声」，没有针对中英文混排、专有名词、函数名的发音约束。

---

## 三、修复方案与改动

最终方案（用户已确认）：**把音频用 Remotion `<Audio>` 烤进单个带声音的 MP4**，帧级锁定，彻底消灭双文件漂移；同时重写脚本提示词让旁白严格对应画面；并强化 TTS 风格指令。

### 改动清单

| 文件 | 改动 |
|------|------|
| `video-renderer/src/render.ts` | 渲染前把每段 wav 拷进 `public/_audio/`，写入 `staticSrc` 相对路径；总帧数改成与各段 `round(duration*fps)` 求和一致 |
| `video-renderer/src/compositions/VideoGenerator.tsx` | 每个 `<Sequence>` 内嵌该段 `<Audio src={staticFile(...)}>`，音频烤进同一个 MP4；逐段 `Math.ceil` → `Math.round`，消除累积漂移 |
| `video-renderer/src/compositions/BulletPoints.tsx` | 要点浮现从「固定 12 帧弹完」改成按整段时长均匀铺开，讲到第 N 条第 N 条才出现 |
| `video-renderer/src/types.ts` | `AudioSegment` 增加 `staticSrc?: string` 字段 |
| `backend-ts/src/services/agents/video-agent.service.ts` | 重写脚本提示词：强制 narration 句子顺序 = visual 元素顺序、逐条对应；单段要点限 2-5 条；删掉「不准提屏幕」导致脱节的规则；给 bullet 正例 |
| `backend-ts/src/services/tts.service.ts` | 1) `DEFAULT_STYLE` 强化：女老师人设、英文术语/函数名按地道英文读音（禁中文谐音、禁逐字母拼读）、不念标点；2) `mergeAudioFiles` 的 `-c copy` → `-c:a libmp3lame -q:a 2` 正确重编码 |

### 关键代码片段

**音频烤进画面（VideoGenerator.tsx）**
```tsx
const audio = audioSegments.find((a) => a.id === segment.id);
return (
  <Sequence from={sf.startFrame} durationInFrames={sf.durationFrames}>
    {renderSegment(segment, sf.durationFrames)}
    {audio?.staticSrc && <Audio src={staticFile(audio.staticSrc)} />}
  </Sequence>
);
```

**帧口径统一（render.ts，与 VideoGenerator 一致）**
```ts
let totalFrames = 0;
for (const seg of script.segments) {
  const audio = audioSegments.find((a) => a.id === seg.id);
  const durationSec = audio?.duration_sec || seg.audio?.duration_sec || seg.estimated_duration_sec || 5;
  totalFrames += Math.round(durationSec * fps);   // round 而非 ceil
}
```

**音频重编码（tts.service.ts）**
```ts
// 不能用 -c copy：wav(PCM) 直接拷进 mp3 容器是非法封装
execSync(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -c:a libmp3lame -q:a 2 "${outputPath}"`, ...);
```

---

## 四、契约变更（重要）

- **产物从「mp4 + mp3 两个文件」变成「一个自带声音的 mp4」。**
- 前端 `frontend/src/components/VideoCard.tsx` 用单个 `<video>` 播 `task_id.mp4` 即可，**不要再单独叠加播放那个 mp3**，否则会双声道重音。
- 返回里的 `audio_file_path` 现在只是可选副产物。

---

## 五、验证状态

- ✅ 后端 `tsc --noEmit` 全绿
- ✅ renderer 改动的 4 个文件无报错
- ⚠️ `Root.tsx` 有一条 `Composition` 泛型报错，是**改动前就存在**的，且渲染走 `tsx`/webpack 不走 `tsc`，不影响出片
- ⏳ **未做端到端实跑**（需起全栈 + 调 MiMo API + Remotion 渲染）

### 建议验证步骤

```
POST /api/test/agents/video
{ "skillName": "CSS Flexbox布局", "difficulty": "beginner" }
```

重点检查：
1. 产出的 `task_id.mp4` 本身是否**带声音**（以前是静音）
2. 旁白讲的要点和画面浮现是否**逐条同步**
3. 英文术语/函数名发音是否正常
