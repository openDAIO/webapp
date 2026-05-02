
export type SimulationPhase =
  | 'IDLE'
  | 'SELECTION'
  | 'MOVING_TO_ROOMS'
  | 'ROUND_1'
  | 'ROUND_2_STARTING'
  | 'ROUND_2'
  | 'ROUND_3_STARTING'
  | 'ROUND_3'
  | 'FINALIZING'
  | 'EVALUATED';

export type NodeStatus =
  | 'IDLE'
  | 'MOVING'
  | 'THINKING'
  | 'DISCUSSING'
  | 'RETURNING'
  | 'REWARDED'
  | 'SLASHED';

export type NodeSelectionStatus = 'selected' | 'standby';

export interface RoundScore {
  round: number;
  score: number;
  reasoning: string;
  discussion: string;
  changeReason: string;
  discussedWith?: string[];
}

export interface RewardLedgerEntry {
  id: string;
  nodeId: string;
  nodeName: string;
  type: 'reward' | 'slash' | 'redistribution';
  amount: number;
  message: string;
}

export type RoundHistoryPhase =
  | 'independent_review'
  | 'cross_lab_discussion'
  | 'hallway_discussion'
  | 'final_scoring';

export interface RoundEvaluationHistory {
  round: number | 'final';
  title: string;
  phase: RoundHistoryPhase;
  scoreBefore?: number;
  scoreAfter: number;
  scoreChange?: number;
  reasoning: string;
  discussedWith?: string[];
  discussionSummary?: string;
  evidenceUsed?: string[];
}

export type NodeEvaluationStatus = 'within_range' | 'outlier' | 'rewarded' | 'slashed';

export interface NodeChatMessage {
  id: string;
  role: 'user' | 'node' | 'system';
  content: string;
  createdAt: string;
}

export interface NodeChatState {
  maxQuestions: number;
  questionsUsed: number;
  messages: NodeChatMessage[];
}

export interface NodeEvaluationResult {
  id: string;
  name: string;
  avatar?: string;
  finalScore: number;
  trustBefore: number;
  trustAfter: number;
  stakeAmount: number;
  isOutlier: boolean;
  slashAmount: number;
  rewardAmount: number;
  bountyRewardAmount: number;
  status: NodeEvaluationStatus;
  finalReasoning: string;
  roundHistory: RoundEvaluationHistory[];
  chat?: NodeChatState;
}

export interface FinalEvaluationSummary {
  finalAverage: number;
  standardDeviation: number;
  outlierThresholdLow: number;
  outlierThresholdHigh: number;
  totalSlashedPool: number;
  eligibleNodeCount: number;
  redistributionPerNode: number;
  reviewBountyAmount: number;
  bountyPerEligibleNode: number;
  bountyAsset: 'USDAIO';
  completedAt?: string;
}

export interface Coordinates {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  offsetX?: number; // pixels
  offsetY?: number; // pixels
}

export interface AICharacter {
  id: string;
  name: string;
  avatar?: string;
  sprite?: string;
  color: string;
  emoji: string;
  speed: number;
  quality: number; // 0-1, affects how well it evaluates and responds
  trustScore: number;
  stakeAmount: number;
  discussionSummary?: string;
  scoreReasoning?: string;
  scoreHistory: RoundScore[];
  lastScore?: number;
  isOutlier?: boolean;
  selected: boolean;
  selectionStatus: NodeSelectionStatus;
  status: NodeStatus;
  position: Coordinates;
  idlePosition: Coordinates;
  roomPosition: Coordinates;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
}

export interface Paper {
  id: string;
  title: string;
  content: string;
}
