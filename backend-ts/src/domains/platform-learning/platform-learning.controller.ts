import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/auth.guard';
import { apiV1Success } from '../../platform/api-v1/api-v1-response';
import { RequireScopes } from '../../platform/access-control/require-scopes.decorator';
import { ScopesGuard } from '../../platform/access-control/scopes.guard';
import { getRequestContext, PlatformRequest } from '../../platform/request-context/request-context.types';
import { CreateLearningGoalDto } from './dto/create-learning-goal.dto';
import { PageQueryDto } from './dto/page-query.dto';
import { UpdateLearningActivityStatusDto } from './dto/update-learning-activity-status.dto';
import { StartAssessmentAttemptDto } from './dto/start-assessment-attempt.dto';
import { SubmitAssessmentAttemptDto } from './dto/submit-assessment-attempt.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { CreateLearningPathNodeDto } from './dto/create-learning-path-node.dto';
import { CreateLearningPathEdgeDto } from './dto/create-learning-path-edge.dto';
import { CreateLearningActivityDto } from './dto/create-learning-activity.dto';
import { UpdateLearningPathStatusDto } from './dto/update-learning-path-status.dto';
import { PlatformLearningService } from './platform-learning.service';

@ApiTags('v1 learning core')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Client-App', required: true })
@Controller('v1')
@UseGuards(AuthGuard, ScopesGuard)
export class PlatformLearningController {
  constructor(private readonly service: PlatformLearningService) {}

  @Get('learning-paths')
  @RequireScopes('learning:read')
  listPaths(@Req() request: PlatformRequest, @Query() query: PageQueryDto) {
    return this.wrap(request, this.service.listPaths(this.tenantId(request), this.userId(request), query));
  }

  @Get('learning-domains')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '读取平台学习领域与起步路线目录' })
  listLearningDomains(@Req() request: PlatformRequest) {
    return apiV1Success(request, this.service.listLearningDomains());
  }

  @Get('learning-domains/:domainId')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '读取单个学习领域与起步路线' })
  getLearningDomain(@Req() request: PlatformRequest, @Param('domainId') domainId: string) {
    return apiV1Success(request, this.service.getLearningDomain(domainId));
  }

  @Get('learning-paths/:id')
  @RequireScopes('learning:read')
  getPath(@Req() request: PlatformRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.wrap(request, this.service.getPath(this.tenantId(request), this.userId(request), id));
  }

  @Patch('learning-paths/:id/status')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '更新规范学习路径状态并同步兼容计划' })
  async updatePathStatus(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) pathId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: UpdateLearningPathStatusDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    return apiV1Success(
      request,
      await this.service.updatePathStatus({
        ...this.commandContext(request, idempotencyKey),
        pathId,
        dto,
      }),
    );
  }

  @Post('learning-paths/:id/nodes')
  @HttpCode(HttpStatus.CREATED)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '向规范化学习路径增加节点' })
  async createPathNode(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) pathId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateLearningPathNodeDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    return apiV1Success(
      request,
      await this.service.createPathNode({
        ...this.commandContext(request, idempotencyKey),
        pathId,
        dto,
      }),
    );
  }

  @Post('learning-paths/:id/edges')
  @HttpCode(HttpStatus.CREATED)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '在同一路径的节点之间增加有向关系' })
  async createPathEdge(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) pathId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateLearningPathEdgeDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    return apiV1Success(
      request,
      await this.service.createPathEdge({
        ...this.commandContext(request, idempotencyKey),
        pathId,
        dto,
      }),
    );
  }

  @Get('me/competencies')
  @RequireScopes('learning:read')
  competencies(@Req() request: PlatformRequest) {
    return this.wrap(request, this.service.listCompetencies(this.tenantId(request), this.userId(request)));
  }

  @Get('learning-activities')
  @RequireScopes('learning:read')
  activities(@Req() request: PlatformRequest, @Query() query: PageQueryDto) {
    return this.wrap(
      request,
      this.service.listActivities(this.tenantId(request), this.userId(request), query),
    );
  }

  @Post('learning-activities')
  @HttpCode(HttpStatus.CREATED)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '创建学习活动并兼容同步历史任务' })
  async createActivity(
    @Req() request: PlatformRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateLearningActivityDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    return apiV1Success(
      request,
      await this.service.createActivity({
        ...this.commandContext(request, idempotencyKey),
        dto,
      }),
    );
  }

  @Patch('learning-activities/:id/status')
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '按受控状态机更新学习活动，并兼容同步历史任务' })
  async updateActivityStatus(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: UpdateLearningActivityStatusDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const context = getRequestContext(request);
    const data = await this.service.updateActivityStatus({
      tenantId: this.tenantId(request),
      userId: this.userId(request),
      clientApp: context.clientApp,
      requestId: context.requestId,
      idempotencyKey,
      ipAddress: request.ip,
      activityId: id,
      dto,
    });
    return apiV1Success(request, data);
  }

  @Get('assessments/attempts')
  @RequireScopes('learning:read')
  attempts(@Req() request: PlatformRequest, @Query() query: PageQueryDto) {
    return this.wrap(request, this.service.listAttempts(this.tenantId(request), this.userId(request), query));
  }

  @Get('assessments')
  @RequireScopes('learning:read')
  assessments(@Req() request: PlatformRequest, @Query() query: PageQueryDto) {
    return this.wrap(request, this.service.listAssessments(this.tenantId(request), query));
  }

  @Post('assessments/:definitionId/attempts')
  @HttpCode(HttpStatus.CREATED)
  @RequireScopes('assessment:take')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '创建测评尝试并返回不含答案的冻结题目' })
  async startAssessment(
    @Req() request: PlatformRequest,
    @Param('definitionId', new ParseUUIDPipe()) definitionId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: StartAssessmentAttemptDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const context = getRequestContext(request);
    const data = await this.service.startAssessment({
      tenantId: this.tenantId(request),
      userId: this.userId(request),
      clientApp: context.clientApp,
      requestId: context.requestId,
      idempotencyKey,
      ipAddress: request.ip,
      definitionId,
      dto,
    });
    return apiV1Success(request, data);
  }

  @Post('assessments/legacy-exams/:legacyExamId/attempts')
  @HttpCode(HttpStatus.CREATED)
  @RequireScopes('assessment:take')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '兼容旧数字考试记录，创建规范化测评尝试' })
  async startLegacyExam(
    @Req() request: PlatformRequest,
    @Param('legacyExamId') legacyExamId: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: StartAssessmentAttemptDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const legacyId = Number(legacyExamId);
    if (!Number.isInteger(legacyId) || legacyId < 1) throw new BadRequestException('历史考试编号无效');
    const context = getRequestContext(request);
    return apiV1Success(
      request,
      await this.service.startLegacyExam({
        tenantId: this.tenantId(request),
        userId: this.userId(request),
        clientApp: context.clientApp,
        requestId: context.requestId,
        idempotencyKey,
        ipAddress: request.ip,
        legacyExamId: legacyId,
        count: dto?.count,
      }),
    );
  }

  @Post('assessments/attempts/:id/submit')
  @HttpCode(HttpStatus.OK)
  @RequireScopes('assessment:take')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '提交答案，由服务端评分并生成能力快照、证据、事件和审计' })
  async submitAssessment(
    @Req() request: PlatformRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: SubmitAssessmentAttemptDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const context = getRequestContext(request);
    const data = await this.service.submitAssessment({
      tenantId: this.tenantId(request),
      userId: this.userId(request),
      clientApp: context.clientApp,
      requestId: context.requestId,
      idempotencyKey,
      ipAddress: request.ip,
      attemptId: id,
      dto,
    });
    return apiV1Success(request, data);
  }

  @Get('evidence')
  @RequireScopes('learning:read')
  evidence(@Req() request: PlatformRequest, @Query() query: PageQueryDto) {
    return this.wrap(request, this.service.listEvidence(this.tenantId(request), this.userId(request), query));
  }

  @Get('evidence/search')
  @RequireScopes('learning:read')
  @ApiOperation({ summary: '检索当前用户规范证据台账' })
  searchEvidence(@Req() request: PlatformRequest, @Query('q') q?: string, @Query('limit') limit?: string) {
    const parsedLimit = limit === undefined ? 20 : Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new BadRequestException('limit 参数无效');
    }
    return this.wrap(
      request,
      this.service.searchEvidence(this.tenantId(request), this.userId(request), q || '', parsedLimit),
    );
  }

  @Post('evidence')
  @HttpCode(HttpStatus.CREATED)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '写入统一证据并关联能力、目标、活动或测评' })
  async createEvidence(
    @Req() request: PlatformRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateEvidenceDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const context = getRequestContext(request);
    const data = await this.service.createEvidence({
      tenantId: this.tenantId(request),
      userId: this.userId(request),
      clientApp: context.clientApp,
      requestId: context.requestId,
      idempotencyKey,
      ipAddress: request.ip,
      dto,
    });
    return apiV1Success(request, data);
  }

  @Post('learning-goals')
  @HttpCode(HttpStatus.CREATED)
  @RequireScopes('learning:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: '在同一事务中创建目标、路径、兼容记录、outbox 与审计日志' })
  async createGoal(
    @Req() request: PlatformRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateLearningGoalDto,
  ) {
    this.validateIdempotencyKey(idempotencyKey);
    const context = getRequestContext(request);
    const data = await this.service.createGoalAndPath({
      tenantId: this.tenantId(request),
      userId: this.userId(request),
      clientApp: context.clientApp,
      requestId: context.requestId,
      idempotencyKey,
      ipAddress: request.ip,
      dto,
    });
    return apiV1Success(request, data);
  }

  private async wrap<T>(request: PlatformRequest, result: Promise<T>) {
    return apiV1Success(request, await result);
  }

  private userId(request: PlatformRequest): number {
    return Number(request.user?.sub || request.user?.id);
  }

  private tenantId(request: PlatformRequest): number {
    const tenantId = Number(request.user?.tenantId);
    if (!tenantId) throw new BadRequestException('访问令牌缺少有效租户上下文');
    return tenantId;
  }

  private validateIdempotencyKey(value: string) {
    if (!value || value.length > 200) {
      throw new BadRequestException('Idempotency-Key 必填且不得超过 200 字符');
    }
  }

  private commandContext(request: PlatformRequest, idempotencyKey: string) {
    const context = getRequestContext(request);
    return {
      tenantId: this.tenantId(request),
      userId: this.userId(request),
      clientApp: context.clientApp,
      requestId: context.requestId,
      idempotencyKey,
      ipAddress: request.ip,
    };
  }
}
