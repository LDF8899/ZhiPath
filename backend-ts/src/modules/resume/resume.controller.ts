import { Controller, Get, Post, Body, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ResumeAgentService } from '../../services/resume-agent.service';
import { PdfService } from '../../services/pdf.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, error } from '../../common/api-response';

/**
 * 简历控制器 — 简历 API
 */
@Controller('user')
@UseGuards(AuthGuard)
export class ResumeController {
  constructor(
    private readonly resumeAgent: ResumeAgentService,
    private readonly pdfService: PdfService,
  ) {}

  /** 获取用户所有简历 */
  @Get('resumes')
  async getResumes(@CurrentUser() user: any) {
    const resumes = await this.resumeAgent.getResumes(user.sub);
    return success(resumes);
  }

  /** 获取简历详情 */
  @Get('resumes/:id')
  async getResume(@Param('id') id: string, @CurrentUser() user: any) {
    const resume = await this.resumeAgent.getResume(parseInt(id, 10), user.sub);
    return success(resume);
  }

  /** 生成简历 */
  @Post('resumes/generate')
  async generateResume(@CurrentUser() user: any, @Body() body: { targetJobId?: number }) {
    const resume = await this.resumeAgent.generateResume(user.sub, body.targetJobId);
    return success(resume);
  }

  /** 更新简历 */
  @Post('resumes/:id/update')
  async updateResume(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { content?: Record<string, any>; htmlContent?: string },
  ) {
    const resume = await this.resumeAgent.updateResume(parseInt(id, 10), user.sub, body);
    return success(resume);
  }

  /** 从基础简历创建岗位版本 */
  @Post('resumes/:id/branch')
  async createVersion(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { targetJobId: number },
  ) {
    const resume = await this.resumeAgent.createVersion(user.sub, parseInt(id, 10), body.targetJobId);
    return success(resume);
  }

  /** 删除简历 */
  @Post('resumes/:id/delete')
  async deleteResume(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.resumeAgent.deleteResume(parseInt(id, 10), user.sub);
    return success({ success: result });
  }

  /** 导出简历为 PDF */
  @Get('resumes/:id/pdf')
  async exportPdf(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const resume = await this.resumeAgent.getResume(parseInt(id, 10), user.sub);
    if (!resume) {
      return error(404, '简历不存在');
    }

    if (!resume.htmlContent) {
      return error(400, '简历内容为空，请先编辑简历');
    }

    try {
      const pdfBuffer = await this.pdfService.generateResumePdf(resume.htmlContent);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="resume-${resume.versionName || resume.version}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (e: any) {
      return error(500, `PDF 生成失败：${e.message}`);
    }
  }
}
