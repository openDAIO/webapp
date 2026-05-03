
export type SimulationPhase =
  | 'IDLE'
  | 'QUEUED'
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

export type ReviewGamePhase =
  | 'selection'
  | 'round1'
  | 'round2'
  | 'round3'
  | 'final';

export type AuditStatus = 'pending' | 'accepted' | 'ignored' | 'cancelled';

export interface Audit {
  id: string;
  fromReviewerId: string;
  toReviewerId: string;
  score: number;
  status: AuditStatus;
  arrivalOrder: number;
  createdAt?: number;
  acceptedAt?: number;
}

export interface ReviewerReputation {
  sampleCount: number;
  reportQuality: number;
  auditReliability: number;
  finalContribution: number;
  protocolCompliance: number;
  reputationScore: number;
}

export interface ReviewerNodeRound0 {
  reviewerScore: number;
  reviewerWeight: number;
  weightedScore: number;
}

export interface ReviewerNodeRound1 {
  incomingAuditScores: number[];
  auditScore: number;
  normalizedQuality: number;
  reliability: number;
  contribution: number;
  reviewerWeight: number;
  weightedScore: number;
  scoreImpact: number;
}

export interface ReviewerNodeRound2 {
  round1Weight: number;
  reputationScore: number;
  finalWeight: number;
  weightedScore: number;
  finalContribution: number;
}

export interface ReviewerNode {
  id: string;
  agentAddress?: `0x${string}`;
  name: string;
  avatar?: string;
  sprite?: string;
  selected: boolean;
  status?: 'selected' | 'standby' | 'reviewing' | 'auditing' | 'complete';
  proposalScore: number;
  reputationScore: number;
  reviewSummary: string;
  round0?: ReviewerNodeRound0;
  round1?: ReviewerNodeRound1;
  reputation?: ReviewerReputation;
  round2?: ReviewerNodeRound2;
}

export interface ReviewRoundState {
  phase: ReviewGamePhase;
  selectedReviewerIds: string[];
  reviewers: ReviewerNode[];
  round0ConsensusScore?: number;
  round1ConsensusScore?: number;
  round2ConsensusScore?: number;
  audits: Audit[];
  auditQuorum: number;
  acceptedAuditCount: number;
  fallbackUsed?: {
    round1: boolean;
    round2: boolean;
  };
}

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
  reputationBefore: number;
  reputationAfter: number;
  stakeAmount: number;
  isOutlier: boolean;
  slashAmount: number;
  rewardAmount: number;
  bountyRewardAmount: number;
  rewardSource?: 'frontend' | 'chain';
  protocolFault?: boolean;
  semanticFault?: boolean;
  slashCount?: number;
  status: NodeEvaluationStatus;
  finalReasoning: string;
  roundHistory: RoundEvaluationHistory[];
  reviewNode?: ReviewerNode;
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
  rewardSource?: 'frontend' | 'chain';
  rewardPoolAmount?: number;
  protocolFeeAmount?: number;
  totalRewardPaidAmount?: number;
  treasuryRemainderAmount?: number;
  treasuryAccrualAmount?: number;
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
  agentAddress?: `0x${string}`;
  name: string;
  avatar?: string;
  sprite?: string;
  color: string;
  emoji: string;
  speed: number;
  quality: number; // 0-1, affects how well it evaluates and responds
  reputationScore: number;
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
