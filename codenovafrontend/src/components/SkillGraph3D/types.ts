// ── 3D 能力星图类型（移植自旧前端，字段对齐新后端数据源） ──

export interface SkillGraphNode {
  id: string;
  name: string;
  /** 所属阶段名（用于详情展示） */
  category: string;
  /** 簇 key（相位/自选），决定颜色与聚拢锚点 */
  cluster: string;
  mastery: number;
  trustWeight: number;
  effectiveMastery: number;
  lastUpdated: number;
  prerequisites: string[];
  relatedSkills: string[];
  /** 阶段序号 1-based，决定 Y 轴分层 */
  level: number;
  /** 是否已结业（讲义/测验/实操全过） */
  done?: boolean;
}

export interface SkillGraphEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related' | 'path';
  strength: number;
}

export interface GraphSnapshot {
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
  metrics: {
    overallScore: number;
    masteredCount: number;
    totalCount: number;
  };
}
