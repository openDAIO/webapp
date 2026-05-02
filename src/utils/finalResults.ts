import {
  FinalEvaluationSummary,
  NodeEvaluationResult,
  NodeEvaluationStatus,
  RoundEvaluationHistory,
} from '../types';

export const OUTLIER_STDDEV_MULTIPLIER = 1;
export const SLASH_RATE = 0.4;
export const OUTLIER_TRUST_PENALTY = 5;
export const ELIGIBLE_TRUST_REWARD = 1;

export interface NodeEvaluationInput {
  id: string;
  name: string;
  avatar?: string;
  finalScore: number;
  trustBefore: number;
  stakeAmount?: number;
  roundHistory?: RoundEvaluationHistory[];
}

export interface FinalResultCalculation {
  summary: FinalEvaluationSummary;
  nodes: NodeEvaluationResult[];
}

export function calculateAverage(scores: number[]) {
  if (scores.length === 0) return 0;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function calculateStandardDeviation(scores: number[], average = calculateAverage(scores)) {
  if (scores.length === 0) return 0;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

export function detectOutliers(
  nodes: Pick<NodeEvaluationInput, 'id' | 'finalScore'>[],
  average: number,
  standardDeviation: number,
  multiplier = OUTLIER_STDDEV_MULTIPLIER,
) {
  const thresholdLow = average - standardDeviation * multiplier;
  const thresholdHigh = average + standardDeviation * multiplier;

  return nodes
    .filter((node) => node.finalScore < thresholdLow || node.finalScore > thresholdHigh)
    .map((node) => node.id);
}

export function calculateFinalSummary(
  nodes: NodeEvaluationInput[],
  completedAt?: string,
  reviewBountyAmount = 0,
): FinalEvaluationSummary {
  const scores = nodes.map((node) => node.finalScore);
  const finalAverage = calculateAverage(scores);
  const standardDeviation = calculateStandardDeviation(scores, finalAverage);
  const outlierIds = detectOutliers(nodes, finalAverage, standardDeviation);
  const totalSlashedPool = nodes
    .filter((node) => outlierIds.includes(node.id))
    .reduce((sum, node) => sum + (node.stakeAmount ?? 0) * SLASH_RATE, 0);
  const eligibleNodeCount = nodes.length - outlierIds.length;

  return {
    finalAverage,
    standardDeviation,
    outlierThresholdLow: finalAverage - standardDeviation * OUTLIER_STDDEV_MULTIPLIER,
    outlierThresholdHigh: finalAverage + standardDeviation * OUTLIER_STDDEV_MULTIPLIER,
    totalSlashedPool,
    eligibleNodeCount,
    redistributionPerNode: 0,
    reviewBountyAmount,
    bountyPerEligibleNode: eligibleNodeCount > 0 ? reviewBountyAmount / eligibleNodeCount : 0,
    bountyAsset: 'USDAIO',
    completedAt,
  };
}

export function calculateSlashingAndRedistribution(
  nodes: NodeEvaluationInput[],
  completedAt = new Date().toISOString(),
  reviewBountyAmount = 0,
): FinalResultCalculation {
  const summary = calculateFinalSummary(nodes, completedAt, reviewBountyAmount);
  const outlierIds = new Set(detectOutliers(nodes, summary.finalAverage, summary.standardDeviation));

  return {
    summary,
    nodes: nodes.map((node) => {
      const stakeAmount = node.stakeAmount ?? 0;
      const isOutlier = outlierIds.has(node.id);
      const slashAmount = isOutlier ? stakeAmount * SLASH_RATE : 0;
      const rewardAmount = 0;
      const bountyRewardAmount = !isOutlier && summary.eligibleNodeCount > 0 ? summary.bountyPerEligibleNode : 0;
      const trustAfter = Math.max(
        0,
        Math.min(
          100,
          node.trustBefore + (isOutlier ? -OUTLIER_TRUST_PENALTY : bountyRewardAmount > 0 ? ELIGIBLE_TRUST_REWARD : 0),
        ),
      );
      const status: NodeEvaluationStatus = isOutlier
        ? slashAmount > 0
          ? 'slashed'
          : 'outlier'
        : bountyRewardAmount > 0
          ? 'rewarded'
          : 'within_range';

      return {
        id: node.id,
        name: node.name,
        avatar: node.avatar,
        finalScore: node.finalScore,
        trustBefore: node.trustBefore,
        trustAfter,
        stakeAmount,
        isOutlier,
        slashAmount,
        rewardAmount,
        bountyRewardAmount,
        status,
        finalReasoning:
          node.roundHistory?.find((entry) => entry.round === 'final')?.reasoning ??
          `${node.name} submitted a final score of ${node.finalScore}.`,
        roundHistory: node.roundHistory ?? [],
        chat: {
          maxQuestions: 3,
          questionsUsed: 0,
          messages: [],
        },
      };
    }),
  };
}

export function buildNodeResultRows(nodes: NodeEvaluationInput[], completedAt?: string, reviewBountyAmount = 0) {
  return calculateSlashingAndRedistribution(nodes, completedAt, reviewBountyAmount);
}
