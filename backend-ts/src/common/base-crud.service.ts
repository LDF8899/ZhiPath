import { Repository, ObjectLiteral, FindOptionsWhere, ILike } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * 泛型 CRUD 引擎 — 1:1 迁移 Python crud/base.py CRUDBase
 *
 * 所有查询自动过滤 status=1
 * 创建自动填充 createTime/updateTime/status
 * 删除是软删除（status→0）
 */
export abstract class BaseCrudService<T extends BaseEntity> {
  constructor(protected readonly repository: Repository<T>) {}

  /** 单条查询（自动过滤 status=1） */
  async findById(id: number): Promise<T | null> {
    return this.repository.findOne({
      where: { id, status: 1 } as FindOptionsWhere<T>,
    });
  }

  /** 分页列表 + 动态筛选 */
  async findMany(options: {
    skip?: number;
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<T[]> {
    const { skip = 0, limit = 20, filters = {} } = options;
    const where: any = { status: 1 };
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        where[key] = value;
      }
    }
    return this.repository.find({ where, skip, take: limit });
  }

  /** 计数 */
  async count(filters: Record<string, any> = {}): Promise<number> {
    const where: any = { status: 1 };
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        where[key] = value;
      }
    }
    return this.repository.count({ where });
  }

  /** 创建（自动填充时间戳和 status） */
  async create(data: Partial<T>): Promise<T> {
    const now = Date.now();
    const entity = this.repository.create({
      ...data,
      createTime: (data as any).createTime ?? now,
      updateTime: (data as any).updateTime ?? now,
      status: (data as any).status ?? 1,
    } as any);
    return this.repository.save(entity) as unknown as Promise<T>;
  }

  /** 更新 */
  async update(id: number, data: Partial<T>): Promise<T | null> {
    const entity = await this.findById(id);
    if (!entity) return null;
    Object.assign(entity, data, { updateTime: Date.now() });
    return this.repository.save(entity);
  }

  /** 软删除（status→0） */
  async delete(id: number): Promise<boolean> {
    const entity = await this.findById(id);
    if (!entity) return false;
    (entity as any).status = 0;
    (entity as any).updateTime = Date.now();
    await this.repository.save(entity);
    return true;
  }

  /** 多字段模糊搜索 */
  async search(
    keyword: string,
    fields: string[],
    skip = 0,
    limit = 20,
  ): Promise<T[]> {
    if (!keyword || !fields.length) return this.findMany({ skip, limit });

    const where: any[] = fields.map((field) => ({
      status: 1,
      [field]: ILike(`%${keyword}%`),
    }));

    return this.repository.find({
      where,
      skip,
      take: limit,
    });
  }
}
