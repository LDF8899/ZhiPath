# ⚠️ 已废弃

此目录下的智能体已迁移到 NestJS 体系：

```
backend-ts/src/services/agents/
├── lecture-agent.service.ts
├── reading-agent.service.ts
├── code-agent.service.ts
├── path-agent.service.ts
├── assess-agent.service.ts
├── index.ts
└── README.md
```

## 迁移说明

| 旧文件 | 新文件 | 改动 |
|--------|--------|------|
| `shared.ts` | 删除 | LLM 调用统一使用 `LlmService` |
| `generate-lecture.ts` | `lecture-agent.service.ts` | 改为 NestJS Service，注入 LlmService |
| `generate-reading.ts` | `reading-agent.service.ts` | 同上 |
| `generate-code.ts` | `code-agent.service.ts` | 同上 |
| `generate-path.ts` | `path-agent.service.ts` | 同上 |
| `generate-assess.ts` | `assess-agent.service.ts` | 同上 |
| `test-all.ts` | 删除 | 测试移到后端单元测试 |

## 为什么迁移？

1. **统一 LLM 客户端** — 原来 `shared.ts` 用原始 fetch，无重试/超时/降级
2. **消除相对路径** — 原来 `../../../agents/agents/` 路径脆弱
3. **统一管理** — 所有智能体在 `backend-ts/src/services/agents/` 目录下
4. **NestJS 依赖注入** — 更好的模块化和可测试性

## 可以删除

确认迁移完成后，可以删除整个 `agents/agents/` 目录。
