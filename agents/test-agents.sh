#!/bin/bash

# ============================================================
# 智能体测试脚本
#
# 功能：调用所有智能体的测试 API，保存结果到文件
# 用法：bash test-agents.sh [baseUrl]
# ============================================================

BASE_URL="${1:-http://localhost:3000/api/test/agents}"
OUTPUT_DIR="./test-results/$(date +%Y%m%d_%H%M%S)"

mkdir -p "$OUTPUT_DIR"

echo "================================================"
echo "  智能体测试"
echo "  时间: $(date)"
echo "  输出目录: $OUTPUT_DIR"
echo "================================================"

# 测试函数
test_agent() {
  local name=$1
  local endpoint=$2
  local data=$3

  echo ""
  echo "【测试 $name】"
  echo "  请求: POST $BASE_URL/$endpoint"

  local start=$(date +%s%N)
  local response=$(curl -s -X POST "$BASE_URL/$endpoint" \
    -H "Content-Type: application/json" \
    -d "$data")
  local end=$(date +%s%N)
  local duration=$(( (end - start) / 1000000 ))

  echo "  耗时: ${duration}ms"

  # 保存结果
  echo "$response" | jq '.' > "$OUTPUT_DIR/${name}.json" 2>/dev/null || echo "$response" > "$OUTPUT_DIR/${name}.json"

  # 检查是否成功
  local success=$(echo "$response" | jq -r '.success // false' 2>/dev/null)
  if [ "$success" = "true" ]; then
    echo "  状态: ✅ 成功"
    # 显示关键统计
    local stats=$(echo "$response" | jq -r '.data.stats // empty' 2>/dev/null)
    if [ -n "$stats" ]; then
      echo "  统计: $stats"
    fi
  else
    local msg=$(echo "$response" | jq -r '.message // "未知错误"' 2>/dev/null)
    echo "  状态: ❌ 失败 - $msg"
  fi
}

# ============================================================
# 逐个测试
# ============================================================

# 1. 讲义生成
test_agent "01-lecture" "lecture" '{
  "skillName": "React Hooks",
  "level": "beginner"
}'

# 2. 拓展阅读
test_agent "02-reading" "reading" '{
  "skillName": "React Hooks",
  "count": 3
}'

# 3. 代码案例
test_agent "03-code" "code" '{
  "skillName": "React Hooks",
  "language": "JavaScript",
  "count": 2
}'

# 4. 学习路径
test_agent "04-path" "path" '{
  "goal": "前端开发工程师",
  "currentLevel": "零基础"
}'

# 5. 学习评估
test_agent "05-assess" "assess" '{
  "learningData": "学了2周React Hooks，完成了useState和useEffect讲义，做了20道选择题正确率80%，写了2个小项目",
  "goal": "掌握 React Hooks"
}'

# 6. JD 解析
test_agent "06-jd-parser" "jd-parser" '{
  "jdText": "前端开发工程师\n\n职位描述：\n1. 负责公司产品的前端开发工作\n2. 参与产品需求评审和技术方案设计\n3. 优化前端性能，提升用户体验\n\n任职要求：\n1. 本科及以上学历，计算机相关专业\n2. 熟练掌握 React、Vue 等前端框架\n3. 熟悉 TypeScript、Webpack、Vite 等工具\n4. 了解 Node.js，有全栈开发经验优先\n5. 良好的沟通能力和团队协作精神\n\n加分项：\n1. 有大型项目开发经验\n2. 熟悉 Docker、CI/CD\n3. 有开源项目贡献经历"
}'

# 7. 质量审查
test_agent "07-reviewer" "reviewer" '{
  "contentType": "quiz",
  "content": "{\"questions\":[{\"type\":\"choice\",\"question\":\"以下关于 React useState 的说法，正确的是？\",\"options\":[\"A. useState 只能在类组件中使用\",\"B. useState 返回一个数组，包含状态值和更新函数\",\"C. useState 的更新是同步的\",\"D. useState 不能在循环中调用\"],\"answer\":\"B\",\"explanation\":\"useState 是 React Hooks，只能在函数组件中使用，返回 [state, setState] 数组。\"}]}"
}'

# 8. 简历生成
test_agent "08-resume" "resume" '{
  "profile": {
    "basicInfo": {
      "name": "张三",
      "school": "北京大学",
      "major": "计算机科学与技术",
      "grade": "大四",
      "email": "zhangsan@example.com"
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
        "techStack": ["React", "TypeScript", "Ant Design", "Node.js"]
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
}'

# 9. 用户画像分析
test_agent "09-profile" "profile" '{
  "learningData": {
    "userId": 123,
    "period": "week",
    "totalMinutes": 480,
    "daysActive": 5,
    "skillsLearned": [
      {"name": "React Hooks", "minutesSpent": 180, "masteryBefore": 30, "masteryAfter": 85, "tasksCompleted": 4},
      {"name": "CSS Grid", "minutesSpent": 120, "masteryBefore": 0, "masteryAfter": 60, "tasksCompleted": 2}
    ],
    "examsTaken": [
      {"skill": "React Hooks", "score": 88, "passed": true}
    ],
    "matchScoreBefore": 62,
    "matchScoreAfter": 68,
    "streakDays": 5,
    "dailyAverage": 96
  }
}'

# 10. 考试出题
test_agent "10-exam" "exam" '{
  "skillName": "React Hooks",
  "difficulty": "mixed",
  "questionCount": 5
}'

# 11. 技能差距分析
test_agent "11-skill-gap" "skill-gap" '{
  "userSkills": [
    {"name": "React", "mastery": 85, "verified": true},
    {"name": "JavaScript", "mastery": 90, "verified": true},
    {"name": "TypeScript", "mastery": 40, "verified": false},
    {"name": "CSS", "mastery": 80, "verified": false}
  ],
  "targetJob": {
    "title": "前端开发工程师",
    "company": "字节跳动",
    "level": "junior",
    "requiredSkills": [
      {"name": "React", "weight": 0.9, "minLevel": 70},
      {"name": "JavaScript", "weight": 0.9, "minLevel": 80},
      {"name": "TypeScript", "weight": 0.8, "minLevel": 60},
      {"name": "CSS", "weight": 0.7, "minLevel": 70},
      {"name": "HTML", "weight": 0.6, "minLevel": 60}
    ],
    "preferredSkills": [
      {"name": "Node.js", "weight": 0.4, "minLevel": 50},
      {"name": "Vue", "weight": 0.3, "minLevel": 50}
    ]
  }
}'

# 12. 每日任务
test_agent "12-daily-task" "daily-task" '{
  "availableMinutes": 120
}'

# 13. 资讯生成
test_agent "13-news" "news" '{
  "skills": ["React", "Vue", "TypeScript"]
}'

# 14. 中控智能体 - 生成讲义
test_agent "14-orchestrator-lecture" "orchestrator" '{
  "query": "帮我生成 React Hooks 讲义"
}'

# 15. 中控智能体 - 面试准备
test_agent "15-orchestrator-interview" "orchestrator" '{
  "query": "帮我准备前端工程师面试"
}'

# 16. 中控智能体 - 技能差距
test_agent "16-orchestrator-gap" "orchestrator" '{
  "query": "分析一下我和前端岗位的差距"
}'

# ============================================================
# 汇总
# ============================================================

echo ""
echo "================================================"
echo "  测试完成"
echo "  结果目录: $OUTPUT_DIR"
echo "================================================"

# 生成汇总
cat > "$OUTPUT_DIR/summary.md" << EOF
# 智能体测试结果

测试时间: $(date)
输出目录: $OUTPUT_DIR

## 测试文件

$(ls -la "$OUTPUT_DIR"/*.json | awk '{print "- " $NF}')

## 查看结果

\`\`\`bash
# 查看某个智能体的结果
cat $OUTPUT_DIR/01-lecture.json | jq .

# 汇总统计
cat $OUTPUT_DIR/*.json | jq -s '{
  total: length,
  success: [.[] | select(.success == true)] | length,
  failed: [.[] | select(.success == false)] | length
}'
\`\`\`
EOF

echo ""
echo "汇总已保存到: $OUTPUT_DIR/summary.md"
