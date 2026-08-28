#!/usr/bin/env python3
"""为 555 用户(id=24)生成完整学习旅程模拟数据"""

import json

USER_ID = 24
BRANCH_ID = 2  # main branch

# ===== 技能渐变设计 (3周) =====
# 7 个关键时间点，每个时间点一个 commit + snapshot
TIMELINE = [
    # (日期, 时间戳ms, 阶段)
    ("2026-07-06", 1783267200000, "Week1-Start"),
    ("2026-07-08", 1783440000000, "Week1-Mid"),
    ("2026-07-11", 1783699200000, "Week1-End"),
    ("2026-07-13", 1783872000000, "Week2-Start"),
    ("2026-07-16", 1784131200000, "Week2-Mid"),
    ("2026-07-19", 1784390400000, "Week2-End"),
    ("2026-07-21", 1784563200000, "Week3-Start"),
    ("2026-07-23", 1784736000000, "Week3-Mid"),
    ("2026-07-26", 1784995200000, "Week3-End"),
    ("2026-07-27", 1785081600000, "Today"),
]

# 技能演变: 每个时间点的 mastery_pct (effective mastery)
SKILL_PROGRESSION = {
    "HTML":    [5, 20, 45, 48, 52, 58, 60, 63, 65, 68],
    "CSS":     [3, 15, 35, 38, 42, 48, 50, 55, 58, 60],
    "JavaScript": [25, 30, 42, 55, 63, 70, 72, 75, 78, 80],
    "React":   [0, 0, 5, 15, 30, 42, 55, 62, 68, 72],
    "Node.js": [53, 55, 58, 60, 63, 67, 70, 72, 74, 75],
    "TypeScript": [0, 0, 0, 5, 10, 15, 20, 25, 30, 35],
    "MongoDB": [0, 0, 0, 0, 10, 20, 30, 38, 45, 50],
}

# 每个时间点的 commit 类型和消息
COMMITS = [
    ("lecture_read", "HTML", "完成 HTML5 语义化标签学习"),
    ("quiz_passed", "CSS", "通过 CSS Flexbox/Grid 测评 (+25%)"),
    ("code_done", "JavaScript", "完成 JS 异步编程练习项目"),
    ("lecture_read", "React", "完成 React Hooks 核心概念学习"),
    ("quiz_passed", "JavaScript", "通过 JS 原型链与闭包测评 (+32%)"),
    ("code_done", "React", "完成 React 组件化实战项目"),
    ("lecture_read", "Node.js", "学习 Node.js Stream 与 Buffer"),
    ("quiz_passed", "React", "通过 React 状态管理测评 (+22%)"),
    ("code_done", "MongoDB", "完成 MongoDB 聚合管道项目"),
    ("skill_complete", "JavaScript", "JavaScript 技能里程碑达成 80%"),
]

# ===== 每个时间点的 radar 维度演进 =====
RADAR_DIMENSIONS = [
    {"name": "前端基础", "skills": ["HTML", "CSS", "JavaScript", "TypeScript"], "category": "frontend"},
    {"name": "框架能力", "skills": ["React", "Vue", "Angular", "Next.js"], "category": "framework"},
    {"name": "状态管理", "skills": ["Redux", "Zustand", "MobX", "Context API"], "category": "state"},
    {"name": "工程化",   "skills": ["Webpack", "Vite", "Git", "GitHub", "CI/CD", "Docker"], "category": "tooling"},
    {"name": "CSS/样式", "skills": ["CSS", "Flexbox", "Grid", "Tailwind", "Sass"], "category": "css"},
    {"name": "后端能力", "skills": ["Node.js", "Express", "NestJS", "MySQL", "MongoDB", "API设计"], "category": "backend"},
]

# 雷达分数演进 (每个时间点)
RADAR_PROGRESSION = {
    "前端基础": [1.6, 4.5, 10.2, 12.5, 15.8, 18.2, 19.5, 21.0, 22.5, 24.0],
    "框架能力": [0, 0, 2.0, 5.5, 12.0, 18.5, 24.0, 28.0, 31.0, 34.0],
    "状态管理": [0, 0, 0, 2.0, 6.0, 10.0, 15.0, 20.0, 24.0, 28.0],
    "工程化":   [0, 0, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0],
    "CSS/样式": [0, 2.0, 8.0, 10.0, 12.0, 15.0, 17.0, 19.0, 21.0, 23.0],
    "后端能力": [15.8, 16.5, 17.8, 18.5, 20.0, 22.0, 24.5, 26.5, 28.0, 29.0],
}

# Match score 逐步提升
MATCH_SCORES = [5.2, 8.5, 15.3, 18.7, 26.1, 34.5, 42.8, 49.2, 55.6, 61.3]

# Ability metrics
ABILITY_PROGRESSION = [
    # depth, breadth, balance, consistency, speed, overall
    (16, 33, 84, 20, 15, 3.0),
    (18, 35, 82, 25, 20, 6.5),
    (22, 38, 78, 35, 28, 14.2),
    (25, 42, 75, 40, 32, 18.8),
    (30, 48, 72, 48, 35, 26.0),
    (35, 52, 68, 55, 40, 33.5),
    (40, 55, 65, 60, 42, 41.2),
    (45, 58, 62, 65, 45, 48.5),
    (50, 60, 58, 70, 48, 55.0),
    (54, 63, 55, 72, 50, 60.8),
]

# ===== 每阶段的学习 sessions (每天一次) =====
SESSION_DAYS = [
    # (date_str, duration_min, completed_tasks_count)
    ("2026-07-06", 45, 2), ("2026-07-07", 35, 1), ("2026-07-08", 60, 3),
    ("2026-07-09", 25, 1), ("2026-07-10", 50, 2), ("2026-07-11", 40, 1),
    ("2026-07-13", 55, 3), ("2026-07-14", 30, 1), ("2026-07-15", 70, 4),
    ("2026-07-16", 45, 2), ("2026-07-17", 35, 1), ("2026-07-18", 60, 3),
    ("2026-07-19", 40, 2),
    ("2026-07-20", 50, 3), ("2026-07-21", 65, 4), ("2026-07-22", 30, 1),
    ("2026-07-23", 55, 3), ("2026-07-24", 45, 2), ("2026-07-25", 70, 4),
    ("2026-07-26", 40, 2), ("2026-07-27", 35, 1),
]

# ===== 学习任务 (每个技能有多个任务，部分已完成) =====
TASKS = [
    # (skill_name, task_type, task_status, plan_date, estimated_min, actual_min, sort_order, priority)
    ("HTML", "main", "done", "2026-07-06", 30, 25, 1, 8),
    ("HTML", "main", "done", "2026-07-07", 45, 35, 2, 7),
    ("HTML", "main", "lecture_done", "2026-07-08", 30, 28, 3, 6),
    ("CSS", "main", "done", "2026-07-08", 45, 50, 4, 8),
    ("CSS", "main", "done", "2026-07-09", 30, 25, 5, 7),
    ("CSS", "main", "code_done", "2026-07-10", 60, 55, 6, 6),
    ("JavaScript", "main", "done", "2026-07-10", 45, 40, 7, 9),
    ("JavaScript", "main", "done", "2026-07-11", 50, 42, 8, 8),
    ("JavaScript", "main", "done", "2026-07-13", 60, 55, 9, 8),
    ("JavaScript", "main", "done", "2026-07-14", 30, 30, 10, 7),
    ("JavaScript", "main", "done", "2026-07-15", 45, 48, 11, 8),
    ("JavaScript", "main", "code_done", "2026-07-16", 60, 55, 12, 9),
    ("React", "main", "done", "2026-07-15", 40, 38, 13, 8),
    ("React", "main", "done", "2026-07-16", 50, 45, 14, 8),
    ("React", "main", "done", "2026-07-17", 45, 35, 15, 7),
    ("React", "main", "done", "2026-07-18", 60, 62, 16, 9),
    ("React", "main", "code_done", "2026-07-19", 50, 48, 17, 9),
    ("React", "main", "done", "2026-07-20", 40, 40, 18, 8),
    ("Node.js", "main", "done", "2026-07-18", 30, 28, 19, 7),
    ("Node.js", "main", "done", "2026-07-20", 50, 55, 20, 8),
    ("Node.js", "main", "lecture_done", "2026-07-22", 45, 42, 21, 7),
    ("Node.js", "main", "code_done", "2026-07-24", 60, 58, 22, 8),
    ("MongoDB", "main", "done", "2026-07-22", 50, 48, 23, 8),
    ("MongoDB", "main", "done", "2026-07-23", 40, 38, 24, 7),
    ("MongoDB", "main", "code_done", "2026-07-25", 45, 42, 25, 8),
    ("MongoDB", "main", "in_progress", "2026-07-27", 50, None, 26, 9),
    ("TypeScript", "main", "lecture_done", "2026-07-25", 30, 28, 27, 6),
    ("TypeScript", "main", "in_progress", "2026-07-27", 45, None, 28, 7),
    ("Docker", "side", "pending", "2026-07-27", 60, None, 29, 5),
    ("Git", "side", "done", "2026-07-24", 20, 18, 30, 4),
]

# ===== AI 生成的资源 =====
RESOURCES = [
    ("video", "JavaScript 异步编程实战", "JavaScript", "success", 850, 2.5),
    ("video", "React Hooks 从入门到精通", "React", "success", 920, 2.8),
    ("progress", "HTML5 学习路线图", "HTML", "success", 0, 0.3),
    ("progress", "CSS 布局完全指南", "CSS", "success", 0, 0.3),
    ("progress", "Node.js 核心概念图谱", "Node.js", "success", 0, 0.5),
    ("progress", "MongoDB 聚合管道速查", "MongoDB", "running", 0, 0.2),
]

# ===== 评估数据设计 =====
EVALUATIONS = [
    # (attempt_type, skill, goal, rubric_key, score, passed, level, evaluator_type, summary)
    ("progress_quiz", "CSS", "CSS Flexbox/Grid 测评", "default_skill_v1", 82, 1, "B", "hybrid", "Flexbox 和 Grid 掌握良好，Grid template areas 略弱"),
    ("progress_code", "JavaScript", "JS 异步编程练习", "default_skill_v1", 78, 1, "B", "llm", "Promise 和 async/await 使用正确，错误处理可以加强"),
    ("progress_quiz", "JavaScript", "JS 原型链与闭包", "default_skill_v1", 88, 1, "A", "hybrid", "原型链理解深刻，闭包应用场景判断准确"),
    ("progress_code", "React", "React 组件化实战", "default_skill_v1", 75, 1, "B", "llm", "组件拆分合理，useEffect 依赖管理需要优化"),
    ("progress_quiz", "React", "React 状态管理测评", "default_skill_v1", 80, 1, "B", "hybrid", "Context + useReducer 组合使用熟练"),
    ("progress_code", "MongoDB", "MongoDB 聚合管道项目", "default_skill_v1", 72, 1, "B", "llm", "聚合管道逻辑正确，索引优化可以再加强"),
    ("skill_complete", "JavaScript", "JavaScript 技能里程碑", "default_skill_v1", 85, 1, "A", "system", "连续 4 次评估通过，技能已达到 B+ 水平"),
    ("ai_assessment", "HTML", "HTML 能力综合评估", "default_skill_v1", 90, 1, "A", "llm", "语义化标签使用规范，可访问性意识强"),
    ("ai_assessment", "Node.js", "Node.js 能力综合评估", "default_skill_v1", 76, 1, "B", "llm", "Stream 和 EventEmitter 理解到位，集群模式可加强"),
]


def esc(s):
    return str(s).replace("\\", "\\\\").replace("'", "\\'")


def build_skills_json(idx):
    """构建 skills_json"""
    skills = []
    categories = {
        "HTML": "frontend", "CSS": "frontend", "JavaScript": "frontend",
        "React": "framework", "Node.js": "backend", "TypeScript": "frontend",
        "MongoDB": "backend", "Docker": "tooling"
    }
    sources = {
        "HTML": "conversation", "CSS": "conversation", "JavaScript": "self_report",
        "React": "conversation", "Node.js": "self_report", "TypeScript": "self_report",
        "MongoDB": "conversation", "Docker": "self_report"
    }
    for name, progress in SKILL_PROGRESSION.items():
        mastery = progress[idx]
        trust = 0.5 if sources.get(name) == "conversation" else 0.3
        if mastery > 50:
            trust = min(0.85, trust + 0.15 * (mastery - 50) / 50)
        skills.append({
            "name": name,
            "mastery": mastery,
            "effectiveMastery": round(mastery * trust, 2),
            "source": sources.get(name, "self_report"),
            "trustWeight": round(trust, 2),
            "category": categories.get(name, "other"),
            "decayRate": 0.5
        })
    return json.dumps(skills, ensure_ascii=False)


def build_radar_json(idx):
    """构建 radar_json"""
    radar = []
    for dim in RADAR_DIMENSIONS:
        score = RADAR_PROGRESSION[dim["name"]][idx]
        trend = "up" if idx > 0 and RADAR_PROGRESSION[dim["name"]][idx] > RADAR_PROGRESSION[dim["name"]][idx-1] else "stable"
        radar.append({
            "name": dim["name"],
            "score": score,
            "trend": trend,
            "skills": dim["skills"],
            "category": dim["category"],
            "lastCommitId": str(idx + 6)  # commit id = snapshot id + 1 roughly
        })
    return json.dumps(radar, ensure_ascii=False)


def build_ability_json(idx):
    a = ABILITY_PROGRESSION[idx]
    return json.dumps({
        "depth": a[0], "breadth": a[1], "balance": a[2],
        "consistency": a[3], "learningSpeed": a[4], "overallScore": a[5],
        "frontendScore": round(RADAR_PROGRESSION["前端基础"][idx], 2),
        "backendScore": round(RADAR_PROGRESSION["后端能力"][idx], 2),
        "toolingScore": round(RADAR_PROGRESSION["工程化"][idx], 2),
        "softSkillScore": 0
    }, ensure_ascii=False)


def build_match_json(idx):
    return json.dumps({
        "overallMatch": MATCH_SCORES[idx],
        "skillCoverage": round(min(100, 35 + idx * 6.5), 1),
        "levelMatch": "mid" if idx >= 5 else "junior",
        "gapSkills": [s for s, p in SKILL_PROGRESSION.items() if p[idx] < 50],
        "strengthSkills": [s for s, p in SKILL_PROGRESSION.items() if p[idx] >= 65]
    }, ensure_ascii=False)


def build_delta_json(idx):
    """构建 delta_json: 相对于前一个 snapshot 的变化"""
    if idx == 0:
        return json.dumps({
            "skillChanges": [],
            "radarChanges": [],
            "metricsChange": {"depthScore": 16, "matchScore": 5.2, "breadthScore": 33, "overallScore": 3}
        }, ensure_ascii=False)
    
    prev_idx = idx - 1
    skill_changes = []
    radar_changes = []
    for name in SKILL_PROGRESSION:
        before = SKILL_PROGRESSION[name][prev_idx]
        after = SKILL_PROGRESSION[name][idx]
        if before != after:
            skill_changes.append({"name": name, "before": before, "after": after, "delta": after - before})
    
    for dim in RADAR_DIMENSIONS:
        before = RADAR_PROGRESSION[dim["name"]][prev_idx]
        after = RADAR_PROGRESSION[dim["name"]][idx]
        if before != after:
            radar_changes.append({"dimension": dim["name"], "before": before, "after": after, "delta": round(after - before, 1)})
    
    pa = ABILITY_PROGRESSION[prev_idx]
    a = ABILITY_PROGRESSION[idx]
    
    return json.dumps({
        "skillChanges": skill_changes,
        "radarChanges": radar_changes,
        "metricsChange": {
            "depthScore": a[0],
            "matchScore": MATCH_SCORES[idx],
            "breadthScore": a[1],
            "overallScore": a[5]
        }
    }, ensure_ascii=False)


def generate_sql():
    sql = []
    sql.append("-- ===== ZhiPath 555 账号完整模拟数据 =====\n")
    sql.append(f"-- user_id={USER_ID}, branch_id={BRANCH_ID}\n\n")
    
    now = 1785081600000  # 2026-07-27
    
    # ===== 1. 更新 baseline snapshot #6 的 match_summary =====
    sql.append(f"-- 更新 baseline snapshot\n")
    sql.append(f"UPDATE skill_snapshots_v3 SET match_summary_json = '{build_match_json(0)}' WHERE id = 6;\n\n")
    
    # ===== 2. 插入 Commits + Snapshots (t1-t9, 对应 TIMELINE idx 1-9) =====
    commit_ids = []
    snapshot_ids = []
    
    for idx in range(1, 10):  # t1-t9 (skip baseline which is t0)
        date_str, ts, stage = TIMELINE[idx]
        commit_info = COMMITS[idx - 1]  # commits[0] 对应 t1
        
        # 计算 parent_commit_id
        if idx == 1:
            parent_id = 5  # baseline commit
        else:
            parent_id = commit_ids[-1]
        
        # commit
        commit_id = 5 + idx  # 6, 7, 8, ... 14
        sql.append(f"-- Commit #{commit_id}: {date_str} {stage}\n")
        sql.append(
            f"INSERT INTO learning_commits_v3 "
            f"(id, user_id, branch_id, parent_commit_id, commit_type, skill_name, message, payload_json, delta_json, create_time, update_time) VALUES "
            f"({commit_id}, {USER_ID}, {BRANCH_ID}, {parent_id}, "
            f"'{commit_info[0]}', '{commit_info[1]}', '{commit_info[2]}', "
            f"'{{\"stage\": \"{stage}\"}}', "
            f"'{build_delta_json(idx)}', "
            f"{ts}, {ts});\n"
        )
        commit_ids.append(commit_id)
        
        # snapshot
        snap_id = 6 + idx
        skills = build_skills_json(idx)
        radar = build_radar_json(idx)
        ability = build_ability_json(idx)
        match = build_match_json(idx)
        ab = ABILITY_PROGRESSION[idx]
        skill_count = len([s for s, p in SKILL_PROGRESSION.items() if p[idx] > 0])
        total_mastery = int(sum(SKILL_PROGRESSION[name][idx] for name in SKILL_PROGRESSION) / len(SKILL_PROGRESSION))
        
        sql.append(
            f"INSERT INTO skill_snapshots_v3 "
            f"(id, user_id, branch_id, commit_id, skills_json, radar_json, ability_metrics_json, match_summary_json, "
            f"total_mastery, skill_count, depth_score, breadth_score, balance_score, create_time, update_time) VALUES "
            f"({snap_id}, {USER_ID}, {BRANCH_ID}, {commit_id}, "
            f"'{skills}', '{radar}', '{ability}', '{match}', "
            f"{total_mastery}, {skill_count}, {ab[0]}, {ab[1]}, {ab[2]}, {ts}, {ts});\n"
        )
        snapshot_ids.append(snap_id)
    
    # 更新 commits 的 snapshot_id 关联
    for i, cid in enumerate(commit_ids):
        sid = snapshot_ids[i]
        sql.append(f"UPDATE learning_commits_v3 SET snapshot_id = {sid} WHERE id = {cid};\n")
    
    # 更新 branch head_commit_id
    sql.append(f"\nUPDATE learning_branches_v3 SET head_commit_id = {commit_ids[-1]} WHERE id = {BRANCH_ID};\n\n")
    
    # ===== 3. 插入学习 Sessions =====
    sql.append("-- 学习会话\n")
    for i, (date_str, dur_min, completed) in enumerate(SESSION_DAYS):
        ts_base = 1783267200000 + i * 86400000  # 2026-07-06 + day offset
        duration_ms = dur_min * 60 * 1000
        # 查找最近的 match score
        match_idx = min(i // 2, 9)
        match_before = MATCH_SCORES[max(0, match_idx - 1)]
        match_after = MATCH_SCORES[match_idx]
        sql.append(
            f"INSERT INTO learning_sessions_v3 "
            f"(user_id, plan_id, session_date, started_at, ended_at, total_duration_ms, "
            f"tasks_snapshot, skill_changes, match_score_before, match_score_after, create_time, update_time) VALUES "
            f"({USER_ID}, 14, '{date_str}', {ts_base}, {ts_base + duration_ms}, {duration_ms}, "
            f"'{{\"total\": {completed}, \"completed\": {completed}}}', "
            f"'{{\"skills\":[]}}', "
            f"{match_before}, {match_after}, {ts_base}, {ts_base});\n"
        )
    
    # ===== 4. 插入学习 Tasks =====
    sql.append("\n-- 学习任务\n")
    for i, (skill, ttype, tstatus, plan_date, est_min, act_min, sort_order, priority) in enumerate(TASKS):
        tid = 100 + i
        ts_date = plan_date.replace("-", "") + "000000000"
        ts = int(ts_date[:13]) if len(ts_date) > 13 else 1750204800000 + i * 43200000
        actual_val = "NULL" if act_min is None else str(act_min)
        sql.append(
            f"INSERT INTO learning_tasks_v3 "
            f"(id, user_id, plan_id, skill_name, task_type, task_status, estimated_min, actual_min, "
            f"sort_order, priority, plan_date, is_active, create_time, update_time) VALUES "
            f"({tid}, {USER_ID}, 14, '{skill}', '{ttype}', '{tstatus}', {est_min}, {actual_val}, "
            f"{sort_order}, {priority}, '{plan_date}', 1, {ts}, {ts});\n"
        )
    
    # ===== 5. 插入 Generated Resources =====
    sql.append("\n-- AI 生成资源\n")
    for i, (rtype, title, skill, status, tokens, credits) in enumerate(RESOURCES):
        rid = 200 + i
        ts = 1783267200000 + i * 43200000
        sql.append(
            f"INSERT INTO generated_resources_v3 "
            f"(id, user_id, resource_type, title, skill_name, source, resource_status, "
            f"cost_tokens, cost_credits, preview_meta, create_time, update_time) VALUES "
            f"({rid}, {USER_ID}, '{rtype}', '{title}', '{skill}', 'manual', '{status}', "
            f"{tokens}, {credits}, '{{\"generated\": true}}', {ts}, {ts});\n"
        )
    
    # ===== 6. 插入 Evaluation 数据 =====
    sql.append("\n-- 评估数据\n")
    for i, (atype, skill, goal, rubric, score, passed, level, etype, summary) in enumerate(EVALUATIONS):
        # attempt
        aid = 300 + i * 10
        rid = aid + 1  # result
        eid = aid + 2  # evidence
        iid = aid + 3  # impact
        ts = 1783267200000 + i * 86400000 * 2
        
        sql.append(
            f"INSERT INTO evaluation_attempts_v3 "
            f"(id, user_id, attempt_type, skill_name, goal, attempt_status, "
            f"rubric_key, rubric_version, started_at, completed_at, create_time, update_time) VALUES "
            f"({aid}, {USER_ID}, '{atype}', '{skill}', '{goal}', 'graded', "
            f"'{rubric}', '1.0.0', {ts}, {ts + 600000}, {ts}, {ts + 600000});\n"
        )
        
        # result
        sql.append(
            f"INSERT INTO evaluation_results_v3 "
            f"(id, user_id, attempt_id, skill_name, evaluator_type, score, max_score, normalized_score, "
            f"level, passed, confidence, summary, rubric_key, rubric_version, create_time, update_time) VALUES "
            f"({rid}, {USER_ID}, {aid}, '{skill}', '{etype}', {score}, 100, {score}, "
            f"'{level}', {passed}, 0.82, '{summary}', '{rubric}', '1.0.0', {ts + 600000}, {ts + 600000});\n"
        )
        
        # evidence
        sql.append(
            f"INSERT INTO evaluation_evidence_v3 "
            f"(id, user_id, attempt_id, evidence_type, skill_name, summary, create_time, update_time) VALUES "
            f"({eid}, {USER_ID}, {aid}, 'learning_action', '{skill}', "
            f"'自动采集的{skill}学习行为数据', {ts}, {ts});\n"
        )
        
        # impact (关联到对应的 commit/snapshot)
        cid = 5 + min(i + 1, 9)  # 映射到最近的 commit
        sid = 6 + min(i + 1, 9)   # 映射到最近的 snapshot
        sql.append(
            f"INSERT INTO evaluation_impacts_v3 "
            f"(id, user_id, attempt_id, result_id, commit_id, snapshot_id, branch_id, "
            f"match_score_delta, create_time, update_time) VALUES "
            f"({iid}, {USER_ID}, {aid}, {rid}, {cid}, {sid}, {BRANCH_ID}, "
            f"{round(score * 0.15, 2)}, {ts + 600000}, {ts + 600000});\n"
        )
        
        # dimension scores
        for dim_idx, dim_name in enumerate(["knowledge", "practice", "thinking", "innovation"]):
            did = 400 + i * 10 + dim_idx
            dim_score = score + (dim_idx - 1) * 5
            sql.append(
                f"INSERT INTO evaluation_dimension_scores_v3 "
                f"(id, user_id, attempt_id, result_id, dimension_key, dimension_name, score, max_score, normalized_score, "
                f"weight, trend, create_time, update_time) VALUES "
                f"({did}, {USER_ID}, {aid}, {rid}, '{dim_name}', '{dim_name}', "
                f"{dim_score}, 100, {dim_score}, 1.0, 'stable', {ts + 600000}, {ts + 600000});\n"
            )
    
    # ===== 7. 更新 user_skills_v3 =====
    sql.append("\n-- 更新用户技能到最新状态\n")
    for name, progress in SKILL_PROGRESSION.items():
        final_mastery = progress[-1]  # t9 (today)
        trust = 0.3
        if final_mastery >= 60:
            trust = 0.7
        elif final_mastery >= 30:
            trust = 0.5
        source_map = {"HTML": "conversation", "CSS": "conversation", "JavaScript": "exam",
                      "React": "conversation", "Node.js": "exam", "TypeScript": "self_report", "MongoDB": "conversation"}
        source = source_map.get(name, "self_report")
        sql.append(
            f"UPDATE user_skills_v3 SET mastery_pct = {final_mastery}, trust_weight = {trust}, "
            f"source = '{source}', last_activity = {now} "
            f"WHERE user_id = {USER_ID} AND skill_name = '{name}';\n"
        )
    
    # 更新 plan 14 的 match_score
    sql.append(f"\nUPDATE learning_plans_v3 SET match_score = {MATCH_SCORES[-1]} WHERE id = 14;\n")
    
    return "\n".join(sql)


if __name__ == "__main__":
    print(generate_sql())
