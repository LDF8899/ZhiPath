import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

/**
 * MongoDB 连接模块（Mongoose）
 *
 * 用于：用户画像、对话历史、知识库
 * 连接失败时应用继续启动，MongoDB 相关功能降级
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get('MONGODB_URL', 'mongodb://127.0.0.1:27017'),
        dbName: config.get('MONGODB_DATABASE', 'zhipath'),
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class MongodbModule {}
