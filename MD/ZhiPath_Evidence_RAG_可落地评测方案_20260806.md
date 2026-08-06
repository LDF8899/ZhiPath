# ZhiPath Evidence RAG 可落地评测方案

> 日期：2026-08-06  
> 角色视角：懂技术和市场的产品经理  
> 结论：现在应该上 RAG，但只上 Evidence RAG，不上大而全知识库 RAG。  
> 目标：把“保存为证据”升级为“证据可召回、可引用、可评测、可影响业务决策”的闭环能力。

---

## 1. 一句话判断

ZhiPath 当前最适合上的不是通用知识库 RAG，而是围绕学生个人成长资产的 Evidence RAG：

```text
学习记录 / 测评结果 / 项目经历 / 文件问答 / Agent 产物 / 简历内容
-> 统一切分为 evidence chunks
-> 写入向量库和证据索引
-> 在聊天、简历、岗位匹配、技能雷达中召回
-> 让每条 AI 建议都能追溯到真实证据
```

这件事的核心价值不是“让 AI 更会聊天”，而是让 ZhiPath 从功能集合升级为“个人求职成长证据系统”。

---

## 2. 为什么现在可以上

### 2.1 已经具备业务入口

当前项目已经有这些前置能力：

| 现有能力 | 对 Evidence RAG 的意义 |
| --- | --- |
| 文件问答 | 用户已经能把文件交给 AI 理解 |
| 文件问答保存为项目证据 | 已有显式沉淀入口 |
| Projects 接真实项目证据 | 项目不再只是 mock 展示 |
| 技能证据链 | 已有学习、测评、项目、简历证据聚合口径 |
| 岗位差距卡 / 今日任务 | 有证据消费场景 |
| 岗位版简历建议 | 有强需求引用真实项目和能力证明 |
| Chroma 中间件 | 基础设施已在部署方案中存在 |

所以现在上 Evidence RAG 不是另起炉灶，而是给现有证据链补上“语义召回能力”。

### 2.2 不上 RAG 的问题

如果只保存项目和文件摘要，不做语义召回，会出现三个问题：

1. 用户保存过的文件，下次聊天很难被准确引用。
2. 简历建议只能看结构化字段，无法提炼文件和项目中的细节。
3. 技能雷达和岗位差距解释容易停留在分数层，缺少证据出处。

### 2.3 现在不该做的 RAG

以下能力暂不进入第一版：

| 暂不做 | 原因 |
| --- | --- |
| 全校课程资料知识库 | 权限、质量、版权和维护成本都高 |
| 管理端知识库搭建平台 | 对当前学生端黄金路径帮助不直接 |
| 多 Agent 自主规划式 RAG | 评测难、不可控、开发周期长 |
| 知识图谱 + RAG 深度融合 | 可以作为后续增强，不应阻塞第一版 |
| 复杂文档解析 OCR / 表格理解 | 先支持文本、Markdown、代码、PDF 文本抽取即可 |

---

## 3. 产品定位

### 3.1 功能命名

建议对内叫：

> Evidence RAG

建议对外说：

> 个人能力证据库

不要在用户界面强调“RAG”。学生和学校更关心：

1. 我的能力证据在哪里。
2. AI 的建议依据是什么。
3. 这些证据能不能提升岗位匹配和简历质量。

### 3.2 用户可感知价值

| 用户场景 | 没有 Evidence RAG | 有 Evidence RAG |
| --- | --- | --- |
| 问 AI “我有哪些 React 证据” | 只能泛泛回答 | 返回具体项目、文件问答、测评和 commit |
| 生成岗位版简历 | 容易写空话 | 引用真实项目片段和成果 |
| 查看技能雷达 | 只看到分数 | 点击技能看到支撑证据和缺口证据 |
| 岗位差距解释 | “你缺 Node.js” | “你有 React 项目证据，但后端接口/数据库证据不足” |
| 学校看板 | 只看比例 | 能下钻群体缺口来自哪些证据不足 |

---

## 4. MVP 范围

### 4.1 P0：个人证据召回闭环

目标：让用户保存过的证据能被 AI 准确找回，并在回答中显示来源。

必须完成：

1. 建立 `evidence_chunks` 证据索引。
2. 保存项目时写入 Evidence RAG。
3. 文件问答保存为证据时写入 Evidence RAG。
4. 新增 `GET /api/user/evidence/search`。
5. 聊天回答接入证据召回。
6. 简历建议接入证据召回。

不要求完成：

1. 管理端知识库。
2. 多租户复杂权限。
3. 文档版本 diff。
4. 大规模离线评测平台。

### 4.2 P1：证据影响业务结果

目标：让 Evidence RAG 不只是被聊天引用，还能进入岗位、技能、简历三个核心业务判断。

必须完成：

1. 技能雷达点击技能展示召回证据。
2. 岗位差距卡展示缺口判断依据。
3. 今日任务推荐理由引用证据不足项。
4. 简历建议每条表达标明证据来源。

### 4.3 P2：学校场景增强

目标：面向学校试点，支持“群体能力证据不足”的数据解释。

必须完成：

1. 管理端就业准备度看板支持证据覆盖率。
2. 专业 / 年级 / 班级维度展示 Top 缺口技能的证据覆盖。
3. 导出学生明细时包含证据数量和证据强度。

---

## 5. 数据设计

### 5.1 证据来源

第一版只接这些来源：

| sourceType | 来源 | 入库时机 | 是否 P0 |
| --- | --- | --- | --- |
| `project` | 手动添加项目 / GitHub 项目 | `saveProject` 成功后 | 是 |
| `file_qa` | 文件问答保存为证据 | 点击“保存证据”后 | 是 |
| `evaluation` | 测评结果 | 生成 evaluation result 后 | P1 |
| `learning_commit` | Git 学习 commit | commitSkill / task complete 后 | P1 |
| `agent_output` | Agent 产物 | Agent 任务成功后 | P1 |
| `resume` | 简历内容 / 简历建议 | 生成简历后 | P1 |

### 5.2 EvidenceChunk 字段

建议新增 MySQL 表 `evidence_chunks`，作为可审计索引；Chroma 只做向量检索。

```ts
type EvidenceSourceType =
  | 'project'
  | 'file_qa'
  | 'evaluation'
  | 'learning_commit'
  | 'agent_output'
  | 'resume';

interface EvidenceChunk {
  id: number;
  userId: number;
  sourceType: EvidenceSourceType;
  sourceId: string;
  chunkIndex: number;
  title: string;
  content: string;
  contentHash: string;
  skillTags: string[];
  jobTargetId?: number | null;
  confidence: number;
  visibility: 'private' | 'school_aggregate';
  vectorStatus: 'pending' | 'indexed' | 'failed';
  createdAt: number;
  updatedAt: number;
}
```

### 5.3 Chroma metadata

Chroma collection 建议命名：

```text
zhipath_user_evidence
```

metadata：

```json
{
  "chunkId": "123",
  "userId": "1",
  "sourceType": "file_qa",
  "sourceId": "file_qa:1:1720000000",
  "title": "文件证据：React 项目总结",
  "skillTags": "React,TypeScript,Vite",
  "jobTargetId": "15",
  "visibility": "private",
  "createdAt": "1720000000"
}
```

### 5.4 去重规则

同一个用户下，`sourceType + sourceId + contentHash` 相同则不重复入库。

```text
项目保存重复点击 -> 不重复生成 chunk
同一文件重复保存 -> 如果内容 hash 相同，只更新 updatedAt
简历反复生成 -> 按 resumeId + version 区分
```

---

## 6. 技术实现方案

### 6.1 后端新增模块

建议新增：

```text
backend-ts/src/entities/evidence-chunk.entity.ts
backend-ts/src/modules/evidence/evidence.module.ts
backend-ts/src/modules/evidence/evidence.controller.ts
backend-ts/src/services/evidence-rag.service.ts
backend-ts/src/services/chroma.service.ts
backend-ts/scripts/backfill-evidence-rag.ts
```

### 6.2 核心服务职责

| 服务 | 职责 |
| --- | --- |
| `EvidenceRagService.ingest()` | 接收业务证据，切 chunk，写 MySQL，写 Chroma |
| `EvidenceRagService.search()` | 结合 userId、query、skillTags、sourceType 检索 |
| `EvidenceRagService.buildContext()` | 生成可放进 LLM prompt 的短上下文 |
| `ChromaService.upsert()` | 向量写入 |
| `ChromaService.query()` | 向量召回 |
| `ChromaService.deleteBySource()` | 后续支持删除或重建索引 |

### 6.3 Embedding 方案

P0 不新增复杂模型编排，采用三层降级：

| 优先级 | 方案 | 说明 |
| --- | --- | --- |
| 1 | OpenAI-compatible embedding | 如果已有兼容服务，直接复用 |
| 2 | Ollama embedding | 本地部署可控，适合演示 |
| 3 | 关键词召回降级 | Chroma / embedding 不可用时不阻塞主流程 |

建议环境变量：

```env
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_BASE_URL=http://localhost:11434/v1
CHROMA_URL=http://localhost:8000
EVIDENCE_RAG_ENABLED=true
```

### 6.4 Chunk 策略

第一版不要复杂切分。

| 内容类型 | 切分策略 |
| --- | --- |
| 项目经历 | 一个项目 1-3 个 chunk |
| 文件问答 | 文件内容按 800-1200 中文字切分，重叠 100 字 |
| 测评结果 | 一次测评一个 chunk |
| 学习 commit | 一个 commit 一个 chunk |
| Agent 产物 | 按标题 / 小节切分 |
| 简历 | 按项目、技能、经历切分 |

每个 chunk 必须包含：

1. 原文片段。
2. 来源标题。
3. 技能标签。
4. 来源类型。
5. 可展示摘要。

### 6.5 检索策略

P0 使用“向量召回 + 规则过滤 + 简单重排”。

```text
输入 query
-> userId 权限过滤
-> sourceType / skillTags / jobTargetId 可选过滤
-> Chroma topK=12
-> MySQL 取 chunk 详情
-> 按 sourceType 权重 + skill 命中 + 时间新鲜度重排
-> 返回 topK=5 给业务使用
```

推荐权重：

| 因素 | 权重 |
| --- | --- |
| 向量相似度 | 50% |
| 技能标签命中 | 20% |
| 当前目标岗位相关 | 15% |
| 证据类型可信度 | 10% |
| 新鲜度 | 5% |

证据类型可信度建议：

| 类型 | 默认可信度 |
| --- | --- |
| evaluation | 0.95 |
| project | 0.85 |
| learning_commit | 0.75 |
| file_qa | 0.70 |
| agent_output | 0.65 |
| resume | 0.60 |

---

## 7. API 设计

### 7.1 搜索证据

```http
GET /api/user/evidence/search?query=React项目经验&skill=React&sourceType=project&limit=5
```

返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "query": "React项目经验",
    "total": 3,
    "items": [
      {
        "chunkId": 123,
        "sourceType": "project",
        "sourceId": "project:45",
        "title": "就业数据分析看板",
        "snippet": "使用 React、TypeScript 和 ECharts 完成...",
        "skillTags": ["React", "TypeScript", "ECharts"],
        "score": 0.86,
        "confidence": 0.85,
        "createdAt": 1720000000
      }
    ]
  }
}
```

### 7.2 手动重建证据索引

```http
POST /api/user/evidence/reindex
```

用途：

1. 开发调试。
2. 用户历史项目和文件补索引。
3. Chroma 数据丢失后恢复。

### 7.3 技能证据增强

现有接口：

```http
GET /api/user/skills/:skillName/evidence
```

增强方式：

1. 保留原有结构化聚合。
2. 新增 `semantic` 字段，返回 Evidence RAG 召回结果。

```ts
semantic: Array<{
  chunkId: number;
  sourceType: string;
  title: string;
  snippet: string;
  score: number;
}>
```

---

## 8. 业务接入点

### 8.1 Chat

接入逻辑：

```text
用户提问
-> 判断是否需要个人证据
-> evidence.search(query, userId)
-> 把 top 5 snippets 放入 LLM context
-> 回答末尾展示“引用证据”
```

需要个人证据的典型问题：

1. “我有哪些 React 项目？”
2. “我的简历能怎么写？”
3. “为什么我不适合这个岗位？”
4. “我最近学了什么？”
5. “根据我上传的文件总结一下能力亮点。”

验收标准：

| 指标 | 合格线 |
| --- | --- |
| 保存文件后同会话可召回 | 100% |
| 保存文件后新会话可召回 | 95% |
| 回答展示证据来源 | 100% |
| 无证据时明确说明“不足” | 100% |

### 8.2 Resume

接入逻辑：

```text
目标岗位技能
-> 按技能检索 evidence
-> 生成岗位化表达
-> 每条表达绑定 evidenceIds
```

验收标准：

| 指标 | 合格线 |
| --- | --- |
| 高置信建议必须有 evidenceId | 100% |
| 证据不足技能不得包装成熟练项目经验 | 100% |
| 至少 3 条建议引用真实项目 / 测评 / 文件证据 | 80% 测试样例达成 |

### 8.3 Skills / Radar

接入逻辑：

```text
点击技能
-> 原结构化证据链
-> semantic evidence 补充
-> 展示“支撑证据”和“缺口证据”
```

验收标准：

| 指标 | 合格线 |
| --- | --- |
| 有证据技能能展示至少 1 条来源 | 90% |
| 无证据技能展示补证据建议 | 100% |
| 点击打开时间 | P95 < 800ms |

### 8.4 Job Gap

接入逻辑：

```text
目标岗位 requiredSkills
-> 对每个技能 search evidence
-> 有证据：解释已有能力
-> 无证据：解释缺口和推荐任务
```

验收标准：

| 指标 | 合格线 |
| --- | --- |
| Top 5 缺口技能给出证据状态 | 100% |
| 推荐任务与缺口技能一致 | 90% |
| 不把无证据技能判断为强掌握 | 100% |

---

## 9. 可评测方案

### 9.1 离线评测集

建立固定 JSON 评测集：

```text
backend-ts/test-fixtures/evidence-rag/eval-cases.json
```

每条样例：

```json
{
  "caseId": "react_project_001",
  "userId": 9001,
  "seedEvidence": [
    {
      "sourceType": "project",
      "title": "校园就业数据分析看板",
      "content": "我使用 React、TypeScript、ECharts 完成就业数据分析看板，负责筛选器、图表联动和 CSV 导出。",
      "skillTags": ["React", "TypeScript", "ECharts"]
    }
  ],
  "queries": [
    {
      "query": "我有什么 React 项目证据？",
      "expectedSourceTypes": ["project"],
      "expectedKeywords": ["就业数据分析看板", "React", "ECharts"],
      "mustNotContain": ["Python 爬虫"]
    }
  ]
}
```

### 9.2 检索评测指标

| 指标 | 含义 | P0 合格线 | P1 目标 |
| --- | --- | --- | --- |
| Recall@5 | 期望证据是否出现在前 5 条 | >= 85% | >= 92% |
| MRR | 正确证据排名是否靠前 | >= 0.70 | >= 0.80 |
| Source Accuracy | 来源类型是否正确 | >= 90% | >= 95% |
| User Isolation | 是否只召回当前用户证据 | 100% | 100% |
| No-Evidence Accuracy | 没有证据时是否返回空 | >= 95% | >= 98% |

### 9.3 生成回答评测指标

| 指标 | 含义 | P0 合格线 |
| --- | --- | --- |
| Citation Coverage | 涉及个人经历的回答是否带引用 | >= 90% |
| Evidence Faithfulness | 回答是否忠于证据内容 | >= 90% |
| No Fabrication | 不编造不存在的项目 / 分数 / 公司 | >= 98% |
| Actionability | 是否给出下一步可执行建议 | >= 85% |

### 9.4 业务效果指标

| 指标 | 口径 | P0 观察目标 |
| --- | --- | --- |
| 证据保存率 | 文件问答后点击保存证据 / 文件问答次数 | >= 25% |
| 证据复用率 | 被聊天 / 简历 / 技能页引用的证据 / 总证据 | >= 30% |
| 简历建议采纳率 | 用户复制 / 保存建议次数 / 建议展示次数 | >= 20% |
| 技能证据覆盖率 | 至少有 1 条证据的技能 / 用户技能数 | >= 40% |
| 无证据提示转化 | 看到补证据建议后完成任务 / 提示次数 | >= 10% |

### 9.5 自动测试建议

后端测试：

```text
EvidenceRagService.ingest
EvidenceRagService.search
EvidenceController.search
ChatService evidence context injection
ResumeAgent evidence-aware advice
SkillService semantic evidence merge
```

必须覆盖：

1. 同用户能召回。
2. 跨用户不能召回。
3. 重复保存不重复入库。
4. Chroma 不可用时主流程不失败。
5. 无证据时返回空结果。
6. 证据排序符合技能标签和来源权重。

---

## 10. 里程碑拆解

### 第 1 周：Evidence RAG P0 基础

后端：

1. 新增 `EvidenceChunk` entity。
2. 新增 `EvidenceRagService`。
3. 新增 `ChromaService`。
4. 新增 `GET /api/user/evidence/search`。
5. `saveProject` 成功后调用 `ingest(project)`。
6. 文件问答保存证据后调用同一个 `saveProject` 链路进入索引。

前端：

1. Chat 回答展示“引用证据”区域。
2. Projects 卡片展示“已索引 / 索引失败 / 待索引”。

验收演示：

```text
上传 React 项目文件
-> 问答
-> 点击保存证据
-> 新开会话问“我有什么 React 项目证据”
-> AI 返回刚才文件内容，并显示来源
```

### 第 2 周：简历和技能页接入

后端：

1. Resume 生成前检索岗位相关证据。
2. Skill evidence 接口追加 semantic evidence。
3. 新增 `backfill-evidence-rag.ts`，补历史项目。

前端：

1. 简历建议展示引用证据。
2. 技能证据链面板展示语义证据。
3. 技能雷达点击后能看到证据支撑。

验收演示：

```text
选择前端岗位
-> 生成简历建议
-> 每条建议显示引用项目或文件证据
-> React 技能雷达点开能看到同一条证据
```

### 第 3 周：岗位差距和评测体系

后端：

1. 岗位差距卡按 requiredSkills 检索证据。
2. 输出技能证据覆盖状态。
3. 建立 eval-cases 固定评测集。
4. 新增 `npm run test:evidence-rag`。

前端：

1. 岗位差距卡展示“已有证据 / 证据不足”。
2. 今日任务推荐增加“为什么推荐”的证据解释。

验收演示：

```text
目标岗位需要 React、Node.js、SQL
-> React 有项目证据
-> Node.js 只有学习记录
-> SQL 无证据
-> 差距卡分别给出不同解释和任务建议
```

---

## 11. 成本和风险控制

### 11.1 成本控制

| 风险 | 控制方式 |
| --- | --- |
| embedding 调用成本上升 | contentHash 去重，不重复向量化 |
| 文件过大 | P0 限制单文件入库字符数，例如 30k |
| 查询变慢 | topK 控制为 12，最终返回 5 |
| Chroma 不稳定 | 降级关键词召回，不影响保存证据 |
| LLM 编造引用 | prompt 要求只引用 retrieved evidence，输出 evidenceIds |

### 11.2 权限和隐私

必须遵守：

1. 用户只能检索自己的 `private` 证据。
2. 学校管理端只能看聚合指标，不直接看学生私有原文。
3. 后续若要给学校查看学生明细，需要单独增加授权字段。
4. 删除项目 / 简历时，后续应支持删除对应 evidence chunks。

### 11.3 降级策略

保存证据时：

```text
MySQL 保存成功
-> Chroma 写入失败
-> vectorStatus = failed
-> 用户仍看到“证据已保存，索引稍后重试”
```

检索证据时：

```text
Chroma 可用 -> 向量召回
Chroma 不可用 -> MySQL LIKE + skillTags 关键词召回
都无结果 -> 明确返回暂无证据
```

---

## 12. 不做清单

P0 明确不做：

1. 不做学校级资料库上传。
2. 不做复杂 RAG 编排。
3. 不做知识图谱融合。
4. 不做多模态图片 / 视频内容理解。
5. 不做管理端可视化知识库配置。
6. 不做跨用户推荐。
7. 不把 Agent 产物默认当高可信证据。

---

## 13. Definition of Done

P0 完成标准：

1. 项目保存后，能在 `evidence_chunks` 查到 chunk。
2. 文件问答保存后，能在 `evidence_chunks` 查到 chunk。
3. Chroma 中存在对应向量记录。
4. `GET /api/user/evidence/search` 能按 query 返回相关证据。
5. Chat 能引用用户保存过的证据回答。
6. Resume 能引用项目 / 文件证据生成建议。
7. 跨用户不能检索到彼此证据。
8. Chroma 关闭时，保存项目和文件问答不报错。
9. 后端新增测试通过。
10. 固定评测集 Recall@5 >= 85%。

---

## 14. 推荐下一步

下一步直接进入 P0 开发，不再继续停留在方案讨论。

建议任务顺序：

1. 先建 `EvidenceChunk` entity 和 `EvidenceRagService`。
2. 再接 `saveProject` 和文件问答保存证据链路。
3. 然后做 `GET /api/user/evidence/search`。
4. 最后接 Chat 引用证据展示。

这样两三天内就能做出一个可演示版本：

```text
文件问答
-> 保存为证据
-> 新会话召回
-> AI 回答带来源
```

这条演示路径最短，也最能证明 ZhiPath 的差异化。
