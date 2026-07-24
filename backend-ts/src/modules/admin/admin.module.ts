import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../../entities/user.entity';
import { Student } from '../../entities/student.entity';
import { JobPosition, JobApplication } from '../../entities/job.entity';
import { Enterprise } from '../../entities/enterprise.entity';
import { News } from '../../entities/news.entity';
import { ExamRecord, ExamQuestion } from '../../entities/exam.entity';
import { Resume } from '../../entities/resume.entity';
import { SystemConfig } from '../../entities/system.entity';
import { GeneratedResource } from '../../entities/generated-resource.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Student, JobPosition, JobApplication, Enterprise, News, ExamRecord, ExamQuestion, Resume, SystemConfig, GeneratedResource])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
