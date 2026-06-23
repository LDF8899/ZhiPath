import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { setDataSource } from './database.helper';

/**
 * MySQL 连接模块（TypeORM）
 *
 * 关键约束：
 * - synchronize: false — 不自动改表，表结构由现有 MySQL 决定
 * - charset: UTF8MB4_UNICODE_CI — TypeORM 传给 mysql2 的是 collation 名称
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('MYSQL_HOST', '127.0.0.1'),
        port: config.get<number>('MYSQL_PORT', 3307),
        username: config.get('MYSQL_USER', 'root'),
        password: config.get('MYSQL_PASSWORD', 'root123'),
        database: config.get('MYSQL_DATABASE', 'zhipath'),
        charset: 'UTF8MB4_UNICODE_CI',
        synchronize: false,
        logging: config.get('DEBUG', 'false') === 'true' ? ['error'] : false,
        entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
        poolSize: 10,
        extra: {
          connectionLimit: 20,
        },
      }),
      dataSourceFactory: async (options) => {
        const { DataSource } = await import('typeorm');
        const ds = new DataSource(options!);
        await ds.initialize();
        setDataSource(ds);
        console.log('[MySQL] Connected to', options!.database);
        return ds;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class MysqlModule {}
