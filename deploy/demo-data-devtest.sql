-- ============================================================
-- ZhiPath Demo Data for devtest (user_id=29, student_id=11)
-- Target Job: 全栈开发工程师 @ 阿里巴巴 (job_id=3)
-- ============================================================

SET NAMES utf8mb4;
SET @now = UNIX_TIMESTAMP() * 1000;
SET @uid = 29;
SET @sid = 11;

-- ── 1. Clean old data ──

DELETE FROM learning_tasks_v3 WHERE user_id = @uid;
DELETE FROM learning_plans_v3 WHERE user_id = @uid;
DELETE FROM user_skills_v3 WHERE user_id = @uid;
DELETE FROM skill_snapshots_v3 WHERE user_id = @uid;
DELETE FROM exam_records_v3 WHERE user_id = @uid;
DELETE FROM evaluation_results_v3 WHERE user_id = @uid;
DELETE FROM generated_resources_v3 WHERE user_id = @uid;
DELETE FROM learning_commits_v3 WHERE user_id = @uid;
DELETE FROM learning_sessions_v3 WHERE user_id = @uid;
DELETE FROM match_history_v3 WHERE userId = @uid;

-- ── 2. Update student profile ──

UPDATE students_v3 SET
  name = '张演示',
  interests = JSON_ARRAY('fullstack', 'ai'),
  skills = JSON_ARRAY(
    JSON_OBJECT('name', 'HTML/CSS', 'level', '熟练'),
    JSON_OBJECT('name', 'JavaScript', 'level', '熟练'),
    JSON_OBJECT('name', 'TypeScript', 'level', '掌握'),
    JSON_OBJECT('name', 'React', 'level', '掌握'),
    JSON_OBJECT('name', 'Vue', 'level', '了解'),
    JSON_OBJECT('name', 'Node.js', 'level', '掌握'),
    JSON_OBJECT('name', 'SQL', 'level', '熟练'),
    JSON_OBJECT('name', 'Git', 'level', '熟练'),
    JSON_OBJECT('name', 'Docker', 'level', '了解'),
    JSON_OBJECT('name', 'Linux', 'level', '入门'),
    JSON_OBJECT('name', 'Python', 'level', '入门'),
    JSON_OBJECT('name', '算法基础', 'level', '掌握')
  ),
  self_intro = '全栈开发学习者，2 年前端经验，正在往后端和 DevOps 方向拓展',
  daily_hours = 3.0,
  update_time = @now
WHERE user_id = @uid;

-- ── 3. User skills (mastery levels for radar chart) ──

INSERT INTO user_skills_v3 (user_id, skill_name, mastery_pct, trust_weight, source, last_activity, decay_start, status, create_time, update_time) VALUES
(@uid, 'HTML/CSS',   85, 0.90, 'github',    @now - 86400000 * 2,  @now - 86400000 * 30,  1, @now - 86400000 * 60, @now),
(@uid, 'JavaScript', 75, 0.85, 'github',    @now - 86400000 * 3,  @now - 86400000 * 30,  1, @now - 86400000 * 55, @now),
(@uid, 'TypeScript', 60, 0.70, 'exam',      @now - 86400000 * 5,  @now - 86400000 * 20,  1, @now - 86400000 * 40, @now),
(@uid, 'React',      55, 0.65, 'github',    @now - 86400000 * 7,  @now - 86400000 * 25,  1, @now - 86400000 * 35, @now),
(@uid, 'Vue',        40, 0.50, 'exam',      @now - 86400000 * 10, @now - 86400000 * 15,  1, @now - 86400000 * 30, @now),
(@uid, 'Node.js',    45, 0.60, 'exam',      @now - 86400000 * 6,  @now - 86400000 * 20,  1, @now - 86400000 * 28, @now),
(@uid, 'SQL',        70, 0.80, 'exam',      @now - 86400000 * 4,  @now - 86400000 * 40,  1, @now - 86400000 * 50, @now),
(@uid, 'Git',        80, 0.90, 'github',    @now - 86400000 * 1,  @now - 86400000 * 60,  1, @now - 86400000 * 70, @now),
(@uid, 'Docker',     30, 0.40, 'exam',      @now - 86400000 * 12, @now - 86400000 * 10,  1, @now - 86400000 * 15, @now),
(@uid, 'Linux',      25, 0.35, 'exam',      @now - 86400000 * 14, @now - 86400000 * 8,   1, @now - 86400000 * 12, @now),
(@uid, 'Python',     20, 0.30, 'self_report', @now - 86400000 * 20, @now - 86400000 * 5, 1, @now - 86400000 * 25, @now),
(@uid, '算法基础',    50, 0.55, 'exam',      @now - 86400000 * 8,  @now - 86400000 * 18,  1, @now - 86400000 * 22, @now);

-- ── 4. Learning Plan ──

INSERT INTO learning_plans_v3 (user_id, plan_name, plan_type, target_job_id, path_data, current_phase, daily_hours, main_ratio, match_score, estimated_date, status, create_time, update_time) VALUES
(@uid, '全栈开发工程师学习计划', 'main', 3,
  JSON_OBJECT(
    'direction', 'fullstack',
    'jobTitle', '全栈开发工程师',
    'gapSkills', JSON_ARRAY('TypeScript', 'React', 'Vue', 'Node.js', 'Docker', 'Linux', 'Python', '算法基础'),
    'phases', JSON_ARRAY(
      JSON_OBJECT('name', '阶段1：基础夯实', 'index', 0, 'skills', JSON_ARRAY(
        JSON_OBJECT('name', 'HTML/CSS', 'estimatedMin', 120, 'priority', 3, 'isRequired', true, 'status', 'done'),
        JSON_OBJECT('name', 'JavaScript', 'estimatedMin', 180, 'priority', 5, 'isRequired', true, 'status', 'done'),
        JSON_OBJECT('name', 'Git', 'estimatedMin', 90, 'priority', 3, 'isRequired', true, 'status', 'done')
      )),
      JSON_OBJECT('name', '阶段2：前端深入', 'index', 1, 'skills', JSON_ARRAY(
        JSON_OBJECT('name', 'TypeScript', 'estimatedMin', 150, 'priority', 8, 'isRequired', true, 'status', 'in_progress'),
        JSON_OBJECT('name', 'React', 'estimatedMin', 240, 'priority', 9, 'isRequired', true, 'status', 'in_progress'),
        JSON_OBJECT('name', 'Vue', 'estimatedMin', 120, 'priority', 4, 'isRequired', false, 'status', 'pending')
      )),
      JSON_OBJECT('name', '阶段3：后端开发', 'index', 2, 'skills', JSON_ARRAY(
        JSON_OBJECT('name', 'Node.js', 'estimatedMin', 210, 'priority', 8, 'isRequired', true, 'status', 'pending'),
        JSON_OBJECT('name', 'SQL', 'estimatedMin', 150, 'priority', 7, 'isRequired', true, 'status', 'pending'),
        JSON_OBJECT('name', 'Python', 'estimatedMin', 180, 'priority', 6, 'isRequired', false, 'status', 'pending')
      )),
      JSON_OBJECT('name', '阶段4：工程化', 'index', 3, 'skills', JSON_ARRAY(
        JSON_OBJECT('name', 'Docker', 'estimatedMin', 150, 'priority', 7, 'isRequired', true, 'status', 'pending'),
        JSON_OBJECT('name', 'Linux', 'estimatedMin', 120, 'priority', 6, 'isRequired', true, 'status', 'pending'),
        JSON_OBJECT('name', '算法基础', 'estimatedMin', 180, 'priority', 5, 'isRequired', false, 'status', 'pending')
      ))
    )
  ),
  1, 3.0, 80, 62.50, '2026-08-12', 1, @now, @now);

SET @plan_id = LAST_INSERT_ID();

-- ── 5. Learning Tasks (today's + past) ──

INSERT INTO learning_tasks_v3 (user_id, plan_id, skill_name, task_type, task_status, estimated_min, priority, sort_order, plan_date, is_active, status, create_time, update_time) VALUES
-- Today's tasks (Phase 2: 前端深入)
(@uid, @plan_id, 'TypeScript', 'main', 'in_progress', 60, 8, 0, DATE_FORMAT(NOW(), '%Y-%m-%d'), 1, 1, @now, @now),
(@uid, @plan_id, 'React', 'main', 'pending', 90, 9, 1, DATE_FORMAT(NOW(), '%Y-%m-%d'), 1, 1, @now, @now),
(@uid, @plan_id, 'Vue', 'side', 'pending', 45, 4, 2, DATE_FORMAT(NOW(), '%Y-%m-%d'), 1, 1, @now, @now),

-- Yesterday (completed)
(@uid, @plan_id, 'JavaScript', 'main', 'done', 60, 5, 0, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 DAY), '%Y-%m-%d'), 0, 1, @now - 86400000, @now),
(@uid, @plan_id, 'HTML/CSS', 'main', 'done', 45, 3, 1, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 DAY), '%Y-%m-%d'), 0, 1, @now - 86400000, @now),

-- Day before yesterday
(@uid, @plan_id, 'JavaScript', 'main', 'done', 90, 5, 0, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 2 DAY), '%Y-%m-%d'), 0, 1, @now - 172800000, @now),
(@uid, @plan_id, 'Git', 'main', 'done', 60, 3, 1, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 2 DAY), '%Y-%m-%d'), 0, 1, @now - 172800000, @now),

-- 3 days ago
(@uid, @plan_id, 'HTML/CSS', 'main', 'done', 45, 3, 0, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 3 DAY), '%Y-%m-%d'), 0, 1, @now - 259200000, @now),
(@uid, @plan_id, 'Git', 'main', 'done', 30, 3, 1, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 3 DAY), '%Y-%m-%d'), 0, 1, @now - 259200000, @now);

-- ── 6. Exam records ──

INSERT INTO exam_records_v3 (user_id, exam_type, skill_name, job_id, question_ids, score, passed, answers, wrong_analysis, retry_count, status, create_time, update_time) VALUES
(@uid, 1, 'JavaScript', NULL,
  JSON_ARRAY(1,2,3,4,5),
  85.00, 1,
  JSON_ARRAY(0,1,0,2,0),
  JSON_ARRAY(JSON_OBJECT('q', '闭包原理', 'correct', '函数内部返回函数', 'user', '变量作用域')),
  0, 1, @now - 86400000 * 15, @now - 86400000 * 15),

(@uid, 1, 'TypeScript', NULL,
  JSON_ARRAY(1,2,3,4,5),
  70.00, 1,
  JSON_ARRAY(0,1,2,0,1),
  JSON_ARRAY(JSON_OBJECT('q', '泛型约束', 'correct', 'extends 关键字', 'user', '类型断言'), JSON_OBJECT('q', '装饰器', 'correct', '类装饰器', 'user', '方法装饰器')),
  1, 1, @now - 86400000 * 8, @now - 86400000 * 5),

(@uid, 1, 'React', NULL,
  JSON_ARRAY(1,2,3,4,5),
  60.00, 1,
  JSON_ARRAY(0,2,1,0,1),
  JSON_ARRAY(JSON_OBJECT('q', 'useEffect', 'correct', '依赖数组为空', 'user', '未传依赖'), JSON_OBJECT('q', '虚拟DOM', 'correct', 'diff算法', 'user', 'DOM操作')),
  0, 1, @now - 86400000 * 5, @now - 86400000 * 5),

(@uid, 1, 'SQL', NULL,
  JSON_ARRAY(1,2,3,4,5),
  90.00, 1,
  JSON_ARRAY(0,0,0,0,0),
  NULL,
  0, 1, @now - 86400000 * 20, @now - 86400000 * 20),

(@uid, 1, 'Vue', NULL,
  JSON_ARRAY(1,2,3,4,5),
  55.00, 0,
  JSON_ARRAY(0,1,2,2,0),
  JSON_ARRAY(JSON_OBJECT('q', '响应式原理', 'correct', 'Proxy', 'user', 'Object.defineProperty'), JSON_OBJECT('q', '组件通信', 'correct', 'provide/inject', 'user', 'props')),
  0, 1, @now - 86400000 * 12, @now - 86400000 * 12);

-- ── 7. Evaluation results (for skill radar / progress tracking) ──

INSERT INTO evaluation_results_v3 (user_id, attempt_id, skill_name, evaluator_type, evaluator_name, score, max_score, normalized_score, level, passed, confidence, summary, rubric_key, rubric_version, status, create_time, update_time) VALUES
(@uid, 1, 'HTML/CSS', 'hybrid', '系统综合评估', 85.00, 100, 85.00, '熟练', 1, 0.90, 'HTML/CSS 基础扎实，Flexbox 和 Grid 掌握良好，建议深入学习响应式设计', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 20, @now),
(@uid, 2, 'JavaScript', 'hybrid', '系统综合评估', 72.00, 100, 72.00, '掌握', 1, 0.85, 'ES6+ 基础良好，异步编程已掌握，建议深入学习闭包与原型链', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 14, @now),
(@uid, 3, 'TypeScript', 'objective', '出题专家', 68.00, 100, 68.00, '掌握', 1, 0.70, '类型系统基础扎实，泛型和装饰器需要加强', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 7, @now),
(@uid, 4, 'React', 'objective', '出题专家', 58.00, 100, 58.00, '掌握', 1, 0.65, 'Hooks 基本掌握，状态管理方案需要深入学习 (Redux/Zustand)', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 4, @now),
(@uid, 5, 'Git', 'hybrid', '系统综合评估', 82.00, 100, 82.00, '熟练', 1, 0.90, 'Git 操作熟练，分支管理策略掌握良好', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 18, @now),
(@uid, 6, 'SQL', 'objective', '出题专家', 88.00, 100, 88.00, '熟练', 1, 0.80, 'SQL 查询编写熟练，建议学习索引优化与性能调优', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 19, @now),
(@uid, 7, 'Node.js', 'objective', '出题专家', 45.00, 100, 45.00, '了解', 0, 0.60, 'Express 基础了解，异步流程和中间件需要深入学习', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 6, @now),
(@uid, 8, 'Docker', 'objective', '出题专家', 32.00, 100, 32.00, '入门', 0, 0.40, 'Docker 基础概念了解，需要多动手实践镜像构建与容器编排', 'default_skill_v1', '1.0.0', 1, @now - 86400000 * 10, @now);

-- ── 8. Skill snapshot (for radar chart on dashboard) ──

INSERT INTO skill_snapshots_v3 (user_id, branch_id, commit_id, skills_json, radar_json, ability_metrics_json, match_summary_json, total_mastery, skill_count, depth_score, breadth_score, balance_score, status, create_time, update_time) VALUES
(@uid, 0, 0,
  JSON_ARRAY(
    JSON_OBJECT('name', 'HTML/CSS', 'category', '前端', 'score', 85, 'masteryPct', 85),
    JSON_OBJECT('name', 'JavaScript', 'category', '前端', 'score', 75, 'masteryPct', 75),
    JSON_OBJECT('name', 'TypeScript', 'category', '前端', 'score', 60, 'masteryPct', 60),
    JSON_OBJECT('name', 'React', 'category', '前端', 'score', 55, 'masteryPct', 55),
    JSON_OBJECT('name', 'Vue', 'category', '前端', 'score', 40, 'masteryPct', 40),
    JSON_OBJECT('name', 'Node.js', 'category', '后端', 'score', 45, 'masteryPct', 45),
    JSON_OBJECT('name', 'SQL', 'category', '后端', 'score', 70, 'masteryPct', 70),
    JSON_OBJECT('name', 'Python', 'category', '后端', 'score', 20, 'masteryPct', 20),
    JSON_OBJECT('name', 'Docker', 'category', 'DevOps', 'score', 30, 'masteryPct', 30),
    JSON_OBJECT('name', 'Linux', 'category', 'DevOps', 'score', 25, 'masteryPct', 25),
    JSON_OBJECT('name', 'Git', 'category', '工具', 'score', 80, 'masteryPct', 80),
    JSON_OBJECT('name', '算法基础', 'category', '基础', 'score', 50, 'masteryPct', 50)
  ),
  JSON_OBJECT(
    'categories', JSON_ARRAY('前端', '后端', 'DevOps', '工具', '基础'),
    'maxScore', 100,
    'dimensions', JSON_ARRAY(
      JSON_OBJECT('name', 'HTML/CSS', 'category', '前端', 'score', 85),
      JSON_OBJECT('name', 'JavaScript', 'category', '前端', 'score', 75),
      JSON_OBJECT('name', 'TypeScript', 'category', '前端', 'score', 60),
      JSON_OBJECT('name', 'React', 'category', '前端', 'score', 55),
      JSON_OBJECT('name', 'Vue', 'category', '前端', 'score', 40),
      JSON_OBJECT('name', 'Node.js', 'category', '后端', 'score', 45),
      JSON_OBJECT('name', 'SQL', 'category', '后端', 'score', 70),
      JSON_OBJECT('name', 'Python', 'category', '后端', 'score', 20),
      JSON_OBJECT('name', 'Docker', 'category', 'DevOps', 'score', 30),
      JSON_OBJECT('name', 'Linux', 'category', 'DevOps', 'score', 25),
      JSON_OBJECT('name', 'Git', 'category', '工具', 'score', 80),
      JSON_OBJECT('name', '算法基础', 'category', '基础', 'score', 50)
    )
  ),
  JSON_OBJECT(
    'totalMastery', 52,
    'skillCount', 12,
    'depthScore', 45,
    'breadthScore', 58,
    'balanceScore', 42,
    'strengths', JSON_ARRAY('HTML/CSS', 'Git', 'JavaScript', 'SQL'),
    'weaknesses', JSON_ARRAY('Docker', 'Linux', 'Python'),
    'recommendations', JSON_ARRAY('重点突破后端开发 (Node.js)', '补齐 DevOps 技能短板')
  ),
  JSON_OBJECT(
    'targetJob', '全栈开发工程师',
    'targetJobId', 3,
    'matchScore', 62,
    'gapSkills', JSON_ARRAY('TypeScript', 'React', 'Docker', 'Linux', 'Node.js'),
    'matchedSkills', JSON_ARRAY('HTML/CSS', 'JavaScript', 'Git', 'SQL'),
    'gapCount', 5,
    'matchedCount', 4
  ),
  620, 12, 45, 58, 42, 1, @now, @now);

-- ── 9. Learning sessions for activity history ──

INSERT INTO learning_sessions_v3 (user_id, plan_id, session_date, started_at, ended_at, total_duration_ms, tasks_snapshot, skill_changes, status, create_time, update_time) VALUES
(@uid, @plan_id, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 3 DAY), '%Y-%m-%d'), @now - 86400000 * 3, @now - 86400000 * 3 + 5400000, 5400000, JSON_ARRAY('Git 分支管理', 'CSS Grid'), JSON_ARRAY(JSON_OBJECT('skill', 'Git', 'before', 75, 'after', 80)), 1, @now - 86400000 * 3, @now),
(@uid, @plan_id, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 2 DAY), '%Y-%m-%d'), @now - 86400000 * 2, @now - 86400000 * 2 + 7200000, 7200000, JSON_ARRAY('ES6+ 新特性', 'Promise'), JSON_ARRAY(JSON_OBJECT('skill', 'JavaScript', 'before', 68, 'after', 75)), 1, @now - 86400000 * 2, @now),
(@uid, @plan_id, DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 DAY), '%Y-%m-%d'), @now - 86400000 * 1, @now - 86400000 * 1 + 6300000, 6300000, JSON_ARRAY('Flexbox 实战', 'Promise 练习'), JSON_ARRAY(JSON_OBJECT('skill', 'HTML/CSS', 'before', 80, 'after', 85)), 1, @now - 86400000 * 1, @now),
(@uid, @plan_id, DATE_FORMAT(NOW(), '%Y-%m-%d'), @now, NULL, 0, JSON_ARRAY('TypeScript 高级类型'), NULL, 0, @now, @now);

-- ── 10. Match history ──

INSERT INTO match_history_v3 (userId, jobId, score, breakdown, triggerEvent, createdAt) VALUES
(29, 3, 62.50, JSON_OBJECT('skillMatch', 55.00, 'experienceMatch', 70.00, 'educationMatch', 80.00, 'canApply', true, 'gapSkills', JSON_ARRAY('TypeScript', 'React', 'Docker', 'Linux', 'Node.js'), 'gapCount', 5), 'manual', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(29, 1, 48.00, JSON_OBJECT('skillMatch', 60.00, 'experienceMatch', 40.00, 'canApply', false, 'gapSkills', JSON_ARRAY('React', 'TypeScript', 'Webpack')), 'manual', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(29, 8, 25.00, JSON_OBJECT('skillMatch', 10.00, 'experienceMatch', 30.00, 'canApply', false, 'gapSkills', JSON_ARRAY('Python', 'TensorFlow', '机器学习')), 'manual', DATE_SUB(NOW(), INTERVAL 8 DAY));

SELECT 'Demo data for devtest created successfully!' AS result;
