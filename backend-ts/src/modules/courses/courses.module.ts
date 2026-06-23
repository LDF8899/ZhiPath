import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseChapter } from '../../entities/course-chapter.entity';
import { CourseAbility } from '../../entities/course-ability.entity';
import { LearningPlan } from '../../entities/learning.entity';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { LlmService } from '../../services/llm.service';

@Module({
  imports: [TypeOrmModule.forFeature([CourseChapter, CourseAbility, LearningPlan])],
  controllers: [CoursesController],
  providers: [CoursesService, LlmService],
  exports: [CoursesService],
})
export class CoursesModule {}
