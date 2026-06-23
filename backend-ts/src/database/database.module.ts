import { Module } from '@nestjs/common';
import { MysqlModule } from './mysql.module';
import { MongodbModule } from './mongodb.module';
import { RedisModule } from './redis.module';
import { Neo4jModule } from './neo4j.module';

/**
 * 数据库聚合模块
 * 一次性导入所有数据库连接
 */
@Module({
  imports: [MysqlModule, MongodbModule, RedisModule, Neo4jModule],
  exports: [MysqlModule, MongodbModule, RedisModule, Neo4jModule],
})
export class DatabaseModule {}
