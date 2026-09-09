import { BadRequestException, Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Student } from '../../entities/student.entity';
import { AccessControlService, IdentityAccessContext } from '../../platform/access-control/access-control.service';
import { ClientApp } from '../../entities/client-app.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantMembership } from '../../entities/tenant-membership.entity';
import { createHash, randomBytes, randomUUID } from 'crypto';

/**
 * Auth 服务 v3.0
 * - 密码：bcrypt hash（替代 MD5）
 * - Token：JWT（替代 Session 表）
 * - 角色：user.role 直接字段（替代 groupId 查表）
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private jwtService: JwtService,
    private accessControl: AccessControlService,
    @InjectRepository(ClientApp) private clientAppRepo: Repository<ClientApp>,
    @InjectRepository(RefreshToken) private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(TenantMembership) private membershipRepo: Repository<TenantMembership>,
  ) {}

  /** 登录 */
  async login(username: string, password: string, clientApp = 'unknown') {
    if (clientApp !== 'unknown') {
      const registeredClient = await this.clientAppRepo.findOne({
        where: { clientKey: clientApp, status: 'active' },
      });
      if (!registeredClient) throw new BadRequestException('客户端未注册或已停用');
    }
    const user = await this.userRepo.findOne({
      where: { username, status: 1 },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // bcrypt 比对
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const access = await this.accessControl.getIdentityContext(user.id);
    const tokens = await this.issueSession(user, access.tenant?.id || null, clientApp, access);

    // 检查 onboarding 状态
    let onboardingCompleted = false;
    if (user.role === 'student') {
      const student = await this.studentRepo.findOne({
        where: {
          userId: user.id,
          ...(access.tenant?.id ? { tenantId: access.tenant.id } : {}),
          status: 1,
        },
      });
      if (student && student.onboardingCompleted === 1) {
        onboardingCompleted = true;
      }
    }

    return {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userId: user.id,
      username: user.username,
      realName: user.realName || '',
      role: user.role,
      onboardingCompleted,
    };
  }

  /** 当前用户可访问的租户列表；客户端可据此显式切换工作空间。 */
  async listTenants(userId: number) {
    const rows = await this.membershipRepo.find({
      where: { userId, status: 'active' },
      order: { id: 'ASC' },
    });
    if (!rows.length) return [];
    const tenants = await this.tenantRepo.find({
      where: rows.map((row) => ({ id: row.tenantId, status: 'active' })),
    });
    const byId = new Map(tenants.map((tenant) => [Number(tenant.id), tenant]));
    return rows
      .map((membership) => {
        const tenant = byId.get(Number(membership.tenantId));
        if (!tenant) return null;
        return {
          id: Number(tenant.id),
          key: tenant.tenantKey,
          name: tenant.name,
          type: tenant.tenantType,
          role: membership.roleKey,
          membershipId: Number(membership.id),
        };
      })
      .filter(Boolean);
  }

  /** 校验 membership 后签发绑定目标租户的新访问/刷新令牌。 */
  async switchTenant(userId: number, tenantId: number, clientApp: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, status: 1 } });
    if (!user) throw new UnauthorizedException('用户不存在或已停用');
    const access = await this.accessControl.getIdentityContext(userId, tenantId);
    if (!access.tenant) throw new UnauthorizedException('无权访问该租户');
    return this.issueSession(user, access.tenant.id, clientApp, access);
  }

  private async issueSession(user: User, tenantId: number | null, clientApp: string, accessContext?: IdentityAccessContext) {
    const access = accessContext || await this.accessControl.getIdentityContext(user.id, tenantId || undefined);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      azp: clientApp,
      tenantId: access.tenant?.id || null,
      roles: access.roles,
      scopes: access.scopes,
      jti: randomUUID(),
    });
    const refreshToken = await this.issueRefreshToken(user.id, access.tenant?.id || null, clientApp);
    return { token: accessToken, accessToken, refreshToken };
  }

  async refresh(rawRefreshToken: string, clientApp: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
    const client = await this.clientAppRepo.findOne({ where: { clientKey: clientApp, status: 'active' } });
    if (!client || Number(client.id) !== Number(stored.clientAppId)) {
      throw new UnauthorizedException('刷新令牌与客户端不匹配');
    }
    const user = await this.userRepo.findOne({ where: { id: stored.userId, status: 1 } });
    if (!user) throw new UnauthorizedException('用户不存在或已停用');
    const access = await this.accessControl.getIdentityContext(user.id, stored.tenantId);
    if (!access.tenant) throw new UnauthorizedException('租户成员关系已失效');

    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);
    const nextRefreshToken = await this.issueRefreshToken(user.id, access.tenant.id, clientApp);
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      azp: clientApp,
      tenantId: access.tenant.id,
      roles: access.roles,
      scopes: access.scopes,
      jti: randomUUID(),
    };
    const accessToken = this.jwtService.sign(payload);
    return { token: accessToken, accessToken, refreshToken: nextRefreshToken };
  }

  async revokeRefreshToken(rawRefreshToken: string, clientApp: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
    if (!stored) return;
    const client = await this.clientAppRepo.findOne({ where: { clientKey: clientApp } });
    if (!client || Number(client.id) !== Number(stored.clientAppId)) return;
    stored.revokedAt = new Date();
    await this.refreshTokenRepo.save(stored);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueRefreshToken(
    userId: number,
    tenantId: number | null,
    clientApp: string,
  ): Promise<string | null> {
    if (!tenantId || clientApp === 'unknown') return null;
    const client = await this.clientAppRepo.findOne({
      where: { clientKey: clientApp, status: 'active' },
    });
    if (!client) return null;
    const raw = randomBytes(48).toString('base64url');
    const days = Math.max(1, Number(process.env.REFRESH_TOKEN_DAYS || 30));
    const createdAt = new Date();
    await this.refreshTokenRepo.save({
      tokenHash: this.hashToken(raw),
      userId,
      tenantId,
      clientAppId: client.id,
      expiresAt: new Date(createdAt.getTime() + days * 86_400_000),
      revokedAt: null,
      createdAt,
    });
    return raw;
  }

  /** 注册 */
  async register(username: string, password: string, realName?: string) {
    const existing = await this.userRepo.findOne({
      where: { username, status: 1 },
    });
    if (existing) {
      throw new ConflictException('用户名已存在');
    }

    // bcrypt 哈希
    const pwdHash = await bcrypt.hash(password, 10);
    const now = Date.now();
    const user = await this.userRepo.save({
      username,
      password: pwdHash,
      realName: realName || '',
      role: 'student',
      status: 1,
      createTime: now,
      updateTime: now,
    });

    await this.accessControl.addDefaultMembership(user.id, 'student');

    return { id: user.id, username: user.username };
  }

  /** 获取当前用户信息 */
  async getMe(userId: number, tenantId?: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId, status: 1 },
    });
    if (!user) return null;

    let onboardingCompleted = false;
    if (user.role === 'student') {
      const student = await this.studentRepo.findOne({
        where: { userId: user.id, ...(tenantId ? { tenantId } : {}), status: 1 },
      });
      if (student && student.onboardingCompleted === 1) {
        onboardingCompleted = true;
      }
    }

    return {
      id: user.id,
      username: user.username,
      realName: user.realName || '',
      phone: user.phone || '',
      email: user.email || '',
      avatar: user.avatar || '',
      role: user.role,
      ...(tenantId ? { tenantId } : {}),
      onboardingCompleted,
    };
  }
}
