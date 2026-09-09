import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthV1Controller } from './auth-v1.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { User } from '../../entities/user.entity';
import { Student } from '../../entities/student.entity';
import { ClientApp } from '../../entities/client-app.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { Tenant } from '../../entities/tenant.entity';
import { TenantMembership } from '../../entities/tenant-membership.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Student, ClientApp, RefreshToken, Tenant, TenantMembership]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32 || secret.includes('change-me')) {
          throw new Error('JWT_SECRET 必须配置为至少 32 字符的随机密钥');
        }
        return {
          secret,
          signOptions: {
            expiresIn: config.get('JWT_EXPIRES_IN', '7d'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController, AuthV1Controller],
  providers: [AuthService, RolesGuard],
  exports: [AuthService, JwtModule, RolesGuard],
})
export class AuthModule {}
