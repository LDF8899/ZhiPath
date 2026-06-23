# 智途本地开发启动指南

> 更新日期：2026-06-18

---

## 一、前置条件

| 依赖 | 版本要求 | 检查命令 |
|------|---------|---------|
| Node.js | ≥ 18 | `node -v` |
| npm | ≥ 9 | `npm -v` |
| FFmpeg | 任意 | `ffmpeg -version` |
| Redis | 运行中 | `redis-cli ping` → PONG |
| MySQL | 运行中 | 配置在 `.env` |
| MongoDB | 运行中 | 配置在 `.env` |

---

## 二、启动服务

### 后端（backend-ts）

```powershell
cd D:\X\ZhiPath\backend-ts
npx ts-node -r tsconfig-paths/register src/main.ts
```

启动成功标志：
```
[ZhiPath] API running on http://0.0.0.0:3000
```

### 前端（frontend）

```powershell
cd D:\X\ZhiPath\frontend
npm run dev
```

启动成功标志：
```
VITE v8.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 视频渲染器（video-renderer）

不需要手动启动。后端会自动调用 `npx tsx src/render.ts` 来渲染视频。

---

## 三、端口占用处理

### 查看占用端口的进程

```powershell
# 查看 3000 端口
netstat -ano | findstr ":3000"

# 查看 5173 端口
netstat -ano | findstr ":5173"
```

输出示例：
```
TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    48448
```

最后一列是 PID（进程号）。

### 杀掉占用端口的进程

```powershell
# 方法一：按 PID 杀
taskkill /F /PID 48448

# 方法二：杀掉所有 node 进程（慎用，会杀掉所有 Node 程序）
taskkill /F /IM node.exe
```

### 一键清理并重启后端

```powershell
# 杀掉 3000 端口进程 → 重启后端
$pid = (netstat -ano | findstr ":3000.*LISTENING" | Select-String "\d+$").Matches[0].Value
if ($pid) { taskkill /F /PID $pid }
cd D:\X\ZhiPath\backend-ts
npx ts-node -r tsconfig-paths/register src/main.ts
```

---

## 四、前端依赖问题

### rolldown 原生绑定丢失（vite 8）

报错：`Cannot find native binding` 或 `Cannot find module '@rolldown/binding-win32-x64-msvc'`

```powershell
cd D:\X\ZhiPath\frontend
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```

> ⚠️ 检查 `package.json` 里不要有 `@rolldown/binding-linux-x64-gnu`，有的话删掉再装。

### TypeScript 编译检查

```powershell
# 后端
cd D:\X\ZhiPath\backend-ts; npx tsc --noEmit

# 前端
cd D:\X\ZhiPath\frontend; npx tsc --noEmit
```

---

## 五、常用 API 测试

### 健康检查

```powershell
curl http://localhost:3000/api/health
```

### 登录获取 Token

```powershell
curl -X POST http://localhost:3000/api/admin/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin123"}'
```

### 视频生成（测试端点，无需登录）

```powershell
curl -X POST http://localhost:3000/api/test/agents/video `
  -H "Content-Type: application/json" `
  -d '{"skillName":"CSS Flexbox","difficulty":"beginner"}'
```

### 视频生成（聊天端点，需 Token）

```powershell
$token = "eyJhbGci..."  # 从登录接口获取

curl -X POST http://localhost:3000/api/user/chat `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  -d '{"message":"帮我生成一个linux的教学视频"}'
```

### 查询视频生成进度

```powershell
curl http://localhost:3000/api/user/video-task/chat_video_xxx `
  -H "Authorization: Bearer $token"
```

### 播放视频文件

```powershell
# 浏览器打开
http://localhost:3000/api/user/video-file/chat_video_xxx.mp4
```

---

## 六、目录结构速查

```
D:\X\ZhiPath\
├── backend-ts\          # NestJS 后端（端口 3000）
├── frontend\            # React + Vite 前端（端口 5173）
├── video-renderer\      # Remotion 视频渲染器
├── MD\                  # 文档目录
└── test_video_*.mp4     # 生成的测试视频
```

### 视频产物目录

```
D:\tmp\zhipath\
├── tts\                 # TTS 音频文件（.wav）
└── video\               # 视频文件（.mp4）+ 脚本缓存
```
