-- MySQL dump 10.13  Distrib 8.0.33, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: zhipath
-- ------------------------------------------------------
-- Server version	8.0.36

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
  `agent_type` varchar(30) NOT NULL COMMENT 'Agent 类型：lecture/reading/code/path/assess/exam/skillgap/resume/profile/news',
  `animal_type` varchar(20) NOT NULL COMMENT '动物形象',
  `color` varchar(10) NOT NULL COMMENT '配色 hex',
  `nickname` varchar(20) NOT NULL COMMENT '自定义昵称',
  `display_role` varchar(30) NOT NULL COMMENT '显示岗位',
  `station_id` int DEFAULT NULL COMMENT '工位号 null=待命',
  `agent_status` enum('idle','busy') DEFAULT 'idle' COMMENT '当前状态',
  `status` tinyint DEFAULT '1',
  `create_time` bigint NOT NULL DEFAULT '0',
  `update_time` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_user_station` (`user_id`,`station_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='智能体办公室员工配置';
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
  `agent_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Agent 类型',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ä»»åŠ¡æ ‡é¢˜',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'ä»»åŠ¡æè¿°',
  `params` json DEFAULT NULL COMMENT 'ä»»åŠ¡å‚æ•°',
  `task_status` enum('pending','running','success','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'ä»»åŠ¡çŠ¶æ€',
  `progress` int NOT NULL DEFAULT '0' COMMENT 'è¿›åº¦ 0-100',
  `result` json DEFAULT NULL COMMENT 'ä»»åŠ¡ç»“æžœ',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT 'é”™è¯¯ä¿¡æ¯',
  `is_urgent` tinyint NOT NULL DEFAULT '0' COMMENT 'æ˜¯å¦ç´§æ€¥',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT 'æŽ’åº',
  `group_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '任务组ID，用于批量关联任务',
  `external_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '外部幂等ID，防止重复创建',
  `started_at` bigint DEFAULT NULL COMMENT 'å¼€å§‹æ—¶é—´',
  `completed_at` bigint DEFAULT NULL COMMENT 'å®Œæˆæ—¶é—´',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=æ­£å¸¸ 0=åˆ é™¤',
  `create_time` bigint DEFAULT NULL COMMENT 'åˆ›å»ºæ—¶é—´æˆ³ms',
  `update_time` bigint DEFAULT NULL COMMENT 'æ›´æ–°æ—¶é—´æˆ³ms',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_external_id` (`external_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_type` (`agent_type`),
  KEY `idx_task_status` (`task_status`)
) ENGINE=InnoDB AUTO_INCREMENT=129 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Agent ä»»åŠ¡é˜Ÿåˆ—è¡¨';
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
  `name` varchar(50) NOT NULL,
  `description` varchar(200) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_plan_id` (`plan_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `name` varchar(200) NOT NULL,
  `level` tinyint NOT NULL DEFAULT '0',
  `parent_id` bigint DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `skill_name` varchar(100) DEFAULT NULL,
  `ability_id` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `enterprises_v3`
--

DROP TABLE IF EXISTS `enterprises_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enterprises_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '企业名称',
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '行业',
  `contact_email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联络员邮箱',
  `contact_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联络员姓名',
  `contact_phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0=待审核 1=已通过 2=已拒绝',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `exam_questions_v3`
--

DROP TABLE IF EXISTS `exam_questions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_questions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exam_type` tinyint NOT NULL COMMENT '1=通用技能 2=岗位考试 3=5分钟速测',
  `skill_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_id` bigint DEFAULT NULL,
  `question_type` enum('choice','fill','coding','essay') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '题干',
  `content` json NOT NULL COMMENT '选项/模板代码/测试用例',
  `answer` json DEFAULT NULL COMMENT '正确答案/评分要点',
  `difficulty` tinyint NOT NULL DEFAULT '1' COMMENT '1-5',
  `confidence_score` decimal(3,2) DEFAULT NULL COMMENT 'Agent出题置信度 §12.1',
  `pass_rate` decimal(5,2) DEFAULT NULL COMMENT '通过率（考试后统计）',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '0=待审核 1=已上架 2=已下架',
  `created_by` enum('agent','manual','enterprise') COLLATE utf8mb4_unicode_ci DEFAULT 'agent',
  `reviewed_by` bigint DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_exam_type` (`exam_type`),
  KEY `idx_skill` (`skill_name`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `skill_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_exam_type` (`exam_type`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `reviewer_agent_comment` text COLLATE utf8mb4_unicode_ci COMMENT 'AI 建议',
  `admin_decision` tinyint NOT NULL DEFAULT '0' COMMENT '0=待处理 1=通过 2=拒绝',
  `admin_comment` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enterprise_email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_job` (`job_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_positions_v3`
--

DROP TABLE IF EXISTS `job_positions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_positions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '岗位名称',
  `company` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '公司名称',
  `level` enum('junior','mid','senior') COLLATE utf8mb4_unicode_ci DEFAULT 'junior' COMMENT '岗位级别 §7.4',
  `jd_text` text COLLATE utf8mb4_unicode_ci COMMENT '原始 JD 文本',
  `required_skills` json DEFAULT NULL COMMENT '必须技能 [{name,weight}]',
  `preferred_skills` json DEFAULT NULL COMMENT '加分技能 [{name,weight}]',
  `salary_range` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '薪资范围',
  `location` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '工作地点',
  `delivery_threshold` tinyint NOT NULL DEFAULT '60' COMMENT '投递门槛百分比 §7.4',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'manual' COMMENT 'manual/jd_parser/enterprise',
  `confidence_score` decimal(3,2) DEFAULT NULL COMMENT 'JD 解析置信度',
  `enterprise_id` bigint DEFAULT NULL COMMENT '关联企业',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '0=下架 1=上架',
  `neo4j_node_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_level` (`level`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `knowledge_base_v3`
--

DROP TABLE IF EXISTS `knowledge_base_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_base_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `skill_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '所属技能',
  `resource_type` enum('lecture','choice','fill','coding','essay','graph') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` json NOT NULL COMMENT 'Markdown讲义/题目/图谱数据',
  `version` int NOT NULL DEFAULT '1',
  `source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '来源',
  `reviewed_by` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=待审查 2=已过期',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_skill` (`skill_name`),
  KEY `idx_type` (`resource_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `plan_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Default Plan' COMMENT '计划名称（中文由应用层写入）',
  `plan_type` enum('main','side') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main' COMMENT '主线/支线 §4.3',
  `target_job_id` bigint DEFAULT NULL COMMENT '目标岗位',
  `path_data` json DEFAULT NULL COMMENT '阶段→技能点→资源 完整结构',
  `current_phase` int NOT NULL DEFAULT '0' COMMENT '当前阶段索引',
  `daily_hours` decimal(3,1) DEFAULT NULL COMMENT '本计划每日时长',
  `main_ratio` tinyint DEFAULT '80' COMMENT '主线占比 %',
  `match_score` decimal(5,2) DEFAULT NULL COMMENT '当前匹配度',
  `estimated_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '预计达成日期',
  `branch_from` bigint DEFAULT NULL COMMENT '分支来源计划ID（Git模型）§2.3',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=进行中 2=已完成 0=已归档',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `bound_agent_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ç»‘å®šçš„Agentç±»åž‹',
  `bound_agent_at` timestamp NULL DEFAULT NULL COMMENT 'Agentç»‘å®šæ—¶é—´',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_type` (`plan_type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `session_date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '日期 YYYY-MM-DD',
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
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`session_date`),
  KEY `idx_date` (`session_date`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `skill_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能名称',
  `task_type` enum('main','side') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main' COMMENT '主线/支线',
  `task_status` enum('pending','in_progress','lecture_done','practice_done','code_done','exam_done','skipped','done') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT '状态机',
  `estimated_min` int DEFAULT NULL COMMENT '预估时长(分钟)',
  `actual_min` int DEFAULT NULL COMMENT '实际时长(分钟)',
  `sort_order` int NOT NULL DEFAULT '0' COMMENT '排序（支持拖拽 §9.3）',
  `priority` tinyint NOT NULL DEFAULT '5' COMMENT '优先级1-10，10最高（用户可标记紧急）',
  `plan_date` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '安排在哪天 YYYY-MM-DD',
  `start_time` bigint DEFAULT NULL COMMENT '用户点击开始时间',
  `complete_time` bigint DEFAULT NULL COMMENT '完成时间',
  `is_active` tinyint NOT NULL DEFAULT '1' COMMENT '1=有效 0=删除',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=删除',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`plan_date`),
  KEY `idx_plan` (`plan_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `triggerEvent` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'è§¦å‘äº‹ä»¶',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT 'åˆ›å»ºæ—¶é—´',
  PRIMARY KEY (`id`),
  KEY `IDX_match_history_user_job` (`userId`,`jobId`),
  KEY `IDX_match_history_created` (`createdAt`)
) ENGINE=InnoDB AUTO_INCREMENT=1825 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `news_v3`
--

DROP TABLE IF EXISTS `news_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `summary` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'AI 生成摘要',
  `image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'industry/tech/recruit',
  `tags` json DEFAULT NULL COMMENT '技能标签 ["React","AI"]',
  `source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '0=下架 1=上架',
  `publish_time` bigint DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `type` enum('learning','progress','job','exam','system') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `link` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '点击跳转路径',
  `is_read` tinyint NOT NULL DEFAULT '0',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `status` tinyint DEFAULT '1' COMMENT '1=正常 0=删除',
  PRIMARY KEY (`id`),
  KEY `idx_user_read` (`user_id`,`is_read`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `action` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `module` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `create_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `version_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '如 v1-前端开发工程师',
  `is_base` tinyint NOT NULL DEFAULT '0' COMMENT '是否基础简历',
  `content` json DEFAULT NULL COMMENT '简历结构化内容',
  `html_content` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '简历 HTML（编辑/导出用）',
  `pdf_file_id` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `review_comment` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_version` (`user_id`,`version`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `skill_snapshots`
--

DROP TABLE IF EXISTS `skill_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_snapshots` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `commit_id` varchar(36) DEFAULT NULL COMMENT 'å…³è”çš„æŠ€èƒ½æäº¤ ID',
  `snapshot_type` enum('full','delta') NOT NULL DEFAULT 'full',
  `nodes_json` json DEFAULT NULL COMMENT 'å®Œæ•´å¿«ç…§ï¼šèŠ‚ç‚¹æ•°ç»„ï¼ˆä»… full ç±»åž‹ï¼‰',
  `edges_json` json DEFAULT NULL COMMENT 'å®Œæ•´å¿«ç…§ï¼šè¾¹æ•°ç»„ï¼ˆä»… full ç±»åž‹ï¼‰',
  `delta_json` json DEFAULT NULL COMMENT 'å¢žé‡å¿«ç…§ï¼šå˜æ›´æ“ä½œï¼ˆä»… delta ç±»åž‹ï¼‰',
  `overall_score` int NOT NULL DEFAULT '0' COMMENT 'ç»¼åˆè¯„åˆ†',
  `match_score` int NOT NULL DEFAULT '0' COMMENT 'åŒ¹é…åº¦è¯„åˆ†',
  `skill_count` int NOT NULL DEFAULT '0' COMMENT 'æŠ€èƒ½æ€»æ•°',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_user_type` (`user_id`,`snapshot_type`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='ç”¨æˆ·æŠ€èƒ½å›¾è°±å¿«ç…§ï¼ˆæ”¯æŒå®Œæ•´/å¢žé‡ä¸¤ç§æ¨¡å¼ï¼‰';
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
  `name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '学号',
  `school` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '学校',
  `major` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '专业',
  `grade` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '年级/毕业年份',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系方式',
  `email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '联系方式',
  `target_job_id` bigint DEFAULT NULL COMMENT '目标岗位 FK',
  `interests` json DEFAULT NULL COMMENT '兴趣方向 ["AI","前端"]',
  `skills` json DEFAULT NULL COMMENT '技能列表 [{name,level,source}] - 快速访问冗余',
  `projects` json DEFAULT NULL COMMENT '项目经历 - 快速访问冗余',
  `github_username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'GitHub 用户名',
  `work_experience` json DEFAULT NULL COMMENT '实习/工作经历',
  `awards` json DEFAULT NULL COMMENT '获奖/证书',
  `self_intro` text COLLATE utf8mb4_unicode_ci COMMENT '自我评价/个人简介',
  `daily_hours` decimal(3,1) DEFAULT NULL COMMENT '每日可投入学习时长(h)',
  `target_deadline` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '目标达成时间',
  `onboarding_completed` tinyint NOT NULL DEFAULT '0' COMMENT '0=未完成 1=已完成',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  KEY `idx_target_job` (`target_job_id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_config_v3`
--

DROP TABLE IF EXISTS `system_config_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_config_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `config_key` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `config_value` text COLLATE utf8mb4_unicode_ci,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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
  `skill_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '技能名称',
  `mastery_pct` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '掌握百分比 0-100 §6.2',
  `trust_weight` decimal(3,2) NOT NULL DEFAULT '0.30' COMMENT '信任权重 §6.1',
  `source` enum('self_report','conversation','github','exam') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'self_report' COMMENT '技能来源 §6.1',
  `last_activity` bigint DEFAULT NULL COMMENT '最后一次使用/学习时间戳',
  `decay_start` bigint DEFAULT NULL COMMENT '开始衰减时间（考试通过3个月后）',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=有效 0=归档',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_skill` (`user_id`,`skill_name`),
  KEY `idx_skill` (`skill_name`),
  KEY `idx_mastery` (`mastery_pct`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users_v3`
--

DROP TABLE IF EXISTS `users_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '登录名',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'bcrypt hash',
  `real_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '真实姓名',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','student') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '1=正常 0=禁用',
  `create_time` bigint DEFAULT NULL COMMENT '创建时间戳ms',
  `update_time` bigint DEFAULT NULL COMMENT '更新时间戳ms',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
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

-- Dump completed on 2026-06-24 19:33:00
