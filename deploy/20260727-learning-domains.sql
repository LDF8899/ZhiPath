-- Promote learning domain and goal semantics to first-class plan fields.
-- Run once against an existing ZhiPath v3 database before deploying the new backend.

ALTER TABLE `learning_plans_v3`
  ADD COLUMN `domain_id` varchar(80) NULL COMMENT '学习领域标识' AFTER `target_job_id`,
  ADD COLUMN `goal_type` enum('career','course','exam','certificate','project','interest') NULL COMMENT '学习目标类型' AFTER `domain_id`,
  ADD COLUMN `goal_title` varchar(160) NULL COMMENT '用户可读的学习目标' AFTER `goal_type`;

UPDATE `learning_plans_v3`
SET
  `domain_id` = 'software-engineering',
  `goal_type` = CASE WHEN `target_job_id` IS NOT NULL THEN 'career' ELSE 'interest' END,
  `goal_title` = `plan_name`
WHERE `domain_id` IS NULL OR `goal_type` IS NULL OR `goal_title` IS NULL;

ALTER TABLE `learning_plans_v3`
  MODIFY COLUMN `domain_id` varchar(80) NOT NULL DEFAULT 'software-engineering' COMMENT '学习领域标识',
  MODIFY COLUMN `goal_type` enum('career','course','exam','certificate','project','interest') NOT NULL DEFAULT 'interest' COMMENT '学习目标类型',
  MODIFY COLUMN `goal_title` varchar(160) NOT NULL DEFAULT '' COMMENT '用户可读的学习目标',
  ADD KEY `idx_learning_domain_goal` (`domain_id`, `goal_type`);
