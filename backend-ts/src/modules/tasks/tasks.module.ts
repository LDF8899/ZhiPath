import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksV1Controller } from './tasks-v1.controller';
import { TasksService } from './tasks.service';
import { TaskSchedulerModule } from '../task-scheduler/task-scheduler.module';

@Module({
  imports: [TaskSchedulerModule],
  controllers: [TasksController, TasksV1Controller],
  providers: [TasksService],
})
export class TasksModule {}
