import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { ClientApp } from '../../entities/client-app.entity';
import { ClientFeature } from '../../entities/client-feature.entity';
import { UserClientPreference } from '../../entities/user-client-preference.entity';
import { AuthService } from '../../modules/auth/auth.service';
import { AccessControlService } from '../access-control/access-control.service';
import { CreateClientAppDto } from './dto/create-client-app.dto';
import { UpdateClientFeatureDto } from './dto/update-client-feature.dto';
import { ClientOriginPolicyService } from './client-origin-policy.service';

export interface ClientAdminMutationContext {
  tenantId: number;
  actorUserId: number;
  actorClientKey: string;
  requestId: string;
  ipAddress?: string;
}

@Injectable()
export class ClientExperienceService {
  constructor(
    @InjectRepository(ClientApp)
    private readonly clientAppRepo: Repository<ClientApp>,
    @InjectRepository(ClientFeature)
    private readonly clientFeatureRepo: Repository<ClientFeature>,
    @InjectRepository(UserClientPreference)
    private readonly preferenceRepo: Repository<UserClientPreference>,
    private readonly authService: AuthService,
    private readonly accessControl: AccessControlService,
    private readonly dataSource: DataSource,
    private readonly originPolicy: ClientOriginPolicyService,
  ) {}

  async listClients() {
    const clients = await this.clientAppRepo.find({ order: { id: 'ASC' } });
    const features = await this.clientFeatureRepo.find({ order: { clientAppId: 'ASC', featureKey: 'ASC' } });
    return clients.map((client) => ({
      key: client.clientKey,
      name: client.name,
      status: client.status,
      configVersion: client.configVersion,
      defaultTenantId: client.defaultTenantId,
      allowedOrigins: client.allowedOrigins,
      theme: client.themeConfig,
      features: features
        .filter((feature) => Number(feature.clientAppId) === Number(client.id))
        .map((feature) => ({
          key: feature.featureKey,
          enabled: feature.enabled === 1,
          rolloutPercent: feature.rolloutPercent,
          config: feature.config || {},
        })),
    }));
  }

  async createClient(dto: CreateClientAppDto, context: ClientAdminMutationContext) {
    this.assertMutationContext(context);
    const allowedOrigins = this.normalizeHttpOrigins(dto.allowedOrigins);
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const appRepo = manager.getRepository(ClientApp);
        const featureRepo = manager.getRepository(ClientFeature);
        const existing = await appRepo.findOne({ where: { clientKey: dto.clientKey } });
        if (existing) throw new ConflictException('客户端 key 已存在');

        const now = new Date();
        const client = await appRepo.save({
          clientKey: dto.clientKey,
          name: dto.name,
          status: 'active',
          defaultTenantId: context.tenantId,
          configVersion: 1,
          allowedOrigins,
          themeConfig: dto.theme || {},
          createdAt: now,
          updatedAt: now,
        });
        const featureKeys = [...new Set(dto.features || [])];
        for (const featureKey of featureKeys) {
          await featureRepo.save({
            clientAppId: client.id,
            featureKey,
            enabled: 1,
            config: {},
            rolloutPercent: 100,
            createdAt: now,
            updatedAt: now,
          });
        }
        const response = {
          key: client.clientKey,
          name: client.name,
          configVersion: client.configVersion,
        };
        await this.recordPlatformMutation(manager, context, {
          action: 'client_app.create',
          eventType: 'client.app.created.v1',
          aggregateType: 'client_app',
          aggregateId: client.clientKey,
          resourceType: 'client_app',
          resourceId: client.clientKey,
          payload: { ...response, allowedOrigins: client.allowedOrigins, features: featureKeys },
        });
        return response;
      });
      this.originPolicy.invalidate();
      return result;
    } catch (error: any) {
      if (error instanceof ConflictException || error?.driverError?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('客户端 key 已存在');
      }
      throw error;
    }
  }

  async updateFeature(
    clientKey: string,
    featureKey: string,
    dto: UpdateClientFeatureDto,
    context: ClientAdminMutationContext,
  ) {
    this.assertMutationContext(context);
    if (!/^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/.test(featureKey)) {
      throw new BadRequestException('featureKey 格式无效');
    }
    return this.dataSource.transaction(async (manager) => {
      const appRepo = manager.getRepository(ClientApp);
      const featureRepo = manager.getRepository(ClientFeature);
      const client = await appRepo.findOne({ where: { clientKey, status: 'active' } });
      if (!client) throw new NotFoundException('客户端不存在或已停用');
      let feature = await featureRepo.findOne({
        where: { clientAppId: client.id, featureKey },
      });
      const now = new Date();
      feature = await featureRepo.save({
        ...(feature || {}),
        clientAppId: client.id,
        featureKey,
        enabled: dto.enabled ? 1 : 0,
        rolloutPercent: dto.rolloutPercent ?? feature?.rolloutPercent ?? 100,
        config: dto.config ?? feature?.config ?? {},
        createdAt: feature?.createdAt || now,
        updatedAt: now,
      });
      client.configVersion += 1;
      client.updatedAt = now;
      await appRepo.save(client);
      const response = {
        clientKey,
        featureKey,
        enabled: feature.enabled === 1,
        rolloutPercent: feature.rolloutPercent,
        config: feature.config || {},
        configVersion: client.configVersion,
      };
      await this.recordPlatformMutation(manager, context, {
        action: 'client_feature.update',
        eventType: 'client.feature.updated.v1',
        aggregateType: 'client_app',
        aggregateId: client.clientKey,
        resourceType: 'client_feature',
        resourceId: `${client.clientKey}:${featureKey}`,
        payload: response,
      });
      return response;
    });
  }

  async bootstrap(clientKey: string, userId: number, tenantId?: number) {
    if (!clientKey || clientKey === 'unknown') {
      throw new BadRequestException('缺少有效的 X-Client-App 请求头');
    }

    const client = await this.clientAppRepo.findOne({
      where: { clientKey, status: 'active' },
    });
    if (!client) throw new BadRequestException('客户端未注册或已停用');

    const [featureRows, user, access] = await Promise.all([
      this.clientFeatureRepo.find({ where: { clientAppId: client.id } }),
      this.authService.getMe(userId, tenantId),
      this.accessControl.getIdentityContext(userId, tenantId),
    ]);
    if (!user) throw new BadRequestException('当前用户不存在或已停用');

    const features = Object.fromEntries(
      featureRows.map((feature) => [
        feature.featureKey,
        {
          enabled: this.isFeatureAvailable(feature, userId),
          rolloutPercent: feature.rolloutPercent,
          config: feature.config || {},
        },
      ]),
    );

    const effectiveTenantId = access.tenant?.id;
    let preference = effectiveTenantId
      ? await this.preferenceRepo.findOne({
          where: { userId, clientAppId: client.id, tenantId: effectiveTenantId },
        })
      : null;
    if (effectiveTenantId && !preference) {
      const now = new Date();
      preference = await this.preferenceRepo.save({
        userId,
        clientAppId: client.id,
        tenantId: effectiveTenantId,
        onboardingState: user.onboardingCompleted ? 'completed' : 'pending',
        locale: 'zh-CN',
        preference: {},
        createdAt: now,
        updatedAt: now,
      });
    }

    const navigation = featureRows
      .filter((feature) => this.isFeatureAvailable(feature, userId))
      .map((feature) => ({
        key: feature.featureKey,
        ...(feature.config || {}),
      }))
      .sort((left: any, right: any) => (left.order || 0) - (right.order || 0));

    return {
      client: {
        key: client.clientKey,
        name: client.name,
        configVersion: client.configVersion,
        theme: client.themeConfig || {},
      },
      tenant: access.tenant,
      user,
      features,
      navigation,
      preference: preference
        ? {
            onboardingState: preference.onboardingState,
            locale: preference.locale,
            values: preference.preference || {},
          }
        : null,
      roles: access.roles,
      permissions: access.scopes,
    };
  }

  /**
   * Compose read models by registered feature keys. Core domain queries never
   * branch on a product name, so a third client can opt into the same blocks
   * through client_features without changing this contract.
   */
  async home(clientKey: string, tenantId: number, userId: number) {
    if (!clientKey || clientKey === 'unknown') {
      throw new BadRequestException('缺少有效的 X-Client-App 请求头');
    }
    const client = await this.clientAppRepo.findOne({ where: { clientKey, status: 'active' } });
    if (!client) throw new BadRequestException('客户端未注册或已停用');
    const featureRows = await this.clientFeatureRepo.find({ where: { clientAppId: client.id } });
    const enabled = new Set(
      featureRows
        .filter((feature) => this.isFeatureAvailable(feature, userId))
        .map((feature) => feature.featureKey),
    );
    const sections: Record<string, unknown> = {};

    if (enabled.has('dashboard')) {
      const rows = await this.dataSource.query(
        `SELECT
           (SELECT COUNT(*) FROM learning_paths
             WHERE tenant_id = ? AND user_id = ? AND lifecycle_status = 'active' AND deleted_at IS NULL) AS activePaths,
           (SELECT COUNT(*) FROM learning_activities
             WHERE tenant_id = ? AND user_id = ? AND planned_date <= CURRENT_DATE
               AND activity_status IN ('planned', 'ready', 'in_progress') AND deleted_at IS NULL) AS dueActivities,
           (SELECT COUNT(*) FROM learning_activities
             WHERE tenant_id = ? AND user_id = ? AND activity_status = 'in_progress' AND deleted_at IS NULL) AS inProgressActivities,
           (SELECT COUNT(*) FROM learning_activities
             WHERE tenant_id = ? AND user_id = ? AND activity_status = 'completed'
               AND DATE(completed_at) = CURRENT_DATE AND deleted_at IS NULL) AS completedToday,
           (SELECT COUNT(*) FROM async_jobs
             WHERE tenant_id = ? AND user_id = ? AND status IN ('queued', 'active', 'cancelling')) AS pendingJobs`,
        [tenantId, userId, tenantId, userId, tenantId, userId, tenantId, userId, tenantId, userId],
      );
      sections.dashboard = this.numericRow(rows[0] || {});
    }

    if (enabled.has('learning-paths')) {
      const rows = await this.dataSource.query(
        `SELECT path.public_id AS id, path.name, path.path_kind AS kind,
                path.lifecycle_status AS status, path.version_no AS version,
                goal.goal_type AS goalType, goal.title AS goalTitle, path.updated_at AS updatedAt
           FROM learning_paths path
           JOIN learning_goals goal ON goal.id = path.goal_id
          WHERE path.tenant_id = ? AND path.user_id = ? AND path.deleted_at IS NULL
          ORDER BY path.updated_at DESC, path.id DESC LIMIT 5`,
        [tenantId, userId],
      );
      sections.learningPaths = { items: rows };
    }

    if (enabled.has('assessment')) {
      const rows = await this.dataSource.query(
        `SELECT COUNT(DISTINCT attempt.id) AS attemptCount,
                ROUND(AVG(score.normalized_score), 2) AS averageScore,
                MAX(attempt.completed_at) AS lastCompletedAt
           FROM assessment_attempts attempt
           LEFT JOIN assessment_scores score ON score.attempt_id = attempt.id AND score.tenant_id = attempt.tenant_id
          WHERE attempt.tenant_id = ? AND attempt.user_id = ?`,
        [tenantId, userId],
      );
      sections.assessment = this.numericRow(rows[0] || {}, ['lastCompletedAt']);
    }

    if (enabled.has('remediation')) {
      const rows = await this.dataSource.query(
        `SELECT competency.public_id AS id, competency.name,
                state.mastery_percent AS masteryPercent, state.confidence
           FROM user_competency_states state
           JOIN competencies competency
             ON competency.id = state.competency_id AND competency.tenant_id = state.tenant_id
          WHERE state.tenant_id = ? AND state.user_id = ?
          ORDER BY state.mastery_percent ASC, state.confidence ASC, competency.name LIMIT 5`,
        [tenantId, userId],
      );
      sections.remediation = {
        items: rows.map((row: any) => this.numericRow(row, ['id', 'name'])),
      };
    }

    return {
      client: { key: client.clientKey, configVersion: client.configVersion },
      generatedAt: new Date().toISOString(),
      sections,
    };
  }

  private isFeatureAvailable(feature: ClientFeature, userId: number): boolean {
    if (feature.enabled !== 1 || feature.rolloutPercent <= 0) return false;
    if (feature.rolloutPercent >= 100) return true;
    const bucket = Number.parseInt(
      createHash('sha256').update(`${userId}:${feature.featureKey}`).digest('hex').slice(0, 8),
      16,
    ) % 100;
    return bucket < feature.rolloutPercent;
  }

  private numericRow(row: Record<string, unknown>, excluded: string[] = []) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        excluded.includes(key) || value === null || value === undefined ? value : Number(value),
      ]),
    );
  }

  private assertMutationContext(context: ClientAdminMutationContext) {
    if (!context.tenantId || !context.actorUserId) {
      throw new BadRequestException('访问令牌缺少租户或操作人上下文');
    }
  }

  private normalizeHttpOrigins(origins: string[]): string[] {
    const normalized = origins.map((origin) => {
      try {
        const parsed = new URL(origin);
        const valid =
          (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
          !parsed.username &&
          !parsed.password &&
          parsed.pathname === '/' &&
          !parsed.search &&
          !parsed.hash;
        return valid ? parsed.origin : null;
      } catch {
        return null;
      }
    });
    if (normalized.some((origin) => !origin)) {
      throw new BadRequestException('allowedOrigins 仅允许 HTTP/HTTPS 地址');
    }
    return [...new Set(normalized as string[])];
  }

  private async recordPlatformMutation(
    manager: EntityManager,
    context: ClientAdminMutationContext,
    mutation: {
      action: string;
      eventType: string;
      aggregateType: string;
      aggregateId: string;
      resourceType: string;
      resourceId: string;
      payload: Record<string, unknown>;
    },
  ) {
    const actorClient = await manager.getRepository(ClientApp).findOne({
      where: { clientKey: context.actorClientKey },
    });
    await manager.query(
      `INSERT INTO outbox_events
        (public_id, tenant_id, aggregate_type, aggregate_id, event_type, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        context.tenantId,
        mutation.aggregateType,
        mutation.aggregateId,
        mutation.eventType,
        JSON.stringify(mutation.payload),
      ],
    );
    await manager.query(
      `INSERT INTO audit_logs
        (public_id, tenant_id, client_app_id, actor_user_id, action, resource_type,
         resource_id, request_id, result, ip_address, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?)`,
      [
        randomUUID(),
        context.tenantId,
        actorClient?.id || null,
        context.actorUserId,
        mutation.action,
        mutation.resourceType,
        mutation.resourceId,
        context.requestId,
        context.ipAddress || null,
        JSON.stringify(mutation.payload),
      ],
    );
  }
}
