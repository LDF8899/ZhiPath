# ZhiPath 通用出题器

这套流程参考 `D:\AAA\hksx\question-generator-template` 和 `zfhs_hk.sql` 的任务生命周期，适配 ZhiPath 现有 NestJS + React + `exam_questions_v3` 题库。

## 生命周期

1. `POST /api/user/question-generation/tasks` 创建任务。
2. `POST /api/user/question-generation/tasks/:id/start` 启动后台生成。
3. 前端轮询 `GET /api/user/question-generation/tasks/:id/snapshot`，读取进度和可恢复题目快照。
4. `POST /api/user/question-generation/tasks/:id/questions/batch` 将快照写入题库草稿（`exam_questions_v3.status = 0`）。
5. 审核后调用 `PATCH /api/user/question-generation/tasks/:id/questions/approve`，批准题目上架（`status = 1`）。

题库的选择题仍保存为 ZhiPath 现有考试服务使用的字符串选项数组和数字答案索引；通用题目对象的 `metadata`、`parts` 和选项 key 保留在 JSON 中。

## 与聊天智能体联动 + 反馈闭环

- 聊天智能体的 `generate_exam` 动作（`action-executor.service.ts`）与出题器共享同一套高质量提示词（`question-generation.prompts.ts`：逆向构建法、难度阶梯、干扰项质量、M/A 评分点、多样性守卫）。
- 智能体在对话里触发"出 N 道题"时，经 `QuestionGenerationService.generateForChat()` 一次多道生成，写入 `exam_records_v3`。
- 答题结果走现有 `ExamsService.submitExam` 反馈链路：更新 `user_skills` 掌握度（mastery_pct + trustWeight + 衰减）、写 `skill_snapshots_v3`、写 evaluation-spine、并进入 MongoDB 用户画像（profile-scheduler 每 15 分钟增量分析）。

## 数据库

首次启用前执行 `deploy/20260822-question-generation.sql`。它创建任务/快照表，并为 `exam_questions_v3` 增加 `generation_task_id`、`source_order`、`reviewed_at` 字段。脚本兼容 MySQL 8.0（不使用 MariaDB 专属的 `ADD COLUMN IF NOT EXISTS`），并用 `information_schema` 断言保证可重复执行。

应用方式：`mysql -h ... -P ... -u ... -p zhipath < deploy/20260822-question-generation.sql`

## OCR 题库导入（试卷图片）

- 视觉模型：智谱 `ZHIPU_VISION_MODEL=glm-5v-turbo`（base64 图片即可，无需公网 URL）。
- 端点：`POST /api/user/question-bank/imports`（上传图片 base64）→ `GET /imports`、`GET /imports/:id` → `POST /imports/:id/confirm` 发布到 `exam_questions_v3`。
- 表：`question_bank_imports`（批次）+ `question_bank_import_candidates`（候选题）。迁移 `deploy/20260822-bank-import.sql`。
- 前端：`/user/question-generator` 页面底部有「题库导入」，上传试卷图片 → OCR → 勾选 → 确认入库。

## 结合题库出题

- 出题表单/聊天智能体勾选「结合题库」后（`referenceLibrary=true`），出题时按主题/知识点检索 `exam_questions_v3`，把已入库题目作为风格/考点参考 + 防重复基准注入提示词。

## 补弱（弱点 → 由浅入深出题 → 反馈）

- 参考 hksx `ma_ai_remediation_tasks` 的「弱项检测 → 弱项分析 → 补弱试卷 → 分配 → 反馈」闭环。
- 后端 `modules/remediation/`：`GET /api/user/remediation/weak-points` 读用户弱项（`user_skills.mastery_pct < 60`）；`POST /prepare` 把弱项包装成「由浅入深」的补弱出题配置；`POST /generate` 直接创建并启动补弱出题任务（走完整生命周期，可在出题器审核）。
- 前端：出题页「智能补弱出题」按钮——自动定位弱项、填充知识点与补弱指令、参考题库防重复并生成。
- 聊天智能体：`generate_exam` 带 `remediation:true` 时，自动读弱项知识点、注入「由浅入深」补弱指令并出题。
- 反馈闭环：补弱题作答 → `submitExam` → `commitSkill` 更新掌握度/画像 → 弱项收敛。

### 错题本 → 一键补强出题（闭环入口）

- `/user/wrong-answers` 每个技能分组新增「一键补强出题」：调用 `POST /user/remediation/generate`（`topics:[{label:该技能}]`）创建补弱出题任务 → 跳转 `/user/question-generator?taskId=...` 自动加载快照审核 → 批准备入库 → 作答 → 反馈回灌掌握度/错题 → 弱项收敛。出题器也支持 `?taskId=` 自动加载任务。

## 题库 / 组卷 + 智能体注入出题配置

- 题库页：`/user/question-bank`。`GET /api/user/question-bank/questions`（按技能/题型/难度/来源筛选 + 分页）；`POST /api/user/question-bank/assemble`（勾选题目组卷 → 写入 `exam_records_v3` 并有作答 `served`，返回 examId → 跳转 `/user/exams/:id/take`）。来源区分：`generated`(AI出题)/`imported`(OCR导入)/`manual`/`enterprise`。
- 智能体注入：聊天 `question_config` 动作把用户出题需求解析为 `GenerationConfig`，前端存储到 `utils/questionGeneratorConfig`，`/user/question-generator` 挂载时自动预填。`generate_exam` 带 `remediation:true` 时走补弱。

### 闭环三件事

1. **审核后自动进考**：出题器「批准并练习」→ 已批准题组卷 → 跳转 `/user/exams/:id/take` 直接作答（复用 `assemble`）。
2. **成长画像·补强卡片**：`components/WeakPointCard` 在首页展示当前薄弱点（`/user/remediation/weak-points`）+「一键补弱出题」。
3. **补强前后掌握度对比归档**：`remediation_runs` 表记录每次补强的"补强前"掌握度；`GET /user/remediation/history` 返回 补强前 → 当前 掌握度 + 增量；`WeakPointCard` 展示「近期补强效果」。迁移 `deploy/20260822-remediation.sql`。
4. **完成/失败通知**：出题任务异步完成后 `NotificationService.notifySystem` 通知用户（`/user/question-generator`）。生成本身已是异步任务 + 进度轮询；如需全量 BullMQ 队列可在 `modules/queue` 追加。

## GeoGebra 数学作图

- 出题时若题干涉及几何/坐标系/函数图/圆锥曲线/数形结合，LLM 会输出 `figure`（`{"type":"geogebra","commands":[...],"view":[xmin,xmax,ymin,ymax]}`）。
- 前端 `components/GeoGebraFigure.tsx` 用官方 `geogebra-loader.js`（`window.GGBApplet`）+ `evalCommand()` 动态渲染，可导出 PNG/SVG；出题审核页与聊天 `geogebra` 卡片均可显示。
- 聊天智能体：`generate_geogebra` 动作按需生成几何/函数图（"画个圆/画函数图/数形结合"），`action-executor` + `tutor-prompt` 已接入。
- LLM：全平台 DeepSeek `deepseek-v4-flash-vision-exp`（OpenAI 兼容端点）。生成用 `response_format: json_object` 保证返回合法 JSON；并传 `thinking:{type:"disabled"}` 关闭深度思考（DeepSeek 默认深度思考会耗尽 token 预算导致 content 为空、`extractJson` 失败）。glm-5.3/5.2 因"始终思考不产 content"不用于结构化生成。

- 页面入口：`/user/question-generator`、`/user/question-bank`。
