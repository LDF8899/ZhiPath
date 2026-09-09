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
  async import(@CurrentUser() user: any, @Body() body: { filename?: string; fileType?: string; images: string[] }) {
    try { return success(await this.service.importBatch(user.sub, body, Number(user.tenantId || 1)), 'OCR 识别完成'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Get()
  async list(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return success(await this.service.listImports(user.sub, limit ? Number(limit) : 20, Number(user.tenantId || 1)));
  }

  @Get(':id')
  async detail(@CurrentUser() user: any, @Param('id') id: string) {
    try { return success(await this.service.getImport(user.sub, Number(id), Number(user.tenantId || 1))); }
    catch (e: any) { return error(404, e.message); }
  }

  @Post(':id/confirm')
  async confirm(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { candidateIds: number[] }) {
    try { return success(await this.service.confirmImport(user.sub, Number(id), body.candidateIds, Number(user.tenantId || 1)), '已发布到题库'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    try { return success(await this.service.deleteImport(user.sub, Number(id), Number(user.tenantId || 1)), '已删除'); }
    catch (e: any) { return error(400, e.message); }
  }
}
