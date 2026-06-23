# ZhiPath 数据库文档 v3.0

> 更新日期：2026-06-12
> MySQL 版本：8.0.36 (Docker)
> 数据库名：`zhipath`
> 字符集：utf8mb4 / utf8mb4_unicode_ci

---

## 概览

共 18 张表，统一 `_v3` 后缀命名，snake_case 列名。

| 表名 | 说明 | 当前行数 |
|------|------|------:|
| `users_v3` | 用户表（统一账号） | 10 |
| `students_v3` | 学生画像 | 7 |
| `enterprises_v3` | 企业信息 | 5 |
| `job_positions_v3` | 岗位信息 | 8 |
| `job_applications_v3` | 岗位投递 | 3 |
| `resumes_v3` | 简历（多版本） | 2 |
| `user_skills_v3` | 用户技能（掌握度+衰减） | 22 |
| `learning_plans_v3` | 学习计划（主线/支线） | 7 |
| `learning_tasks_v3` | 每日学习任务 | 7 |
| `learning_sessions_v3` | 学习会话记录 | 3 |
| `exam_questions_v3` | 考试题库 | 8 |
| `exam_records_v3` | 考试记录 | 5 |
| `knowledge_base_v3` | 知识库（讲义/题/图谱） | 0 |
| `news_v3` | 资讯 | 5 |
| `notifications_v3` | 通知 | 6 |
| `agent_tasks_v3` | Agent 任务队列 | 0 |
| `system_config_v3` | 系统配置 | 4 |
| `operation_logs_v3` | 操作日志 | 0 |

---

## 公共字段

所有表（除 `operation_logs_v3`）继承以下公共字段：

| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | bigint | AUTO_INCREMENT | 主键 |
| `status` | tinyint | 1 | 1=正常 0=删除 |
| `create_time` | bigint | NULL | 创建时间戳(ms) |
| `update_time` | bigint | NULL | 更新时间戳(ms) |

---

## 表结构详情

### 1. users_v3 — 用户表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| username | varchar(100) | NO | — | 用户名（UNIQUE） |
| password | varchar(255) | NO | — | bcrypt hash |
| real_name | varchar(100) | YES | NULL | 真实姓名 |
| phone | varchar(20) | YES | NULL | 手机号 |
| email | varchar(200) | YES | NULL | 邮箱 |
| avatar | varchar(500) | YES | NULL | 头像URL |
| role | enum('admin','student') | NO | 'student' | 角色 |
| status | tinyint | NO | 1 | 1=正常 0=禁用 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`username` (UNIQUE)

---

### 2. students_v3 — 学生画像

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联 users_v3 |
| name | varchar(100) | YES | NULL | 姓名 |
| student_no | varchar(50) | YES | NULL | 学号 |
| school | varchar(100) | YES | NULL | 学校 |
| major | varchar(100) | YES | NULL | 专业 |
| grade | varchar(20) | YES | NULL | 年级/毕业年份 |
| phone | varchar(20) | YES | NULL | 联系方式 |
| email | varchar(200) | YES | NULL | 联系方式 |
| target_job_id | bigint | YES | NULL | 目标岗位 FK |
| interests | json | YES | NULL | 兴趣方向 |
| skills | json | YES | NULL | 技能列表（冗余） |
| projects | json | YES | NULL | 项目经历（冗余） |
| github_username | varchar(100) | YES | NULL | GitHub 用户名 |
| work_experience | json | YES | NULL | 实习/工作经历 |
| awards | json | YES | NULL | 获奖/证书 |
| self_intro | text | YES | NULL | 自我评价 |
| daily_hours | decimal(3,1) | YES | NULL | 每日可投入学习时长(h) |
| target_deadline | varchar(50) | YES | NULL | 目标达成时间 |
| onboarding_completed | tinyint | NO | 0 | 0=未完成 1=已完成 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id` (UNIQUE), `target_job_id`

---

### 3. enterprises_v3 — 企业表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| name | varchar(200) | NO | — | 企业名称 |
| industry | varchar(100) | YES | NULL | 行业 |
| contact_email | varchar(200) | YES | NULL | 联系邮箱 |
| contact_name | varchar(100) | YES | NULL | 联系人 |
| contact_phone | varchar(20) | YES | NULL | 联系电话 |
| status | tinyint | NO | 0 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

---

### 4. job_positions_v3 — 岗位表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| title | varchar(200) | NO | — | 岗位名称 |
| company | varchar(200) | YES | NULL | 公司名称 |
| level | enum('junior','mid','senior') | YES | 'junior' | 岗位级别 |
| jd_text | text | YES | NULL | 原始JD文本 |
| required_skills | json | YES | NULL | 必须技能 [{name,weight}] |
| preferred_skills | json | YES | NULL | 加分技能 [{name,weight}] |
| salary_range | varchar(100) | YES | NULL | 薪资范围 |
| location | varchar(200) | YES | NULL | 工作地点 |
| delivery_threshold | tinyint | NO | 60 | 投递门槛百分比 |
| source | varchar(50) | YES | 'manual' | 来源 manual/jd_parser/enterprise |
| confidence_score | decimal(3,2) | YES | NULL | JD解析置信度 |
| enterprise_id | bigint | YES | NULL | 关联企业 |
| neo4j_node_id | varchar(100) | YES | NULL | Neo4j 节点ID |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`level`, `status`

---

### 5. job_applications_v3 — 岗位投递表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| job_id | bigint | NO | — | 关联岗位 |
| resume_id | bigint | YES | NULL | 关联简历 |
| reviewer_agent_score | decimal(5,2) | YES | NULL | AI筛选分 |
| reviewer_agent_comment | text | YES | NULL | AI建议 |
| admin_decision | tinyint | NO | 0 | 0=待处理 1=通过 2=拒绝 |
| admin_comment | varchar(500) | YES | NULL | 管理员备注 |
| enterprise_email | varchar(200) | YES | NULL | 企业邮箱 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `job_id`

---

### 6. resumes_v3 — 简历表（多版本 Git 模型）

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| target_job_id | bigint | YES | NULL | 目标岗位 |
| version | int | NO | 1 | 版本号 |
| version_name | varchar(100) | YES | NULL | 如 v1-前端开发工程师 |
| is_base | tinyint | NO | 0 | 是否基础简历 |
| content | json | YES | NULL | 简历结构化内容 |
| html_content | mediumtext | YES | NULL | 简历HTML |
| pdf_file_id | bigint | YES | NULL | PDF文件ID |
| review_comment | varchar(500) | YES | NULL | 审阅备注 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`

---

### 7. user_skills_v3 — 用户技能表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| skill_name | varchar(100) | NO | — | 技能名称 |
| mastery_pct | decimal(5,2) | NO | 0.00 | 掌握百分比 0-100 |
| trust_weight | decimal(3,2) | NO | 0.30 | 信任权重 |
| source | enum('self_report','conversation','github','exam') | NO | 'self_report' | 技能来源 |
| last_activity | bigint | YES | NULL | 最后使用/学习时间戳 |
| decay_start | bigint | YES | NULL | 开始衰减时间 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `skill_name`, `mastery_pct`

---

### 8. learning_plans_v3 — 学习计划表（多计划 + Git 分支模型）

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| plan_name | varchar(100) | NO | 'Default Plan' | 计划名称 |
| plan_type | enum('main','side') | NO | 'main' | 主线/支线 |
| target_job_id | bigint | YES | NULL | 目标岗位 |
| path_data | json | YES | NULL | 阶段→技能点→资源 |
| current_phase | int | NO | 0 | 当前阶段索引 |
| daily_hours | decimal(3,1) | YES | NULL | 本计划每日时长 |
| main_ratio | tinyint | YES | 80 | 主线占比 % |
| match_score | decimal(5,2) | YES | NULL | 当前匹配度 |
| estimated_date | varchar(50) | YES | NULL | 预计达成日期 |
| branch_from | bigint | YES | NULL | 分支来源计划ID |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `plan_type`, `status`

---

### 9. learning_tasks_v3 — 每日学习任务表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| plan_id | bigint | NO | — | 关联计划 |
| skill_name | varchar(100) | NO | — | 技能名称 |
| task_type | enum('main','side') | NO | 'main' | 主线/支线 |
| task_status | enum('pending','in_progress','lecture_done','practice_done','code_done','exam_done','skipped','done') | NO | 'pending' | 任务状态机 |
| estimated_min | int | YES | NULL | 预估时长(分钟) |
| actual_min | int | YES | NULL | 实际时长(分钟) |
| sort_order | int | NO | 0 | 排序(支持拖拽) |
| priority | tinyint | NO | 5 | 优先级 1-10 |
| plan_date | varchar(20) | YES | NULL | 安排日期 YYYY-MM-DD |
| start_time | bigint | YES | NULL | 开始时间戳 |
| complete_time | bigint | YES | NULL | 完成时间戳 |
| is_active | tinyint | NO | 1 | 1=有效 0=删除 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `plan_id`

---

### 10. learning_sessions_v3 — 学习会话记录表（Git commit 模型）

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| plan_id | bigint | YES | NULL | 关联计划 |
| session_date | varchar(20) | NO | — | 日期 YYYY-MM-DD |
| started_at | bigint | YES | NULL | 会话开始时间戳 |
| ended_at | bigint | YES | NULL | 会话结束时间戳 |
| total_duration_ms | bigint | YES | 0 | 总学习时长ms |
| tasks_snapshot | json | YES | NULL | 当日任务完成快照 |
| skill_changes | json | YES | NULL | 技能变化 [{name,before,after}] |
| match_score_before | decimal(5,2) | YES | NULL | 学习前匹配度 |
| match_score_after | decimal(5,2) | YES | NULL | 学习后匹配度 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `session_date`

---

### 11. exam_questions_v3 — 考试题库表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| exam_type | tinyint | NO | — | 1=通用技能 2=岗位考试 3=5分钟速测 |
| skill_name | varchar(100) | YES | NULL | 技能名称 |
| job_id | bigint | YES | NULL | 关联岗位 |
| question_type | enum('choice','fill','coding','essay') | NO | — | 题型 |
| title | varchar(500) | NO | — | 题目标题 |
| content | json | NO | — | 题目内容 |
| answer | json | YES | NULL | 正确答案/评分要点 |
| difficulty | tinyint | NO | 1 | 难度 1-5 |
| confidence_score | decimal(3,2) | YES | NULL | Agent出题置信度 |
| pass_rate | decimal(5,2) | YES | NULL | 通过率(统计) |
| created_by | enum('agent','manual','enterprise') | YES | 'agent' | 出题来源 |
| reviewed_by | bigint | YES | NULL | 审核人 |
| status | tinyint | NO | 0 | 0=待审核 1=已上架 2=已下架 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`exam_type`, `skill_name`, `status`

---

### 12. exam_records_v3 — 考试记录表（含错题分析）

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| exam_type | tinyint | NO | 1 | 1=通用技能 2=岗位考试 |
| skill_name | varchar(100) | YES | NULL | 技能名称 |
| job_id | bigint | YES | NULL | 关联岗位 |
| question_ids | json | YES | NULL | 题目ID列表 |
| score | decimal(5,2) | YES | NULL | 得分 |
| passed | tinyint | NO | 0 | 是否通过 |
| answers | json | YES | NULL | 用户答题内容 |
| wrong_analysis | json | YES | NULL | 错题分析 |
| retry_count | int | NO | 0 | 重试次数 |
| next_retry_time | bigint | YES | NULL | 下次重试时间 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `exam_type`

---

### 13. knowledge_base_v3 — 知识库表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| title | varchar(500) | NO | — | 资源标题 |
| skill_name | varchar(100) | NO | — | 所属技能 |
| resource_type | enum('lecture','choice','fill','coding','essay','graph') | NO | — | 资源类型 |
| content | json | NO | — | Markdown讲义/题目/图谱数据 |
| version | int | NO | 1 | 版本号 |
| source | varchar(255) | YES | NULL | 来源 |
| reviewed_by | bigint | YES | NULL | 审核人 |
| status | tinyint | NO | 1 | 1=正常 0=待审查 2=已过期 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`skill_name`, `resource_type`

---

### 14. news_v3 — 资讯表（含 AI 摘要 + 技能标签）

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| title | varchar(500) | NO | — | 标题 |
| content | text | YES | NULL | 正文 |
| summary | varchar(1000) | YES | NULL | AI生成摘要 |
| image | varchar(500) | YES | NULL | 封面图 |
| type | varchar(50) | YES | NULL | industry/tech/recruit |
| tags | json | YES | NULL | 技能标签 |
| source | varchar(100) | YES | NULL | 来源 |
| source_url | varchar(1000) | YES | NULL | 原文链接 |
| publish_time | bigint | YES | NULL | 发布时间戳 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`type`, `status`

---

### 15. notifications_v3 — 通知表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| type | enum('learning','progress','job','exam','system') | NO | — | 通知类型 |
| title | varchar(200) | NO | — | 标题 |
| content | text | YES | NULL | 内容 |
| link | varchar(500) | YES | NULL | 点击跳转路径 |
| is_read | tinyint | NO | 0 | 0=未读 1=已读 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `type`

---

### 16. agent_tasks_v3 — Agent 任务队列表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | NO | — | 关联用户 |
| agent_type | enum('lecture','reading','code','path','assess') | NO | — | Agent 类型 |
| title | varchar(200) | NO | — | 任务标题 |
| description | text | YES | NULL | 任务描述 |
| params | json | YES | NULL | 任务参数 |
| task_status | enum('pending','running','success','failed','cancelled') | NO | 'pending' | 任务状态 |
| progress | int | NO | 0 | 进度 0-100 |
| result | json | YES | NULL | 任务结果 |
| error_message | text | YES | NULL | 错误信息 |
| is_urgent | tinyint | NO | 0 | 是否紧急 |
| sort_order | int | NO | 0 | 排序 |
| started_at | bigint | YES | NULL | 开始时间 |
| completed_at | bigint | YES | NULL | 完成时间 |
| status | tinyint | NO | 1 | 软删除标记 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`user_id`, `agent_type`, `task_status`

> 注：此表 2026-06-12 新建，修复了 Entity 中 `status` 列双重映射的问题，任务状态列独立为 `task_status`。

---

### 17. system_config_v3 — 系统配置表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| config_key | varchar(200) | NO | — | 配置键（UNIQUE） |
| config_value | text | YES | NULL | 配置值 |
| description | varchar(500) | YES | NULL | 描述 |
| status | tinyint | NO | 1 | 状态 |
| create_time | bigint | YES | NULL | 创建时间戳ms |
| update_time | bigint | YES | NULL | 更新时间戳ms |

索引：`config_key` (UNIQUE)

---

### 18. operation_logs_v3 — 操作日志表

| 列名 | 类型 | 可空 | 默认值 | 说明 |
|------|------|:----:|--------|------|
| id | bigint | NO | PK | 主键 |
| user_id | bigint | YES | NULL | 操作用户 |
| action | varchar(200) | YES | NULL | 操作动作 |
| module | varchar(100) | YES | NULL | 所属模块 |
| ip | varchar(50) | YES | NULL | IP地址 |
| detail | text | YES | NULL | 操作详情 |
| create_time | bigint | YES | NULL | 创建时间戳ms |

索引：`user_id`, `module`

> 注：此表不继承公共字段，无 `status` 和 `update_time`（日志只写不改）。

---

## 本次修复记录 (2026-06-12)

| 问题 | 修复方式 |
|------|----------|
| `agent_tasks_v3` 表不存在 | 新建表，17 个字段与 Entity 对齐 |
| `AgentTask.status` 双重映射 | Entity 中列名改为 `task_status`，与基类 `status`（软删除）分离 |
