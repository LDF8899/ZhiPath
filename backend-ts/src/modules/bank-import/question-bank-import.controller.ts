import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, error } from '../../common/api-response';
import { QuestionBankImportService } from './question-bank-import.service';

@Controller('user/question-bank/imports')
@UseGuards(AuthGuard)
export class QuestionBankImportController {
  constructor(private readonly service: QuestionBankImportService) {}

  @Post()
  async import(@CurrentUser('sub') userId: number, @Body() body: { filename?: string; fileType?: string; images: string[] }) {
    try { return success(await this.service.importBatch(userId, body), 'OCR 识别完成'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Get()
  async list(@CurrentUser('sub') userId: number, @Query('limit') limit?: string) {
    return success(await this.service.listImports(userId, limit ? Number(limit) : 20));
  }

  @Get(':id')
  async detail(@CurrentUser('sub') userId: number, @Param('id') id: string) {
    try { return success(await this.service.getImport(userId, Number(id))); }
    catch (e: any) { return error(404, e.message); }
  }

  @Post(':id/confirm')
  async confirm(@CurrentUser('sub') userId: number, @Param('id') id: string, @Body() body: { candidateIds: number[] }) {
    try { return success(await this.service.confirmImport(userId, Number(id), body.candidateIds), '已发布到题库'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Delete(':id')
  async remove(@CurrentUser('sub') userId: number, @Param('id') id: string) {
    try { return success(await this.service.deleteImport(userId, Number(id)), '已删除'); }
    catch (e: any) { return error(400, e.message); }
  }
}
