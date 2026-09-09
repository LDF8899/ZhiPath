import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success } from '../../common/api-response';
import { CoursesService } from './courses.service';

@Controller('user/courses')
@UseGuards(AuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get(':planId/chapters')
  async getChapters(@CurrentUser() user: any, @Param('planId') planId: string) {
    return success(await this.coursesService.getChapters(+planId, user.sub || user.userId, Number(user.tenantId || 1)));
  }

  @Post(':planId/chapters/generate')
  async generateChapters(@CurrentUser() user: any, @Param('planId') planId: string) {
    return success(await this.coursesService.generateChapters(+planId, user.sub || user.userId, Number(user.tenantId || 1)));
  }

  @Post(':planId/chapters/parse')
  async parseChapters(@CurrentUser() user: any, @Param('planId') planId: string, @Body() body: { treeText: string }) {
    return success(await this.coursesService.parseTreeText(+planId, user.sub || user.userId, body.treeText, Number(user.tenantId || 1)));
  }

  @Put(':planId/chapters/:id')
  async updateChapter(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return success(await this.coursesService.updateChapter(+id, user.sub || user.userId, body, Number(user.tenantId || 1)));
  }

  @Delete(':planId/chapters/:id')
  async deleteChapter(@CurrentUser() user: any, @Param('id') id: string) {
    return success(await this.coursesService.deleteChapter(+id, user.sub || user.userId, Number(user.tenantId || 1)));
  }

  @Get(':planId/abilities')
  async getAbilities(@CurrentUser() user: any, @Param('planId') planId: string) {
    return success(await this.coursesService.getAbilities(+planId, user.sub || user.userId, Number(user.tenantId || 1)));
  }

  @Post(':planId/abilities/generate')
  async generateAbilities(@CurrentUser() user: any, @Param('planId') planId: string) {
    return success(await this.coursesService.generateAbilities(+planId, user.sub || user.userId, Number(user.tenantId || 1)));
  }

  @Post(':planId/abilities/save')
  async saveAbilities(@CurrentUser() user: any, @Param('planId') planId: string, @Body() body: { abilities: any[] }) {
    return success(await this.coursesService.saveAbilities(+planId, user.sub || user.userId, body.abilities, Number(user.tenantId || 1)));
  }

  @Post(':planId/abilities/match')
  async matchChapterAbility(@CurrentUser() user: any, @Param('planId') planId: string) {
    return success(await this.coursesService.matchChapterAbility(+planId, 3, Number(user.tenantId || 1), user.sub || user.userId));
  }
}
