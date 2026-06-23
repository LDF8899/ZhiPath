# 智途 ZhiPath 智能体 - 前端集成包

## 文件说明

| 文件 | 说明 | 放置位置 |
|------|------|----------|
| `API_DOCUMENTATION.md` | 完整的 API 接口文档 | 参考文档 |
| `rtcplayer.iife.js` | 讯飞数字人播放 SDK | `public/sdk/` |
| `.env.local` | 环境变量配置 | 项目根目录 |
| `types.ts` | TypeScript 类型定义 | `types/` |

## 快速开始

### 1. 复制 SDK 文件

```bash
# 创建目录并复制 SDK
mkdir -p public/sdk
cp rtcplayer.iife.js public/sdk/
```

### 2. 配置环境变量

```bash
# 复制环境变量文件
cp .env.local ./
```

### 3. 复制类型定义

```bash
# 复制类型文件到项目
cp types.ts types/index.ts
```

### 4. 安装依赖（如需渲染图表）

```bash
npm install mermaid
```

## 前端集成示例

### 调用聊天接口

```javascript
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '生成 JavaScript 的短视频' })
});

const result = await response.json();
const { type, data } = result.data;
```

### 渲染不同类型的资源

```javascript
switch (type) {
  case 'video':
    // 视频播放
    break;
  case 'animation':
    // <iframe srcdoc={data.code} />
    break;
  case 'diagram':
    // mermaid.render(...)
    break;
  case 'avatar_video':
    // 讯飞 RTCPlayer SDK
    break;
}
```

## 详细文档

请查看 `API_DOCUMENTATION.md` 获取完整的接口文档。
