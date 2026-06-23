# 智能体测试命令

## 前置条件

1. 后端服务已启动：`cd backend-ts && npm run start:dev`
2. 确保 LLM 服务可用（Ollama/DeepSeek/OpenAI）

## 测试单个智能体

### 1. 讲义生成

```bash
curl -X POST http://localhost:3000/api/test/agents/lecture \
  -H "Content-Type: application/json" \
  -d '{
    "skillName": "React Hooks",
    "level": "beginner"
  }' | jq '.'
```

### 2. 拓展阅读

```bash
curl -X POST http://localhost:3000/api/test/agents/reading \
  -H "Content-Type: application/json" \
  -d '{
    "skillName": "React Hooks",
    "count": 3
  }' | jq '.'
```

### 3. 代码案例

```bash
curl -X POST http://localhost:3000/api/test/agents/code \
  -H "Content-Type: application/json" \
  -d '{
    "skillName": "React Hooks",
    "language": "JavaScript",
    "count": 2
  }' | jq '.'
```

### 4. 学习路径

```bash
curl -X POST http://localhost:3000/api/test/agents/path \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "前端开发工程师",
    "currentLevel": "零基础"
  }' | jq '.'
```

### 5. 学习评估

```bash
curl -X POST http://localhost:3000/api/test/agents/assess \
  -H "Content-Type: application/json" \
  -d '{
    "learningData": "学了2周React Hooks，完成了useState和useEffect讲义，做了20道选择题正确率80%，写了2个小项目",
    "goal": "掌握 React Hooks"
  }' | jq '.'
```

### 6. JD 解析

```bash
curl -X POST http://localhost:3000/api/test/agents/jd-parser \
  -H "Content-Type: application/json" \
  -d '{
    "jdText": "前端开发工程师\n\n职位描述：\n1. 负责公司产品的前端开发工作\n2. 参与产品需求评审和技术方案设计\n\n任职要求：\n1. 熟练掌握 React、Vue 等前端框架\n2. 熟悉 TypeScript\n3. 了解 Node.js 优先"
  }' | jq '.'
```

### 7. 质量审查

```bash
curl -X POST http://localhost:3000/api/test/agents/reviewer \
  -H "Content-Type: application/json" \
  -d '{
    "contentType": "quiz",
    "content": "{\"questions\":[{\"type\":\"choice\",\"question\":\"React useState 返回什么？\",\"options\":[\"A. 数组\",\"B. 对象\",\"C. 函数\",\"D. 字符串\"],\"answer\":\"A\",\"explanation\":\"useState 返回 [state, setState] 数组\"}]}"
  }' | jq '.'
```

### 8. 简历生成

```bash
curl -X POST http://localhost:3000/api/test/agents/resume \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "basicInfo": {
        "name": "张三",
        "school": "北京大学",
        "major": "计算机科学与技术",
        "grade": "大四"
      },
      "skills": [
        {"name": "React", "mastery": 85, "verified": true},
        {"name": "JavaScript", "mastery": 90, "verified": true},
        {"name": "TypeScript", "mastery": 70, "verified": false}
      ],
      "projects": [
        {
          "name": "在线教育平台",
          "description": "使用 React + TypeScript 开发的在线教育平台",
          "techStack": ["React", "TypeScript", "Ant Design"]
        }
      ],
      "exams": [
        {"skill": "React", "score": 92, "passedAt": "2026-06-01"}
      ],
      "learningPaths": [
        {"name": "前端开发工程师", "progress": 75}
      ]
    },
    "targetJob": {
      "title": "前端开发工程师",
      "company": "字节跳动",
      "requiredSkills": ["React", "JavaScript", "TypeScript"],
      "preferredSkills": ["Node.js", "Vue"],
      "level": "junior"
    }
  }' | jq '.'
```

### 9. 用户画像分析

```bash
curl -X POST http://localhost:3000/api/test/agents/profile \
  -H "Content-Type: application/json" \
  -d '{
    "learningData": {
      "userId": 123,
      "period": "week",
      "totalMinutes": 480,
      "daysActive": 5,
      "skillsLearned": [
        {"name": "React Hooks", "minutesSpent": 180, "masteryBefore": 30, "masteryAfter": 85, "tasksCompleted": 4}
      ],
      "examsTaken": [
        {"skill": "React Hooks", "score": 88, "passed": true}
      ],
      "matchScoreBefore": 62,
      "matchScoreAfter": 68,
      "streakDays": 5,
      "dailyAverage": 96
    }
  }' | jq '.'
```

### 10. 考试出题

```bash
curl -X POST http://localhost:3000/api/test/agents/exam \
  -H "Content-Type: application/json" \
  -d '{
    "skillName": "React Hooks",
    "difficulty": "mixed",
    "questionCount": 5
  }' | jq '.'
```

### 11. 技能差距分析

```bash
curl -X POST http://localhost:3000/api/test/agents/skill-gap \
  -H "Content-Type: application/json" \
  -d '{
    "userSkills": [
      {"name": "React", "mastery": 85, "verified": true},
      {"name": "JavaScript", "mastery": 90, "verified": true},
      {"name": "TypeScript", "mastery": 40, "verified": false}
    ],
    "targetJob": {
      "title": "前端开发工程师",
      "company": "字节跳动",
      "level": "junior",
      "requiredSkills": [
        {"name": "React", "weight": 0.9, "minLevel": 70},
        {"name": "JavaScript", "weight": 0.9, "minLevel": 80},
        {"name": "TypeScript", "weight": 0.8, "minLevel": 60},
        {"name": "CSS", "weight": 0.7, "minLevel": 70}
      ],
      "preferredSkills": [
        {"name": "Node.js", "weight": 0.4, "minLevel": 50}
      ]
    }
  }' | jq '.'
```

### 12. 每日任务

```bash
curl -X POST http://localhost:3000/api/test/agents/daily-task \
  -H "Content-Type: application/json" \
  -d '{
    "availableMinutes": 120
  }' | jq '.'
```

### 13. 资讯生成

```bash
curl -X POST http://localhost:3000/api/test/agents/news \
  -H "Content-Type: application/json" \
  -d '{
    "skills": ["React", "Vue", "TypeScript"]
  }' | jq '.'
```

### 14. 中控智能体

```bash
# 生成讲义
curl -X POST http://localhost:3000/api/test/agents/orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "query": "帮我生成 React Hooks 讲义"
  }' | jq '.'

# 面试准备
curl -X POST http://localhost:3000/api/test/agents/orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "query": "帮我准备前端工程师面试"
  }' | jq '.'

# 技能差距
curl -X POST http://localhost:3000/api/test/agents/orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "query": "分析一下我和前端岗位的差距"
  }' | jq '.'
```

## 全量测试

```bash
# 运行所有测试（约 2-5 分钟）
curl -X POST http://localhost:3000/api/test/agents/all | jq '.'

# 或使用脚本
bash test-agents.sh
```

## 保存结果到文件

```bash
# 单个测试保存
curl -s -X POST http://localhost:3000/api/test/agents/lecture \
  -H "Content-Type: application/json" \
  -d '{"skillName": "React Hooks"}' > result-lecture.json

# 全量测试保存
curl -s -X POST http://localhost:3000/api/test/agents/all > result-all.json
```

## 检查返回结构

每个测试返回：

```json
{
  "success": true,
  "data": {
    "agent": "LectureAgent",
    "input": { ... },
    "output": { ... },  // 智能体的实际输出
    "stats": {
      "timeMs": 1234,    // 执行时间
      ...                // 其他统计
    }
  }
}
```

## 质量检查清单

检查每个智能体的输出：

- [ ] **讲义生成**：结构完整、代码可运行、练习题有答案和解析
- [ ] **拓展阅读**：摘要有内容、关键概念准确、来源合理
- [ ] **代码案例**：代码可运行、注释清晰、要点明确
- [ ] **学习路径**：阶段合理、技能排序符合依赖、时间预估合理
- [ ] **学习评估**：维度全面、评分合理、建议具体
- [ ] **JD 解析**：技能提取准确、分类正确、置信度合理
- [ ] **质量审查**：问题定位准确、建议可操作
- [ ] **简历生成**：HTML 可渲染、内容突出匹配技能
- [ ] **画像分析**：成就识别准确、建议个性化
- [ ] **考试出题**：题目无歧义、答案正确、解析清楚
- [ ] **技能差距**：匹配度计算准确、差距分析合理
- [ ] **每日任务**：任务可执行、时间分配合理
- [ ] **资讯生成**：趋势有依据、技能关联准确
- [ ] **中控智能体**：意图识别准确、任务编排合理
