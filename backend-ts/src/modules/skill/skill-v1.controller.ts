import { BadRequestException, Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { PlatformRequest } from '../../platform/request-context/request-context.types';
import { SkillService } from '../../services/skill.service';

/** 统一技能读模型；历史 /api/user/skills 路由只保留兼容用途。 */
@ApiTags('v1 competencies')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1/me/skills')
@UseGuards(AuthGuard, ScopesGuard)
export class SkillV1Controller {
  constructor(private readonly skills: SkillService) {}

  @Get()
  @RequireScopes('learning:read')
  async list(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.skills.getSkills(this.userId(request), this.tenantId(request)));
  }

  @Get('stats')
  @RequireScopes('learning:read')
  async stats(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.skills.getStats(this.userId(request), this.tenantId(request)));
  }

  @Get('effective')
  @RequireScopes('learning:read')
  async effective(@Req() request: PlatformRequest) {
    return apiV1Success(request, await this.skills.getEffectiveSkills(this.userId(request), this.tenantId(request)));
  }

  @Get(':skillName/evidence')
  @RequireScopes('learning:read')
  async evidence(@Req() request: PlatformRequest, @Param('skillName') skillName: string) {
    return apiV1Success(request, await this.skills.getSkillEvidence(this.userId(request), skillName, this.tenantId(request)));
  }

  private userId(request: PlatformRequest) {
    return Number(request.user?.sub || request.user?.id);
  }
  private tenantId(request: PlatformRequest) {
    const id = Number(request.user?.tenantId);
    if (!id) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return id;
  }
}
