// ── 图谱节点 (从 GraphSnapshot 提取的命名类型) ──
export interface SkillGraphNode {
  id: string;
  name: string;
  category: string;
  cluster: string;
  mastery: number;
  trustWeight: number;
  effectiveMastery: number;
  lastUpdated: number;
  prerequisites: string[];
  relatedSkills: string[];
  level: number;
}

// ── 图谱边 ──
export interface SkillEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'related' | 'path';
  strength: number;
}

// ── 图谱变化量 ──
export interface GraphDelta {
  nodeChanges: Array<{
    nodeId: string;
    field: string;
    before: number;
    after: number;
  }>;
  newNodes: string[];
  newEdges: Array<{ from: string; to: string; type: string; strength: number }>;
  metricsChange: {
    overallScore: number;
    matchScore: number;
    depthScore: number;
    breadthScore: number;
  };
}

// ── 图谱快照 ──
export interface GraphSnapshot {
  nodes: SkillGraphNode[];
  edges: SkillEdge[];
  metrics: {
    overallScore: number;
    matchScore: number;
    depthScore: number;
    breadthScore: number;
    balanceScore: number;
    learningSpeed: number;
    consistency: number;
  };
}

// ── 跨页面事件 ──
export type WorkspaceEvent =
  | {
      type: 'path_generated';
      planId: number;
      planName: string;
      totalSkills: number;
    }
  | {
      type: 'skill_completed';
      skillName: string;
      newMatchScore?: number;
      delta: GraphDelta;
      snapshot: GraphSnapshot;
    }
  | {
      type: 'exam_completed';
      skillName: string;
      passed: boolean;
      score: number;
      trustWeightChange: number;
    }
  | {
      type: 'match_updated';
      newScore: number;
      jobTitle?: string;
    }
  | {
      type: 'agent_task_completed';
      taskId: string;
      agentType: string;
      skillName?: string;
      delta?: GraphDelta;
    }
  | {
      type: 'agent_task_started';
      taskId: string;
      agentType: string;
    }
  | {
      type: 'agent_dispatched';
      agentType: string;
      target: 'chat' | 'node' | 'path';
      targetId?: string;
      autoMessage?: string;
    }
  | {
      type: 'agent_bound_to_path';
      agentType: string;
      pathId: number;
    }
  | {
      type: 'agent_advice';
      agentType: string;
      planId: string;
      advice: string;
      skillName?: string;
    }
  | {
      type: 'resource_ready';
      skillName: string;
      contentType: string;
    }
  | {
      type: 'today_tasks_refresh';
    };
