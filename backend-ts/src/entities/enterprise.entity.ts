import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * 企业表 v3.0 — enterprises_v3
 */
@Entity('enterprises_v3')
export class Enterprise extends BaseEntity {
  @Column({ type: 'varchar', length: 200, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'industry' })
  industry: string;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'contact_email' })
  contactEmail: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'contact_name' })
  contactName: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'contact_phone' })
  contactPhone: string;
}
