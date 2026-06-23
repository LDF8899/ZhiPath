# 智途 ZhiPath 智能体 API 接口文档

> 后端地址：`http://localhost:3001`
> 前端地址：`http://localhost:3000`

---

## 一、核心聊天接口

### POST /api/user/chat

发送消息，智能体自动识别意图并执行相应功能。

**请求参数：**
```json
{
  "message": "用户输入的消息",
  "photoUrl": "用户照片URL（可选）",
  "avatarId": "数字人形象ID（可选）",
  "voiceId": "数字人声音ID（可选）"
}
```

**响应格式：**
```json
{
  "code": 200,
  "data": {
    "type": "video | animation | diagram | avatar_video | multimodal_resources",
    "data": {
      // 根据 type 不同，data 结构不同
    }
  },
  "message": "success"
}
```

**支持的意图（关键词触发）：**

| 意图 | 关键词 | 说明 |
|------|--------|------|
| 生成短视频 | 短视频、教学视频、视频讲解 | 生成5秒可视化视频 |
| 生成动画 | 动画演示、生成动画、数学动画 | 生成HTML算法动画 |
| 生成图表 | 流程图、架构图、时序图、配图 | 生成Mermaid图表 |
| 生成数字人 | 数字人、虚拟教师、数字人讲解 | 生成数字人讲解视频 |
| 出题 | 出题、考试、做题、测试、练习 | 生成练习题 |
| 推荐岗位 | 推荐岗位、找工作、求职 | 推荐合适岗位 |
| 学习计划 | 学习计划、学习路径、制定计划 | 生成学习路径 |
| 查看进度 | 进度、学习进度、我的进度 | 查看学习进度 |
| 今日任务 | 今天学什么、今日任务 | 查看今日任务 |

---

## 二、多模态资源生成接口

### POST /api/user/multimodal/video

生成短视频。

**请求参数：**
```json
{
  "skill": "JavaScript",
  "profile": {}
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "type": "video",
    "data": {
      "skill": "javascript",
      "title": "JavaScript 可视化",
      "duration": "5秒",
      "overview": "javascript的动态可视化展示",
      "scenes": [],
      "video_url": "https://...",
      "video_status": "generated",
      "source": "zhipu"
    }
  }
}
```

---

### POST /api/user/multimodal/animation

生成HTML动画。

**请求参数：**
```json
{
  "skill": "快速排序"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "type": "animation",
    "data": {
      "skill": "快速排序",
      "title": "快速排序 动画演示",
      "code": "<!DOCTYPE html>...",
      "language": "html",
      "framework": "vanilla",
      "video_url": null,
      "video_status": "generated",
      "description": "使用 HTML/CSS/JavaScript 生成的算法动画"
    }
  }
}
```

**动画代码渲染方式：**
```html
<iframe srcdoc="<动画代码>" />
```

---

### POST /api/user/multimodal/diagram

生成Mermaid图表。

**请求参数：**
```json
{
  "skill": "React 生命周期"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "type": "diagram",
    "data": {
      "skill": "react",
      "diagrams": {
        "flowchart": {
          "title": "React 生命周期流程图",
          "code": "flowchart TD\n    A[开始] --> B[处理]"
        },
        "architecture": null,
        "sequence": null
      },
      "format": "mermaid"
    }
  }
}
```

**图表渲染方式：**
使用 `mermaid.js` 库渲染：
```javascript
import mermaid from 'mermaid';
mermaid.initialize({ startOnLoad: true });
// 将 code 放入 <div class="mermaid"> 中
```

---

### POST /api/user/multimodal/avatar

生成数字人讲解视频。

**请求参数：**
```json
{
  "skill": "CSS Flexbox",
  "avatarId": "111192001",
  "voiceId": "0392383_ttsclone-xfyousheng-ydyfs"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "type": "avatar_video",
    "data": {
      "skill": "css",
      "title": "css 数字人讲解",
      "script": "大家好，今天我们来学习CSS...",
      "word_count": 500,
      "estimated_duration": "100秒",
      "video_url": "webrtc://srs-stream.cn-huadong-1.xf-yun.com:9850/live/...",
      "video_status": "generated",
      "source": "xunfei"
    }
  }
}
```

**数字人视频播放方式：**
使用讯飞 RTCPlayer SDK：
```html
<script src="/sdk/rtcplayer.iife.js"></script>
<script>
  const player = new Interactive.RTCPlayer();
  player.playerType = 6; // WebRTC
  player.stream = { sid: 'xxx', streamUrl: 'webrtc://...' };
  player.videoSize = { width: 720, height: 1280 };
  player.container = document.getElementById('player');
  player.play();
</script>
```

---

### GET /api/user/multimodal/avatar-options

获取可用的数字人形象和声音列表。

**响应：**
```json
{
  "code": 200,
  "data": {
    "avatars": [
      { "id": "111192001", "name": "诸葛亮", "description": "三国智者诸葛亮", "gender": "male" },
      { "id": "201165002", "name": "女生形象", "description": "年轻女性数字人", "gender": "female" },
      { "id": "111227001", "name": "西施形象", "description": "古典美人西施", "gender": "female" },
      { "id": "111264001", "name": "男生形象", "description": "年轻男性数字人", "gender": "male" }
    ],
    "voices": [
      { "id": "0392383_ttsclone-xfyousheng-ydyfs", "name": "默认男声", "gender": "male" },
      { "id": "x4_lingxiaoqi_oral", "name": "女生声音", "gender": "female" },
      { "id": "x4_lingxiaoying_assist", "name": "西施声音", "gender": "female" }
    ]
  }
}
```

---

### POST /api/user/multimodal/generate-all

生成所有多模态资源（视频+动画+图表+数字人）。

**请求参数：**
```json
{
  "skill": "JavaScript"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "type": "multimodal_resources",
    "data": {
      "skill": "javascript",
      "resources": {
        "video": { ... },
        "animation": { ... },
        "diagram": { ... },
        "avatar": { ... }
      },
      "generated_at": 1718000000000
    }
  }
}
```

---

## 三、认证接口

### POST /api/auth/register

注册。

**请求参数：**
```json
{
  "username": "testuser",
  "password": "123456",
  "realName": "张三",
  "phone": "13800138000",
  "email": "test@example.com"
}
```

---

### POST /api/auth/login

登录。

**请求参数：**
```json
{
  "username": "testuser",
  "password": "123456"
}
```

**响应：**
```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "testuser",
      "realName": "张三"
    }
  }
}
```

---

## 四、数据类型定义

### 多模态资源类型

```typescript
// 短视频
interface VideoResource {
  type: 'video';
  title: string;
  duration: string;
  overview: string;
  scenes: VideoScene[];
  video_url: string | null;
  video_status: 'not_started' | 'generated' | 'failed';
  source: string;
}

// 动画
interface AnimationResource {
  type: 'animation';
  title: string;
  code: string; // HTML代码
  language: string;
  framework: string;
  video_url: string | null;
  video_status: string;
  description: string;
}

// 图表
interface DiagramResource {
  type: 'diagram';
  diagrams: {
    flowchart: { title: string; code: string } | null;
    architecture: { title: string; code: string } | null;
    sequence: { title: string; code: string } | null;
  };
  format: string;
}

// 数字人
interface AvatarResource {
  type: 'avatar_video';
  title: string;
  script: string;
  word_count: number;
  estimated_duration: string;
  video_url: string | null;
  video_status: 'not_started' | 'generated' | 'failed';
  source: string;
}
```

---

## 五、前端集成示例

### 发送消息并处理响应

```javascript
const response = await fetch('http://localhost:3001/api/user/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '生成 JavaScript 的短视频' })
});

const result = await response.json();
const { type, data } = result.data;

switch (type) {
  case 'video':
    // 渲染视频
    renderVideo(data.video_url);
    break;
  case 'animation':
    // 渲染HTML动画
    renderAnimation(data.code);
    break;
  case 'diagram':
    // 渲染Mermaid图表
    renderDiagram(data.diagrams.flowchart.code);
    break;
  case 'avatar_video':
    // 渲染数字人视频
    renderAvatar(data.video_url, data.script);
    break;
}
```

### 渲染HTML动画

```jsx
function AnimationCard({ code }) {
  return (
    <iframe
      srcDoc={code}
      style={{ width: '100%', height: '500px', border: 'none' }}
    />
  );
}
```

### 渲染Mermaid图表

```jsx
function DiagramCard({ code }) {
  const ref = useRef(null);
  
  useEffect(() => {
    import('mermaid').then(mermaid => {
      mermaid.default.initialize({ startOnLoad: false });
      mermaid.default.render('diagram', code).then(({ svg }) => {
        ref.current.innerHTML = svg;
      });
    });
  }, [code]);
  
  return <div ref={ref} />;
}
```

### 渲染数字人视频

```jsx
function AvatarCard({ videoUrl, script }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const RTCPlayer = window.Interactive?.RTCPlayer;
    if (!RTCPlayer) return;
    
    const player = new RTCPlayer();
    player.playerType = 6;
    player.stream = { sid: `sid_${Date.now()}`, streamUrl: videoUrl };
    player.videoSize = { width: 720, height: 1280 };
    player.container = containerRef.current;
    player.play();
    
    return () => player.stop?.();
  }, [videoUrl]);
  
  return <div ref={containerRef} style={{ width: 270, height: 480 }} />;
}
```

---

## 六、SDK 文件

数字人播放需要以下文件：
- `/sdk/rtcplayer.iife.js` — 讯飞RTCPlayer SDK

将此文件放在前端 `public/sdk/` 目录下。

---

## 七、环境变量

后端 `.env` 配置：
```env
PORT=3001
XUNFEI_DIGITAL_HUMAN_APP_ID=xxx
XUNFEI_DIGITAL_HUMAN_API_KEY=xxx
XUNFEI_DIGITAL_HUMAN_API_SECRET=xxx
ZHIPU_API_KEY=xxx
```

前端 `.env.local` 配置：
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 八、CORS 配置

后端已配置 CORS 允许所有来源：
```javascript
app.enableCors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});
```

---

## 九、错误处理

所有接口统一返回格式：
```json
{
  "code": 200,  // 200=成功, 400=参数错误, 500=服务器错误
  "data": { ... },
  "message": "success"
}
```

---

## 十、联系信息

如有问题，请联系智能体开发者。
