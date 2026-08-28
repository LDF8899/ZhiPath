-- Generic question generation lifecycle for ZhiPath.
-- Run once against the zhipath database before using /api/user/question-generation.
-- Compatible with MySQL 8.0 (no MariaDB-only `ADD COLUMN IF NOT EXISTS`); idempotent.
--
-- Apply with:   mysql -h ... -P ... -u ... -p zhipath < deploy/20260822-question-generation.sql
-- (works with `mysql < file`, which runs statements one by one)

CREATE TABLE IF NOT EXISTS `question_generation_tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `subject` varchar(120) NOT NULL DEFAULT '',
  `curriculum` varchar(120) NOT NULL DEFAULT '',
  `locale` varchar(20) NOT NULL DEFAULT 'zh-CN',
  `grade` varchar(80) NOT NULL DEFAULT '',
  `question_types` json NOT NULL,
  `question_count` tinyint NOT NULL,
  `difficulty` tinyint NOT NULL DEFAULT 5,
  `difficulty_mix` json DEFAULT NULL,
  `topics` json DEFAULT NULL,
  `instructions` text NOT NULL,
  `metadata` json DEFAULT NULL,
  `reference_library` tinyint NOT NULL DEFAULT 0,
  `task_status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  `progress` json DEFAULT NULL,
  `result_count` int NOT NULL DEFAULT 0,
  `error_message` text,
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 1,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_question_generation_user_status` (`user_id`,`task_status`),
  KEY `idx_question_generation_user_time` (`user_id`,`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Generic AI question generation tasks';

CREATE TABLE IF NOT EXISTS `question_generation_snapshots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `questions` json NOT NULL,
  `config` json DEFAULT NULL,
  `review_statuses` json DEFAULT NULL,
  `version` int NOT NULL DEFAULT 1,
  `status` tinyint NOT NULL DEFAULT 1,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_question_generation_snapshot_task` (`task_id`),
  KEY `idx_question_generation_snapshot_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Latest resumable review snapshot';

-- ── exam_questions_v3 columns ────────────────────────────────────────────
-- MySQL 8.0 does NOT support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
-- (that is MariaDB-only). Use information_schema guards + prepared statements
-- so this migration is idempotent and runs cleanly on MySQL 8.0.
SET @db := DATABASE();

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'question_generation_tasks' AND column_name = 'reference_library');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `question_generation_tasks` ADD COLUMN `reference_library` tinyint NOT NULL DEFAULT 0 AFTER `metadata`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'exam_questions_v3' AND column_name = 'generation_task_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `exam_questions_v3` ADD COLUMN `generation_task_id` bigint DEFAULT NULL AFTER `id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'exam_questions_v3' AND column_name = 'source_order');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `exam_questions_v3` ADD COLUMN `source_order` int DEFAULT NULL AFTER `generation_task_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'exam_questions_v3' AND column_name = 'reviewed_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `exam_questions_v3` ADD COLUMN `reviewed_at` bigint DEFAULT NULL AFTER `reviewed_by`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = @db AND table_name = 'exam_questions_v3' AND index_name = 'idx_exam_question_generation_task');
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE `exam_questions_v3` ADD KEY `idx_exam_question_generation_task` (`generation_task_id`,`source_order`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
