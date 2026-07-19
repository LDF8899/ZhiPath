# 3D 可交互知识图谱 + 手势控制 技术文档

> 基于 Three.js + MediaPipe 实现的可交互 3D 知识图谱，支持鼠标操控和手势控制。

---

## 零、知识图谱数据构建

### 0.1 数据来源

204 种蛇类数据存储在 MySQL `snake_info` 表中：

```sql
snake_id, snake_name, family, genus, latin_name, toxin_type, danger_level,
distribution, characteristics, habitat_info, conservation_status, toxicity_level
```

数据来源：全球及中国蛇类系统分类、地域分布与毒理学综合研究报告。

### 0.2 图谱节点类型（6 种）

| 类型 | ID 格式 | 来源 | 示例 |
|------|---------|------|------|
| 🐍 snake | `snake:{id}` | 每行一条 | `snake:1` → "银环蛇" |
| 🏷️ family | `family:{name}` | 按 family 字段去重 | `family:眼镜蛇科` |
| ☠️ toxin | `toxin:{type}` | 按 toxin_type 去重 | `toxin:神经毒素` |
| 🤒 symptom | `symptom:{type}` | 硬编码映射表 | `symptom:神经毒素` → "眼睑下垂..." |
| 💉 serum | `serum:{type}` | 硬编码映射表 | `serum:神经毒素` → "抗银环蛇血清" |
| ⚠️ danger | `danger:{level}` | 按 danger_level 去重 | `danger:重度` |

### 0.3 图谱边关系（5 种）

```
snake  ──属于──→  family      (蛇种归类到科)
snake  ──分泌──→  toxin       (蛇种分泌的毒素类型)
toxin  ──导致──→  symptom     (毒素引起的临床症状)
toxin  ──中和──→  serum       (对应的抗蛇毒血清)
snake  ──危险──→  danger      (危险等级)
```

### 0.4 后端图谱生成（SnakeGraphController.java）

后端在内存中从 MySQL 读取全量数据，动态构建 Cytoscape/Three.js 兼容的 JSON：

```java
@RestController
@RequestMapping("/snake/graph")
public class SnakeGraphController {

    // 毒素→症状 硬编码映射
    private static final Map<String, String> TOXIN_SYMPTOMS = Map.of(
        "神经毒素", "眼睑下垂、吞咽困难、呼吸肌麻痹、呼吸衰竭",
        "血液毒素", "伤口剧痛肿胀、凝血障碍、广泛性出血、DIC",
        "细胞毒素", "组织坏死、皮肤溃烂、角膜溃疡、心肌损害",
        "混合毒素", "多系统损害、呼吸抑制、凝血崩溃、组织坏死"
    );

    // 毒素→血清 硬编码映射
    private static final Map<String, String> TOXIN_SERUM = Map.of(
        "神经毒素", "抗银环蛇/抗眼镜蛇蛇毒血清",
        "血液毒素", "抗蝮蛇/抗五步蛇蛇毒血清",
        "细胞毒素", "抗眼镜蛇蛇毒血清",
        "混合毒素", "多价抗蛇毒血清"
    );

    @GetMapping("/full")
    public Result<Map<String, Object>> getFullGraph() {
        List<SnakeInfo> snakes = snakeInfoService.list(); // MyBatis-Plus 全量查询

        // 遍历每条蛇，生成节点和边
        for (SnakeInfo snake : snakes) {
            // 1. 蛇种节点
            addNode("snake:" + snake.getSnakeId(), snake.getSnakeName(), "snake",
                family, toxin, danger, latin);

            // 2. 科节点（去重）
            if (addedFamilies.add(snake.getFamily())) {
                addNode("family:" + snake.getFamily(), snake.getFamily(), "family");
            }

            // 3. 毒素节点（去重）+ 关联症状和血清
            if (addedToxins.add(snake.getToxinType())) {
                addNode("toxin:" + toxin, toxin, "toxin");
                addNode("symptom:" + toxin, TOXIN_SYMPTOMS.get(toxin), "symptom");
                addNode("serum:" + toxin, TOXIN_SERUM.get(toxin), "serum");
                addEdge(toxin → symptom, "导致");
                addEdge(toxin → serum, "中和");
            }

            // 4. 边：蛇种→科、蛇种→毒素、蛇种→危险
            addEdge(snake → family, "属于");
            addEdge(snake → toxin, "分泌");
        }

        return Result.success(Map.of("nodes", nodes, "edges", edges, "stats", stats));
    }
}
```

### 0.5 API 端点

| 端点 | 用途 | 前端调用 |
|------|------|----------|
| `GET /snake/graph/full` | 全量图谱（204 蛇种 + 所有关系） | KnowledgeGraph.vue |
| `GET /snake/graph/overview` | 概览（只有科/毒素/危险，无蛇种） | Dashboard 迷你图谱 |
| `GET /snake/graph/family/{name}` | 单科子图 | 按科展开 |
| `GET /snake/graph/detail/{id}` | 单蛇详情子图 | 点击蛇种节点 |

### 0.6 数据流转

```
MySQL snake_info 表 (204 条)
    ↓ MyBatis-Plus
SnakeInfoService.list()
    ↓ SnakeGraphController 内存构建
JSON: { nodes: [...], edges: [...], stats: {...} }
    ↓ axios.get('/snake/graph/full')
前端 GraphData 对象
    ↓ use3DGraph.loadGraphData()
Three.js 场景中的节点球体 + 发光线条
    ↓ 力导向物理模拟
自动布局的 3D 知识图谱
```

### 0.7 Redis 缓存

启动时 `RedisSyncRunner` 预热缓存：

```
sling:snake:info:{id}     → Hash（完整蛇种数据）
sling:snake:family:{name} → Set（该科所有蛇 ID）
sling:snake:toxin:{type}  → Set（该毒素所有蛇 ID）
sling:snake:danger:{level}→ Set（该等级所有蛇 ID）
```

---

## 一、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 (Composition API) | 3.5+ |
| 3D 渲染 | Three.js | 0.170+ |
| 3D 控制器 | OrbitControls | three/addons |
| 手势识别 | MediaPipe HandLandmarker | @mediapipe/tasks-vision 0.10.21 |
| 平滑算法 | One-Euro Filter | 自实现 |
| UI 组件 | Element Plus | 2.14+ |

---

## 二、架构概览

```
┌─────────────────────────────────────────────────┐
│              KnowledgeGraph.vue                  │
│  (UI 控制栏 + 3D 容器 + 手势状态 + 速度控制)      │
└───────┬────────────────┬────────────────┬────────┘
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  use3DGraph  │ │useHandTracking│ │ oneEuroFilter│
│              │ │              │ │              │
│ • Three.js   │ │ • MediaPipe  │ │ • 自适应平滑  │
│ • 场景/相机   │ │ • 摄像头管理  │ │ • 静止强平滑  │
│ • 力导向布局  │ │ • 手势分类    │ │ • 运动快响应  │
│ • 节点/边渲染 │ │ • 调试预览    │ │              │
│ • 鼠标交互    │ │              │ │              │
│ • 手势→相机   │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## 三、3D 知识图谱渲染 (use3DGraph.ts)

### 3.1 场景初始化

```typescript
// 透视相机 — 3D 空间感
camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 5000)
camera.position.set(0, 0, 600)

// OrbitControls — 鼠标拖拽旋转/平移/缩放
controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.minDistance = 50
controls.maxDistance = 2000
```

### 3.2 节点渲染

每种节点类型有不同的视觉样式：

```typescript
const NODE_STYLES = {
  family:  { color: 0x409EFF, size: 18, emissive: 0x2060CC },  // 科 — 大球
  snake:   { color: 0x50b8f0, size: 6,  emissive: 0x2a6090 },  // 蛇种 — 小球
  toxin:   { color: 0xF56C6C, size: 14, emissive: 0xCC3030 },  // 毒素 — 红球
  symptom: { color: 0xE6A23C, size: 8,  emissive: 0xB07010 },  // 症状 — 橙球
  serum:   { color: 0x67C23A, size: 12, emissive: 0x308010 },  // 血清 — 绿球
  danger:  { color: 0xFF3333, size: 14, emissive: 0xCC0000 },  // 危险 — 亮红球
}
```

每个节点 = **3 个 Three.js 对象叠加**：

```
Mesh (主球体)          — MeshStandardMaterial，自发光
  └─ Glow (光晕子mesh) — AdditiveBlending，呼吸脉冲动画
  └─ Label (文字精灵)  — Canvas Sprite，始终朝向相机
```

```typescript
// 主球体 — 自发光，无需场景灯光
const mat = new THREE.MeshStandardMaterial({
  color: style.color,
  emissive: style.emissive,
  emissiveIntensity: 1.2,
  metalness: 0.3,
  roughness: 0.6,
  transparent: true,
  opacity: 0.92,
})

// 光晕 — AdditiveBlending 叠加发光
const glowMat = new THREE.MeshBasicMaterial({
  color: style.color,
  transparent: true,
  opacity: 0.12,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

// 文字标签 — Canvas 生成纹理，Sprite 始终朝向相机
const labelTex = makeLabelTexture(data.label)  // 2D Canvas 绘制文字
const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex }))
```

### 3.3 边渲染

使用 `THREE.Line` + `AdditiveBlending` 实现发光线条：

```typescript
const mat = new THREE.LineBasicMaterial({
  color: baseColor,           // 根据关系类型着色
  transparent: true,
  opacity: 0.25,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const line = new THREE.Line(geo, mat)
```

边的颜色根据关系类型变化：毒素=红，血清=绿，症状=橙。

### 3.4 力导向物理布局

核心公式：

```
斥力:  F = strength / dist²     (所有节点互斥)
弹簧:  F = (dist - restLen) × k (沿边吸引)
重力:  F = -pos × g             (向中心)
阻尼:  vel *= 0.92              (每帧衰减)
```

```typescript
// 斥力 — 所有节点对之间
for (i < n) for (j = i+1; j < n) {
  const force = repulsionStrength / distSq * alpha
  a.vx += fx; a.vy += fy; a.vz += fz
  b.vx -= fx; b.vy -= fy; b.vz -= fz
}

// 弹簧力 — 沿边
for (edge of allEdges) {
  const displacement = dist - springLength
  const force = displacement * springStrength * alpha
}

// 中心引力
node.vx -= node.pos.x * gravity * alpha

// 积分 + 阻尼
node.vx *= 0.92
node.pos.x += node.vx * dt * 60
```

退火策略：前 300 帧满速模拟，之后 `simAlpha *= 0.995` 逐渐冻结。

### 3.5 交互系统

**Raycaster 射线拾取** — 鼠标悬浮/点击节点：

```typescript
const raycaster = new THREE.Raycaster()
raycaster.setFromCamera(mouse, camera)
const intersects = raycaster.intersectObjects(meshes, false)
if (intersects.length > 0) {
  // 高亮节点 + 放大 + 高亮相关边
}
```

**鼠标拖拽节点** — Plane 投影 + 惯性：

```typescript
// 拖拽：鼠标射线与平面交点 → 更新节点位置
// 释放：保留拖拽速度作为惯性 → 每帧衰减
```

**相机飞向** — 三次 ease-in-out 动画：

```typescript
const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2
camera.position.lerpVectors(startPos, targetPos, ease)
```

### 3.6 展开/折叠

科节点点击 → 显示/隐藏该科下的蛇种节点 + 相关边：

```typescript
function expandFamily(name) {
  nodeMap.forEach(n => {
    if (n.data.family === name) n.mesh.visible = true
  })
  updateEdgeVisibility() // 边两端都可见才显示
}
```

### 3.7 背景氛围

```
星云球 (512×256 程序纹理) — BackSide 渲染，缓慢旋转
星点 (1500 个白点)        — 远距离球壳分布
环境粒子 (200 个发光点)   — AdditiveBlending 漂浮
```

---

## 四、手势识别 (useHandTracking.ts)

### 4.1 MediaPipe 初始化

```typescript
// WASM + 模型从本地加载（无需翻墙）
const vision = await FilesetResolver.forVisionTasks('/mediapipe/')
handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: '/mediapipe/hand_landmarker.task',
    delegate: 'GPU',
  },
  runningMode: 'VIDEO',
  numHands: 1,
  minHandDetectionConfidence: 0.5,
})
```

本地文件（复制自 hand-particles 项目）：

```
public/mediapipe/
  hand_landmarker.task          (7.8MB — 手部检测模型)
  vision_wasm_internal.js/wasm  (WASM 运行时)
  vision_wasm_module_internal.*
  vision_wasm_nosimd_internal.*
```

### 4.2 手势检测算法

基于 **palm-center + finger-extension**（移植自 hand-particles/staticGestures.ts）：

```typescript
// 手掌中心 = 5 个关键点平均（比单用 wrist 稳定得多）
function getPalmCenter(lm) {
  const ids = [0, 5, 9, 13, 17] // wrist + 4 个 MCP
  return average(lm[ids])
}

// 手指伸展判断：tip 到手掌距离 > PIP 到手掌距离 × ratio
function fingerExtended(lm, tipIdx, pipIdx, ratio) {
  return dist(lm[tipIdx], palm) > dist(lm[pipIdx], palm) * ratio
}
```

### 4.3 三种手势（互斥优先级）

```
☝️ pointing (食指指向)  — 最高优先级
   条件: index 伸展 + middle/ring/pinky 弯曲
   用途: 旋转控制

🖐 open_palm (张掌)     — 中优先级
   条件: 5 指全部伸展
   用途: 放大

✊ closed_fist (握拳)   — 中优先级
   条件: 0 指伸展（index 也弯曲）
   用途: 缩小
```

```typescript
// 优先级判断
if (indexUp && !middleUp && !ringUp && !pinkyUp) {
  detected = 'pointing'      // 食指最高优先
} else if (extendedCount >= 5) {
  detected = 'open_palm'
} else if (extendedCount <= 1 && !indexUp) {
  detected = 'closed_fist'
}
```

### 4.4 手势平滑

连续 N 帧一致才切换（防止抖动）：

```typescript
const SMOOTH_FRAMES = 2
if (gesture !== currentGesture) {
  if (gesture === pendingGesture) pendingCount++
  else { pendingGesture = gesture; pendingCount = 1 }
  if (pendingCount >= SMOOTH_FRAMES) {
    currentGesture = gesture  // 真正切换
  }
}
```

### 4.5 调试预览

开启后显示摄像头画面 + 手部骨骼：

```
320×240 镜像视频 (右下角)
Canvas 覆盖层:
  - 21 个关键点（蓝色小圆点，食指尖红色大圆点）
  - 骨骼连线（绿色半透明线）
  - 左上角显示当前手势名称
```

关键骨骼连接：

```typescript
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],       // 拇指
  [0,5],[5,6],[6,7],[7,8],       // 食指
  [5,9],[9,10],[10,11],[11,12],  // 中指
  [9,13],[13,14],[14,15],[15,16],// 无名指
  [13,17],[17,18],[18,19],[19,20],// 小指
  [0,17]                         // 手掌
]
```

---

## 五、One-Euro Filter 平滑算法

### 5.1 原理

自适应低通滤波器：**静止时强平滑（消抖），运动时快响应（低延迟）**。

```
输入信号 → 速度估算 → 自适应截止频率 → 低通滤波 → 输出
                         ↑
                    速度快 → 截止频率高 → 少平滑
                    速度慢 → 截止频率低 → 多平滑
```

### 5.2 实现

```typescript
class OneEuroFilter {
  constructor(freq = 30, minCutoff = 1.0, beta = 0.007, dCutoff = 1.0)

  filter(x, timestamp?) {
    // 1. 速度估算
    const dx = (x - xPrev) * freq
    const edx = alpha(dCutoff) * dx + (1-alpha(dCutoff)) * dxPrev

    // 2. 自适应截止频率
    const cutoff = minCutoff + beta * |edx|

    // 3. 低通滤波
    const a = alpha(cutoff)
    const result = a * x + (1-a) * xPrev
  }
}
```

### 5.3 参数调优

| 参数 | 作用 | 旋转用 | 缩放用 |
|------|------|--------|--------|
| minCutoff | 静止平滑度 | 1.0 | 1.0 |
| beta | 运动灵敏度 | 0.12 | 0.05 |
| freq | 采样频率 | 30 | 30 |

缩放用更小的 beta（0.05），因为缩放抖动比旋转更刺眼。

### 5.4 使用

```typescript
const filter = new OneEuroFilter(30, 1.0, 0.12)

// 每个检测帧调用
const smoothed = filter.filter(rawValue, performance.now())

// 切换手势时 reset，避免从旧值跳变
filter.reset()
```

---

## 六、手势→相机控制映射

### 6.1 旋转（食指指向）

```
食指尖(landmark 8) 位移 → 球坐标 theta/phi
手指左移 → theta 减小 → 相机左旋
手指右移 → theta 增大 → 相机右旋
手指上移 → phi 减小 → 相机上仰
手指下移 → phi 增大 → 相机俯视
```

```typescript
// 指尖位移（归一化坐标差值）
const dx = indexTipX - prevIndexX
const dy = indexTipY - prevIndexY

// One-Euro 平滑
const sDx = filterDx.filter(dx, now)
const sDy = filterDy.filter(dy, now)

// 应用到球坐标
const spherical = new THREE.Spherical()
spherical.setFromVector3(camera.position.clone().sub(controls.target))
spherical.theta -= sDx * rotSpeed * 20
spherical.phi += sDy * rotSpeed * 15
spherical.phi = clamp(spherical.phi, 0.15, Math.PI - 0.15) // 防翻转
camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical))
```

### 6.2 缩放（张掌/握拳）

```
🖐 张掌 → 相机向目标靠近（放大）
✊ 握拳 → 相机远离目标（缩小）
匀速运动，One-Euro 平滑启停
```

```typescript
function zoomBy(delta) {
  const dir = camera.position.clone().sub(controls.target).normalize()
  const dist = camera.position.distanceTo(controls.target)
  const newDist = clamp(dist - delta, minDistance, maxDistance)
  camera.position.copy(target).add(dir.multiplyScalar(newDist))
}
```

### 6.3 互斥控制

```
食指指向 → 只旋转，return 跳过缩放
张掌/握拳 → 只缩放，不触发旋转
```

---

## 七、性能优化

### 7.1 帧率分离

```
检测: 25ms 间隔 (~40fps)  — MediaPipe 推理，阻塞主线程
渲染: requestAnimationFrame (~60fps) — Three.js 渲染
平滑: One-Euro Filter — 40fps 检测值 → 60fps 丝滑过渡
```

### 7.2 摄像头管理

```typescript
// start() 前强制清理旧 stream
cleanup()

// 逐个尝试摄像头，跳过被占用的
for (const cam of sorted) {
  try {
    stream = await getUserMedia({ deviceId: cam.deviceId })
    break
  } catch { continue }
}

// 页面关闭时释放
window.addEventListener('beforeunload', cleanup)
```

### 7.3 自动降级

FPS < 20 时自动关闭粒子层（useParticleLayer 中实现）。

---

## 八、文件结构

```
src/composables/
  use3DGraph.ts          # 3D 图谱引擎（场景/物理/交互/手势控制）
  useHandTracking.ts     # MediaPipe 手势识别（摄像头/检测/调试预览）
  oneEuroFilter.ts       # One-Euro 自适应平滑滤波器

src/views/
  KnowledgeGraph.vue     # 页面（UI 控制 + 数据加载 + 手势联动）

public/mediapipe/
  hand_landmarker.task   # MediaPipe 手部检测模型
  vision_wasm_*.js/wasm  # WASM 运行时
```

---

## 九、依赖安装

```bash
npm install three @types/three @mediapipe/tasks-vision
```

MediaPipe 本地文件（从 hand-particles 项目复制或自行下载）：

```bash
# 模型文件需单独下载，不包含在 npm 包中
# 来源: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
# 放到 public/mediapipe/ 目录
```

---

## 十、移植到其他项目

### 最小可用

只需要 `use3DGraph.ts`（3D 图谱）+ `oneEuroFilter.ts`（平滑）：

```vue
<script setup>
import { use3DGraph } from '@/composables/use3DGraph'

const graph = use3DGraph()
onMounted(() => {
  graph.bind(containerRef.value)
  graph.loadGraphData(yourGraphData) // { nodes: [{data: {id, label, type, ...}}], edges: [{data: {source, target}}] }
})
</script>
```

### 加手势控制

额外需要 `useHandTracking.ts` + MediaPipe 文件：

```vue
<script setup>
const hand = useHandTracking()
hand.onGestureChange((result) => {
  graph.applyGesture(result.gesture, result.palmPosition.x, result.palmPosition.y,
    result.indexTip.x, result.indexTip.y)
})
// 用户点击按钮后
hand.start(containerRef.value)
</script>
```

### 数据格式

```typescript
interface GraphData {
  nodes: Array<{ data: { id: string, label: string, type: string, [key: string]: any } }>
  edges: Array<{ data: { source: string, target: string, label?: string } }>
}
```

---

## 十一、可调参数速查

| 参数 | 位置 | 默认值 | 说明 |
|------|------|--------|------|
| 检测间隔 | useHandTracking | 25ms | 越小越灵敏但越卡 |
| 平滑帧数 | useHandTracking | 2 | 手势切换防抖 |
| 手势优先级 | useHandTracking | pointing > palm > fist | 互斥检测 |
| 旋转灵敏度 | use3DGraph | 1.5 | 用户可调滑块 |
| 缩放速度 | use3DGraph | 3 | 用户可调滑块 |
| One-Euro beta (旋转) | use3DGraph | 0.12 | 越大越灵敏 |
| One-Euro beta (缩放) | use3DGraph | 0.05 | 越小越平滑 |
| 球坐标 phi 限制 | use3DGraph | 0.15 ~ π-0.15 | 防相机翻转 |
| 节点斥力强度 | use3DGraph | 3000 | 力导向布局 |
| 弹簧长度 | use3DGraph | 120 | 边的理想长度 |
| 节点阻尼 | use3DGraph | 0.92 | 每帧速度衰减 |
