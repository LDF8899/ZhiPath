import { DataSource } from 'typeorm';

/**
 * 全局 DataSource 引用
 * 供 AuthGuard / AdminGuard 等非 DI 场景使用
 */
let _dataSource: DataSource;

export function setDataSource(ds: DataSource) {
  _dataSource = ds;
}

export function getDataSource(): DataSource {
  if (!_dataSource) {
    throw new Error('DataSource not initialized. Ensure DatabaseModule has been loaded.');
  }
  return _dataSource;
}
