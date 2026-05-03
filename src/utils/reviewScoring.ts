import type { AICharacter, Audit, ReviewGamePhase, ReviewerNode, ReviewerReputation, ReviewRoundState } from '../types';

export const SCORE_SCALE = 10000;
// Frontend fallback: five spawned agents with a three-reviewer committee.
export const REVIEWER_COUNT = 3;
export const TOTAL_NODE_COUNT = 5;
export const REVIEW_VRF_PROBABILITY = REVIEWER_COUNT / TOTAL_NODE_COUNT;
export const AUDIT_VRF_PROBABILITY = 1.0;
export const AUDIT_QUORUM = 4;
export const MAX_CONCURRENT_REVIEWS = 2;
export const CONTRIBUTION_THRESHOLD = 3000;
export const MAX_AUDIT_SCORE = 10000;

const REVIEW_SUMMARIES = [
  'Clear evidence pass with a cautious check on reproducibility and baseline strength.',
  'Strong methods read; main concern is whether edge cases are supported by the appendix.',
  'Novelty is promising, but the score stays grounded in evidence quality and protocol fit.',
  'Positive result with a conservative adjustment for limited ablation coverage.',
  'Acceptable submission after separating presentation polish from actual research support.',
];

export function clampScore(value: number, min = 0, max = SCORE_SCALE) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[], mean = average(values)) {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function median(values: number[]) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sorted.length === 0) return 0;

  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];

  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function weightedMedian(values: number[], weights: number[]) {
  const pairs = values
    .map((value, index) => ({ value, weight: weights[index] ?? 0 }))
    .filter((pair) => pair.weight > 0)
    .sort((a, b) => a.value - b.value);

  if (pairs.length === 0) return null;

  const totalWeight = pairs.reduce((sum, pair) => sum + pair.weight, 0);
  let cumulative = 0;

  for (const pair of pairs) {
    cumulative += pair.weight;
    if (cumulative >= totalWeight / 2) {
      return pair.value;
    }
  }

  return pairs[pairs.length - 1].value;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: string) {
  const hash = hashString(seed);
  return (hash % 10000) / 10000;
}

function scoreJitter(seed: string, range: number) {
  return Math.round((seededUnit(seed) * 2 - 1) * range);
}

function proposalScoreFor(character: AICharacter, index: number) {
  const qualityScore = character.quality * 2500;
  const reputationScore = (character.reputationScore / 100) * 1400;
  const base = 5200 + qualityScore + reputationScore;
  return clampScore(base + scoreJitter(`${character.id}:proposal:${index}`, 520));
}

function characterReputationScore(character: AICharacter) {
  return clampScore((character.reputationScore / 100) * SCORE_SCALE);
}

export function calculateRound1Scores(reviewers: ReviewerNode[]) {
  const scoredReviewers = reviewers.map((reviewer) => ({
    ...reviewer,
    round0: {
      reviewerScore: reviewer.proposalScore,
      reviewerWeight: SCORE_SCALE,
      weightedScore: reviewer.proposalScore,
    },
  }));

  return {
    reviewers: scoredReviewers,
    consensusScore: median(scoredReviewers.map((reviewer) => reviewer.proposalScore)),
  };
}

export function generateAuditPairs(reviewers: ReviewerNode[]) {
  return reviewers.flatMap((fromReviewer) =>
    reviewers
      .filter((toReviewer) => toReviewer.id !== fromReviewer.id)
      .map((toReviewer) => ({
        fromReviewerId: fromReviewer.id,
        toReviewerId: toReviewer.id,
      })),
  );
}

function shuffledPairs<T>(items: T[], random: () => number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function simulateAuditArrivals(
  reviewers: ReviewerNode[],
  sourceCharacters: AICharacter[],
  random: () => number = Math.random,
) {
  const sourceById = new Map(sourceCharacters.map((character) => [character.id, character]));
  const reviewerById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));
  const pairs = shuffledPairs(generateAuditPairs(reviewers), random);
  const createdAtBase = Date.now();

  return pairs.map((pair, index): Audit => {
    const fromCharacter = sourceById.get(pair.fromReviewerId);
    const targetReviewer = reviewerById.get(pair.toReviewerId);
    const auditorQuality = fromCharacter?.quality ?? 0.75;
    const targetProposalScore = targetReviewer?.proposalScore ?? SCORE_SCALE / 2;
    const auditorBias = (auditorQuality - 0.75) * 520;
    const arrivalOrder = index + 1;
    const score = clampScore(
      targetProposalScore + auditorBias + scoreJitter(`${pair.fromReviewerId}:${pair.toReviewerId}:audit`, 720),
      0,
      MAX_AUDIT_SCORE,
    );
    const status = index < AUDIT_QUORUM ? 'accepted' : 'ignored';

    return {
      id: `audit-${pair.fromReviewerId}-${pair.toReviewerId}`,
      fromReviewerId: pair.fromReviewerId,
      toReviewerId: pair.toReviewerId,
      score,
      status,
      arrivalOrder,
      createdAt: createdAtBase + index * 640,
      acceptedAt: status === 'accepted' ? createdAtBase + arrivalOrder * 820 : undefined,
    };
  });
}

export function calculateAuditScore(reviewerId: string, audits: Audit[]) {
  const incomingAuditScores = audits
    .filter((audit) => audit.status === 'accepted' && audit.toReviewerId === reviewerId)
    .map((audit) => audit.score);

  return {
    incomingAuditScores,
    auditScore: incomingAuditScores.length > 0 ? median(incomingAuditScores) : 0,
  };
}

export function calculateAuditReliability(reviewerId: string, audits: Audit[]) {
  const acceptedAudits = audits.filter((audit) => audit.status === 'accepted');
  const outgoingAudits = acceptedAudits.filter((audit) => audit.fromReviewerId === reviewerId);
  const closenessScores = outgoingAudits.flatMap((audit) => {
    const otherScores = acceptedAudits
      .filter((candidate) => (
        candidate.toReviewerId === audit.toReviewerId &&
        candidate.fromReviewerId !== reviewerId
      ))
      .map((candidate) => candidate.score);

    if (otherScores.length === 0) return [];

    const otherAuditMedian = median(otherScores);
    const difference = Math.abs(audit.score - otherAuditMedian);

    return [clampScore(SCORE_SCALE - difference)];
  });

  if (closenessScores.length === 0) return 0;

  return clampScore(average(closenessScores));
}

export function calculateRound2Scores(reviewers: ReviewerNode[], audits: Audit[]) {
  const scoredReviewers = reviewers.map((reviewer) => {
    const { incomingAuditScores, auditScore } = calculateAuditScore(reviewer.id, audits);
    const normalizedQuality = clampScore((auditScore / MAX_AUDIT_SCORE) * SCORE_SCALE);
    const reliability = calculateAuditReliability(reviewer.id, audits);
    const contribution = Math.min(normalizedQuality, reliability);
    const reviewerWeight = contribution >= CONTRIBUTION_THRESHOLD ? contribution : 0;
    const weightedScore = clampScore((reviewer.proposalScore * reviewerWeight) / SCORE_SCALE);

    return {
      ...reviewer,
      round1: {
        incomingAuditScores,
        auditScore,
        normalizedQuality,
        reliability,
        contribution,
        reviewerWeight,
        weightedScore,
        scoreImpact: weightedScore - reviewer.proposalScore,
      },
    };
  });

  const proposalScores = scoredReviewers.map((reviewer) => reviewer.proposalScore);
  const reviewerWeights = scoredReviewers.map((reviewer) => reviewer.round1?.reviewerWeight ?? 0);
  const weightedConsensus = weightedMedian(proposalScores, reviewerWeights);

  return {
    reviewers: scoredReviewers,
    consensusScore: weightedConsensus ?? median(proposalScores),
    fallbackUsed: weightedConsensus === null,
  };
}

function mockReputationFor(
  reviewer: ReviewerNode,
  reviewerIndex: number,
): ReviewerReputation {
  const sampleCount = reviewerIndex === 2 ? 0 : reviewerIndex === 0 ? 8 : 4;
  const reputationScore = reviewer.reputationScore;

  return {
    sampleCount,
    reportQuality: reputationScore,
    auditReliability: reputationScore,
    finalContribution: reputationScore,
    protocolCompliance: reputationScore,
    reputationScore,
  };
}

export function calculateReputationScore(reputation: ReviewerReputation) {
  return clampScore(reputation.reputationScore);
}

export function calculateRound3Scores(reviewers: ReviewerNode[]) {
  const scoredReviewers = reviewers.map((reviewer, index) => {
    const reputation = mockReputationFor(reviewer, index);
    const reputationScore = calculateReputationScore(reputation);
    const round1Weight = reviewer.round1?.reviewerWeight ?? 0;
    const finalWeight = clampScore(Math.min((round1Weight * reputationScore) / SCORE_SCALE, SCORE_SCALE));
    const weightedScore = clampScore((reviewer.proposalScore * finalWeight) / SCORE_SCALE);

    return {
      ...reviewer,
      reputation: {
        ...reputation,
        reputationScore,
      },
      round2: {
        round1Weight,
        reputationScore,
        finalWeight,
        weightedScore,
        finalContribution: finalWeight,
      },
    };
  });

  const proposalScores = scoredReviewers.map((reviewer) => reviewer.proposalScore);
  const finalWeights = scoredReviewers.map((reviewer) => reviewer.round2?.finalWeight ?? 0);
  const weightedConsensus = weightedMedian(proposalScores, finalWeights);

  return {
    reviewers: scoredReviewers,
    consensusScore: weightedConsensus ?? median(proposalScores),
    fallbackUsed: weightedConsensus === null,
  };
}

export function createReviewerNodes(
  characters: AICharacter[],
  random: () => number = Math.random,
) {
  return characters.slice(0, REVIEWER_COUNT).map((character, index): ReviewerNode => ({
    id: character.id,
    name: character.name,
    avatar: character.avatar,
    sprite: character.sprite,
    selected: true,
    status: index < MAX_CONCURRENT_REVIEWS ? 'reviewing' : 'selected',
    proposalScore: clampScore(proposalScoreFor(character, index) + Math.round((random() - 0.5) * 160)),
    reputationScore: characterReputationScore(character),
    reviewSummary: REVIEW_SUMMARIES[index % REVIEW_SUMMARIES.length],
  }));
}

export function createReviewRoundState(
  selectedCharacters: AICharacter[],
  random: () => number = Math.random,
  phase: ReviewGamePhase = 'selection',
): ReviewRoundState {
  const reviewers = createReviewerNodes(selectedCharacters, random);
  const round1 = calculateRound1Scores(reviewers);
  const audits = simulateAuditArrivals(round1.reviewers, selectedCharacters, random);
  const round2 = calculateRound2Scores(round1.reviewers, audits);
  const round3 = calculateRound3Scores(round2.reviewers);
  const selectedReviewerIds = round3.reviewers.map((reviewer) => reviewer.id);

  return {
    phase,
    selectedReviewerIds,
    reviewers: round3.reviewers,
    round0ConsensusScore: round1.consensusScore,
    round1ConsensusScore: round2.consensusScore,
    round2ConsensusScore: round3.consensusScore,
    audits,
    auditQuorum: AUDIT_QUORUM,
    acceptedAuditCount: audits.filter((audit) => audit.status === 'accepted').length,
    fallbackUsed: {
      round1: round2.fallbackUsed,
      round2: round3.fallbackUsed,
    },
  };
}

export function updateReviewRoundPhase(
  state: ReviewRoundState | null,
  phase: ReviewGamePhase,
) {
  return state ? { ...state, phase } : null;
}
