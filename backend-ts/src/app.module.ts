import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { StudentModule } from './modules/student/student.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LearningPathsModule } from './modules/learning-paths/learning-paths.module';
import { ExamsModule } from './modules/exams/exams.module';
import { NewsModule } from './modules/news/news.module';
import { GraphModule } from './modules/graph/graph.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChatModule } from './modules/chat/chat.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ProgressModule } from './modules/progress/progress.module';
import { GitHubModule } from './modules/github/github.module';
import { SkillModule } from './modules/skill/skill.module';
import { PlannerModule } from './modules/planner/planner.module';
import { MatchModule } from './modules/match/match.module';
import { TaskSchedulerModule } from './modules/task-scheduler/task-scheduler.module';
import { SessionModule } from './modules/session/session.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ResumeModule } from './modules/resume/resume.module';
import { AgentsModule } from './modules/agents/agents.module';
import { AgentOfficeModule } from './modules/agent-office/agent-office.module';
import { QuickTestModule } from './modules/quick-test/quick-test.module';
import { EventsModule } from './modules/events/events.module';
import { QueueModule } from './modules/queue/queue.module';
import { MultimodalModule } from './modules/multimodal/multimodal.module';
import { CoursesModule } from './modules/courses/courses.module';

/**
 * ZhiPath API 根模块
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    DatabaseModule,

    // 用户端模块
    AuthModule,
    StudentModule,
    DashboardModule,
    JobsModule,
    LearningPathsModule,
    ExamsModule,
    NewsModule,
    GraphModule,
    TasksModule,
    ChatModule,
    KnowledgeModule,
    ProgressModule,
    GitHubModule,
    SkillModule,
    PlannerModule,
    MatchModule,
    TaskSchedulerModule,
    SessionModule,
    NotificationModule,
    ResumeModule,
    AgentsModule,
    AgentOfficeModule,
    QuickTestModule,
    EventsModule,
    QueueModule,
    MultimodalModule,
    CoursesModule,

    // 定时任务
    SchedulerModule,

    // 管理端模块
    AdminModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
