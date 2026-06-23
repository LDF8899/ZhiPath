import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { Student } from '../../entities/student.entity';

/**
 * GitHub / 项目经历控制器 — 对齐 Python api/user/github.py
 *
 * POST /api/user/github/analyze — 分析 GitHub 仓库
 * POST /api/user/projects/save  — 保存项目经历
 */
@Controller('user')
@UseGuards(AuthGuard)
export class GitHubController {
  constructor(
    @InjectRepository(Student) private studentRepo: Repository<Student>,
  ) {}

  /** POST /api/user/github/analyze — 分析 GitHub 仓库 */
  @Post('github/analyze')
  async analyzeRepo(@Body() body: { repo_url: string }) {
    // TODO: 接入 GitHub API 分析仓库
    // Python 版调用 services/github.py analyze_repo()
    return success({
      name: '',
      description: '',
      language: '',
      stars: 0,
      topics: [],
      message: 'GitHub 分析功能待接入 GitHub API',
    });
  }

  /** POST /api/user/projects/save — 保存项目经历到学生档案 */
  @Post('projects/save')
  async saveProject(
    @CurrentUser('sub') userId: number,
    @Body() body: {
      name: string;
      description?: string;
      role?: string;
      tech?: string[];
      time?: string;
      github_url?: string;
      highlights?: string[];
      activity?: Record<string, any>;
    },
  ) {
    const student = await this.studentRepo.findOne({ where: { userId, status: 1 } });
    if (!student) return success(null, '学生信息不存在');

    // 构建项目记录
    const project: Record<string, any> = {
      name: body.name,
      description: body.description || '',
      role: body.role || '',
      tech: body.tech || [],
      time: body.time || '',
      github_url: body.github_url || '',
      highlights: body.highlights || [],
    };
    if (body.activity) project.activity = body.activity;

    // 追加到已有项目
    const existing = student.projects || [];
    existing.push(project);
    student.projects = existing;
    await this.studentRepo.save(student);

    // 自动将 tech 中的新技能加入 skills
    if (body.tech?.length) {
      const existingSkills = student.skills || [];
      const existingNames = new Set(existingSkills.map((s) => s.name));
      const newSkills = body.tech.filter((t) => !existingNames.has(t));
      if (newSkills.length) {
        for (const skillName of newSkills) {
          existingSkills.push({ name: skillName, level: '了解' });
        }
        student.skills = existingSkills;
        await this.studentRepo.save(student);
        console.log(`[GitHub] Auto-added ${newSkills.length} skills from project:`, newSkills);
      }
    }

    return success(null, '项目保存成功');
  }
}
