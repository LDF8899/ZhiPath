import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

export type EvaluationTargetType = 'skill' | 'radar_dimension' | 'job_match' | 'learning_action' | 'project';

@Entity('evaluation_rubrics_v3')
@Index(['rubricKey', 'version'], { unique: true })
export class EvaluationRubric extends BaseEntity {
  @Column({ type: 'varchar', length: 120, name: 'rubric_key' })
  rubricKey: string;

  @Column({ type: 'varchar', length: 160, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 40, default: '1.0.0', name: 'version' })
  version: string;

  @Column({
    type: 'enum',
    enum: ['skill', 'radar_dimension', 'job_match', 'learning_action', 'project'],
    default: 'skill',
    name: 'target_type',
  })
  targetType: EvaluationTargetType;

  @Column({ type: 'int', default: 70, name: 'pass_score' })
  passScore: number;

  @Column({ type: 'json', nullable: true, name: 'dimensions_json' })
  dimensionsJson: any[] | null;

  @Column({ type: 'json', nullable: true, name: 'weights_json' })
  weightsJson: Record<string, any> | null;
}
