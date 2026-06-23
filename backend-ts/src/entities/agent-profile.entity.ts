import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

/**
 * Agent 配置表 — agent_profiles_v3
 * 存储用户 Agent 员工配置（动物形象、颜色、昵称等）
 * 一个用户可以招聘多个员工，每个员工绑定一个 agentType
 */
@Entity('agent_profiles_v3')
export class AgentProfile extends BaseEntity {
  @Column({ type: 'bigint', name: 'user_id' })
  userId: number;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'agent_type',
    comment: 'Agent 类型：lecture/reading/code/path/assess/exam/skillgap/resume/profile/news',
  })
  agentType: string;

  @Column({ type: 'varchar', length: 20, name: 'animal_type', comment: '动物形象' })
  animalType: string;

  @Column({ type: 'varchar', length: 10, name: 'color', comment: '配色 hex' })
  color: string;

  @Column({ type: 'varchar', length: 20, name: 'nickname', comment: '自定义昵称' })
  nickname: string;

  @Column({ type: 'varchar', length: 30, name: 'display_role', comment: '显示岗位' })
  displayRole: string;

  @Column({ type: 'int', nullable: true, name: 'station_id', comment: '工位号 null=待命' })
  stationId: number | null;

  @Column({
    type: 'enum',
    enum: ['idle', 'busy'],
    default: 'idle',
    name: 'agent_status',
    comment: '当前状态',
  })
  agentStatus: 'idle' | 'busy';
}
