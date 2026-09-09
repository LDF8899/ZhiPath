import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { LearningPathsService } from './learning-paths.service';
import { KnowledgeBaseService } from '../../services/knowledge-base.service';

@ApiTags('v1 knowledge')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/knowledge')
@UseGuards(AuthGuard, ScopesGuard)
export class LearningKnowledgeV1Controller {
  constructor(
    private readonly paths: LearningPathsService,
    private readonly knowledge: KnowledgeBaseService,
  ) {}

  /** 目录只返回 MySQL 元数据，正文按需通过 /:skill 读取。 */
  @Get()
  @RequireScopes('learning:read')
  async catalog(@Req() request: PlatformRequest) {
    const tenantId = Number(request.user?.tenantId || 1);
    return apiV1Success(request, {
      items: await this.knowledge.listPublishedAssets(tenantId),
      sourceOfTruth: 'mysql.knowledge_assets',
      bodyStore: 'mongodb.knowledge_base',
    });
  }

  @Get(':skill')
  @RequireScopes('learning:read')
  async skill(@Req() request: PlatformRequest, @Param('skill') skill: string) {
    const userId = Number(request.user?.sub || request.user?.id);
    const tenantId = Number(request.user?.tenantId || 1);
    return apiV1Success(request, await this.paths.getSkillContent(decodeURIComponent(skill), userId, tenantId));
  }
}
