import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default new DataSource({
  type: 'mysql',
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  username: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root123',
  database: process.env.MYSQL_DATABASE || 'zhipath',
  charset: 'UTF8MB4_UNICODE_CI',
  synchronize: false,
  logging: false,
  entities: [path.resolve(__dirname, '../entities/*.entity{.ts,.js}')],
  migrations: [path.resolve(__dirname, 'migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
});
