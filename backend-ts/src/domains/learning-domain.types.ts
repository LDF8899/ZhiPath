export const LEARNING_GOAL_TYPES = [
  'career',
  'course',
  'exam',
  'certificate',
  'project',
  'interest',
] as const;

export type LearningGoalType = (typeof LEARNING_GOAL_TYPES)[number];

export interface LearningAbilityDefinition {
  id: string;
  name: string;
  estimatedMin: number;
  priority: number;
}

export interface LearningPhaseDefinition {
  name: string;
  abilities: LearningAbilityDefinition[];
}

export interface StarterLearningPath {
  id: string;
  title: string;
  description: string;
  goalType: LearningGoalType;
  phases: LearningPhaseDefinition[];
}

export interface LearningRadarDimensionDefinition {
  id: string;
  name: string;
  abilityIds: string[];
  weight: number;
}

export interface LearningDomain {
  id: string;
  name: string;
  description: string;
  goalTypes: LearningGoalType[];
  terminology: Record<string, string>;
  assessmentModes: string[];
  evidenceTypes: string[];
  passScore: number;
  radarDimensions: LearningRadarDimensionDefinition[];
  starterPaths: StarterLearningPath[];
}

export interface DomainPlanRequest {
  domainId: string;
  goalType: LearningGoalType;
  goalTitle?: string;
  starterPathId: string;
}
