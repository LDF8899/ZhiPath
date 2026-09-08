-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: zhipath
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `zhipath`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `zhipath` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `zhipath`;

--
-- Table structure for table `agent_profiles_v3`
--

DROP TABLE IF EXISTS `agent_profiles_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_profiles_v3` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `agent_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT 'Agent 类型：lecture/reading/code/path/assess/exam/skillgap/resume/profile/news',
  `animal_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '动物形象',
  `color` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '配色 hex',
  `nickname` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '自定义昵称',
  `display_role` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '显示岗位',
  `station_id` int DEFAULT NULL COMMENT '工位号 null=待命',
  `agent_status` enum('idle','busy') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'idle' COMMENT '当前状态',
  `status` tinyint DEFAULT '1',
  `create_time` bigint NOT NULL DEFAULT '0',
  `update_time` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_status` (`user_id`,`status`) USING BTREE,
  KEY `idx_user_station` (`user_id`,`station_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=150 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='智能体办公室员工配置';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `agent_tasks_v3`
--

DROP TABLE IF EXISTS `agent_tasks_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_tasks_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'ä¸»é”®ID',
  `user_id` bigint NOT NULL COMMENT 'å…³è”ç”¨æˆ·',
  `agent_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Agent 类型',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ä»»åŠ¡æ ‡é¢˜',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'ä»»åŠ¡æè¿°',
  `params` json DEFAULT NULL COMMENT 'ä»»åŠ¡å‚æ•°',
  `task_status` enum('pending','running','success','failed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'ä»»åŠ¡çŠ¶æ€',
  `progress` int NOT NULL DEFAULT '0' COMMENT 'è¿›åº¦ 0-100',
  `result` json DEFAULT NULL COMMENT 'ä»»åŠ¡ç»“æžœ',
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'é”™è¯¯ä¿¡æ¯',
  `is_urgent` tinyint NOT NULL DEFAULT '0' COMMENT 'æ˜¯å¦ç´§æ€¥',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'æŽ’åº',
  `group_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '任务组ID，用于批量关联任务',
  `external_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '外部幂等ID，防止重复创建',
  `output_type` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '产物类型：knowledge/project/plan/evaluation/resume',
  `target_entity` json DEFAULT NULL COMMENT '产物目标实体：如 {skillName, planId, resumeId}',
  `started_at` bigint DEFAULT NULL COMMENT 'å¼€å§‹æ—¶é—´',
  `completed_at` bigint DEFAULT NULL COMMENT 'å®Œæˆæ—¶é—´',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=æ­£å¸¸ 0=åˆ é™¤',
  `create_time` bigint DEFAULT NULL COMMENT 'åˆ›å»ºæ—¶é—´æˆ³ms',
  `update_time` bigint DEFAULT NULL COMMENT 'æ›´æ–°æ—¶é—´æˆ³ms',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `idx_external_id` (`external_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_agent_type` (`agent_type`) USING BTREE,
  KEY `idx_task_status` (`task_status`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=307 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='Agent ä»»åŠ¡é˜Ÿåˆ—è¡¨';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `course_abilities_v3`
--

DROP TABLE IF EXISTS `course_abilities_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_abilities_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_id` bigint NOT NULL,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `description` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_plan_id` (`plan_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `course_chapters_v3`
--

DROP TABLE IF EXISTS `course_chapters_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_chapters_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_id` bigint NOT NULL,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `level` tinyint NOT NULL DEFAULT '0',
  `parent_id` bigint DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `ability_id` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_plan_id` (`plan_id`) USING BTREE,
  KEY `idx_user_id` (`user_id`) USING BTREE,
  KEY `idx_parent_id` (`parent_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `enterprises_v3`
--

DROP TABLE IF EXISTS `enterprises_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enterprises_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '企业名称',
  `industry` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '行业',
  `contact_email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联络员邮箱',
  `contact_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联络员姓名',
  `contact_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0=待审核 1=已通过 2=已拒绝',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evaluation_attempts_v3`
--

DROP TABLE IF EXISTS `evaluation_attempts_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evaluation_attempts_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `attempt_type` enum('progress_read','progress_quiz','progress_code','skill_complete','quick_test','exam','ai_assessment','chat_resource','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `source_type` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skill_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goal` varchar(240) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempt_status` enum('started','graded','committed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'started',
  `rubric_key` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default_skill_v1',
  `rubric_version` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0.0',
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_evaluation_attempts_user_type` (`user_id`,`attempt_type`) USING BTREE,
  KEY `idx_evaluation_attempts_user_skill` (`user_id`,`skill_name`) USING BTREE,
  KEY `idx_evaluation_attempts_source` (`source_type`,`source_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evaluation_dimension_scores_v3`
--

DROP TABLE IF EXISTS `evaluation_dimension_scores_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evaluation_dimension_scores_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `attempt_id` bigint NOT NULL,
  `result_id` bigint NOT NULL,
  `dimension_key` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `dimension_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `max_score` decimal(6,2) NOT NULL DEFAULT '100.00',
  `normalized_score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `weight` decimal(5,2) NOT NULL DEFAULT '1.00',
  `trend` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'stable',
  `detail` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evidence_refs_json` json DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_evaluation_dimension_user_attempt` (`user_id`,`attempt_id`) USING BTREE,
  KEY `idx_evaluation_dimension_result` (`result_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evaluation_evidence_v3`
--

DROP TABLE IF EXISTS `evaluation_evidence_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evaluation_evidence_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `attempt_id` bigint NOT NULL,
  `evidence_type` enum('learning_action','quiz_answer','exam_answer','code','conversation','resource','project','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `source_type` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skill_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` json DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_evaluation_evidence_user_attempt` (`user_id`,`attempt_id`) USING BTREE,
  KEY `idx_evaluation_evidence_source` (`source_type`,`source_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evaluation_impacts_v3`
--

DROP TABLE IF EXISTS `evaluation_impacts_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evaluation_impacts_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `attempt_id` bigint NOT NULL,
  `result_id` bigint DEFAULT NULL,
  `commit_id` bigint DEFAULT NULL,
  `snapshot_id` bigint DEFAULT NULL,
  `branch_id` bigint DEFAULT NULL,
  `skill_changes_json` json DEFAULT NULL,
  `radar_changes_json` json DEFAULT NULL,
  `metrics_change_json` json DEFAULT NULL,
  `match_score_delta` decimal(6,2) NOT NULL DEFAULT '0.00',
  `next_actions_json` json DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_evaluation_impacts_user_attempt` (`user_id`,`attempt_id`) USING BTREE,
  KEY `idx_evaluation_impacts_commit` (`commit_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evaluation_results_v3`
--

DROP TABLE IF EXISTS `evaluation_results_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evaluation_results_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `attempt_id` bigint NOT NULL,
  `skill_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evaluator_type` enum('objective','llm','hybrid','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `evaluator_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `max_score` decimal(6,2) NOT NULL DEFAULT '100.00',
  `normalized_score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `level` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passed` tinyint DEFAULT NULL,
  `confidence` decimal(4,2) NOT NULL DEFAULT '0.70',
  `summary` varchar(600) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `feedback_json` json DEFAULT NULL,
  `raw_result_json` json DEFAULT NULL,
  `rubric_key` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default_skill_v1',
  `rubric_version` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0.0',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_evaluation_results_user_attempt` (`user_id`,`attempt_id`) USING BTREE,
  KEY `idx_evaluation_results_user_skill` (`user_id`,`skill_name`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evaluation_rubrics_v3`
--

DROP TABLE IF EXISTS `evaluation_rubrics_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evaluation_rubrics_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `rubric_key` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0.0',
  `target_type` enum('skill','radar_dimension','job_match','learning_action','project') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'skill',
  `pass_score` int NOT NULL DEFAULT '70',
  `dimensions_json` json DEFAULT NULL,
  `weights_json` json DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_evaluation_rubric_key_version` (`rubric_key`,`version`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `evidence_chunks`
--

DROP TABLE IF EXISTS `evidence_chunks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `evidence_chunks` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '关联用户',
  `source_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '证据来源：project/file_qa/evaluation/learning_commit/agent_output/resume',
  `source_id` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '来源唯一ID，如 project:45 / file_qa:1:1720000000',
  `chunk_index` int NOT NULL DEFAULT '0' COMMENT '第几个分块',
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '证据标题',
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '原文片段',
  `content_hash` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '内容哈希，用于去重',
  `skill_tags` json DEFAULT NULL COMMENT '技能标签',
  `job_target_id` bigint DEFAULT NULL COMMENT '关联目标岗位',
  `confidence` decimal(4,2) NOT NULL DEFAULT '0.70' COMMENT '证据可信度',
  `visibility` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'private' COMMENT 'private=仅本人 school_aggregate=可聚合',
  `vector_status` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending/indexed/failed',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=删除',
  `create_time` bigint DEFAULT NULL COMMENT '创建时间戳ms',
  `update_time` bigint DEFAULT NULL COMMENT '更新时间戳ms',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_source` (`user_id`,`source_type`,`source_id`) USING BTREE,
  KEY `idx_user_created` (`user_id`,`create_time`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=139 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='个人证据索引（Evidence RAG）';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `exam_questions_v3`
--

DROP TABLE IF EXISTS `exam_questions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_questions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `generation_task_id` bigint DEFAULT NULL,
  `source_order` int DEFAULT NULL,
  `exam_type` tinyint NOT NULL COMMENT '1=通用技能 2=岗位考试 3=5分钟速测',
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_id` bigint DEFAULT NULL,
  `question_type` enum('choice','fill','coding','essay') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题干',
  `content` json NOT NULL COMMENT '选项/模板代码/测试用例',
  `answer` json DEFAULT NULL COMMENT '正确答案/评分要点',
  `difficulty` tinyint NOT NULL DEFAULT '1' COMMENT '1-5',
  `confidence_score` decimal(3,2) DEFAULT NULL COMMENT 'Agent出题置信度 §12.1',
  `pass_rate` decimal(5,2) DEFAULT NULL COMMENT '通过率（考试后统计）',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0=待审核 1=已上架 2=已下架',
  `created_by` enum('agent','manual','enterprise') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'agent',
  `reviewed_by` bigint DEFAULT NULL,
  `reviewed_at` bigint DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_exam_type` (`exam_type`) USING BTREE,
  KEY `idx_skill` (`skill_name`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=900112 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `exam_records_v3`
--

DROP TABLE IF EXISTS `exam_records_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_records_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `exam_type` tinyint NOT NULL DEFAULT '1',
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_id` bigint DEFAULT NULL,
  `question_ids` json DEFAULT NULL COMMENT '题目ID列表',
  `score` decimal(5,2) DEFAULT NULL,
  `passed` tinyint DEFAULT NULL COMMENT '考试结果：null=未批改, 0=未通过, 1=通过',
  `answers` json DEFAULT NULL COMMENT '用户答题内容',
  `wrong_analysis` json DEFAULT NULL COMMENT '错题分析 §12.2',
  `retry_count` int NOT NULL DEFAULT '0',
  `next_retry_time` bigint DEFAULT NULL COMMENT '下次可重考时间',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_exam_type` (`exam_type`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `generated_resources_v3`
--

DROP TABLE IF EXISTS `generated_resources_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `generated_resources_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `user_id` bigint NOT NULL,
  `resource_type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `skill_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `source_task_id` bigint DEFAULT NULL,
  `external_id` varchar(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chat_session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chat_message_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agent_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resource_status` enum('pending','running','success','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `payload` json DEFAULT NULL,
  `preview_meta` json DEFAULT NULL,
  `provider` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw_request` json DEFAULT NULL,
  `raw_response` json DEFAULT NULL,
  `cost_tokens` int NOT NULL DEFAULT '0',
  `cost_credits` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `duration_ms` int DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `idx_generated_external_id` (`external_id`) USING BTREE,
  KEY `idx_generated_user_time` (`user_id`,`update_time`) USING BTREE,
  KEY `idx_generated_user_session` (`user_id`,`chat_session_id`) USING BTREE,
  KEY `idx_generated_source_task` (`source_task_id`) USING BTREE,
  KEY `idx_generated_type_status` (`resource_type`,`resource_status`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=155 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC COMMENT='Generated resources and AI artifacts';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_applications_v3`
--

DROP TABLE IF EXISTS `job_applications_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_applications_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `job_id` bigint NOT NULL,
  `resume_id` bigint DEFAULT NULL,
  `reviewer_agent_score` decimal(5,2) DEFAULT NULL COMMENT 'AI 筛选分',
  `reviewer_agent_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'AI 建议',
  `admin_decision` tinyint NOT NULL DEFAULT '0' COMMENT '0=待处理 1=通过 2=拒绝',
  `admin_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enterprise_email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_job` (`job_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_positions_v3`
--

DROP TABLE IF EXISTS `job_positions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_positions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '岗位名称',
  `company` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公司名称',
  `level` enum('junior','mid','senior') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'junior' COMMENT '岗位级别 §7.4',
  `jd_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '原始 JD 文本',
  `required_skills` json DEFAULT NULL COMMENT '必须技能 [{name,weight}]',
  `preferred_skills` json DEFAULT NULL COMMENT '加分技能 [{name,weight}]',
  `salary_range` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '薪资范围',
  `location` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '工作地点',
  `delivery_threshold` tinyint NOT NULL DEFAULT '60' COMMENT '投递门槛百分比 §7.4',
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'manual' COMMENT 'manual/jd_parser/enterprise',
  `confidence_score` decimal(3,2) DEFAULT NULL COMMENT 'JD 解析置信度',
  `enterprise_id` bigint DEFAULT NULL COMMENT '关联企业',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '0=下架 1=上架',
  `neo4j_node_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_level` (`level`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `knowledge_base_v3`
--

DROP TABLE IF EXISTS `knowledge_base_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_base_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属技能',
  `resource_type` enum('lecture','choice','fill','coding','essay','graph') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` json NOT NULL COMMENT 'Markdown讲义/题目/图谱数据',
  `version` int NOT NULL DEFAULT '1',
  `source` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源',
  `reviewed_by` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=待审查 2=已过期',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_skill` (`skill_name`) USING BTREE,
  KEY `idx_type` (`resource_type`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `knowledge_ingestion_tasks`
--

DROP TABLE IF EXISTS `knowledge_ingestion_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_ingestion_tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `task_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint NOT NULL,
  `source_kind` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ingestion_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `title` varchar(220) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw_text` mediumtext COLLATE utf8mb4_unicode_ci,
  `cleaned_text` mediumtext COLLATE utf8mb4_unicode_ci,
  `summary` text COLLATE utf8mb4_unicode_ci,
  `skill_tags` json DEFAULT NULL,
  `chunk_preview` json DEFAULT NULL,
  `curator_result` json DEFAULT NULL,
  `inspection_result` json DEFAULT NULL,
  `ingested_chunk_ids` json DEFAULT NULL,
  `failure_reason` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_knowledge_ingestion_task_id` (`task_id`),
  KEY `idx_knowledge_ingestion_user_time` (`user_id`,`create_time`),
  KEY `idx_knowledge_ingestion_status` (`user_id`,`ingestion_status`,`create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `learning_branches_v3`
--

DROP TABLE IF EXISTS `learning_branches_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_branches_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `branch_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_type` enum('main','plan','side','experiment') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main',
  `plan_id` bigint DEFAULT NULL,
  `base_commit_id` bigint DEFAULT NULL,
  `head_commit_id` bigint DEFAULT NULL,
  `source_branch_id` bigint DEFAULT NULL,
  `merged_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_learning_branches_user_status` (`user_id`,`status`) USING BTREE,
  KEY `idx_learning_branches_user_type` (`user_id`,`branch_type`) USING BTREE,
  KEY `idx_learning_branches_user_plan` (`user_id`,`plan_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `learning_commits_v3`
--

DROP TABLE IF EXISTS `learning_commits_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_commits_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `branch_id` bigint NOT NULL,
  `parent_commit_id` bigint DEFAULT NULL,
  `merge_source_commit_id` bigint DEFAULT NULL,
  `commit_type` enum('baseline','lecture_read','quiz_passed','quiz_failed','code_done','skill_complete','task_done','manual','merge','rollback') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `skill_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` varchar(240) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_json` json DEFAULT NULL,
  `snapshot_id` bigint DEFAULT NULL,
  `delta_json` json DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_learning_commits_user_branch` (`user_id`,`branch_id`) USING BTREE,
  KEY `idx_learning_commits_branch_parent` (`branch_id`,`parent_commit_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=110 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `learning_plans_v3`
--

DROP TABLE IF EXISTS `learning_plans_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_plans_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Default Plan' COMMENT '计划名称（中文由应用层写入）',
  `plan_type` enum('main','side') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main' COMMENT '主线/支线 §4.3',
  `target_job_id` bigint DEFAULT NULL COMMENT '目标岗位',
  `plan_status` enum('active','paused','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `schedule_enabled` tinyint NOT NULL DEFAULT '1',
  `path_data` json DEFAULT NULL COMMENT '阶段→技能点→资源 完整结构',
  `current_phase` int NOT NULL DEFAULT '0' COMMENT '当前阶段索引',
  `daily_hours` decimal(3,1) DEFAULT NULL COMMENT '本计划每日时长',
  `main_ratio` tinyint DEFAULT '80' COMMENT '主线占比 %',
  `match_score` decimal(5,2) DEFAULT NULL COMMENT '当前匹配度',
  `estimated_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '预计达成日期',
  `branch_from` bigint DEFAULT NULL COMMENT '分支来源计划ID（Git模型）§2.3',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=进行中 2=已完成 0=已归档',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `bound_agent_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ç»‘å®šçš„Agentç±»åž‹',
  `bound_agent_at` timestamp NULL DEFAULT NULL COMMENT 'Agentç»‘å®šæ—¶é—´',
  `domain_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'software-engineering',
  `goal_type` enum('career','course','exam','certificate','project','interest') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'interest',
  `goal_title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_type` (`plan_type`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE,
  KEY `idx_learning_plans_schedule` (`user_id`,`plan_status`,`schedule_enabled`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `learning_sessions_v3`
--

DROP TABLE IF EXISTS `learning_sessions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_sessions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_id` bigint DEFAULT NULL COMMENT '关联计划',
  `session_date` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '日期 YYYY-MM-DD',
  `started_at` bigint DEFAULT NULL COMMENT '会话开始时间戳',
  `ended_at` bigint DEFAULT NULL COMMENT '会话结束时间戳',
  `total_duration_ms` bigint DEFAULT '0' COMMENT '总学习时长ms',
  `tasks_snapshot` json DEFAULT NULL COMMENT '当日任务完成快照 §11.1',
  `skill_changes` json DEFAULT NULL COMMENT '技能变化 [{name,before,after}]',
  `match_score_before` decimal(5,2) DEFAULT NULL,
  `match_score_after` decimal(5,2) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_date` (`user_id`,`session_date`) USING BTREE,
  KEY `idx_date` (`session_date`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=84 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `learning_tasks_v3`
--

DROP TABLE IF EXISTS `learning_tasks_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_tasks_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_id` bigint NOT NULL COMMENT '关联 learning_plans_v3',
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能名称',
  `task_type` enum('main','side') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main' COMMENT '主线/支线',
  `task_status` enum('pending','in_progress','lecture_done','practice_done','code_done','exam_done','skipped','done') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '状态机',
  `estimated_min` int DEFAULT NULL COMMENT '预估时长(分钟)',
  `actual_min` int DEFAULT NULL COMMENT '实际时长(分钟)',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序（支持拖拽 §9.3）',
  `priority` tinyint NOT NULL DEFAULT '5' COMMENT '优先级1-10，10最高（用户可标记紧急）',
  `plan_date` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '安排在哪天 YYYY-MM-DD',
  `start_time` bigint DEFAULT NULL COMMENT '用户点击开始时间',
  `complete_time` bigint DEFAULT NULL COMMENT '完成时间',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '1=有效 0=删除',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=删除',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_date` (`user_id`,`plan_date`) USING BTREE,
  KEY `idx_plan` (`plan_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=216 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `match_history_v3`
--

DROP TABLE IF EXISTS `match_history_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `match_history_v3` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL COMMENT 'ç”¨æˆ·ID',
  `jobId` int NOT NULL COMMENT 'å²—ä½ID',
  `score` decimal(5,2) NOT NULL COMMENT 'åŒ¹é…åº¦åˆ†æ•°',
  `breakdown` json DEFAULT NULL COMMENT 'å„å› å­åˆ†æ•°å¿«ç…§',
  `triggerEvent` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'è§¦å‘äº‹ä»¶',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'åˆ›å»ºæ—¶é—´',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `IDX_match_history_user_job` (`userId`,`jobId`) USING BTREE,
  KEY `IDX_match_history_created` (`createdAt`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=22842 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `news_v3`
--

DROP TABLE IF EXISTS `news_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `summary` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI 生成摘要',
  `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'industry/tech/recruit',
  `tags` json DEFAULT NULL COMMENT '技能标签 ["React","AI"]',
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_url` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '0=下架 1=上架',
  `publish_time` bigint DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_type` (`type`) USING BTREE,
  KEY `idx_status` (`status`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=355 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications_v3`
--

DROP TABLE IF EXISTS `notifications_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `type` enum('learning','progress','job','exam','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '点击跳转路径',
  `is_read` tinyint NOT NULL DEFAULT '0',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `status` tinyint DEFAULT '1' COMMENT '1=正常 0=删除',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_read` (`user_id`,`is_read`) USING BTREE,
  KEY `idx_type` (`type`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `operation_logs_v3`
--

DROP TABLE IF EXISTS `operation_logs_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operation_logs_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint DEFAULT NULL,
  `action` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `create_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_module` (`module`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `question_generation_snapshots`
--

DROP TABLE IF EXISTS `question_generation_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_generation_snapshots` (
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=删除',
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `create_time` bigint DEFAULT NULL COMMENT '创建时间戳ms',
  `update_time` bigint DEFAULT NULL COMMENT '更新时间戳ms',
  `task_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `questions` json NOT NULL,
  `config` json DEFAULT NULL,
  `review_statuses` json DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_question_generation_snapshot_task` (`task_id`),
  KEY `idx_question_generation_snapshot_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `question_generation_tasks`
--

DROP TABLE IF EXISTS `question_generation_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question_generation_tasks` (
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=删除',
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `create_time` bigint DEFAULT NULL COMMENT '创建时间戳ms',
  `update_time` bigint DEFAULT NULL COMMENT '更新时间戳ms',
  `user_id` bigint NOT NULL,
  `subject` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `curriculum` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `locale` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'zh-CN',
  `grade` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `question_types` json NOT NULL,
  `question_count` tinyint NOT NULL,
  `difficulty` tinyint NOT NULL DEFAULT '5',
  `difficulty_mix` json DEFAULT NULL,
  `topics` json DEFAULT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `reference_library` tinyint NOT NULL DEFAULT '0',
  `task_status` enum('pending','running','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `progress` json DEFAULT NULL,
  `result_count` int NOT NULL DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_question_generation_user_status` (`user_id`,`task_status`),
  KEY `idx_question_generation_user_time` (`user_id`,`create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=900002 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `remediation_runs`
--

DROP TABLE IF EXISTS `remediation_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `remediation_runs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `topics` json DEFAULT NULL,
  `task_id` bigint DEFAULT NULL,
  `run_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_remediation_run_user_time` (`user_id`,`create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='补强记录（补强前掌握度 → 前后对比）';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resumes_v3`
--

DROP TABLE IF EXISTS `resumes_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resumes_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `target_job_id` bigint DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1' COMMENT '版本号',
  `version_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '如 v1-前端开发工程师',
  `is_base` tinyint NOT NULL DEFAULT '0' COMMENT '是否基础简历',
  `content` json DEFAULT NULL COMMENT '简历结构化内容',
  `html_content` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '简历 HTML（编辑/导出用）',
  `pdf_file_id` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `review_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_version` (`user_id`,`version`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `skill_snapshots`
--

DROP TABLE IF EXISTS `skill_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_snapshots` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `commit_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT 'å…³è”çš„æŠ€èƒ½æäº¤ ID',
  `snapshot_type` enum('full','delta') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'full',
  `nodes_json` json DEFAULT NULL COMMENT 'å®Œæ•´å¿«ç…§ï¼šèŠ‚ç‚¹æ•°ç»„ï¼ˆä»… full ç±»åž‹ï¼‰',
  `edges_json` json DEFAULT NULL COMMENT 'å®Œæ•´å¿«ç…§ï¼šè¾¹æ•°ç»„ï¼ˆä»… full ç±»åž‹ï¼‰',
  `delta_json` json DEFAULT NULL COMMENT 'å¢žé‡å¿«ç…§ï¼šå˜æ›´æ“ä½œï¼ˆä»… delta ç±»åž‹ï¼‰',
  `overall_score` int NOT NULL DEFAULT '0' COMMENT 'ç»¼åˆè¯„åˆ†',
  `match_score` int NOT NULL DEFAULT '0' COMMENT 'åŒ¹é…åº¦è¯„åˆ†',
  `skill_count` int NOT NULL DEFAULT '0' COMMENT 'æŠ€èƒ½æ€»æ•°',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user` (`user_id`) USING BTREE,
  KEY `idx_user_type` (`user_id`,`snapshot_type`) USING BTREE,
  KEY `idx_created` (`created_at`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC COMMENT='ç”¨æˆ·æŠ€èƒ½å›¾è°±å¿«ç…§ï¼ˆæ”¯æŒå®Œæ•´/å¢žé‡ä¸¤ç§æ¨¡å¼ï¼‰';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `skill_snapshots_v3`
--

DROP TABLE IF EXISTS `skill_snapshots_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_snapshots_v3` (
  `status` tinyint NOT NULL DEFAULT '1',
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `branch_id` bigint NOT NULL,
  `commit_id` bigint NOT NULL,
  `skills_json` json NOT NULL,
  `radar_json` json NOT NULL,
  `ability_metrics_json` json DEFAULT NULL,
  `match_summary_json` json DEFAULT NULL,
  `total_mastery` int NOT NULL DEFAULT '0',
  `skill_count` int NOT NULL DEFAULT '0',
  `depth_score` int NOT NULL DEFAULT '0',
  `breadth_score` int NOT NULL DEFAULT '0',
  `balance_score` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_skill_snapshots_user_branch` (`user_id`,`branch_id`) USING BTREE,
  KEY `idx_skill_snapshots_commit` (`commit_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `students_v3`
--

DROP TABLE IF EXISTS `students_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL COMMENT '关联 users_v3',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '学号',
  `school` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '学校',
  `major` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '专业',
  `grade` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '年级/毕业年份',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系方式',
  `email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系方式',
  `target_job_id` bigint DEFAULT NULL COMMENT '目标岗位 FK',
  `interests` json DEFAULT NULL COMMENT '兴趣方向 ["AI","前端"]',
  `skills` json DEFAULT NULL COMMENT '技能列表 [{name,level,source}] - 快速访问冗余',
  `projects` json DEFAULT NULL COMMENT '项目经历 - 快速访问冗余',
  `github_username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'GitHub 用户名',
  `work_experience` json DEFAULT NULL COMMENT '实习/工作经历',
  `awards` json DEFAULT NULL COMMENT '获奖/证书',
  `self_intro` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '自我评价/个人简介',
  `daily_hours` decimal(3,1) DEFAULT NULL COMMENT '每日可投入学习时长(h)',
  `target_deadline` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '目标达成时间',
  `onboarding_completed` tinyint NOT NULL DEFAULT '0' COMMENT '0=未完成 1=已完成',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_id` (`user_id`) USING BTREE,
  KEY `idx_target_job` (`target_job_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_config_v3`
--

DROP TABLE IF EXISTS `system_config_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `config_key` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_key` (`config_key`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_llm_config`
--

DROP TABLE IF EXISTS `user_llm_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_llm_config` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `api_key_enc` text COLLATE utf8mb4_unicode_ci,
  `base_url` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_llm_config_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_skills_v3`
--

DROP TABLE IF EXISTS `user_skills_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_skills_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能名称',
  `mastery_pct` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '掌握百分比 0-100 §6.2',
  `trust_weight` decimal(3,2) NOT NULL DEFAULT '0.30' COMMENT '信任权重 §6.1',
  `source` enum('self_report','conversation','github','exam') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'self_report' COMMENT '技能来源 §6.1',
  `last_activity` bigint DEFAULT NULL COMMENT '最后一次使用/学习时间戳',
  `decay_start` bigint DEFAULT NULL COMMENT '开始衰减时间（考试通过3个月后）',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=有效 0=归档',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_user_skill` (`user_id`,`skill_name`) USING BTREE,
  KEY `idx_skill` (`skill_name`) USING BTREE,
  KEY `idx_mastery` (`mastery_pct`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=170 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_v3`
--

DROP TABLE IF EXISTS `users_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '登录名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'bcrypt hash',
  `real_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '真实姓名',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','student') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=禁用',
  `create_time` bigint DEFAULT NULL COMMENT '创建时间戳ms',
  `update_time` bigint DEFAULT NULL COMMENT '更新时间戳ms',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_username` (`username`) USING BTREE,
  KEY `idx_role` (`role`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'zhipath'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-08 10:27:55
