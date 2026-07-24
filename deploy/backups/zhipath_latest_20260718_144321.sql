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
  `agent_type` varchar(30) NOT NULL,
  `animal_type` varchar(20) NOT NULL,
  `color` varchar(10) NOT NULL,
  `nickname` varchar(20) NOT NULL,
  `display_role` varchar(30) NOT NULL,
  `station_id` int DEFAULT NULL,
  `agent_status` enum('idle','busy') DEFAULT 'idle',
  `status` tinyint DEFAULT '1',
  `create_time` bigint NOT NULL DEFAULT '0',
  `update_time` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`,`status`),
  KEY `idx_user_station` (`user_id`,`station_id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_profiles_v3`
--

LOCK TABLES `agent_profiles_v3` WRITE;
/*!40000 ALTER TABLE `agent_profiles_v3` DISABLE KEYS */;
INSERT INTO `agent_profiles_v3` VALUES (13,29,'lecture','cat','#f9d27c','小喵','讲义专家',1,'idle',1,1784346659339,1784346659339),(14,29,'reading','dog','#c9daf5','旺财','阅读向导',2,'idle',1,1784346659339,1784346659339),(15,29,'code','fox','#e5d5f5','小狐','代码大师',3,'idle',1,1784346659339,1784346659339),(16,29,'path','panda','#c9f5c0','团子','路径规划',NULL,'idle',1,1784346659339,1784346659339),(17,29,'assess','owl','#ffd5c9','咕咕','评估官',NULL,'idle',1,1784346659339,1784346659339);
/*!40000 ALTER TABLE `agent_profiles_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `agent_tasks_v3`
--

DROP TABLE IF EXISTS `agent_tasks_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `agent_tasks_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `agent_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `params` json DEFAULT NULL,
  `task_status` enum('pending','running','success','failed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `progress` int NOT NULL DEFAULT '0',
  `result` json DEFAULT NULL,
  `error_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `is_urgent` tinyint NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `group_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_external_id` (`external_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_agent_type` (`agent_type`),
  KEY `idx_task_status` (`task_status`)
) ENGINE=InnoDB AUTO_INCREMENT=132 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agent_tasks_v3`
--

LOCK TABLES `agent_tasks_v3` WRITE;
/*!40000 ALTER TABLE `agent_tasks_v3` DISABLE KEYS */;
INSERT INTO `agent_tasks_v3` VALUES (129,29,'reading','Smoke resource ledger task','deployment smoke test','{\"skillName\": \"SmokeSkill\"}','failed',30,NULL,'404 model \'qwen2.5:7b\' not found',0,1,NULL,NULL,1784345071868,1784345071952,1,1784345071835,1784345071952),(130,29,'reading','Smoke resource ledger task after chroma fix','verify generated resource persistence from agent office','{\"skillName\": \"SmokeSkill\"}','failed',30,NULL,'404 model \'qwen2.5:7b\' not found',0,2,NULL,NULL,1784345727895,1784345727947,1,1784345727862,1784345727947),(131,29,'reading','DeepSeek smoke resource task','verify DeepSeek provider for agent office','{\"skillName\": \"HTTP\"}','success',100,'{\"items\": [{\"type\": \"why\", \"title\": \"为什么 HTTP 要设计成无状态协议？\", \"content\": \"上个月我帮朋友排查一个奇怪的 Bug：他在电商网站登录后，刷新页面就变成了未登录状态。明明登录接口返回了 200，为什么一刷新就丢了身份？这个问题最终指向了 HTTP 最基础的设计哲学——无状态。\\n\\nHTTP 协议在设计之初就刻意避免\\\"记住\\\"客户端的状态。简单来说，服务器不会为每个请求保留上下文，每个请求都是独立的。这意味着即使你 1 秒前刚发了一个登录请求，紧随其后的购物车请求也不会自动携带身份信息。这听起来很反直觉，甚至给开发者带来了不少麻烦，但正是这个决定让 HTTP 在 30 多年里撑起了整个 Web。\\n\\n无状态的第一个好处是简单。一个请求进来，服务器只需要解析报文、找到资源、返回响应，不需要维护会话表，不需要处理超时清理。这种模型让任何人都能用几行代码写出一个 HTTP 服务器——你甚至可以对着 RFC 7230 手写一个。同时，因为请求之间没有依赖，服务器可以水平缩放到几百台，负载均衡器可以随机分发请求，而不必担心用户被\\\"粘\\\"在某台机器上。1990 年代 Web 爆发时，这种架构让雅虎、亚马逊能快速扩展。\\n\\n但问题也随之而来：电商需要记住用户的购物车，社交网络需要记住你是谁。于是开发者们在无状态的地基上搭建了有状态的\\\"上层建筑\\\"。最经典的方案是 Cookie + Session：服务器在登录成功后生成一个 Session ID，通过 Set-Cookie 种在浏览器里；后续请求自动带上 Cookie，服务器再查 Session 表找到用户信息。这本质上是把状态从协议层移到了应用层。后来为了更好的水平扩展，JWT（JSON Web Token）出现了，它将用户信息编码成自包含的令牌，服务器不需要存储任何东西，只需要验签名就能获取用户身份——这又是一次向无状态的回归。\\n\\n这也解释了为什么 RESTful 架构强调\\\"自描述的消息\\\"：每个请求应该包含足够的信息让服务器理解意图，而不依赖于之前的请求。当你的 API 做到了真正的无状态，你会发现缓存、重试、灰度发布都变得异常简单。\\n\\n无状态不是缺陷，而是一个精妙的约束。它迫使我们将复杂性推向更高的抽象层，在需要状态的地方用可插拔的方案解决，而不是让协议本身负重前行。但当我们享受 WebSocket 带来的全双工连接、HTTP/3 基于 QUIC 的持久化时，不禁要问：在连接本身就携带状态的今天，无状态的坚持是否需要重新审视？或许未来，我们会重新定义\\\"请求独立\\\"的边界。\", \"readTime\": \"5 min\", \"questions\": [\"如果 HTTP 从一开始就是有状态的，Web 的架构会有什么不同？\", \"JWT 虽然避免了服务端存储，但带来了哪些新的安全隐患？\", \"WebSocket 如何在无状态 HTTP 上建立有状态的连接？这算不算对无状态原则的绕过？\"], \"difficulty\": \"basic\", \"keyConcepts\": [\"HTTP无状态特性\", \"Cookie与Session机制\", \"JWT自包含令牌\", \"水平扩展与负载均衡\"], \"relatedTopics\": [\"Session管理策略\", \"RESTful API设计原则\"]}, {\"type\": \"practice\", \"title\": \"从零写一个 HTTP 服务器：理解请求与响应的本质\", \"content\": \"有一次面试，我问候选人：\\\"当你用 Express 写 app.get(\'/hello\') 时，背后发生了什么？\\\"大部分人只能说出\\\"框架处理了路由和中间件\\\"，但当我追问\\\"底层怎么接收数据、怎么解析 HTTP 报文\\\"时，多数人沉默了。今天我们就抛开所有框架，用 Node.js 的 net 模块从零实现一个能解析请求、返回响应的 HTTP 服务器，揭开抽象层下面的真相。\\n\\n我们从一个 TCP 服务器开始。Node.js 的 net.createServer 会在每次有客户端连接时触发 callback，传入一个 socket 对象。HTTP 就是跑在 TCP 上面的文本协议，所以我们要监听 socket 的 data 事件，拿到原始的字节流。你可以把它打印出来看看，大概是这样的：\\n\\nGET /hello HTTP/1.1\\r\\nHost: localhost:3000\\r\\nConnection: keep-alive\\r\\n\\r\\n\\n这就是一个 HTTP 请求报文。第一行是\\\"请求行\\\"，包含方法、路径和协议版本；接着是若干行头部，每行一个键值对；直到一个空行（\\\\r\\\\n\\\\r\\\\n）表示头部结束。暂时忽略 body（GET 请求没有），我们先用字符串分割来解析这些内容。\\n\\n解析出方法、路径后，我们就可以实现一个最简路由。比如当路径是 \'/\' 时返回一段 HTML，否则返回 \'Not Found\'。关键是要构造一个合法的 HTTP 响应报文。响应第一行是状态行，如 HTTP/1.1 200 OK，后面是响应头，再空行后是响应体。Content-Length 头必须准确，否则浏览器会挂起。我们手动拼接字符串：\\n\\nHTTP/1.1 200 OK\\r\\nContent-Type: text/html; charset=UTF-8\\r\\nContent-Length: 27\\r\\n\\r\\n<h1>Hello from scratch</h1>\\n\\n用 socket.write 发出去，浏览器就能正确渲染。你还可以进一步处理 POST 请求，读取 body（根据 Content-Length 从 data 事件中拼接 Buffer），解析 JSON，再返回业务结果。\\n\\n完成了这些，你再看 Express 或 Koa，会发现它们做的无非是：把报文解析封装成 request 和 response 对象，用中间件链处理逻辑，最后调用 writeHead 和 end 方法把响应写回 socket。所谓的\\\"路由\\\"本质上是一个映射表，匹配路径后调用对应的回调。\\\"中间件\\\"则是一个个函数，在请求和响应之间形成洋葱模型。\\n\\n当你能手写一个最小化服务器时，你才真正理解了什么叫做\\\"框架只是便利工具\\\"。下次遇到诡异的超时、连接重置或头解析错误时，你就不会只依赖框架的文档，而是能沉到 TCP 流的层面去诊断问题。不妨思考一下：如果要支持大文件流式传输，或者实现 HTTP/2 的多路复用，你设计的服务器需要做什么根本性的改变？\", \"readTime\": \"7 min\", \"questions\": [\"为什么 HTTP 协议选择用 \\\\r\\\\n 作为换行符，而不是单独 \\\\n？\", \"如果 Content-Length 小于实际 body 长度会发生什么？浏览器会如何处理？\", \"你自己实现的服务器如何处理客户端的一次连接发送多个 HTTP 请求（HTTP keep-alive）？\"], \"difficulty\": \"basic\", \"keyConcepts\": [\"TCP数据流\", \"HTTP请求报文格式\", \"Content-Length的作用\", \"路由与中间件原理\"], \"relatedTopics\": [\"Node.js net模块\", \"Web框架设计模式\"]}, {\"type\": \"deep\", \"title\": \"浏览器缓存背后的 HTTP 头：从 ETag 到 Cache-Control\", \"content\": \"刚上线的新版首页，运营频繁更新文案，但测试却总是看到旧内容。清了浏览器缓存就好，但用户不会这么干。这个典型的\\\"缓存脏数据\\\"问题，根源在于开发者对 HTTP 缓存头似懂非懂。HTTP 缓存是一套精密的时间与验证机制，用好它能让页面秒开，用错则让用户看到过期信息。\\n\\nHTTP 缓存分成两种：强缓存和协商缓存。强缓存直接告诉浏览器：\\\"这个资源在某个时间之前不要来问我\\\"，协商缓存则是：\\\"你可以用本地缓存，但先问问我它有没有变\\\"。\\n\\n强缓存由 Expires 和 Cache-Control 头控制。Expires 是一个绝对时间，比如 Expires: Wed, 21 Oct 2023 07:28:00 GMT，浏览器对比本地时间，没到期就用缓存。但本地时间可能不准确，于是有了 Cache-Control 的 max-age，它指定了资源从请求时刻开始能存活多少秒，这更可靠。Cache-Control 还提供了精细选项：no-cache 不是不缓存，而是强制每次使用前做协商验证；no-store 则绝对不缓存；public 允许 CDN 等中间节点缓存，private 仅限浏览器。\\n\\n协商缓存依赖两套验证码：Last-Modified/If-Modified-Since 和 ETag/If-None-Match。服务器在响应中带上 Last-Modified（最后修改时间），浏览器下次请求时自动带 If-Modified-Since，服务器比较时间，如果文件没变返回 304 Not Modified。但时间精度只到秒，且有时内容变了修改时间不变（比如从 CDN 回源），所以更推荐 ETag。ETag 是资源的唯一标识，可以基于内容哈希生成。请求时带上 If-None-Match: \\\"abc123\\\"，服务器对比，若匹配返回 304。\\n\\n实际开发中，我们通常在构建时为静态资源文件名加上哈希，比如 app.3e5a1c.js，同时设置 Cache-Control: public, max-age=31536000（一年）。这样只要文件内容不变，URL 有效期内都可以无网络请求直接加载。当内容更新，哈希变化，URL 变了，浏览器会当成新资源请求。这就是\\\"代理缓存+文件名哈希\\\"的最佳实践。对于 HTML 文档这种动态页面，通常设置 Cache-Control: no-cache，每次都协商验证，保证用户常看到最新版本。\\n\\n理解这套机制后，你可以清楚地知道在 Nginx 或 CDN 上如何为不同类型的资源配置缓存策略，也能轻松定位为什么页面发布后客户端迟迟不生效。最后留一个有意思的问题：当服务器同时返回了 ETag 和 Last-Modified，并且两者都用于协商，浏览器会发出一个请求带两个条件头吗？服务器收到后，应该先检查哪个才算真正符合标准？\", \"readTime\": \"7 min\", \"questions\": [\"如果服务器只返回了 Last-Modified，没有 ETag，并且文件一秒内被改变两次，会出现什么问题？\", \"为什么 Cache-Control: no-cache 需要配合 ETag 或 Last-Modified 才有意义？\", \"在微服务架构中，不同服务返回不一致的缓存头会导致浏览器什么行为？\"], \"difficulty\": \"intermediate\", \"keyConcepts\": [\"强缓存与协商缓存\", \"Cache-Control细节\", \"ETag生成策略\", \"304 Not Modified\"], \"relatedTopics\": [\"CDN缓存策略\", \"Service Worker缓存\", \"哈希化资源持久化\"]}], \"skill\": \"HTTP\", \"totalItems\": 3, \"studyAdvice\": \"\"}',NULL,0,3,NULL,NULL,1784346162070,1784346239207,1,1784346162036,1784346239207);
/*!40000 ALTER TABLE `agent_tasks_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `course_abilities_v3`
--

LOCK TABLES `course_abilities_v3` WRITE;
/*!40000 ALTER TABLE `course_abilities_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `course_abilities_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
-- Dumping data for table `course_chapters_v3`
--

LOCK TABLES `course_chapters_v3` WRITE;
/*!40000 ALTER TABLE `course_chapters_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `course_chapters_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enterprises_v3`
--

DROP TABLE IF EXISTS `enterprises_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enterprises_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `industry` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enterprises_v3`
--

LOCK TABLES `enterprises_v3` WRITE;
/*!40000 ALTER TABLE `enterprises_v3` DISABLE KEYS */;
INSERT INTO `enterprises_v3` VALUES (1,'字节跳动','互联网','hr@bytedance.com','王HR','010-12345678',1,1781163995000,1781163995000),(2,'腾讯','互联网','hr@tencent.com','李HR','0755-12345678',1,1781163995000,1781163995000),(3,'阿里巴巴','互联网','hr@alibaba.com','赵HR','0571-12345678',1,1781163995000,1781163995000),(4,'百度','互联网','hr@baidu.com','孙HR','010-87654321',1,1781163995000,1781163995000),(5,'美团','互联网','hr@meituan.com','周HR','010-11111111',1,1781163995000,1781163995000);
/*!40000 ALTER TABLE `enterprises_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `attempt_type` enum('progress_read','progress_quiz','progress_code','skill_complete','quick_test','exam','ai_assessment','chat_resource','manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `source_type` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skill_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goal` varchar(240) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempt_status` enum('started','graded','committed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'started',
  `rubric_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default_skill_v1',
  `rubric_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0.0',
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `metadata_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_evaluation_attempts_user_type` (`user_id`,`attempt_type`),
  KEY `idx_evaluation_attempts_user_skill` (`user_id`,`skill_name`),
  KEY `idx_evaluation_attempts_source` (`source_type`,`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `evaluation_attempts_v3`
--

LOCK TABLES `evaluation_attempts_v3` WRITE;
/*!40000 ALTER TABLE `evaluation_attempts_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `evaluation_attempts_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `dimension_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dimension_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `max_score` decimal(6,2) NOT NULL DEFAULT '100.00',
  `normalized_score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `weight` decimal(5,2) NOT NULL DEFAULT '1.00',
  `trend` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'stable',
  `detail` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evidence_refs_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_evaluation_dimension_user_attempt` (`user_id`,`attempt_id`),
  KEY `idx_evaluation_dimension_result` (`result_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `evaluation_dimension_scores_v3`
--

LOCK TABLES `evaluation_dimension_scores_v3` WRITE;
/*!40000 ALTER TABLE `evaluation_dimension_scores_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `evaluation_dimension_scores_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `evidence_type` enum('learning_action','quiz_answer','exam_answer','code','conversation','resource','project','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `source_type` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `skill_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_evaluation_evidence_user_attempt` (`user_id`,`attempt_id`),
  KEY `idx_evaluation_evidence_source` (`source_type`,`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `evaluation_evidence_v3`
--

LOCK TABLES `evaluation_evidence_v3` WRITE;
/*!40000 ALTER TABLE `evaluation_evidence_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `evaluation_evidence_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id`),
  KEY `idx_evaluation_impacts_user_attempt` (`user_id`,`attempt_id`),
  KEY `idx_evaluation_impacts_commit` (`commit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `evaluation_impacts_v3`
--

LOCK TABLES `evaluation_impacts_v3` WRITE;
/*!40000 ALTER TABLE `evaluation_impacts_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `evaluation_impacts_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `skill_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evaluator_type` enum('objective','llm','hybrid','system') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `evaluator_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `max_score` decimal(6,2) NOT NULL DEFAULT '100.00',
  `normalized_score` decimal(6,2) NOT NULL DEFAULT '0.00',
  `level` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `passed` tinyint DEFAULT NULL,
  `confidence` decimal(4,2) NOT NULL DEFAULT '0.70',
  `summary` varchar(600) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `feedback_json` json DEFAULT NULL,
  `raw_result_json` json DEFAULT NULL,
  `rubric_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default_skill_v1',
  `rubric_version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0.0',
  PRIMARY KEY (`id`),
  KEY `idx_evaluation_results_user_attempt` (`user_id`,`attempt_id`),
  KEY `idx_evaluation_results_user_skill` (`user_id`,`skill_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `evaluation_results_v3`
--

LOCK TABLES `evaluation_results_v3` WRITE;
/*!40000 ALTER TABLE `evaluation_results_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `evaluation_results_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `rubric_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0.0',
  `target_type` enum('skill','radar_dimension','job_match','learning_action','project') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'skill',
  `pass_score` int NOT NULL DEFAULT '70',
  `dimensions_json` json DEFAULT NULL,
  `weights_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_evaluation_rubric_key_version` (`rubric_key`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `evaluation_rubrics_v3`
--

LOCK TABLES `evaluation_rubrics_v3` WRITE;
/*!40000 ALTER TABLE `evaluation_rubrics_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `evaluation_rubrics_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `exam_questions_v3`
--

DROP TABLE IF EXISTS `exam_questions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `exam_questions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `exam_type` tinyint NOT NULL,
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_id` bigint DEFAULT NULL,
  `question_type` enum('choice','fill','coding','essay') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` json NOT NULL,
  `answer` json DEFAULT NULL,
  `difficulty` tinyint NOT NULL DEFAULT '1',
  `confidence_score` decimal(3,2) DEFAULT NULL,
  `pass_rate` decimal(5,2) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '0',
  `created_by` enum('agent','manual','enterprise') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'agent',
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
-- Dumping data for table `exam_questions_v3`
--

LOCK TABLES `exam_questions_v3` WRITE;
/*!40000 ALTER TABLE `exam_questions_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `exam_questions_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `question_ids` json DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `passed` tinyint DEFAULT NULL,
  `answers` json DEFAULT NULL,
  `wrong_analysis` json DEFAULT NULL,
  `retry_count` int NOT NULL DEFAULT '0',
  `next_retry_time` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_exam_type` (`exam_type`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `exam_records_v3`
--

LOCK TABLES `exam_records_v3` WRITE;
/*!40000 ALTER TABLE `exam_records_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `exam_records_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `generated_resources_v3`
--

DROP TABLE IF EXISTS `generated_resources_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `generated_resources_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_generated_external_id` (`external_id`),
  KEY `idx_generated_user_time` (`user_id`,`update_time`),
  KEY `idx_generated_user_session` (`user_id`,`chat_session_id`),
  KEY `idx_generated_source_task` (`source_task_id`),
  KEY `idx_generated_type_status` (`resource_type`,`resource_status`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `generated_resources_v3`
--

LOCK TABLES `generated_resources_v3` WRITE;
/*!40000 ALTER TABLE `generated_resources_v3` DISABLE KEYS */;
INSERT INTO `generated_resources_v3` VALUES (1,29,'reading','Smoke resource ledger task','SmokeSkill','agent_office',129,'agent-task:129',NULL,NULL,'reading','failed','{\"message\": \"404 model \'qwen2.5:7b\' not found\"}','{\"progress\": 30, \"actionKey\": \"task:129\", \"actionType\": \"error\"}',NULL,'{\"skillName\": \"SmokeSkill\"}',NULL,0,0.0000,NULL,'404 model \'qwen2.5:7b\' not found',1,1784345071850,1784345071980),(2,29,'reading','Smoke resource ledger task after chroma fix','SmokeSkill','agent_office',130,'agent-task:130',NULL,NULL,'reading','failed','{\"message\": \"404 model \'qwen2.5:7b\' not found\"}','{\"progress\": 30, \"actionKey\": \"task:130\", \"actionType\": \"error\"}',NULL,'{\"skillName\": \"SmokeSkill\"}',NULL,0,0.0000,NULL,'404 model \'qwen2.5:7b\' not found',1,1784345727876,1784345727953),(3,29,'reading','DeepSeek smoke resource task','HTTP','agent_office',131,'agent-task:131',NULL,NULL,'reading','success','{\"items\": [{\"type\": \"why\", \"title\": \"为什么 HTTP 要设计成无状态协议？\", \"content\": \"上个月我帮朋友排查一个奇怪的 Bug：他在电商网站登录后，刷新页面就变成了未登录状态。明明登录接口返回了 200，为什么一刷新就丢了身份？这个问题最终指向了 HTTP 最基础的设计哲学——无状态。\\n\\nHTTP 协议在设计之初就刻意避免\\\"记住\\\"客户端的状态。简单来说，服务器不会为每个请求保留上下文，每个请求都是独立的。这意味着即使你 1 秒前刚发了一个登录请求，紧随其后的购物车请求也不会自动携带身份信息。这听起来很反直觉，甚至给开发者带来了不少麻烦，但正是这个决定让 HTTP 在 30 多年里撑起了整个 Web。\\n\\n无状态的第一个好处是简单。一个请求进来，服务器只需要解析报文、找到资源、返回响应，不需要维护会话表，不需要处理超时清理。这种模型让任何人都能用几行代码写出一个 HTTP 服务器——你甚至可以对着 RFC 7230 手写一个。同时，因为请求之间没有依赖，服务器可以水平缩放到几百台，负载均衡器可以随机分发请求，而不必担心用户被\\\"粘\\\"在某台机器上。1990 年代 Web 爆发时，这种架构让雅虎、亚马逊能快速扩展。\\n\\n但问题也随之而来：电商需要记住用户的购物车，社交网络需要记住你是谁。于是开发者们在无状态的地基上搭建了有状态的\\\"上层建筑\\\"。最经典的方案是 Cookie + Session：服务器在登录成功后生成一个 Session ID，通过 Set-Cookie 种在浏览器里；后续请求自动带上 Cookie，服务器再查 Session 表找到用户信息。这本质上是把状态从协议层移到了应用层。后来为了更好的水平扩展，JWT（JSON Web Token）出现了，它将用户信息编码成自包含的令牌，服务器不需要存储任何东西，只需要验签名就能获取用户身份——这又是一次向无状态的回归。\\n\\n这也解释了为什么 RESTful 架构强调\\\"自描述的消息\\\"：每个请求应该包含足够的信息让服务器理解意图，而不依赖于之前的请求。当你的 API 做到了真正的无状态，你会发现缓存、重试、灰度发布都变得异常简单。\\n\\n无状态不是缺陷，而是一个精妙的约束。它迫使我们将复杂性推向更高的抽象层，在需要状态的地方用可插拔的方案解决，而不是让协议本身负重前行。但当我们享受 WebSocket 带来的全双工连接、HTTP/3 基于 QUIC 的持久化时，不禁要问：在连接本身就携带状态的今天，无状态的坚持是否需要重新审视？或许未来，我们会重新定义\\\"请求独立\\\"的边界。\", \"readTime\": \"5 min\", \"questions\": [\"如果 HTTP 从一开始就是有状态的，Web 的架构会有什么不同？\", \"JWT 虽然避免了服务端存储，但带来了哪些新的安全隐患？\", \"WebSocket 如何在无状态 HTTP 上建立有状态的连接？这算不算对无状态原则的绕过？\"], \"difficulty\": \"basic\", \"keyConcepts\": [\"HTTP无状态特性\", \"Cookie与Session机制\", \"JWT自包含令牌\", \"水平扩展与负载均衡\"], \"relatedTopics\": [\"Session管理策略\", \"RESTful API设计原则\"]}, {\"type\": \"practice\", \"title\": \"从零写一个 HTTP 服务器：理解请求与响应的本质\", \"content\": \"有一次面试，我问候选人：\\\"当你用 Express 写 app.get(\'/hello\') 时，背后发生了什么？\\\"大部分人只能说出\\\"框架处理了路由和中间件\\\"，但当我追问\\\"底层怎么接收数据、怎么解析 HTTP 报文\\\"时，多数人沉默了。今天我们就抛开所有框架，用 Node.js 的 net 模块从零实现一个能解析请求、返回响应的 HTTP 服务器，揭开抽象层下面的真相。\\n\\n我们从一个 TCP 服务器开始。Node.js 的 net.createServer 会在每次有客户端连接时触发 callback，传入一个 socket 对象。HTTP 就是跑在 TCP 上面的文本协议，所以我们要监听 socket 的 data 事件，拿到原始的字节流。你可以把它打印出来看看，大概是这样的：\\n\\nGET /hello HTTP/1.1\\r\\nHost: localhost:3000\\r\\nConnection: keep-alive\\r\\n\\r\\n\\n这就是一个 HTTP 请求报文。第一行是\\\"请求行\\\"，包含方法、路径和协议版本；接着是若干行头部，每行一个键值对；直到一个空行（\\\\r\\\\n\\\\r\\\\n）表示头部结束。暂时忽略 body（GET 请求没有），我们先用字符串分割来解析这些内容。\\n\\n解析出方法、路径后，我们就可以实现一个最简路由。比如当路径是 \'/\' 时返回一段 HTML，否则返回 \'Not Found\'。关键是要构造一个合法的 HTTP 响应报文。响应第一行是状态行，如 HTTP/1.1 200 OK，后面是响应头，再空行后是响应体。Content-Length 头必须准确，否则浏览器会挂起。我们手动拼接字符串：\\n\\nHTTP/1.1 200 OK\\r\\nContent-Type: text/html; charset=UTF-8\\r\\nContent-Length: 27\\r\\n\\r\\n<h1>Hello from scratch</h1>\\n\\n用 socket.write 发出去，浏览器就能正确渲染。你还可以进一步处理 POST 请求，读取 body（根据 Content-Length 从 data 事件中拼接 Buffer），解析 JSON，再返回业务结果。\\n\\n完成了这些，你再看 Express 或 Koa，会发现它们做的无非是：把报文解析封装成 request 和 response 对象，用中间件链处理逻辑，最后调用 writeHead 和 end 方法把响应写回 socket。所谓的\\\"路由\\\"本质上是一个映射表，匹配路径后调用对应的回调。\\\"中间件\\\"则是一个个函数，在请求和响应之间形成洋葱模型。\\n\\n当你能手写一个最小化服务器时，你才真正理解了什么叫做\\\"框架只是便利工具\\\"。下次遇到诡异的超时、连接重置或头解析错误时，你就不会只依赖框架的文档，而是能沉到 TCP 流的层面去诊断问题。不妨思考一下：如果要支持大文件流式传输，或者实现 HTTP/2 的多路复用，你设计的服务器需要做什么根本性的改变？\", \"readTime\": \"7 min\", \"questions\": [\"为什么 HTTP 协议选择用 \\\\r\\\\n 作为换行符，而不是单独 \\\\n？\", \"如果 Content-Length 小于实际 body 长度会发生什么？浏览器会如何处理？\", \"你自己实现的服务器如何处理客户端的一次连接发送多个 HTTP 请求（HTTP keep-alive）？\"], \"difficulty\": \"basic\", \"keyConcepts\": [\"TCP数据流\", \"HTTP请求报文格式\", \"Content-Length的作用\", \"路由与中间件原理\"], \"relatedTopics\": [\"Node.js net模块\", \"Web框架设计模式\"]}, {\"type\": \"deep\", \"title\": \"浏览器缓存背后的 HTTP 头：从 ETag 到 Cache-Control\", \"content\": \"刚上线的新版首页，运营频繁更新文案，但测试却总是看到旧内容。清了浏览器缓存就好，但用户不会这么干。这个典型的\\\"缓存脏数据\\\"问题，根源在于开发者对 HTTP 缓存头似懂非懂。HTTP 缓存是一套精密的时间与验证机制，用好它能让页面秒开，用错则让用户看到过期信息。\\n\\nHTTP 缓存分成两种：强缓存和协商缓存。强缓存直接告诉浏览器：\\\"这个资源在某个时间之前不要来问我\\\"，协商缓存则是：\\\"你可以用本地缓存，但先问问我它有没有变\\\"。\\n\\n强缓存由 Expires 和 Cache-Control 头控制。Expires 是一个绝对时间，比如 Expires: Wed, 21 Oct 2023 07:28:00 GMT，浏览器对比本地时间，没到期就用缓存。但本地时间可能不准确，于是有了 Cache-Control 的 max-age，它指定了资源从请求时刻开始能存活多少秒，这更可靠。Cache-Control 还提供了精细选项：no-cache 不是不缓存，而是强制每次使用前做协商验证；no-store 则绝对不缓存；public 允许 CDN 等中间节点缓存，private 仅限浏览器。\\n\\n协商缓存依赖两套验证码：Last-Modified/If-Modified-Since 和 ETag/If-None-Match。服务器在响应中带上 Last-Modified（最后修改时间），浏览器下次请求时自动带 If-Modified-Since，服务器比较时间，如果文件没变返回 304 Not Modified。但时间精度只到秒，且有时内容变了修改时间不变（比如从 CDN 回源），所以更推荐 ETag。ETag 是资源的唯一标识，可以基于内容哈希生成。请求时带上 If-None-Match: \\\"abc123\\\"，服务器对比，若匹配返回 304。\\n\\n实际开发中，我们通常在构建时为静态资源文件名加上哈希，比如 app.3e5a1c.js，同时设置 Cache-Control: public, max-age=31536000（一年）。这样只要文件内容不变，URL 有效期内都可以无网络请求直接加载。当内容更新，哈希变化，URL 变了，浏览器会当成新资源请求。这就是\\\"代理缓存+文件名哈希\\\"的最佳实践。对于 HTML 文档这种动态页面，通常设置 Cache-Control: no-cache，每次都协商验证，保证用户常看到最新版本。\\n\\n理解这套机制后，你可以清楚地知道在 Nginx 或 CDN 上如何为不同类型的资源配置缓存策略，也能轻松定位为什么页面发布后客户端迟迟不生效。最后留一个有意思的问题：当服务器同时返回了 ETag 和 Last-Modified，并且两者都用于协商，浏览器会发出一个请求带两个条件头吗？服务器收到后，应该先检查哪个才算真正符合标准？\", \"readTime\": \"7 min\", \"questions\": [\"如果服务器只返回了 Last-Modified，没有 ETag，并且文件一秒内被改变两次，会出现什么问题？\", \"为什么 Cache-Control: no-cache 需要配合 ETag 或 Last-Modified 才有意义？\", \"在微服务架构中，不同服务返回不一致的缓存头会导致浏览器什么行为？\"], \"difficulty\": \"intermediate\", \"keyConcepts\": [\"强缓存与协商缓存\", \"Cache-Control细节\", \"ETag生成策略\", \"304 Not Modified\"], \"relatedTopics\": [\"CDN缓存策略\", \"Service Worker缓存\", \"哈希化资源持久化\"]}], \"skill\": \"HTTP\", \"totalItems\": 3, \"studyAdvice\": \"\"}','{\"progress\": 100, \"actionKey\": \"task:131\", \"actionType\": \"resources\"}',NULL,'{\"skillName\": \"HTTP\"}','{\"items\": [{\"type\": \"why\", \"title\": \"为什么 HTTP 要设计成无状态协议？\", \"content\": \"上个月我帮朋友排查一个奇怪的 Bug：他在电商网站登录后，刷新页面就变成了未登录状态。明明登录接口返回了 200，为什么一刷新就丢了身份？这个问题最终指向了 HTTP 最基础的设计哲学——无状态。\\n\\nHTTP 协议在设计之初就刻意避免\\\"记住\\\"客户端的状态。简单来说，服务器不会为每个请求保留上下文，每个请求都是独立的。这意味着即使你 1 秒前刚发了一个登录请求，紧随其后的购物车请求也不会自动携带身份信息。这听起来很反直觉，甚至给开发者带来了不少麻烦，但正是这个决定让 HTTP 在 30 多年里撑起了整个 Web。\\n\\n无状态的第一个好处是简单。一个请求进来，服务器只需要解析报文、找到资源、返回响应，不需要维护会话表，不需要处理超时清理。这种模型让任何人都能用几行代码写出一个 HTTP 服务器——你甚至可以对着 RFC 7230 手写一个。同时，因为请求之间没有依赖，服务器可以水平缩放到几百台，负载均衡器可以随机分发请求，而不必担心用户被\\\"粘\\\"在某台机器上。1990 年代 Web 爆发时，这种架构让雅虎、亚马逊能快速扩展。\\n\\n但问题也随之而来：电商需要记住用户的购物车，社交网络需要记住你是谁。于是开发者们在无状态的地基上搭建了有状态的\\\"上层建筑\\\"。最经典的方案是 Cookie + Session：服务器在登录成功后生成一个 Session ID，通过 Set-Cookie 种在浏览器里；后续请求自动带上 Cookie，服务器再查 Session 表找到用户信息。这本质上是把状态从协议层移到了应用层。后来为了更好的水平扩展，JWT（JSON Web Token）出现了，它将用户信息编码成自包含的令牌，服务器不需要存储任何东西，只需要验签名就能获取用户身份——这又是一次向无状态的回归。\\n\\n这也解释了为什么 RESTful 架构强调\\\"自描述的消息\\\"：每个请求应该包含足够的信息让服务器理解意图，而不依赖于之前的请求。当你的 API 做到了真正的无状态，你会发现缓存、重试、灰度发布都变得异常简单。\\n\\n无状态不是缺陷，而是一个精妙的约束。它迫使我们将复杂性推向更高的抽象层，在需要状态的地方用可插拔的方案解决，而不是让协议本身负重前行。但当我们享受 WebSocket 带来的全双工连接、HTTP/3 基于 QUIC 的持久化时，不禁要问：在连接本身就携带状态的今天，无状态的坚持是否需要重新审视？或许未来，我们会重新定义\\\"请求独立\\\"的边界。\", \"readTime\": \"5 min\", \"questions\": [\"如果 HTTP 从一开始就是有状态的，Web 的架构会有什么不同？\", \"JWT 虽然避免了服务端存储，但带来了哪些新的安全隐患？\", \"WebSocket 如何在无状态 HTTP 上建立有状态的连接？这算不算对无状态原则的绕过？\"], \"difficulty\": \"basic\", \"keyConcepts\": [\"HTTP无状态特性\", \"Cookie与Session机制\", \"JWT自包含令牌\", \"水平扩展与负载均衡\"], \"relatedTopics\": [\"Session管理策略\", \"RESTful API设计原则\"]}, {\"type\": \"practice\", \"title\": \"从零写一个 HTTP 服务器：理解请求与响应的本质\", \"content\": \"有一次面试，我问候选人：\\\"当你用 Express 写 app.get(\'/hello\') 时，背后发生了什么？\\\"大部分人只能说出\\\"框架处理了路由和中间件\\\"，但当我追问\\\"底层怎么接收数据、怎么解析 HTTP 报文\\\"时，多数人沉默了。今天我们就抛开所有框架，用 Node.js 的 net 模块从零实现一个能解析请求、返回响应的 HTTP 服务器，揭开抽象层下面的真相。\\n\\n我们从一个 TCP 服务器开始。Node.js 的 net.createServer 会在每次有客户端连接时触发 callback，传入一个 socket 对象。HTTP 就是跑在 TCP 上面的文本协议，所以我们要监听 socket 的 data 事件，拿到原始的字节流。你可以把它打印出来看看，大概是这样的：\\n\\nGET /hello HTTP/1.1\\r\\nHost: localhost:3000\\r\\nConnection: keep-alive\\r\\n\\r\\n\\n这就是一个 HTTP 请求报文。第一行是\\\"请求行\\\"，包含方法、路径和协议版本；接着是若干行头部，每行一个键值对；直到一个空行（\\\\r\\\\n\\\\r\\\\n）表示头部结束。暂时忽略 body（GET 请求没有），我们先用字符串分割来解析这些内容。\\n\\n解析出方法、路径后，我们就可以实现一个最简路由。比如当路径是 \'/\' 时返回一段 HTML，否则返回 \'Not Found\'。关键是要构造一个合法的 HTTP 响应报文。响应第一行是状态行，如 HTTP/1.1 200 OK，后面是响应头，再空行后是响应体。Content-Length 头必须准确，否则浏览器会挂起。我们手动拼接字符串：\\n\\nHTTP/1.1 200 OK\\r\\nContent-Type: text/html; charset=UTF-8\\r\\nContent-Length: 27\\r\\n\\r\\n<h1>Hello from scratch</h1>\\n\\n用 socket.write 发出去，浏览器就能正确渲染。你还可以进一步处理 POST 请求，读取 body（根据 Content-Length 从 data 事件中拼接 Buffer），解析 JSON，再返回业务结果。\\n\\n完成了这些，你再看 Express 或 Koa，会发现它们做的无非是：把报文解析封装成 request 和 response 对象，用中间件链处理逻辑，最后调用 writeHead 和 end 方法把响应写回 socket。所谓的\\\"路由\\\"本质上是一个映射表，匹配路径后调用对应的回调。\\\"中间件\\\"则是一个个函数，在请求和响应之间形成洋葱模型。\\n\\n当你能手写一个最小化服务器时，你才真正理解了什么叫做\\\"框架只是便利工具\\\"。下次遇到诡异的超时、连接重置或头解析错误时，你就不会只依赖框架的文档，而是能沉到 TCP 流的层面去诊断问题。不妨思考一下：如果要支持大文件流式传输，或者实现 HTTP/2 的多路复用，你设计的服务器需要做什么根本性的改变？\", \"readTime\": \"7 min\", \"questions\": [\"为什么 HTTP 协议选择用 \\\\r\\\\n 作为换行符，而不是单独 \\\\n？\", \"如果 Content-Length 小于实际 body 长度会发生什么？浏览器会如何处理？\", \"你自己实现的服务器如何处理客户端的一次连接发送多个 HTTP 请求（HTTP keep-alive）？\"], \"difficulty\": \"basic\", \"keyConcepts\": [\"TCP数据流\", \"HTTP请求报文格式\", \"Content-Length的作用\", \"路由与中间件原理\"], \"relatedTopics\": [\"Node.js net模块\", \"Web框架设计模式\"]}, {\"type\": \"deep\", \"title\": \"浏览器缓存背后的 HTTP 头：从 ETag 到 Cache-Control\", \"content\": \"刚上线的新版首页，运营频繁更新文案，但测试却总是看到旧内容。清了浏览器缓存就好，但用户不会这么干。这个典型的\\\"缓存脏数据\\\"问题，根源在于开发者对 HTTP 缓存头似懂非懂。HTTP 缓存是一套精密的时间与验证机制，用好它能让页面秒开，用错则让用户看到过期信息。\\n\\nHTTP 缓存分成两种：强缓存和协商缓存。强缓存直接告诉浏览器：\\\"这个资源在某个时间之前不要来问我\\\"，协商缓存则是：\\\"你可以用本地缓存，但先问问我它有没有变\\\"。\\n\\n强缓存由 Expires 和 Cache-Control 头控制。Expires 是一个绝对时间，比如 Expires: Wed, 21 Oct 2023 07:28:00 GMT，浏览器对比本地时间，没到期就用缓存。但本地时间可能不准确，于是有了 Cache-Control 的 max-age，它指定了资源从请求时刻开始能存活多少秒，这更可靠。Cache-Control 还提供了精细选项：no-cache 不是不缓存，而是强制每次使用前做协商验证；no-store 则绝对不缓存；public 允许 CDN 等中间节点缓存，private 仅限浏览器。\\n\\n协商缓存依赖两套验证码：Last-Modified/If-Modified-Since 和 ETag/If-None-Match。服务器在响应中带上 Last-Modified（最后修改时间），浏览器下次请求时自动带 If-Modified-Since，服务器比较时间，如果文件没变返回 304 Not Modified。但时间精度只到秒，且有时内容变了修改时间不变（比如从 CDN 回源），所以更推荐 ETag。ETag 是资源的唯一标识，可以基于内容哈希生成。请求时带上 If-None-Match: \\\"abc123\\\"，服务器对比，若匹配返回 304。\\n\\n实际开发中，我们通常在构建时为静态资源文件名加上哈希，比如 app.3e5a1c.js，同时设置 Cache-Control: public, max-age=31536000（一年）。这样只要文件内容不变，URL 有效期内都可以无网络请求直接加载。当内容更新，哈希变化，URL 变了，浏览器会当成新资源请求。这就是\\\"代理缓存+文件名哈希\\\"的最佳实践。对于 HTML 文档这种动态页面，通常设置 Cache-Control: no-cache，每次都协商验证，保证用户常看到最新版本。\\n\\n理解这套机制后，你可以清楚地知道在 Nginx 或 CDN 上如何为不同类型的资源配置缓存策略，也能轻松定位为什么页面发布后客户端迟迟不生效。最后留一个有意思的问题：当服务器同时返回了 ETag 和 Last-Modified，并且两者都用于协商，浏览器会发出一个请求带两个条件头吗？服务器收到后，应该先检查哪个才算真正符合标准？\", \"readTime\": \"7 min\", \"questions\": [\"如果服务器只返回了 Last-Modified，没有 ETag，并且文件一秒内被改变两次，会出现什么问题？\", \"为什么 Cache-Control: no-cache 需要配合 ETag 或 Last-Modified 才有意义？\", \"在微服务架构中，不同服务返回不一致的缓存头会导致浏览器什么行为？\"], \"difficulty\": \"intermediate\", \"keyConcepts\": [\"强缓存与协商缓存\", \"Cache-Control细节\", \"ETag生成策略\", \"304 Not Modified\"], \"relatedTopics\": [\"CDN缓存策略\", \"Service Worker缓存\", \"哈希化资源持久化\"]}], \"skill\": \"HTTP\", \"totalItems\": 3, \"studyAdvice\": \"\"}',0,0.0000,NULL,NULL,1,1784346162052,1784346239213),(4,29,'path_resources','path_resources resource',NULL,'queue',NULL,'resource-job:1:path_resources',NULL,NULL,'ResourceAgent','success','{\"total\": 11, \"failed\": 0, \"skipped\": 0, \"generated\": 11}','{\"actionType\": \"resources\"}',NULL,'{\"pathData\": {\"phases\": [{\"name\": \"阶段1：前端基础\", \"index\": 0, \"skills\": [{\"name\": \"HTML/CSS\", \"status\": \"pending\", \"priority\": 8, \"estimatedMin\": 150}, {\"name\": \"JavaScript\", \"status\": \"pending\", \"priority\": 9, \"estimatedMin\": 200}, {\"name\": \"React\", \"status\": \"pending\", \"priority\": 9, \"estimatedMin\": 240}]}, {\"name\": \"阶段2：后端基础\", \"index\": 1, \"skills\": [{\"name\": \"Node.js\", \"status\": \"pending\", \"priority\": 9, \"estimatedMin\": 200}, {\"name\": \"Express/Koa\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 150}, {\"name\": \"MongoDB\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 120}, {\"name\": \"SQL 基础\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 120}]}, {\"name\": \"阶段3：全栈进阶\", \"index\": 2, \"skills\": [{\"name\": \"TypeScript\", \"status\": \"pending\", \"priority\": 8, \"estimatedMin\": 180}, {\"name\": \"Docker\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 120}, {\"name\": \"Git 工作流\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 90}, {\"name\": \"项目部署\", \"status\": \"pending\", \"priority\": 6, \"estimatedMin\": 120}]}], \"direction\": \"fullstack\"}}','{\"total\": 11, \"failed\": 0, \"skipped\": 0, \"generated\": 11}',0,0.0000,NULL,NULL,1,1784346654089,1784347470564);
/*!40000 ALTER TABLE `generated_resources_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `reviewer_agent_score` decimal(5,2) DEFAULT NULL,
  `reviewer_agent_comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `admin_decision` tinyint NOT NULL DEFAULT '0',
  `admin_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enterprise_email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_job` (`job_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_applications_v3`
--

LOCK TABLES `job_applications_v3` WRITE;
/*!40000 ALTER TABLE `job_applications_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_applications_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_positions_v3`
--

DROP TABLE IF EXISTS `job_positions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_positions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `company` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` enum('junior','mid','senior') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'junior',
  `jd_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `required_skills` json DEFAULT NULL,
  `preferred_skills` json DEFAULT NULL,
  `salary_range` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_threshold` tinyint NOT NULL DEFAULT '60',
  `source` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `confidence_score` decimal(3,2) DEFAULT NULL,
  `enterprise_id` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `neo4j_node_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_level` (`level`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_positions_v3`
--

LOCK TABLES `job_positions_v3` WRITE;
/*!40000 ALTER TABLE `job_positions_v3` DISABLE KEYS */;
INSERT INTO `job_positions_v3` VALUES (1,'前端开发工程师','字节跳动','junior',NULL,'[{\"name\": \"JavaScript\"}, {\"name\": \"React\"}, {\"name\": \"TypeScript\"}, {\"name\": \"CSS\"}]','[{\"name\": \"Vue\"}, {\"name\": \"Node.js\"}]','15-25K','北京',60,'manual',NULL,1,1,NULL,1781163995000,1781163995000),(2,'Web前端实习生','腾讯','junior',NULL,'[{\"name\": \"JavaScript\"}, {\"name\": \"HTML/CSS\"}, {\"name\": \"React\"}]','[{\"name\": \"微信小程序\"}]','200-300/天','深圳',50,'manual',NULL,2,1,NULL,1781163995000,1781163995000),(3,'全栈开发工程师','阿里巴巴','mid',NULL,'[{\"name\": \"JavaScript\"}, {\"name\": \"React\"}, {\"name\": \"Node.js\"}, {\"name\": \"MongoDB\"}, {\"name\": \"Docker\"}]','[{\"name\": \"TypeScript\"}, {\"name\": \"Redis\"}]','20-35K','杭州',70,'manual',NULL,3,1,NULL,1781163995000,1781163995000),(4,'后端开发工程师','百度','junior',NULL,'[{\"name\": \"Java\"}, {\"name\": \"Spring Boot\"}, {\"name\": \"MySQL\"}, {\"name\": \"Redis\"}]','[{\"name\": \"Kafka\"}, {\"name\": \"Elasticsearch\"}]','18-30K','北京',60,'manual',NULL,4,1,NULL,1781163995000,1781163995000),(5,'Python开发工程师','美团','junior',NULL,'[{\"name\": \"Python\"}, {\"name\": \"Django/Flask\"}, {\"name\": \"MySQL\"}, {\"name\": \"Linux\"}]','[{\"name\": \"Docker\"}, {\"name\": \"Kubernetes\"}]','16-28K','北京',60,'manual',NULL,5,1,NULL,1781163995000,1781163995000),(6,'前端开发工程师','腾讯','mid',NULL,'[{\"name\": \"JavaScript\"}, {\"name\": \"TypeScript\"}, {\"name\": \"React\"}, {\"name\": \"CSS\"}, {\"name\": \"Webpack\"}]','[{\"name\": \"Next.js\"}, {\"name\": \"Node.js\"}]','25-40K','深圳',75,'manual',NULL,2,1,NULL,1781163995000,1781163995000),(7,'全栈开发工程师','字节跳动','mid',NULL,'[{\"name\": \"JavaScript\"}, {\"name\": \"React\"}, {\"name\": \"Node.js\"}, {\"name\": \"TypeScript\"}]','[{\"name\": \"Go\"}, {\"name\": \"Redis\"}, {\"name\": \"Docker\"}]','25-45K','北京',70,'manual',NULL,1,1,NULL,1781163995000,1781163995000),(8,'AI工程师','百度','mid',NULL,'[{\"name\": \"Python\"}, {\"name\": \"TensorFlow/PyTorch\"}, {\"name\": \"机器学习\"}, {\"name\": \"NLP\"}]','[{\"name\": \"大模型\"}, {\"name\": \"RAG\"}]','25-40K','北京',70,'manual',NULL,4,1,NULL,1781163995000,1781163995000);
/*!40000 ALTER TABLE `job_positions_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `knowledge_base_v3`
--

DROP TABLE IF EXISTS `knowledge_base_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `knowledge_base_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_type` enum('lecture','choice','fill','coding','essay','graph') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` json NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `source` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_by` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_skill` (`skill_name`),
  KEY `idx_type` (`resource_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `knowledge_base_v3`
--

LOCK TABLES `knowledge_base_v3` WRITE;
/*!40000 ALTER TABLE `knowledge_base_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `knowledge_base_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `branch_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_type` enum('main','side','experiment') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main',
  `base_commit_id` bigint DEFAULT NULL,
  `head_commit_id` bigint DEFAULT NULL,
  `source_branch_id` bigint DEFAULT NULL,
  `merged_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_learning_branches_user_status` (`user_id`,`status`),
  KEY `idx_learning_branches_user_type` (`user_id`,`branch_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_branches_v3`
--

LOCK TABLES `learning_branches_v3` WRITE;
/*!40000 ALTER TABLE `learning_branches_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `learning_branches_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `commit_type` enum('baseline','lecture_read','quiz_passed','quiz_failed','code_done','skill_complete','task_done','manual','merge','rollback') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `skill_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` varchar(240) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_json` json DEFAULT NULL,
  `snapshot_id` bigint DEFAULT NULL,
  `delta_json` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_learning_commits_user_branch` (`user_id`,`branch_id`),
  KEY `idx_learning_commits_branch_parent` (`branch_id`,`parent_commit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_commits_v3`
--

LOCK TABLES `learning_commits_v3` WRITE;
/*!40000 ALTER TABLE `learning_commits_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `learning_commits_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_plans_v3`
--

DROP TABLE IF EXISTS `learning_plans_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_plans_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Default Plan',
  `plan_type` enum('main','side') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main',
  `target_job_id` bigint DEFAULT NULL,
  `path_data` json DEFAULT NULL,
  `current_phase` int NOT NULL DEFAULT '0',
  `daily_hours` decimal(3,1) DEFAULT NULL,
  `main_ratio` tinyint DEFAULT '80',
  `match_score` decimal(5,2) DEFAULT NULL,
  `estimated_date` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branch_from` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `bound_agent_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bound_agent_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_type` (`plan_type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_plans_v3`
--

LOCK TABLES `learning_plans_v3` WRITE;
/*!40000 ALTER TABLE `learning_plans_v3` DISABLE KEYS */;
INSERT INTO `learning_plans_v3` VALUES (13,29,'全栈开发学习计划','main',NULL,'{\"phases\": [{\"name\": \"阶段1：前端基础\", \"index\": 0, \"skills\": [{\"name\": \"HTML/CSS\", \"status\": \"pending\", \"priority\": 8, \"estimatedMin\": 150}, {\"name\": \"JavaScript\", \"status\": \"pending\", \"priority\": 9, \"estimatedMin\": 200}, {\"name\": \"React\", \"status\": \"pending\", \"priority\": 9, \"estimatedMin\": 240}]}, {\"name\": \"阶段2：后端基础\", \"index\": 1, \"skills\": [{\"name\": \"Node.js\", \"status\": \"pending\", \"priority\": 9, \"estimatedMin\": 200}, {\"name\": \"Express/Koa\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 150}, {\"name\": \"MongoDB\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 120}, {\"name\": \"SQL 基础\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 120}]}, {\"name\": \"阶段3：全栈进阶\", \"index\": 2, \"skills\": [{\"name\": \"TypeScript\", \"status\": \"pending\", \"priority\": 8, \"estimatedMin\": 180}, {\"name\": \"Docker\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 120}, {\"name\": \"Git 工作流\", \"status\": \"pending\", \"priority\": 7, \"estimatedMin\": 90}, {\"name\": \"项目部署\", \"status\": \"pending\", \"priority\": 6, \"estimatedMin\": 120}]}], \"direction\": \"fullstack\"}',0,2.0,80,0.00,'2026-11-15',NULL,1,1784346654059,1784346654059,NULL,NULL);
/*!40000 ALTER TABLE `learning_plans_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_sessions_v3`
--

DROP TABLE IF EXISTS `learning_sessions_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_sessions_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_id` bigint DEFAULT NULL,
  `session_date` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` bigint DEFAULT NULL,
  `ended_at` bigint DEFAULT NULL,
  `total_duration_ms` bigint DEFAULT '0',
  `tasks_snapshot` json DEFAULT NULL,
  `skill_changes` json DEFAULT NULL,
  `match_score_before` decimal(5,2) DEFAULT NULL,
  `match_score_after` decimal(5,2) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`session_date`),
  KEY `idx_date` (`session_date`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_sessions_v3`
--

LOCK TABLES `learning_sessions_v3` WRITE;
/*!40000 ALTER TABLE `learning_sessions_v3` DISABLE KEYS */;
INSERT INTO `learning_sessions_v3` VALUES (13,29,NULL,'2026-07-18',1784346661677,NULL,0,'{\"skills\": [{\"name\": \"Node.js\", \"masteryPct\": 0}, {\"name\": \"Linux\", \"masteryPct\": 0}, {\"name\": \"Vue\", \"masteryPct\": 0}, {\"name\": \"SQL\", \"masteryPct\": 0}, {\"name\": \"TypeScript\", \"masteryPct\": 0}, {\"name\": \"Angular\", \"masteryPct\": 0}]}','[]',NULL,NULL,1,1784346661677,1784346661677),(14,29,NULL,'2026-07-18',1784346661679,NULL,0,'{\"skills\": [{\"name\": \"Node.js\", \"masteryPct\": 0}, {\"name\": \"Linux\", \"masteryPct\": 0}, {\"name\": \"Vue\", \"masteryPct\": 0}, {\"name\": \"SQL\", \"masteryPct\": 0}, {\"name\": \"TypeScript\", \"masteryPct\": 0}, {\"name\": \"Angular\", \"masteryPct\": 0}]}','[]',NULL,NULL,1,1784346661679,1784346661679);
/*!40000 ALTER TABLE `learning_sessions_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_tasks_v3`
--

DROP TABLE IF EXISTS `learning_tasks_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_tasks_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `plan_id` bigint NOT NULL,
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_type` enum('main','side') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'main',
  `task_status` enum('pending','in_progress','lecture_done','practice_done','code_done','exam_done','skipped','done') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `estimated_min` int DEFAULT NULL,
  `actual_min` int DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `priority` tinyint NOT NULL DEFAULT '5',
  `plan_date` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_time` bigint DEFAULT NULL,
  `complete_time` bigint DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_date` (`user_id`,`plan_date`),
  KEY `idx_plan` (`plan_id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_tasks_v3`
--

LOCK TABLES `learning_tasks_v3` WRITE;
/*!40000 ALTER TABLE `learning_tasks_v3` DISABLE KEYS */;
INSERT INTO `learning_tasks_v3` VALUES (31,29,13,'HTML/CSS','main','pending',150,NULL,0,8,'2026-07-18',NULL,NULL,1,1,1784346654059,1784346654059);
/*!40000 ALTER TABLE `learning_tasks_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `match_history_v3`
--

DROP TABLE IF EXISTS `match_history_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `match_history_v3` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `jobId` int NOT NULL,
  `score` decimal(5,2) NOT NULL,
  `breakdown` json DEFAULT NULL,
  `triggerEvent` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_match_history_user_job` (`userId`,`jobId`),
  KEY `IDX_match_history_created` (`createdAt`)
) ENGINE=InnoDB AUTO_INCREMENT=1841 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `match_history_v3`
--

LOCK TABLES `match_history_v3` WRITE;
/*!40000 ALTER TABLE `match_history_v3` DISABLE KEYS */;
INSERT INTO `match_history_v3` VALUES (1825,29,1,8.40,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 3, \"matched\": [\"TypeScript\"], \"missing\": [\"JavaScript\", \"React\", \"CSS\"], \"coverage\": 25}, \"preferredSkills\": {\"score\": 10, \"matched\": [\"Vue\", \"Node.js\"], \"missing\": [], \"coverage\": 100}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.803685'),(1826,29,2,6.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"JavaScript\", \"HTML/CSS\", \"React\"], \"coverage\": 0}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"微信小程序\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.813747'),(1827,29,3,1.80,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 2, \"matched\": [\"Node.js\"], \"missing\": [\"JavaScript\", \"React\", \"MongoDB\", \"Docker\"], \"coverage\": 20}, \"preferredSkills\": {\"score\": 5, \"matched\": [\"TypeScript\"], \"missing\": [\"Redis\"], \"coverage\": 50}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.820766'),(1828,29,4,6.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Java\", \"Spring Boot\", \"MySQL\", \"Redis\"], \"coverage\": 0}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Kafka\", \"Elasticsearch\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.830208'),(1829,29,5,6.90,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 3, \"matched\": [\"Linux\"], \"missing\": [\"Python\", \"Django/Flask\", \"MySQL\"], \"coverage\": 25}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Docker\", \"Kubernetes\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.838053'),(1830,29,6,1.80,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 2, \"matched\": [\"TypeScript\"], \"missing\": [\"JavaScript\", \"React\", \"CSS\", \"Webpack\"], \"coverage\": 20}, \"preferredSkills\": {\"score\": 5, \"matched\": [\"Node.js\"], \"missing\": [\"Next.js\"], \"coverage\": 50}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.845283'),(1831,29,7,2.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 5, \"matched\": [\"Node.js\", \"TypeScript\"], \"missing\": [\"JavaScript\", \"React\"], \"coverage\": 50}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Go\", \"Redis\", \"Docker\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.851779'),(1832,29,8,0.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Python\", \"TensorFlow/PyTorch\", \"机器学习\", \"NLP\"], \"coverage\": 0}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"大模型\", \"RAG\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:31.858620'),(1833,29,1,8.40,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 3, \"matched\": [\"TypeScript\"], \"missing\": [\"JavaScript\", \"React\", \"CSS\"], \"coverage\": 25}, \"preferredSkills\": {\"score\": 10, \"matched\": [\"Vue\", \"Node.js\"], \"missing\": [], \"coverage\": 100}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.180144'),(1834,29,2,6.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"JavaScript\", \"HTML/CSS\", \"React\"], \"coverage\": 0}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"微信小程序\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.188078'),(1835,29,3,1.80,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 2, \"matched\": [\"Node.js\"], \"missing\": [\"JavaScript\", \"React\", \"MongoDB\", \"Docker\"], \"coverage\": 20}, \"preferredSkills\": {\"score\": 5, \"matched\": [\"TypeScript\"], \"missing\": [\"Redis\"], \"coverage\": 50}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.195210'),(1836,29,4,6.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Java\", \"Spring Boot\", \"MySQL\", \"Redis\"], \"coverage\": 0}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Kafka\", \"Elasticsearch\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.202017'),(1837,29,5,6.90,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"campus\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 3, \"matched\": [\"Linux\"], \"missing\": [\"Python\", \"Django/Flask\", \"MySQL\"], \"coverage\": 25}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Docker\", \"Kubernetes\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.208649'),(1838,29,6,1.80,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 2, \"matched\": [\"TypeScript\"], \"missing\": [\"JavaScript\", \"React\", \"CSS\", \"Webpack\"], \"coverage\": 20}, \"preferredSkills\": {\"score\": 5, \"matched\": [\"Node.js\"], \"missing\": [\"Next.js\"], \"coverage\": 50}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.215298'),(1839,29,7,2.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 5, \"matched\": [\"Node.js\", \"TypeScript\"], \"missing\": [\"JavaScript\", \"React\"], \"coverage\": 50}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Go\", \"Redis\", \"Docker\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.221802'),(1840,29,8,0.00,'{\"exams\": {\"score\": 0, \"totalCount\": 0, \"passedCount\": 0}, \"projects\": {\"score\": 0, \"relatedCount\": 0}, \"scenario\": \"social\", \"learningSpeed\": {\"score\": 60, \"sampleCount\": 0}, \"requiredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"Python\", \"TensorFlow/PyTorch\", \"机器学习\", \"NLP\"], \"coverage\": 0}, \"preferredSkills\": {\"score\": 0, \"matched\": [], \"missing\": [\"大模型\", \"RAG\"], \"coverage\": 0}, \"learningProgress\": {\"score\": 0, \"completionPct\": 0}}',NULL,'2026-07-18 06:25:32.228164');
/*!40000 ALTER TABLE `match_history_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `summary` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `source` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_url` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `publish_time` bigint DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=136 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news_v3`
--

LOCK TABLES `news_v3` WRITE;
/*!40000 ALTER TABLE `news_v3` DISABLE KEYS */;
INSERT INTO `news_v3` VALUES (115,'Why teens deserve access to safe AI','Learn how OpenAI is making ChatGPT safer for teens with age-appropriate protections, learning tools, parental controls, and expert partnerships.','OpenAI 宣布为 ChatGPT 推出面向青少年的安全保护措施，包括年龄限制、学习工具、家长控制及专家合作，旨在确保青少年在安全环境中使用 AI。这有助于培养青少年正确使用 AI 的能力，降低风险，为未来学习和就业中的 AI 应用奠定基础。',NULL,'industry','[\"AI\", \"ChatGPT\", \"青少年安全\", \"教育\", \"OpenAI\"]','OpenAI News','https://openai.com/index/why-teens-deserve-access-safe-ai',1,1784217600000,1784354788376,1784354788376),(116,'How Cars24 scales conversations and builds faster with OpenAI','Cars24 uses OpenAI-powered voice and chat agents to handle 1M+ monthly conversation minutes, recover 12% of lost leads, and bring agentic workflows to teams across the company.','Cars24 利用 OpenAI 驱动的语音和聊天代理，每月处理超百万分钟对话，成功挽回 12% 的流失线索，并将代理工作流推广至公司各部门。这表明 AI 对话系统在客户服务和业务流程自动化中的巨大价值，提示学习者关注大模型应用、语音交互及工作流设计等技能，未来可从事 AI 产品、NLP 工程等岗位。',NULL,'industry','[\"AI\", \"大模型\", \"语音代理\", \"客户服务\", \"工作流自动化\"]','OpenAI News','https://openai.com/index/cars24',1,1784160000000,1784354792402,1784354792402),(117,'GPT-Red: Unlocking Self-Improvement for Robustness','Explore GPT-Red, OpenAI’s automated red teaming system that uses self-play to improve AI safety, alignment, and prompt injection robustness.','OpenAI发布GPT-Red，一种基于自我对弈的自动化红队系统，旨在提升AI模型的安全性和鲁棒性，尤其是在对抗提示注入攻击方面。这一进展意味着AI对齐研究从人工测试向自动化演进，可能降低安全评估成本，对AI开发者意味着更高效的安全验证工具。',NULL,'tech','[\"AI安全\", \"红队测试\", \"自我对弈\", \"大模型\"]','OpenAI News','https://openai.com/index/unlocking-self-improvement-gpt-red',1,1784109600000,1784354795150,1784354795150),(118,'GPT-5.6 is now the preferred model in Microsoft 365 Copilot','Learn how GPT-5.6 powers Microsoft 365 Copilot with stronger AI capabilities across Word, Excel, PowerPoint, Chat, and Cowork for faster, higher-quality work.','GPT-5.6 成为 Microsoft 365 Copilot 首选模型，为 Word、Excel、PowerPoint 等核心应用提供更强 AI 能力，提升工作质量与效率。这意味着 AI 办公工具进一步升级，掌握相关技能有助于提升职场竞争力，对求职和技能学习方向具有重要指导意义。',NULL,'industry','[\"AI\", \"大模型\", \"GPT-5.6\", \"Microsoft 365\", \"办公效率\"]','OpenAI News','https://openai.com/index/gpt-5-6-preferred-model-microsoft-365-copilot',1,1783602000000,1784354799220,1784354799220),(119,'GPT-5.5 Bio Bug Bounty','Details about the OpenAI Bio Bounty program','OpenAI宣布启动GPT-5.5 Bio Bug Bounty计划，鼓励研究人员发现并报告模型在生物安全方面的漏洞。此举旨在加强AI与生物领域交叉的安全性，对学习AI安全、生物信息学的人有重要就业前景。',NULL,'tech','[\"OpenAI\", \"生物安全\", \"赏金计划\", \"大模型\", \"AI安全\"]','OpenAI News','https://openai.com/index/bio-bug-bounty',1,1783591200000,1784354801866,1784354801866),(120,'MUFG aims to become AI-native with OpenAI','MUFG uses ChatGPT Enterprise to build an AI-native organization, improve workflows, and deliver new AI-powered financial services at scale.','日本三菱日联金融集团（MUFG）宣布与OpenAI合作，采用ChatGPT Enterprise打造AI原生组织，优化工作流程并规模化推出AI驱动的金融服务。这一举措表明传统金融巨头正加速AI转型，对学习者而言，掌握AI与金融结合的能力将成为重要竞争力；对就业者而言，金融行业对AI应用人才的需求将显著增长。',NULL,'industry','[\"AI\", \"金融科技\", \"企业应用\", \"大模型\", \"行业转型\"]','OpenAI News','https://openai.com/index/mufg',1,1783382400000,1784355373838,1784355373838),(121,'DeepSeek V4,一个王炸!','这是一次略显突然的发布。就在几天前，硅谷还在热议OpenAI的GPT-5.5和Anthropic的Claude Opus 4.6，全球AI领域的竞争早已呈现“万类霜天竞自由”的气象。站在另一个维度来看，此刻距离DeepSeek上一次让全球AI行业震动，已经过去了近16个月。时间拨回到2025年初。R1发布当天，行业迅速沸腾，中国AI团','DeepSeek发布V4版本，距离上次引发行业震动的R1发布已过去16个月，此次发布在GPT-5.5和Claude Opus 4.6热议之际，显示中国AI团队持续突破，提醒从业者需紧跟前沿技术迭代，增强学习紧迫感。',NULL,'industry','[\"DeepSeek\", \"V4\", \"AI大模型\", \"行业动态\"]','searxng:127.0.0.1:8080','https://baijiahao.baidu.com/s?id=1863613898225213252&wfr=spider&for=pc',1,1784355970975,1784355973428,1784355973428),(122,'我们的AI生活','03DeepSeek预览新AI模型V4,称已“缩小差距”逼近前沿闭源系统 2026年4月24日 39条候选资讯 01OpenAI推出ChatGPT工作区智能体,团队可创建自主执行任务的定制机器人 02谷歌发布两款全新AI芯片TPU v8,挑战英伟达霸主地位 03AI工具助朝鲜黑客窃取数百万美元,从代码编写到网站伪造全程使用AI ...','本周AI领域密集发布：DeepSeek预览V4模型缩小与闭源系统差距，OpenAI推出ChatGPT工作区智能体，谷歌发布TPU v8芯片挑战英伟达，同时AI工具被用于黑客攻击。这些进展表明AI技术加速渗透各行各业，对学习者而言需紧跟模型、芯片和智能体开发趋势，对从业者则需关注技术落地与安全风险。',NULL,'industry','[\"AI\", \"大模型\", \"芯片\", \"智能体\", \"安全\"]','searxng:127.0.0.1:8080','https://www.freeout.net/',1,1784355970975,1784355976354,1784355976354),(123,'生成式人工智能(人工智能的一个分支、自主创造新内容的技术) - 百度百科','生成式人工智能（Generative AI）是人工智能的一个分支，能够根据用户输入自主创造文本、图片、声音、视频、代码等新内容。其技术核心包括生成对抗网络（GAN）、生成式预训练Transformer（GPT）及扩散模型等多模态模型。该技术应用于图像生成与增强、音频与音乐生成、药物发现等领域，并对经济学研究方法和劳动力市场产生影响...','百度百科介绍生成式AI是人工智能分支，能自主创造文本、图像等内容，核心技术包括GAN、GPT、扩散模型等。了解该技术有助于把握AI领域前沿，对学习相关技能和寻找AI相关就业有重要参考价值。',NULL,'tech','[\"生成式AI\", \"人工智能\", \"大模型\", \"多模态\"]','searxng:127.0.0.1:8080','https://baike.baidu.com/item/%E7%94%9F%E6%88%90%E5%BC%8F%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD/59344747',1,1784355967989,1784355979730,1784355979730),(124,'为什么OpenAI、DeepSeek、Anthropic都在集体押注”科研智能体...','目前AI科研其实有两条路:一条是Scientist(科学家),即OpenAI、Anthropic正在做的,基于语言智能、逻辑推理和文献整合;另一条是Simulator(模拟器),如Google DeepMind的AlphaFold、GNoME,直接通过数据驱动去拟合物理世界规律。 巨头们押注科研智能体,终极目标是将这两条路汇合——既像顶尖科学家一样推理,又能直接理解物理世...','OpenAI、DeepSeek、Anthropic等巨头集体押注科研智能体，旨在融合语言推理与数据驱动的物理世界模拟两条路径。这一趋势将重塑AI科研范式，对学习/就业意味着需掌握跨学科能力（如逻辑推理+数据科学），相关复合型人才需求将激增。',NULL,'industry','[\"AI\", \"科研智能体\", \"大模型\", \"数据驱动\", \"人才需求\"]','searxng:127.0.0.1:8080','https://zhuanlan.zhihu.com/p/2060899167598389017',1,1784355970975,1784355982227,1784355982227),(125,'new.qq.com/rain/a/20240315A098Y500','今天,大模型创企生数科技宣布,生数科技多模态大模型正式通过国家《生成式人工智能服务管理暂...','生数科技的多模态大模型正式通过国家《生成式人工智能服务管理暂行办法》相关审核，成为首批合规的大模型之一。这表明国内大模型进入规范化应用阶段，对学习者而言，跟进多模态技术可提升研发或应用能力；对求职者而言，了解合规要求有助于在AI行业获得优势。',NULL,'industry','[\"大模型\", \"多模态\", \"AI合规\", \"生数科技\"]','searxng:127.0.0.1:8080','https://new.qq.com/rain/a/20240315A098Y500',1,1784355967978,1784355985593,1784355985593),(126,'OpenAI 官网入口地址：如何轻松找到','OpenAI OpenAI是一个强大的开放人工智能研究平台，其提供了一系列深度学习和自然语言处理的工具和技术。 使用OpenAI可以获得以下优点： 更准确的预测或推荐：OpenAI 的模型可以训练和预测特定 …','本文介绍了如何轻松找到OpenAI官网入口。OpenAI作为开放人工智能研究平台，提供深度学习和自然语言处理工具，访问其官网可获取最新模型和API资源。对于AI学习者和从业者，掌握官网入口是获取前沿技术、参与社区和利用商业化服务的基础。',NULL,'tech','[\"AI\", \"大模型\", \"官网\", \"教程\"]','searxng:127.0.0.1:8080','https://apifox.com/apiskills/openai-official-portal/',1,1784355970975,1784355988886,1784355988886),(127,'中国团队发布全球首款通用AI Agent Manus爆火90后创始人肖弘崭露...','在全球科技界,如比尔·盖茨等曾表示,AI Agent是重要发展方向。 AI智能体大火,A股市场上,相关概念股狂欢。 多家公司公开表示,涉足AI智能体业务。润和软件称,推出的新一代AI Agent智能中台、全新AI软硬一体化平台AIRUNS 2.0通过深度适配DeepSeek,推理能力得到进一步提升。 今年1月,酷特智能与华为签订《全面合作协议》...','中国团队发布全球首款通用AI智能体Manus，由90后创始人肖弘带领。AI Agent被视为重要发展方向，引发A股相关概念股热潮，多家公司如润和软件、酷特智能宣布涉足该领域。这一突破标志着AI从大模型向自主智能体演进，对学习AI开发、智能体应用的学生和就业者意味着新的职业方向与市场需求。',NULL,'industry','[\"AI Agent\", \"Manus\", \"90后创始人\", \"智能体\", \"概念股\"]','searxng:127.0.0.1:8080','https://k.sina.cn/article_1698921891_65437da300101oo1s.html?from=news',1,1784355967988,1784355992104,1784355992104),(128,'Sora(OpenAI发布的人工智能文生视频大模型) - 百度百科','Sora，美国人工智能研究公司OpenAI发布的人工智能文生视频大模型（但OpenAI并未单纯将其视为视频模型，而是作为“世界模拟器”），于2024年2月15日（美国当地时间）正式对外发布。当地时间2025年9月30日，OpenAI发布视频生成模型Sora 2并推出iOS社交应用Sora。Sora这一名称源于日文“空”（そら），','OpenAI于2024年2月发布文生视频大模型Sora（视为“世界模拟器”），2025年9月30日发布Sora2及iOS社交应用。该技术突破使AI从文本/图像扩展至视频生成，对学习者需掌握多模态模型原理，对就业意味着视频创作、游戏开发等岗位可能被重塑。',NULL,'tech','[\"AI\", \"大模型\", \"视频生成\", \"Sora\", \"OpenAI\"]','searxng:127.0.0.1:8080','https://baike.baidu.com/item/Sora/64060909',1,1784355967978,1784355995874,1784355995874),(129,'news.qq.com/rain/a/20250324A01H2T00','OpenAI为其开发者API发布的o1-pro模型,为人工智能定价设立了新的天花板。这一增强版推理模型...','OpenAI 发布 o1-pro 模型，大幅提高其开发者 API 定价，创下新纪录。此举将影响 AI 应用开发成本，促使学习开发者关注模型性价比，就业市场对高端推理模型相关技能需求可能上升。',NULL,'industry','[\"OpenAI\", \"大模型\", \"定价\", \"API\", \"产业趋势\"]','searxng:127.0.0.1:8080','https://news.qq.com/rain/a/20250324A01H2T00',1,1784355967978,1784356000515,1784356000515),(130,'OpenAI ChatGPT 国内使用方式，附完全使用指南【2025年 ...','2025年11月11日 · OpenAI ChatGPT 国内使用方式，附完全使用指南【2025年持续更新】 最新更新：2025年11月11日 本文为您提供最全面的 OpenAI ChatGPT 国内使用指南。我们将详细介绍 …','本文是一篇持续更新的指南，介绍2025年如何在国内使用OpenAI ChatGPT，涵盖注册、网络配置、替代方案等操作步骤。对学习者和从业者而言，掌握这些技巧可突破地域限制，便捷体验前沿AI工具，提升技术实践与就业竞争力。',NULL,'tech','[\"ChatGPT\", \"OpenAI\", \"使用指南\", \"国内访问\", \"AI工具\"]','searxng:127.0.0.1:8080','https://www.chatgpt-chinese.com/blog/guides/chatgpt/openai-chinese-guide.html',1,1784355970975,1784356004388,1784356004388),(131,'OpenAI_百度百科','OpenAI是2015年12月11日由萨姆·奥尔特曼、埃隆·马斯克、彼得·蒂尔等科技领袖创立的一家研究和部署人工智能的公司，总部位于美国旧金山，公司核心宗旨在于“实现安全的通用人工智能 (AGI)”，现任 …','OpenAI由萨姆·奥尔特曼、埃隆·马斯克等科技领袖于2015年创立，致力于安全通用人工智能（AGI）研发。了解其背景有助于理解AI行业格局，对从业者把握技术趋势和求职方向有参考价值。',NULL,'industry','[\"AI\", \"大模型\", \"OpenAI\", \"AGI\"]','searxng:127.0.0.1:8080','https://baike.baidu.com/item/OpenAI/19758408',1,1784355970975,1784356006662,1784356006662),(132,'AI速递!前沿资讯率先看','3.OpenAI约有五款硬件在研,意在把握AI时代终端入口,此前已收购Jony Ive公司并从苹果挖走二十余名硬件员工。 不是吧OpenAI首款硬件吹半天就是个AI音箱?? DeepSeek估值约740亿美元 拟2027年上市 1.DeepSeek启动第二轮融资,投后估值约740亿美元,较上轮涨近40%,并计划最早今年...','OpenAI正研发约五款硬件设备，包括可能推出的AI音箱，并已收购Jony Ive公司及从苹果挖人，意在抢占AI终端入口；同时，DeepSeek启动第二轮融资，估值约740亿美元，计划2027年上市。这些动态显示AI行业竞争从模型向硬件和资本延伸，对学习AI技术的就业者而言，需关注硬件集成与商业落地能力。',NULL,'industry','[\"OpenAI\", \"DeepSeek\", \"AI硬件\", \"融资\", \"大模型\"]','searxng:127.0.0.1:8080','https://mp.weixin.qq.com/s?__biz=MzI3MjIzMzU5Ng%3D%3D&mid=2247630197&idx=4&sn=be501549120e4860353d75ca4c61aa58&chksm=ea08ebc2390032cb71e68b47ae10a1cf3a81d8a75b84269a7f56d5ecf78b93d19ae026bd77c7&scene=27',1,1784355970975,1784356010434,1784356010434),(133,'OpenAI 官网入口与 ChatGPT 国内镜像站推荐 2025','1 天前 · 2025年最新OpenAI官网入口指引与ChatGPT国内镜像站推荐。涵盖ChatGPT官网、Chat GPT官网、chatgpt官网地址、chat gpt、gpt官网、openai官网、chatgpt中文版、GPT-5、GPT-4o、国内使 …','2025年最新OpenAI官网入口与ChatGPT国内镜像站推荐，旨在帮助用户突破访问限制，便捷使用GPT-4o等模型。此举降低了AI工具获取门槛，对学习者掌握前沿技术和就业者提升竞争力具有实际意义。',NULL,'tech','[\"AI\", \"大模型\", \"ChatGPT\", \"OpenAI\", \"镜像站\"]','searxng:127.0.0.1:8080','https://www.chatgpt-cnblog.com/guides/chatgpt/openai-official-entry-chatgpt-mirror-2025.html',1,1784355970975,1784356013292,1784356013292),(134,'福布斯2025年AI十大趋势预测,Killer Agent近在眼前|微软|谷歌|图灵...','今年8月,Sakana AI 团队亮出一位AI科学家,展现AI能够完全自主地完成整个人工智能研究周期: 阅读相关文献; 提出创新研究思路; 设计实验; 执行实验; 撰写研究论文并完成同行评审。 研究内容以「The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery」为题发表在arXiv平台上','福布斯预测2025年AI趋势，强调Killer Agent即将出现。Sakana AI团队推出能自主完成从文献阅读到论文撰写的AI科学家，标志着AI研究自动化迈出关键一步。对学习者而言，需关注AI自主研究能力对传统科研方法的冲击；对从业者，提示AI工具将重塑研发岗位需求。',NULL,'industry','[\"AI科学家\", \"AI自主研究\", \"趋势预测\", \"自动化\", \"就业影响\"]','searxng:127.0.0.1:8080','https://www.163.com/dy/article/JKEI1TB005118O92.html',1,1784355967988,1784356016156,1784356016156),(135,'AI Agent时代加速来临,上市公司积极布局_腾讯新闻','6月份,苹果在开发者大会上展示了其最新的AI成果Apple Intelligence;11月,微软在“Microsoft ignite 2024”大会上发布10多个商用AI Agent;谷歌紧随其后,也宣布全力推广商用AI Agent,发布一系列激励活动和产品,此外还特意发布了全球为数不多的商用AI Agent市场;OpenAI则计划于2025年1月发布一款代号为“Operator”的全新AI...','苹果、微软、谷歌及OpenAI等科技巨头加速商用AI Agent布局，微软发布10多个商用AI Agent，谷歌推出商用AI Agent市场，OpenAI计划于2025年1月发布新Agent。这表明AI Agent时代正在加速，相关技术和应用成为行业焦点，对学习AI Agent开发、就业于AI领域具有重要指导意义。',NULL,'industry','[\"AI Agent\", \"大模型\", \"商用\", \"科技巨头\"]','searxng:127.0.0.1:8080','https://new.qq.com/rain/a/20241218A000ND00',1,1784355967988,1784356020247,1784356020247);
/*!40000 ALTER TABLE `news_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint NOT NULL DEFAULT '0',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  `status` tinyint DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_user_read` (`user_id`,`is_read`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications_v3`
--

LOCK TABLES `notifications_v3` WRITE;
/*!40000 ALTER TABLE `notifications_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_logs_v3`
--

LOCK TABLES `operation_logs_v3` WRITE;
/*!40000 ALTER TABLE `operation_logs_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `operation_logs_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  `version` int NOT NULL DEFAULT '1',
  `version_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_base` tinyint NOT NULL DEFAULT '0',
  `content` json DEFAULT NULL,
  `html_content` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `pdf_file_id` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `review_comment` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_version` (`user_id`,`version`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resumes_v3`
--

LOCK TABLES `resumes_v3` WRITE;
/*!40000 ALTER TABLE `resumes_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `resumes_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skill_snapshots`
--

DROP TABLE IF EXISTS `skill_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_snapshots` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `commit_id` varchar(36) DEFAULT NULL,
  `snapshot_type` enum('full','delta') NOT NULL DEFAULT 'full',
  `nodes_json` json DEFAULT NULL,
  `edges_json` json DEFAULT NULL,
  `delta_json` json DEFAULT NULL,
  `overall_score` int NOT NULL DEFAULT '0',
  `match_score` int NOT NULL DEFAULT '0',
  `skill_count` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_user_type` (`user_id`,`snapshot_type`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_snapshots`
--

LOCK TABLES `skill_snapshots` WRITE;
/*!40000 ALTER TABLE `skill_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `skill_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id`),
  KEY `idx_skill_snapshots_user_branch` (`user_id`,`branch_id`),
  KEY `idx_skill_snapshots_commit` (`commit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_snapshots_v3`
--

LOCK TABLES `skill_snapshots_v3` WRITE;
/*!40000 ALTER TABLE `skill_snapshots_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `skill_snapshots_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students_v3`
--

DROP TABLE IF EXISTS `students_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `student_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `school` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `major` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_job_id` bigint DEFAULT NULL,
  `interests` json DEFAULT NULL,
  `skills` json DEFAULT NULL,
  `projects` json DEFAULT NULL,
  `github_username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `work_experience` json DEFAULT NULL,
  `awards` json DEFAULT NULL,
  `self_intro` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `daily_hours` decimal(3,1) DEFAULT NULL,
  `target_deadline` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `onboarding_completed` tinyint NOT NULL DEFAULT '0',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  KEY `idx_target_job` (`target_job_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students_v3`
--

LOCK TABLES `students_v3` WRITE;
/*!40000 ALTER TABLE `students_v3` DISABLE KEYS */;
INSERT INTO `students_v3` VALUES (11,29,'张三',NULL,'北京大学','软件工程','大四',NULL,NULL,NULL,'[\"fullstack\"]','[{\"name\": \"Angular\", \"level\": \"熟悉\"}, {\"name\": \"TypeScript\", \"level\": \"熟练\"}, {\"name\": \"SQL\", \"level\": \"熟悉\"}, {\"name\": \"Vue\", \"level\": \"熟练\"}, {\"name\": \"Linux\", \"level\": \"熟悉\"}, {\"name\": \"Node.js\", \"level\": \"熟悉\"}]',NULL,NULL,NULL,NULL,NULL,2.0,NULL,1,1,1784346648025,1784346654059);
/*!40000 ALTER TABLE `students_v3` ENABLE KEYS */;
UNLOCK TABLES;

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
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_config_v3`
--

LOCK TABLES `system_config_v3` WRITE;
/*!40000 ALTER TABLE `system_config_v3` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_config_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_skills_v3`
--

DROP TABLE IF EXISTS `user_skills_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_skills_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `skill_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `mastery_pct` decimal(5,2) NOT NULL DEFAULT '0.00',
  `trust_weight` decimal(3,2) NOT NULL DEFAULT '0.30',
  `source` enum('self_report','conversation','github','exam') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'self_report',
  `last_activity` bigint DEFAULT NULL,
  `decay_start` bigint DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_skill` (`user_id`,`skill_name`),
  KEY `idx_skill` (`skill_name`),
  KEY `idx_mastery` (`mastery_pct`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_skills_v3`
--

LOCK TABLES `user_skills_v3` WRITE;
/*!40000 ALTER TABLE `user_skills_v3` DISABLE KEYS */;
INSERT INTO `user_skills_v3` VALUES (35,29,'Angular',0.00,0.50,'self_report',1784346648038,NULL,1,1784346648038,1784346648038),(36,29,'TypeScript',0.00,0.70,'self_report',1784346648047,NULL,1,1784346648047,1784346648047),(37,29,'SQL',0.00,0.50,'self_report',1784346648054,NULL,1,1784346648054,1784346648054),(38,29,'Vue',0.00,0.70,'self_report',1784346648060,NULL,1,1784346648060,1784346648060),(39,29,'Linux',0.00,0.50,'self_report',1784346648066,NULL,1,1784346648066,1784346648066),(40,29,'Node.js',0.00,0.50,'self_report',1784346648073,NULL,1,1784346648073,1784346648073);
/*!40000 ALTER TABLE `user_skills_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users_v3`
--

DROP TABLE IF EXISTS `users_v3`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_v3` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `real_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','student') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` bigint DEFAULT NULL,
  `update_time` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users_v3`
--

LOCK TABLES `users_v3` WRITE;
/*!40000 ALTER TABLE `users_v3` DISABLE KEYS */;
INSERT INTO `users_v3` VALUES (29,'devtest','$2b$10$MVRpVcL3Vyi4HzvmrebQYuODWPpokT/XKJjG36miiluym4GM6YJe2','Dev Test',NULL,NULL,NULL,'student',1,1784345052344,1784345052344);
/*!40000 ALTER TABLE `users_v3` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'zhipath'
--

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

-- Dump completed on 2026-07-18  6:43:21
