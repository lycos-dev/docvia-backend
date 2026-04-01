export interface Milestone {
  id: string;
  title: string;
  description: string;
  chapter: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  points: number;
  icon?: string;
}

export interface RoadmapProgress {
  currentMilestone: number;
  totalMilestones: number;
  completedMilestones: number;
  progressPercentage: number;
}

export interface Position {
  x: number;
  y: number;
}

export type AnimationState = 'idle' | 'unlocking' | 'completing';