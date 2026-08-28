-- Remediation runs (补强记录: 补强前掌握度 → 前后对比) for ZhiPath.
-- Compatible with MySQL 8.0; idempotent.
-- Apply:  mysql -h ... -P ... -u ... -p zhipath < deploy/20260822-remediation.sql

CREATE TABLE IF NOT EXISTS `remediation_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `topics` json DEFAULT NULL,
  `task_id` bigint DEFAULT NULL,
  `run_status` varchar(20) NOT NULL DEFAULT 'pending',
  `status` tinyint NOT NULL DEFAULT 1,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_remediation_run_user_time` (`user_id`,`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='补强记录（补强前掌握度 → 前后对比）';
