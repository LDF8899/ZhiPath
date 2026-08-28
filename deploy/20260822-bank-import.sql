-- Question-bank OCR import (试卷识别 → 候选题 → 审核入题库) for ZhiPath.
-- Compatible with MySQL 8.0; idempotent (CREATE TABLE IF NOT EXISTS).
-- Apply:  mysql -h ... -P ... -u ... -p zhipath < deploy/20260822-bank-import.sql

CREATE TABLE IF NOT EXISTS `question_bank_imports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `filename` varchar(512) NOT NULL DEFAULT '',
  `file_type` varchar(20) NOT NULL DEFAULT 'image',
  `import_status` varchar(32) NOT NULL DEFAULT 'processing',
  `total_questions` int NOT NULL DEFAULT 0,
  `imported_count` int NOT NULL DEFAULT 0,
  `parse_result` json DEFAULT NULL,
  `progress` int NOT NULL DEFAULT 0,
  `pages_total` int NOT NULL DEFAULT 0,
  `pages_done` int NOT NULL DEFAULT 0,
  `error_message` text,
  `storage_key` varchar(512) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `file_hash` varchar(64) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 1,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_question_bank_import_user_time` (`user_id`,`create_time`),
  KEY `idx_question_bank_import_status` (`import_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='OCR/导入的题库批次';

CREATE TABLE IF NOT EXISTS `question_bank_import_candidates` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `import_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `source_order` int NOT NULL DEFAULT 0,
  `question_type` varchar(32) NOT NULL DEFAULT 'choice',
  `stem` text NOT NULL,
  `options` json DEFAULT NULL,
  `answer` json DEFAULT NULL,
  `explanation` text,
  `difficulty` tinyint NOT NULL DEFAULT 3,
  `confidence` decimal(3,2) DEFAULT NULL,
  `topic_suggestions` json DEFAULT NULL,
  `needs_review` tinyint NOT NULL DEFAULT 0,
  `imported` tinyint NOT NULL DEFAULT 0,
  `question_id` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT 1,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_qbi_candidate_import` (`import_id`,`source_order`),
  KEY `idx_qbi_candidate_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='OCR 识别出的题库候选题';
