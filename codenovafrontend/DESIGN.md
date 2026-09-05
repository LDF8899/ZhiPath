# CodeNova 设计语言 v2 —— NOVA（超新星）

> 品牌意象：**超新星爆发 · 星空探索未知**。
> Landing 是品牌时刻（深空沉浸），工作台是探索舱（浅色高效 + 星光细节）。

---

## 1. 设计原则

| 原则 | 落地方式 |
|---|---|
| **一次爆发，处处星光** | Landing 深空场景承担全部"哇"感；工作台只用克制的光效与动效呼应 |
| **动效有物理感** | 爆发 = 快进缓出 + 回弹（`--ease-burst`）；漂移 = 慢速匀速；闪烁 = 呼吸 |
| **光即层级** | 重要元素用发光表达（glow 分级），而非加粗加重边框 |
| **数字是活的** | 所有指标 count-up 滚动，列表级联入场，不做静态罗列 |

## 2. 令牌系统（`src/styles/tokens.css`）

### 星体色（渐变原料）
```
--nova-ice    #22d3ee   冰蓝星核
--nova-blue   #6366f1   靛蓝
--nova-violet #a855f7   紫
--nova-pink   #ec4899   冕层粉
--nova-gold   #fbbf24   恒星金
```

### 品牌渐变
```
--grad-nova        主渐变（ice→blue→violet→pink）  按钮/描边/激活态
--grad-nova-soft   14% 透明版                      浅底高亮（导航激活/icon-wrap）
--grad-nova-text   文字渐变（亮色系）               渐变标题
--grad-core        星核径向渐变                     超新星光球
--grad-deep        深空场景底                       Landing hero
```

### 发光阴影（按星体层级）
`--glow-soft`(18px) → `--glow-ice/blue/violet`(24-28px)；交互态发光优先级高于投影。

### 动效令牌
```
--ease-smooth  cubic-bezier(.16,1,.3,1)    长余韵，入场主推
--ease-burst   cubic-bezier(.16,1.6,.3,1)  超新星爆发回弹
--stagger      65ms                        级联间隔
--dur-drift    9000ms                      星尘漂移周期
```

## 3. 动效系统

### keyframes 库（`src/styles/motion.css`）
| 类别 | 动画 | 用途 |
|---|---|---|
| 入场 | `nova-burst` `rise-in` `word-in` `wipe-in` `pop-in` | 爆发/升起/逐词/扫开/弹出 |
| 星体 | `star-twinkle` `nova-breathe` `drift-slow` `float-y` `orbit` | 闪烁/呼吸/漂移/悬浮/公转 |
| 光效 | `gradient-pan` `comet-sweep` `glow-pulse` `ring-trace` | 渐变流动/彗尾扫光/发光脉冲/描线 |

工具类：`.anim-*`（支持 `--d` 延迟）、`.stagger > *`（按 `--i` 级联）、`.text-gradient`、`.glass` / `.glass-deep`、`.border-nova`、`.hover-lift`、`.hover-glow`、`.press`、`.tilt`、`.comet`、`.stardust`、`.nova-core`、`.nova-dot`、`.marquee`、`.num`。

### hooks（`src/lib/motion.ts`）
| hook | 用途 |
|---|---|
| `useCountUp(target)` | 数字滚动（ease-out 四次方缓动） |
| `useReveal()` | IntersectionObserver 视口入场（配合 `.reveal`） |
| `useStagger()` | 容器子元素注入 `--i` 级联序号 |
| `useTilt(maxDeg)` | 3D 倾斜 + 高光跟随（仅精确指针） |
| `useMagnetic(strength)` | 磁吸按钮（主要 CTA） |
| `makeStardust(count, seed)` | 确定性星尘粒子样式生成 |

全部尊重 `prefers-reduced-motion`。

## 4. 规范组件（`src/components/ui.tsx`）

| 组件 | 说明 |
|---|---|
| `Button` | 新增 `magnetic`；primary = 新星渐变 + 彗尾扫光 |
| `StatCard` | 指标卡：渐变顶线 + 图标 + **count-up** 数字 + hover 升空 |
| `ProgressRing` | 渐变进度环（SVG，发光描边，dashoffset 过渡） |
| `GradientText` | 渐变文字（`flow` 开启流动） |
| `Stardust` | 星尘环境粒子层（工作台氛围） |
| `Reveal` | 视口入场包装器（`delay` 毫秒） |
| `SectionTitle` | 标题 + 渐变发丝延长线 |
| `Logo` | 超新星 SVG 标（`Logo.tsx`：星核+八向星芒+斜置轨道） |

## 5. 页面应用规范

- **Landing**：深空场景（双层星野 `.landing__stars` + 超新星核 `.landing__nova`）、hero 逐词入场（90ms 级联）、玻璃登录舱（`.auth-card` 深空玻璃 + 渐变描边）
- **工作台**：浅色底 + `.main::before` 极光雾环境光（26s 漂移）+ rail 星尘
- **导航激活**：`.grad-nova-soft` 底 + 左侧 3px 渐变光条 + 图标发光
- **指标区**：`StatCard` + `.stagger` 级联（Today / Report / Agents 已接入）
- **对话**：AI 气泡极光描边、用户气泡新星渐变、消息 `rise-in` 入场
- **弹层**：`nova-burst` 入场；Toast 升起 + 发光

## 6. 禁用事项

- 不要用静态 `--brand-600` 大色块当主视觉——一律走 `--grad-nova`
- 不要给工作台页面加深色底——深空只属于 Landing/品牌时刻
- 不要 `animation: none` 硬关动效——用 `prefers-reduced-motion` 媒体查询
- SVG 图标按钮必须加 `aria-label`（agent-browser 自动化需要）

## 第二批页面应用（2026-09-01 追加）

- **Onboarding**：深空品牌场景（复用 `landing__stars` / `landing__nova` + `.space-layer` 固定底），浅玻璃 `wizard-card`，顶部 Logo 品牌行（`.wizard__brand`），卡片 `anim-rise` 入场。规则：wizard 语境下的星空层必须 `position: fixed; z-index: -1`（landing 类默认 absolute/z-index 1，会盖住内容）。
- **Paths**：计划切换 chip 激活态用 `.plan-chip.is-active`（渐变描边 + brand-50 底，替代内联 brand-600 border）；当前阶段 `.phase.is-current` 的 marker 为 nova 渐变发光球 + 左侧 inset 光条；`.skill-row` hover 渐变左条 + 右移 3px；阶段列表 `.stagger` + `useStagger` 入场；「新建路径」用 `variant="primary"` 渐变 CTA。
- **Resources**：台账 `.ledger.stagger` + `useStagger` 入场；反馈按钮激活态 `.is-on--up` nova 渐变发光 / `.is-on--down` 玫红渐变；`.tip-note` 左侧渐变光条（border-image）。
- 注意：`CardBody` 不转发 ref，stagger 容器需用内部 `<div className="col stagger" ref={...}>` 包裹。
- 路由提醒：学习路径是 `/path`（单数），截图/跳转勿写 `/paths`。

## 移动端排版（2026-09-04）

新增断点：
- `≤640px`（手机竖屏）：会话列表改为横向 chip 条（高度 ~64px，不再挤对话区）；`100dvh` 视口；输入栏加 `env(safe-area-inset-bottom)` + 16px 输入防 iOS 自动放大；消息气泡 14px、头像 26px；动作卡片单列；顶栏紧凑（隐藏 crumbs）。
- `641–900px`（平板横屏）：会话区紧凑 150px，仍横向滚动。

要点：CSS-only 改动；纯 CSS media query 不需要组件代码改动；`dvh` 单位兼容移动浏览器地址栏隐藏/显示；`env(safe-area-inset-bottom)` 处理 iPhone 底部小白条。

## 移动端文本溢出（2026-09-04 第二轮）

### 痛点
- `.ledger__title.truncate` 被同行按钮挤压到 137px，标题被截断成 ellipsis
- `.btn` 文字过长（`white-space: nowrap`）撑破容器
- `.tag` 不可换行
- `.segmented` 过滤器在窄屏横向挤压缩略
- 雷达图 SVG 标签在 1.2× 半径处被 viewBox 裁切

### 修复要点（base.css ≤640px）
- `.ledger__row > .grow` `flex-basis: calc(100% - 42px)` 让标题块独占一行；`.ledger__title` 强制 `white-space: normal` 覆盖 `.truncate` 截断
- `.btn/.tag` `white-space: normal`
- `.segmented` 横向滚动
- `.modal/.toast` `max-width: calc(100vw - 24px)`

### 雷达图修复（charts.tsx）
- viewBox 加 PAD_X=52 / PAD_Y=20 内边距，标签不再被裁切
- `max-width: 100%` 自适应缩放

### 验证
- `tmp/cdp-audit.mjs`：CDP 移动视口溢出审计，跳过 SVG text 与滚动容器误报
- 5 视口（320/375/414/768/1024）× 6 页面 = 30 组全部 0 溢出
