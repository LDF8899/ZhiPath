#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ZhiPath 全维度批量模拟数据生成器 — 直接写入 UTF-8 SQL 文件"""

import json, random, datetime

OUT = "deploy/seed-all-data.sql"

# 基础数据
STUDENTS = [1,2,3,4,5,23,24,25,26,27,29]
JOBS = list(range(1,29))
NOW = 1785081600000  # 2026-07-27
RNG = random.Random(42)

def ts(day_offset=0, hour=9):
    """生成时间戳：从今天往前 day_offset 天"""
    base = NOW - day_offset * 86400000 + hour * 3600000
    return base + RNG.randint(0, 3600000)

def esc(s):
    return str(s).replace("\\","\\\\").replace("'","\\'")

def json_str(obj):
    return json.dumps(obj, ensure_ascii=False).replace("\\","\\\\").replace("'","\\'")

# ============ SQL 构建 ============
lines = []
lines.append("-- ===== ZhiPath 全维度模拟数据 =====")
lines.append(f"-- 生成时间: {datetime.datetime.now()}")
lines.append("")

# ── 1. job_applications_v3 ──
lines.append("\n-- ===== 1. 投递申请 (50条) =====")
STATUSES = ["投递成功，等待HR筛选", "简历已查看，进入初筛", "通过初筛，等待笔试通知",
            "笔试完成，等待面试安排", "进入技术面试环节", "技术面试通过，进入HR面试",
            "HR面试完成，等待offer审批", "恭喜！已发放offer", "感谢投递，岗位已招满",
            "简历与岗位要求匹配度不足"]
DECISIONS = [0]*15 + [1]*25 + [2]*10  # 15待审, 25通过, 10拒绝
RNG.shuffle(DECISIONS)

for i in range(50):
    uid = RNG.choice(STUDENTS)
    jid = RNG.choice(JOBS)
    resume_id = RNG.choice([1,2,3,4,5,11,None,None])
    score = round(RNG.uniform(42, 95), 1)
    decision = DECISIONS[i % len(DECISIONS)]
    comment = RNG.choice(STATUSES) if decision == 1 else ("不符合岗位要求" if decision == 2 else None)
    comment_str = f"'{esc(comment)}'" if comment else "NULL"
    t = ts(RNG.randint(0,60))
    lines.append(
        f"INSERT INTO job_applications_v3 (user_id, job_id, resume_id, reviewer_agent_score, reviewer_agent_comment, admin_decision, admin_comment, status, create_time, update_time) VALUES "
        f"({uid}, {jid}, {resume_id if resume_id else 'NULL'}, {score}, 'AI自动评估：技能匹配度{score}%', {decision}, {comment_str}, 1, {t}, {t});"
    )

# ── 2. exam_questions_v3 ──
lines.append("\n-- ===== 2. 题库 (60题) =====")
SKILLS_QUESTIONS = {
    "JavaScript": [
        ("JavaScript中闭包的原理是什么？请举例说明", "coding"),
        ("解释Event Loop的运行机制", "essay"),
        ("Promise.all和Promise.race的区别", "choice"),
        ("以下代码输出是什么？var a=1; function f(){console.log(a);var a=2}", "choice"),
        ("实现一个debounce函数", "coding"),
        ("解释原型链继承和class继承的区别", "essay"),
        ("什么是变量提升？", "fill"),
        ("数组的reduce方法如何使用？", "coding"),
    ],
    "React": [
        ("React Hooks的使用规则有哪些？", "choice"),
        ("useEffect的依赖数组为空数组代表什么？", "choice"),
        ("解释Virtual DOM的工作原理", "essay"),
        ("实现一个自定义Hook：useLocalStorage", "coding"),
        ("React.memo和useMemo的区别", "choice"),
        ("如何在React中实现组件间通信？", "essay"),
        ("受控组件和非受控组件的区别", "fill"),
    ],
    "Node.js": [
        ("Express中间件的执行顺序是怎样的？", "essay"),
        ("如何避免回调地狱？请给出三种方法", "coding"),
        ("Stream的pipe方法有什么作用？", "fill"),
        ("Node.js是单线程的，如何处理高并发？", "essay"),
        ("如何实现JWT鉴权中间件？", "coding"),
    ],
    "HTML/CSS": [
        ("Flexbox中justify-content和align-items的区别", "choice"),
        ("实现一个居中的模态框", "coding"),
        ("CSS选择器的优先级是如何计算的？", "fill"),
        ("BFC是什么？如何触发？", "essay"),
        ("Grid布局中fr单位代表什么？", "choice"),
    ],
    "TypeScript": [
        ("TypeScript中interface和type的区别", "essay"),
        ("泛型的使用场景有哪些？", "coding"),
        ("什么是类型守卫？", "fill"),
    ],
    "MongoDB": [
        ("聚合管道中$match和$group的作用", "fill"),
        ("MongoDB的索引类型有哪些？", "choice"),
        ("如何设计嵌套文档的Schema？", "essay"),
    ],
}

SKILL_DIFFICULTIES = {"JavaScript": [1,2,3,1,2,3,1,3], "React": [1,2,3,2,2,3,1],
                       "Node.js": [2,3,1,3,2], "HTML/CSS": [1,2,1,3,1],
                       "TypeScript": [2,3,1], "MongoDB": [1,1,2]}

qid = 200
for skill, qs in SKILLS_QUESTIONS.items():
    diffs = SKILL_DIFFICULTIES[skill]
    for qi, (title, qtype) in enumerate(qs):
        content = {"question": title, "options": ["A.选项A","B.选项B","C.选项C","D.选项D"]} if qtype == "choice" else {"question": title}
        answer = {"correct": "A", "explanation": f"这是{skill}的基础知识点"} if qtype == "choice" else {"reference": f"参考{skill}官方文档"}
        pass_rate = round(RNG.uniform(45, 92), 1)
        diff = diffs[qi % len(diffs)]
        status = RNG.choice([1,1,1,1,0])  # 80% approved
        t = ts(RNG.randint(1,90))
        lines.append(
            f"INSERT INTO exam_questions_v3 (id, exam_type, skill_name, question_type, title, content, answer, difficulty, confidence_score, pass_rate, status, created_by, create_time, update_time) VALUES "
            f"({qid}, 1, '{skill}', '{qtype}', '{esc(title)}', '{json_str(content)}', '{json_str(answer)}', {diff}, "
            f"{round(RNG.uniform(0.65,0.95),2)}, {pass_rate}, {status}, 'agent', {t}, {t});"
        )
        qid += 1

# ── 3. exam_records_v3 ──
lines.append("\n-- ===== 3. 考试记录 (40条) =====")
for i in range(40):
    uid = RNG.choice(STUDENTS)
    skill = RNG.choice(list(SKILLS_QUESTIONS.keys()))
    qids = [RNG.randint(200, qid-1) for _ in range(RNG.randint(3,8))]
    score = round(RNG.uniform(35,98), 1)
    passed = 1 if score >= 60 else 0
    retry = RNG.randint(0,2)
    t = ts(RNG.randint(1,90))
    wrong = None
    if score < 80:
        wrong = {"weakPoints": [f"{skill}基础概念", f"{skill}进阶应用"], "suggestion": f"建议复习{skill}核心知识点"}
    wrong_str = "NULL" if wrong is None else "'" + esc(json_str(wrong)) + "'"
    lines.append(
        f"INSERT INTO exam_records_v3 (user_id, exam_type, skill_name, question_ids, score, passed, answers, wrong_analysis, retry_count, status, create_time, update_time) VALUES "
        f"({uid}, 1, '{skill}', '{json.dumps(qids)}', {score}, {passed}, '{{\"submitted\":true}}', "
        f"{wrong_str}, {retry}, 1, {t}, {t});"
    )

# ── 4. resumes_v3 ──
lines.append("\n-- ===== 4. 简历数据 (10份) =====")
RESUME_JOBS = [
    ("前端开发工程师", "字节跳动", ["JavaScript","React","TypeScript","CSS","HTML"], "3年前端经验，主导过XX项目中后台建设"),
    ("全栈开发工程师", "阿里巴巴", ["JavaScript","Node.js","React","MongoDB","Docker"], "5年全栈经验，负责过双十一大促系统"),
    ("Python开发工程师", "美团", ["Python","Django","MySQL","Redis","Docker"], "2年后端经验，擅长高并发系统设计"),
    ("Java开发工程师", "腾讯", ["Java","Spring Boot","MySQL","Redis","微服务"], "4年Java经验，参与微信支付核心系统"),
    ("前端实习生", "字节跳动", ["HTML","CSS","JavaScript","Vue"], "计算机专业大三，有个人博客项目经验"),
    ("DevOps工程师", "百度", ["Linux","Docker","K8s","CI/CD","Python"], "3年运维开发经验，管理过千台服务器集群"),
    ("数据分析师", "腾讯", ["Python","SQL","Tableau","机器学习"], "2年数据分析经验，擅长用户增长分析"),
    ("产品经理", "字节跳动", ["需求分析","原型设计","数据分析"], "4年B端产品经验，负责过企业协作产品"),
    ("测试工程师", "阿里巴巴", ["自动化测试","Selenium","Python","接口测试"], "3年测试经验，主导过自动化测试平台搭建"),
    ("UI设计师", "美团", ["Figma","Sketch","设计系统","用户体验"], "3年UI经验，负责过千万用户级产品设计"),
]

for i, (job_title, company, skills, desc) in enumerate(RESUME_JOBS):
    uid = RNG.choice(STUDENTS[:8])
    jid = RNG.choice(JOBS)
    content = {
        "name": f"候选人{RNG.choice(['张','李','王','赵','孙','陈','刘'])}{RNG.choice(['明','强','丽','芳','伟','静','洋'])}",
        "title": job_title, "company": company,
        "skills": skills, "summary": desc,
        "education": "本科", "experience": f"{RNG.randint(2,6)}年"
    }
    html = f"<h2>{job_title}</h2><p>{company}</p><ul>{''.join(f'<li>{s}</li>' for s in skills)}</ul><p>{desc}</p>"
    t = ts(RNG.randint(1,180))
    lines.append(
        f"INSERT INTO resumes_v3 (user_id, target_job_id, version, version_name, is_base, content, html_content, status, create_time, update_time) VALUES "
        f"({uid}, {jid}, 1, 'v1-{esc(job_title)}', 0, '{json_str(content)}', '{esc(html)}', 1, {t}, {t});"
    )

# ── 5. enterprises_v3 ──
lines.append("\n-- ===== 5. 企业补充 (5家) =====")
NEW_ENTERPRISES = [
    ("华为技术有限公司", "通信/IT", "hr@huawei.com", "王HR", "13800001001"),
    ("网易", "互联网", "hr@163.com", "李HR", "13800001002"),
    ("京东", "电商/物流", "hr@jd.com", "刘HR", "13800001003"),
    ("小米", "智能硬件", "hr@xiaomi.com", "陈HR", "13800001004"),
    ("滴滴出行", "出行/交通", "hr@didiglobal.com", "赵HR", "13800001005"),
]
for name, industry, email, contact, phone in NEW_ENTERPRISES:
    t = ts(RNG.randint(10,180))
    lines.append(
        f"INSERT INTO enterprises_v3 (name, industry, contact_email, contact_name, contact_phone, status, create_time, update_time) VALUES "
        f"('{name}', '{industry}', '{email}', '{contact}', '{phone}', 1, {t}, {t});"
    )

# ── 6. notifications_v3 ──
lines.append("\n-- ===== 6. 通知消息 (40条) =====")
NTYPES = ["learning", "progress", "job", "exam", "system"]
NTITLES = {
    "learning": ["学习任务已完成", "新课程已上线", "学习计划更新提醒", "技能里程碑达成"],
    "progress": ["学习进度更新", "本周学习报告已生成", "技能雷达图已更新", "岗位匹配度提升"],
    "job": ["新岗位匹配通知", "投递申请状态更新", "面试邀请通知", "offer发放通知"],
    "exam": ["考试结果已出", "新测评任务已分配", "考试预约提醒", "错题回顾推荐"],
    "system": ["系统维护通知", "版本更新公告", "欢迎加入智途", "账号安全提醒"],
}
for i in range(40):
    uid = RNG.choice(STUDENTS)
    ntype = RNG.choice(NTYPES)
    title = RNG.choice(NTITLES[ntype])
    content = f"尊敬的学员，{title}，请及时查看。"
    read = RNG.choice([0,0,0,1])  # 25% read
    t = ts(RNG.randint(1,30))
    lines.append(
        f"INSERT INTO notifications_v3 (user_id, type, title, content, is_read, status, create_time, update_time) VALUES "
        f"({uid}, '{ntype}', '{title}', '{content}', {read}, 1, {t}, {t});"
    )

# ── 7. operation_logs_v3 ──
lines.append("\n-- ===== 7. 操作日志 (60条) =====")
ACTIONS = ["登录系统", "查看岗位详情", "投递简历", "开始学习任务", "完成测评", 
           "生成学习资源", "查看技能雷达", "修改个人信息", "搜索岗位", "查看学习报告",
           "创建学习计划", "暂停学习计划", "删除通知", "标记任务完成", "提交考试答案",
           "浏览资讯", "收藏岗位", "取消投递", "绑定智能体", "导出简历PDF"]
MODULES = ["auth","jobs","learning","exam","profile","agent","resume","notification","plan","dashboard"]
for i in range(60):
    uid = RNG.choice(STUDENTS)
    action = RNG.choice(ACTIONS)
    module = RNG.choice(MODULES)
    t = ts(RNG.randint(0,30))
    lines.append(
        f"INSERT INTO operation_logs_v3 (user_id, action, module, ip, detail, create_time) VALUES "
        f"({uid}, '{action}', '{module}', '192.168.1.{RNG.randint(1,255)}', '用户执行了{action}操作', {t});"
    )

# ── 8. knowledge_base_v3 ──
lines.append("\n-- ===== 8. 知识库 (35条) =====")
KNOWLEDGE_ITEMS = {
    "JavaScript": [
        ("闭包深入理解", "lecture"), ("原型链图解", "graph"), ("ES6+新特性概览", "lecture"),
        ("异步编程最佳实践", "coding"), ("模块化开发指南", "lecture"),
    ],
    "React": [
        ("Hooks完全指南", "lecture"), ("组件设计模式", "lecture"), ("状态管理方案对比", "graph"),
        ("性能优化实战", "coding"), ("React Router深度解析", "lecture"),
    ],
    "Node.js": [
        ("Express框架入门到精通", "lecture"), ("中间件机制详解", "lecture"),
        ("数据库操作最佳实践", "coding"), ("RESTful API设计规范", "lecture"),
    ],
    "HTML/CSS": [
        ("HTML5语义化指南", "lecture"), ("CSS Flexbox完全指南", "graph"),
        ("CSS Grid布局实战", "coding"), ("响应式设计模式", "lecture"),
    ],
    "TypeScript": [
        ("类型系统深入", "lecture"), ("泛型编程实战", "coding"), ("工程化配置指南", "lecture"),
    ],
    "MongoDB": [
        ("聚合管道详解", "lecture"), ("索引优化策略", "graph"), ("Schema设计最佳实践", "lecture"),
    ],
    "Docker": [
        ("Docker基础入门", "lecture"), ("容器编排实战", "coding"),
    ],
    "Git": [
        ("Git工作流最佳实践", "lecture"), ("团队协作规范", "lecture"),
    ],
}

kid = 1
for skill, items in KNOWLEDGE_ITEMS.items():
    for title, rtype in items:
        content = {"sections": [{"title": "概述", "body": f"关于{title}的基础知识"}, 
                                {"title": "详解", "body": f"{title}的核心内容，涵盖{skill}关键概念"}]}
        t = ts(RNG.randint(1,120))
        lines.append(
            f"INSERT INTO knowledge_base_v3 (id, title, skill_name, resource_type, content, version, status, create_time, update_time) VALUES "
            f"({kid}, '{esc(title)}', '{skill}', '{rtype}', '{json_str(content)}', 1, 1, {t}, {t});"
        )
        kid += 1

# ── 9. evaluation_rubrics_v3 ──
lines.append("\n-- ===== 9. 评分标准 (6条) =====")
RUBRICS = [
    ("default_skill_v1", "通用技能评分标准", "skill", 70,
     [{"key":"knowledge","name":"理论知识","weight":0.3},{"key":"practice","name":"动手实践","weight":0.35},
      {"key":"thinking","name":"思维能力","weight":0.2},{"key":"innovation","name":"创新能力","weight":0.15}]),
    ("frontend_skill", "前端技能专项评分", "skill", 75,
     [{"key":"html_css","name":"HTML/CSS","weight":0.25},{"key":"js_ts","name":"JS/TS","weight":0.35},
      {"key":"framework","name":"框架","weight":0.25},{"key":"tooling","name":"工程化","weight":0.15}]),
    ("backend_skill", "后端技能专项评分", "skill", 75,
     [{"key":"lang","name":"语言能力","weight":0.25},{"key":"db","name":"数据库","weight":0.25},
      {"key":"architecture","name":"架构设计","weight":0.25},{"key":"devops","name":"DevOps","weight":0.25}]),
    ("radar_default", "雷达图综合评估", "radar_dimension", 65,
     [{"key":"frontend","name":"前端","weight":0.3},{"key":"backend","name":"后端","weight":0.3},
      {"key":"tooling","name":"工具链","weight":0.2},{"key":"soft","name":"软技能","weight":0.2}]),
    ("job_match", "岗位匹配度评估", "job_match", 60,
     [{"key":"skill_match","name":"技能匹配","weight":0.5},{"key":"level_match","name":"级别匹配","weight":0.3},
      {"key":"culture","name":"文化匹配","weight":0.2}]),
    ("project_eval", "项目评估标准", "project", 70,
     [{"key":"completeness","name":"完成度","weight":0.3},{"key":"code_quality","name":"代码质量","weight":0.3},
      {"key":"innovation","name":"创新性","weight":0.2},{"key":"presentation","name":"展示效果","weight":0.2}]),
]
for i, (key, name, target, pass_score, dims) in enumerate(RUBRICS):
    t = ts(30+i, 10)
    lines.append(
        f"INSERT INTO evaluation_rubrics_v3 (rubric_key, name, version, target_type, pass_score, dimensions_json, weights_json, create_time, update_time) VALUES "
        f"('{key}', '{name}', '1.0.0', '{target}', {pass_score}, '{json_str(dims)}', '{{\"default\":1.0}}', {t}, {t});"
    )

# ── 10. course_abilities_v3 + course_chapters_v3 for plan 14 ──
lines.append("\n-- ===== 10. 课程大纲 (plan 14的abilities + chapters) =====")
ABILITIES = ["JavaScript基础","HTML/CSS基础","React框架","Node.js后端","数据库基础","工程化实践"]
for i, ab in enumerate(ABILITIES):
    t = ts(25, 10)
    lines.append(
        f"INSERT INTO course_abilities_v3 (user_id, plan_id, name, description, sort_order, status, create_time, update_time) VALUES "
        f"(24, 14, '{ab}', '{ab}能力模块', {i}, 1, {t}, {t});"
    )
    # chapters per ability
    chapters = {
        "JavaScript基础": [("变量与数据类型",1),("函数与作用域",2),("异步编程",3),("ES6+特性",4)],
        "HTML/CSS基础": [("HTML5语义化",1),("CSS布局",2),("响应式设计",3)],
        "React框架": [("组件基础",1),("Hooks深入",2),("状态管理",3),("路由",4)],
        "Node.js后端": [("Express入门",1),("数据库操作",2),("API设计",3),("认证授权",4)],
        "数据库基础": [("MySQL入门",1),("MongoDB入门",2),("索引与优化",3)],
        "工程化实践": [("Git版本控制",1),("Docker容器化",2),("CI/CD",3)],
    }
    for ci, (ch_name, level) in enumerate(chapters.get(ab, [])):
        # strip suffix keywords for skill_name
        skill_short = ab.replace("基础","").replace("框架","").replace("后端","").replace("实践","")
        lines.append(
            f"INSERT INTO course_chapters_v3 (user_id, plan_id, name, level, parent_id, sort_order, skill_name, ability_id, status, create_time, update_time) VALUES "
            f"(24, 14, '{ch_name}', {level}, NULL, {ci}, '{skill_short}', {i+1}, 1, {t}, {t});"
        )

# ── 写入文件 ──
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f"Written {OUT} ({len(lines)} lines)")
print(f"  applications:50, questions:60, exam_records:40, resumes:10")
print(f"  enterprises:5, notifications:40, logs:60, knowledge:35")
print(f"  rubrics:6, course_abilities+chapters")
