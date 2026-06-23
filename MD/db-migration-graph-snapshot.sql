-- ============================================================
-- 增量快照存储表 + Agent 绑定扩展
-- 对齐 CONSTITUTION.md § 3D知识图谱 / 快照机制
-- ============================================================

-- 1. 技能快照表 — 存储用户的图谱快照与增量
CREATE TABLE IF NOT EXISTS skill_snapshots (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  commit_id VARCHAR(36) COMMENT '关联的技能提交 ID',
  snapshot_type ENUM('full', 'delta') NOT NULL DEFAULT 'full',
  nodes_json JSON           COMMENT '完整快照：节点数组（仅 full 类型）',
  edges_json JSON           COMMENT '完整快照：边数组（仅 full 类型）',
  delta_json JSON           COMMENT '增量快照：变更操作（仅 delta 类型）',
  overall_score INT NOT NULL DEFAULT 0 COMMENT '综合评分',
  match_score INT NOT NULL DEFAULT 0   COMMENT '匹配度评分',
  skill_count INT NOT NULL DEFAULT 0   COMMENT '技能总数',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_user_type (user_id, snapshot_type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户技能图谱快照（支持完整/增量两种模式）';

-- 2. 扩展 learning_plans 表 — 支持 Agent 绑定
--    Agent 可以绑定到学习路径，为用户提供个性化指导
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS bound_agent_type VARCHAR(50) DEFAULT NULL COMMENT '绑定的 Agent 类型';
ALTER TABLE learning_plans ADD COLUMN IF NOT EXISTS bound_agent_at TIMESTAMP DEFAULT NULL COMMENT 'Agent 绑定时间';
