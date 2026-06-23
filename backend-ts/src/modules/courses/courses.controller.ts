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
  async getChapters(@CurrentUser('userId') userId: number, @Param('planId') planId: string) {
    return success(await this.coursesService.getChapters(+planId, userId));
  }

  @Post(':planId/chapters/generate')
  async generateChapters(@CurrentUser('userId') userId: number, @Param('planId') planId: string) {
    return success(await this.coursesService.generateChapters(+planId, userId));
  }

  @Post(':planId/chapters/parse')
  async parseChapters(@CurrentUser('userId') userId: number, @Param('planId') planId: string, @Body() body: { treeText: string }) {
    return success(await this.coursesService.parseTreeText(+planId, userId, body.treeText));
  }

  @Put(':planId/chapters/:id')
  async updateChapter(@Param('id') id: string, @Body() body: any) {
    return success(await this.coursesService.updateChapter(+id, body));
  }

  @Delete(':planId/chapters/:id')
  async deleteChapter(@Param('id') id: string) {
    return success(await this.coursesService.deleteChapter(+id));
  }

  @Get(':planId/abilities')
  async getAbilities(@CurrentUser('userId') userId: number, @Param('planId') planId: string) {
    return success(await this.coursesService.getAbilities(+planId, userId));
  }

  @Post(':planId/abilities/generate')
  async generateAbilities(@CurrentUser('userId') userId: number, @Param('planId') planId: string) {
    return success(await this.coursesService.generateAbilities(+planId, userId));
  }

  @Post(':planId/abilities/save')
  async saveAbilities(@CurrentUser('userId') userId: number, @Param('planId') planId: string, @Body() body: { abilities: any[] }) {
    return success(await this.coursesService.saveAbilities(+planId, userId, body.abilities));
  }

  @Post(':planId/abilities/match')
  async matchChapterAbility(@Param('planId') planId: string) {
    return success(await this.coursesService.matchChapterAbility(+planId));
  }
}
