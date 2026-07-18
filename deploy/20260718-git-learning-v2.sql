CREATE TABLE IF NOT EXISTS `learning_branches_v3` (
  `status` tinyint NOT NULL DEFAULT 1,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint NULL,
  `update_time` bigint NULL,
  `user_id` bigint NOT NULL,
  `branch_name` varchar(120) NOT NULL,
  `branch_type` enum('main','side','experiment') NOT NULL DEFAULT 'main',
  `base_commit_id` bigint NULL,
  `head_commit_id` bigint NULL,
  `source_branch_id` bigint NULL,
  `merged_at` bigint NULL,
  PRIMARY KEY (`id`),
  KEY `idx_learning_branches_user_status` (`user_id`, `status`),
  KEY `idx_learning_branches_user_type` (`user_id`, `branch_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `learning_commits_v3` (
  `status` tinyint NOT NULL DEFAULT 1,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint NULL,
  `update_time` bigint NULL,
  `user_id` bigint NOT NULL,
  `branch_id` bigint NOT NULL,
  `parent_commit_id` bigint NULL,
  `merge_source_commit_id` bigint NULL,
  `commit_type` enum('baseline','lecture_read','quiz_passed','quiz_failed','code_done','skill_complete','task_done','manual','merge','rollback') NOT NULL DEFAULT 'manual',
  `skill_name` varchar(120) NULL,
  `message` varchar(240) NOT NULL,
  `payload_json` json NULL,
  `snapshot_id` bigint NULL,
  `delta_json` json NULL,
  PRIMARY KEY (`id`),
  KEY `idx_learning_commits_user_branch` (`user_id`, `branch_id`),
  KEY `idx_learning_commits_branch_parent` (`branch_id`, `parent_commit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `skill_snapshots_v3` (
  `status` tinyint NOT NULL DEFAULT 1,
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint NULL,
  `update_time` bigint NULL,
  `user_id` bigint NOT NULL,
  `branch_id` bigint NOT NULL,
  `commit_id` bigint NOT NULL,
  `skills_json` json NOT NULL,
  `radar_json` json NOT NULL,
  `ability_metrics_json` json NULL,
  `match_summary_json` json NULL,
  `total_mastery` int NOT NULL DEFAULT 0,
  `skill_count` int NOT NULL DEFAULT 0,
  `depth_score` int NOT NULL DEFAULT 0,
  `breadth_score` int NOT NULL DEFAULT 0,
  `balance_score` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_skill_snapshots_user_branch` (`user_id`, `branch_id`),
  KEY `idx_skill_snapshots_commit` (`commit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
