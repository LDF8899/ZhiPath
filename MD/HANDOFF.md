# SkillStudio (ZhiPath) 项目交接文档

> 更新时间：2026-09-01 09:30 · 面向接手的智能体/开发者，可独立读懂项目全貌

---

## 一、项目是什么

**SkillStudio**（代码目录 `D:\ZhiPath\`）是一款面向 AI-native 软件开发方向的垂直领域技能学习平台。

| 组成 | 路径 | 说明 |
|---|---|---|
| 后端 | `D:\ZhiPath\backend-ts` | NestJS + TypeORM + MySQL(3307, root/root123, 库名 zhipath)，LLM 用 DeepSeek 系列 |
| 新前端 | `D:\ZhiPath\codenovafrontend` | React + Vite（端口 5180），本次从零构建的主工程 |
| 旧前端 | `D:\ZhiPath\`（另一目录） | 仅作参考，不再开发 |

**启动方式**（Windows, Git Bash）：
- 后端：`cd /d/ZhiPath/backend-ts && npm run start:dev`（端口 3000，健康检查 `GET /api/competition/health`）
- 前端：`cd /d/ZhiPath/codenovafrontend && npm run dev`（端口 5180）
- 测试账号：user_id=47，token 存于 `C:/Users/a1527/WorkBuddy/2026-08-30-16-08-03/tmp/token.txt`（可能过期，过期则重新登录获取）

## 二、产品核心链路（均已跑通 ✅）

```
注册/登录(sessionStorage token) → Onboarding 画像(背景/阶段/领域/目标/时间/技能)
→ 学习计划 → 今日工作台 → 技能学习闭环(讲义/测验/掌握度回写)
→ AI 教练对话(SSE + action 卡片) → 资源台账(有用/没用反馈闭环)
→ 成长报告(能力雷达/知识盲区/难度匹配曲线) → Agent 工作台(10 类智能体派发任务)
```

## 三、当前进度

### 已完成（Task #1-#10 全部 completed）
1. **前端工程**：路由/鉴权 store/API 客户端(信封解包+401 处理)/SSE 共享连接/浅色设计系统
2. **核心页面**：登录、Onboarding、工作台、路径学习、Coach、Resources、Report、Agents——全部与后端真实联调过
3. **Bug 修复清单**（本次会话）：
   - Coach 页 action 卡片类型不匹配：后端落地类型是 `progress/path_generated/resources` 等，前端只写了 `show_progress/generate_path` → 前端已兼容两套命名
   - 资源反馈字段错位：前端读顶层 `useful`，实际在 `previewMeta.feedbackUseful` → 加了 `resourceUseful()` 统一读取
   - 成长报告三处：知识盲区显示"未命名"（字段应为 `label/masteryPct`）、能力项完成误导性 0/10（加 `in_progress_skills` 进行中计数）、难度曲线空（测评分数在 `result.normalizedScore` 嵌套层）
   - **掌握度回写失败**：`user_skills_v3` 唯一索引是 `(user_id, skill_name)` 不含 source，按 source 插入必撞唯一约束 → 改为按技能名 upsert（`setMastery` 增强为 upsert）
   - **雷达图全 0**：`getGitProfileState` 优先选 main 分支，但学习进度全在 plan 分支 → 改为优先选 head 提交有快照的分支
   - **skillgap 派发崩溃** `targetJob.preferredSkills is not iterable`：算法无空值守卫 + 前端只传 skillName → `calculateBasicGap`/`buildAnalysisPrompt` 加 Array.isArray 兜底；控制器自动查库补全用户技能与目标岗位（注入 Student/JobPosition/UserSkill 三个 repo）

### 验证证据
- 派发任务 #178：deepseek-v4-pro（tier=pro, thinking=on/high）64s 生成 → success，报告含 matchScore=55、差距清单、240h 时间线、学习建议
- 掌握度回写：`LLM 调用与结构化输出` mastery=80, trust=0.90 落库成功，雷达显示非零
- 反馈闭环：POST /feedback 201 → 按钮选中态 + "已标记有用"绿标正常

## 四、关键坑（接手必读）

1. **Windows 下改后端代码后 tsc watch 静默失效**：运行中的 node 进程锁 dist 文件，编译报 EPERM(TS5033) 但继续跑旧代码。**改后端必须：kill 3000 端口进程 → `npm run build` → 重启 → 验证**。
2. **agent-browser CLI 守护进程已损坏**（open 挂起 SIGTERM，杀进程/清 `~/.agent-browser/` 状态文件/清 Temp profile/重装均无效）。**替代方案（已验证可用）**：常驻无头 Chrome `--remote-debugging-port=9222` + `tmp/cdp-shot.mjs`（Node 22 内置 WebSocket 走 CDP，真实时间等待后抓帧）；认证页用 public/ 下临时 iframe 宿主页注入 sessionStorage（`codenova_token`/`codenova_user`），**用完必须删除**（内嵌 JWT）。注意 `--virtual-time-budget` 会被轮询/SSE 页面挂死、`--timeout` 参数无效。
3. **两套 action 类型命名并存**：intent-router 用 `show_progress/generate_path`，action-executor 落地成 `progress/path_generated/resources/exam/jobs/target_set`，前端 case 需同时兼容。
4. **字段嵌套**：测评记录是 `{attempt, result, impact}` 结构，分数在 `result.normalizedScore`；技能表唯一索引 `(user_id, skill_name)` 不含 source。
5. **retry 接口会创建新任务行**（保留失败历史），每任务 1:1 生成一条 generated_resource，看到"重复资源"先查 sourceTaskId。

## 五、下一步计划（按优先级）

> 2026-09-01 更新：前端 16 个任务全部完成，8 个页面已 NOVA 化并经 CDP 截图验证。重心从前端视觉转回后端稳定性与内容管线。

### P0 — 收尾即可交付的前端余项（1 天内）
1. **SkillStudio（学习闭环页，907 行）与 PlanCreate 的 NOVA 收尾**：讲义/测验/实操三步的选项卡、掌握度回写提示、步骤条已继承全局样式，但页面级动效（stagger 入场、渐变 CTA）未逐页复核；改完跑 `tsc --noEmit && npm run build`，用 CDP 方案截图确认。
2. **Agents 派发弹窗最终视觉复核**：API 层已验证（任务 #178 成功），弹窗 UI 交互用 CDP 截图过一遍即可关闭此项。

### P1 — 影响内容生成稳定性的后端项
3. **deepseek-v4-pro 空回复防护**（此前定位过根因）：reasoning_content 耗尽 token 预算导致 content 为空时回退异常。在 LLM 调用层加兜底：content 为空时自动降推理档（high→medium）重试一次，再空则回退 deepseek-v4-flash，并把事件写入任务日志便于追踪。
4. **多模态模型接入**：评估 deepseek-v4-flash-vision-exp 做 OCR/视觉场景（讲义配图、图表生成校验）。`.env` 必须显式配置 `VISION_MODEL`——此前缺配导致视觉调用静默回退到纯文本模型 deepseek-v4-flash。

### P2 — 质量与体验
5. **浏览器全链路回归**：用 CDP 截图方案（不依赖已损坏的 agent-browser）把 8 个页面按真实用户路径过一遍：注册→Onboarding→生成路径→今日→学习闭环→资源反馈→报告→Agent 派发。
6. **产品打磨**：Coach 页 action 卡片信息密度（后端有 phase 明细/matchScore/预估日期，前端只显示一句话）；报告页数据口径统一。

### P3 — 工程化
7. **测试资产化**：把 curl 冒烟脚本固化（参考 workspace 根目录 `smoke.mjs`）+ CDP 截图脚本 `tmp/cdp-shot.mjs` 纳入回归，每次改动后端跑冒烟、改前端跑构建+截图。

## 六、快速自检命令

```bash
# 服务健康
curl -s http://localhost:3000/api/competition/health
# 任务列表
TOKEN=$(cat "C:/Users/a1527/WorkBuddy/2026-08-30-16-08-03/tmp/token.txt")
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/user/agent-office/tasks?limit=5"
# 前端页面
curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/
```
