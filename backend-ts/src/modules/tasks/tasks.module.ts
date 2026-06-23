import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskSchedulerModule } from '../task-scheduler/task-scheduler.module';

@Module({
  imports: [TaskSchedulerModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
