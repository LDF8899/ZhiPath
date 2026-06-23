import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SkillService } from '../../services/skill.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';

/**
 * 技能控制器 — user_skills_v3 CRUD
 */
@Controller('user')
@UseGuards(AuthGuard)
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  /** 获取用户所有技能 */
  @Get('skills')
  async getSkills(@CurrentUser() user: any) {
    const skills = await this.skillService.getSkills(user.sub);
    return success(skills);
  }

  /** 获取用户技能统计 */
  @Get('skills/stats')
  async getStats(@CurrentUser() user: any) {
    const stats = await this.skillService.getStats(user.sub);
    return success(stats);
  }

  /** 获取加权后的有效技能 */
  @Get('skills/effective')
  async getEffectiveSkills(@CurrentUser() user: any) {
    const skills = await this.skillService.getEffectiveSkills(user.sub);
    return success(skills);
  }

  /** 添加技能 */
  @Post('skills')
  async addSkill(@CurrentUser() user: any, @Body() body: { name: string; source?: string; trustWeight?: number }) {
    const skill = await this.skillService.addSkill(
      user.sub,
      body.name,
      (body.source as any) || 'self_report',
      body.trustWeight || 0.3,
    );
    return success(skill);
  }

  /** 更新技能掌握度 */
  @Post('skills/:skillName/mastery')
  async updateMastery(
    @CurrentUser() user: any,
    @Param('skillName') skillName: string,
    @Body() body: { delta?: number; masteryPct?: number },
  ) {
    let skill;
    if (body.masteryPct !== undefined) {
      skill = await this.skillService.setMastery(user.sub, skillName, body.masteryPct);
    } else if (body.delta !== undefined) {
      skill = await this.skillService.updateMastery(user.sub, skillName, body.delta);
    }
    return success(skill);
  }

  /** 从 students_v3.skills 迁移到 user_skills_v3 */
  @Post('skills/sync')
  async syncFromStudentSkills(@CurrentUser() user: any) {
    const migrated = await this.skillService.syncFromStudentSkills(user.sub);
    return success({ migrated });
  }
}
