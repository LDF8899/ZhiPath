import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../../entities/student.entity';
import { GitHubController } from './github.controller';
import { ProfileService } from '../../services/profile.service';

/**
 * GitHub / 项目经历模块 — Phase 9 补齐
 *
 * POST /api/user/github/analyze — 分析 GitHub 仓库
 * POST /api/user/projects/save  — 保存项目经历
 */
@Module({
  imports: [TypeOrmModule.forFeature([Student])],
  controllers: [GitHubController],
  providers: [ProfileService],
})
export class GitHubModule {}
