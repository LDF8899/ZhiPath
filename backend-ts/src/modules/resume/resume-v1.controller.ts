import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { PdfService } from '../../services/pdf.service';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { ResumeAgentService } from '../../services/resume-agent.service';

/** 统一简历契约；PDF 也通过 v1 提供二进制下载。 */
@ApiTags('v1 resumes')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/resumes')
@UseGuards(AuthGuard, ScopesGuard)
export class ResumeV1Controller {
  constructor(private readonly service: ResumeAgentService, private readonly pdfService: PdfService) {}
  @Get() @RequireScopes('learning:read') async list(@Req() req: PlatformRequest) { return apiV1Success(req, await this.service.getResumes(this.userId(req), this.tenantId(req))); }
  @Get(':id') @RequireScopes('learning:read') async detail(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, await this.service.getResume(Number(id), this.userId(req), this.tenantId(req))); }
  @Post('generate') @RequireScopes('learning:write') async generate(@Req() req: PlatformRequest, @Body() body: { targetJobId?: number }) { return apiV1Success(req, await this.service.generateResume(this.userId(req), body?.targetJobId, this.tenantId(req))); }
  @Put(':id') @RequireScopes('learning:write') async update(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: any) { return apiV1Success(req, await this.service.updateResume(Number(id), this.userId(req), body, this.tenantId(req))); }
  @Post(':id/branch') @RequireScopes('learning:write') async branch(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: { targetJobId: number }) { return apiV1Success(req, await this.service.createVersion(this.userId(req), Number(id), body.targetJobId, this.tenantId(req))); }
  @Delete(':id') @RequireScopes('learning:write') async remove(@Req() req: PlatformRequest, @Param('id') id: string) { return apiV1Success(req, { success: await this.service.deleteResume(Number(id), this.userId(req), this.tenantId(req)) }); }
  @Get(':id/pdf')
  @RequireScopes('learning:read')
  async pdf(@Req() req: PlatformRequest, @Param('id') id: string, @Res() res: Response) {
    const resume = await this.service.getResume(Number(id), this.userId(req), this.tenantId(req));
    if (!resume) {
      res.status(404).json(apiV1Success(req, null));
      return;
    }
    if (!resume.htmlContent) {
      res.status(400).json(apiV1Success(req, { error: '简历内容为空，请先编辑简历' }));
      return;
    }
    try {
      const buffer = await this.pdfService.generateResumePdf(resume.htmlContent);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="resume-${resume.versionName || resume.version}.pdf"`,
        'Content-Length': buffer.length,
        'X-Request-Id': req.requestContext?.requestId || '',
      });
      res.end(buffer);
    } catch (error: any) {
      res.status(500).json(apiV1Success(req, { error: `PDF 生成失败：${error?.message || 'unknown error'}` }));
    }
  }
  private userId(req: PlatformRequest) { return Number(req.user?.sub || req.user?.id); }
  private tenantId(req: PlatformRequest) {
    const id = Number(req.user?.tenantId);
    if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return id;
  }
}
