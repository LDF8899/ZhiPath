import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserLlmConfig } from '../../entities/user-llm-config.entity';
import { AesCryptoService } from '../../services/aes-crypto.service';
import { UserLlmService } from './user-llm.service';
import { UserLlmController } from './user-llm.controller';
import { LlmService } from '../../services/llm.service';
import { UserLlmContextInterceptor } from './user-llm-context.interceptor';

/**
 * 用户 AI 服务商配置模块
 * 提供配置读写 + 将用户级 provider/key 注入 LlmService 请求上下文。
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserLlmConfig])],
  controllers: [UserLlmController],
  providers: [
    UserLlmService,
    AesCryptoService,
    LlmService,
    { provide: APP_INTERCEPTOR, useClass: UserLlmContextInterceptor },
  ],
  exports: [UserLlmService, AesCryptoService, LlmService],
})
export class UserLlmModule {}
