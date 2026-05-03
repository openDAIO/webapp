/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, DoorOpen, FileDown, LayoutDashboard } from 'lucide-react';
import { useDaioData, type DaioData, type DaioReviewerProfile, type DaioReviewerRoundSnapshot } from './services/daio/useDaioData';
import { getAgentStatuses, type AgentStatus } from './services/daio/contentApi';
import { AICharacter, Coordinates, FinalEvaluationSummary, LogEntry, NodeEvaluationResult, ReviewGamePhase, ReviewRoundState, ReviewerNode, RoundEvaluationHistory, RoundScore, SimulationPhase } from './types';
import { buildAICharactersForRoom } from './data/mockCharacters';
import { MOCK_FINAL_RESULT_INPUTS } from './data/mockFinalResults';
import { buildNodeResultRows, type NodeEvaluationInput } from './utils/finalResults';
import { useNodeChat } from './hooks/useNodeChat';

import Character from './components/Character';
import ReviewBountyGateOverlay, { type ConfirmedReviewBounty } from './components/ReviewBountyGateOverlay';
import LogPanel from './components/LogPanel';
import ReputationScorePanel from './components/ReputationScorePanel';
import ConferenceHall from './components/ConferenceHall';
import ProjectRoom from './components/ProjectRoom';
import Navbar from './components/Navbar';
import DashboardPage from './components/DashboardPage';
import CommonsPage from './components/CommonsPage';
import LoadingTransition from './components/LoadingTransition';
import NodeSelectionScene from './components/NodeSelectionScene';
import NodeDetailDrawer from './components/NodeDetailDrawer';
import ConversationDrawer, { type ConversationDrawerData } from './components/ConversationDrawer';
import ThinkingDrawer from './components/ThinkingDrawer';
import Billboard from './components/Billboard';
import ReviewerSidePanel from './components/ReviewerSidePanel';
import AuditQuorumTracker from './components/AuditQuorumTracker';
import ContractStatePanel from './components/ContractStatePanel';
import { PixelFrameChrome } from './components/PixelFrame';
import { ActiveReviewRoomId, REVIEW_ROOMS } from './components/RoomSelectionPanel';
import { getRoomConfig, getCharacterTarget, type RoomConfigEntry } from './constants/roomConfig';
import { REVIEW_ROOM_SCENES } from './constants/reviewRoomScenes';
import { ASSET_PATHS } from './assets/assetPaths';
import {
  DEFAULT_SELECTED_NODE_COUNT,
  getReviewParticipants,
  getSelectedReviewNodes,
  selectReviewNodes,
} from './utils/nodeSelection';
import { AUDIT_QUORUM, createReviewRoundState } from './utils/reviewScoring';
import { daioProfileReputationPercent } from './utils/daioReputation';
import {
  CHARACTER_BASE_MOVE_DURATION_MS,
  FINAL_RESULT_EXPAND_DELAY_MS,
  FLOW_REVEAL_INITIAL_DELAY_MS,
  FLOW_REVEAL_STEP_MS,
  ROUND_INTRO_DURATION_MS,
  ROUND_MOVEMENT_SETTLE_MS,
  ROUND_RESULT_HOLD_MS,
  ROUND_REVEAL_BUFFER_MS,
  ROUND_THREE_RESULT_HOLD_MS,
  roundProcessDurationMs,
} from './constants/reviewFlowTiming';

type AppPage = 'dashboard' | 'commons' | 'loading' | 'room';

interface FinalResultState {
  summary: FinalEvaluationSummary;
  nodes: NodeEvaluationResult[];
}

interface DiscussionPlan {
  conversations: ConversationDrawerData[];
  idleNodeId?: string;
  idleNodeName?: string;
}

const roundDiscussions = {
  1: 'Initial independent review focused on methodology, evidence, and clarity.',
  2: 'Nodes compared notes in neighboring labs and challenged weak assumptions.',
  3: 'Small walking discussions resolved score gaps before final submission.',
};

const changeReasons = {
  1: 'Initial score based on local evidence extraction.',
  2: 'Revised after peer discussion and credibility checks.',
  3: 'Final adjustment after hallway discussion and outlier awareness.',
};
const REVIEW_LOG_PREFIX = '[DAIO][review]';
// Frontend fallback: five spawned agents with a three-reviewer committee.
// If chain participants are available, the UI uses the chain count instead.
const CONTRACT_EXPECTED_REVIEWER_COUNT = DEFAULT_SELECTED_NODE_COUNT;
const NODE_SELECTION_DRAW_MS = 3600;
const NODE_SELECTION_SELECTED_HOLD_MS = 2200;
const STATUS_AUDIT_COMMIT = 4;
const STATUS_AUDIT_REVEAL = 5;
const STATUS_FINALIZED = 6;
const CONTRACT_BPS = 10_000n;
const CONTRACT_PROTOCOL_FEE_BPS = 1_000n;

function logReview(event: string, payload: Record<string, unknown>) {
  console.debug(`${REVIEW_LOG_PREFIX} ${event}`, payload);
}

function isHexAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function uniqueHexAddresses(groups: readonly (readonly (string | undefined)[])[]): `0x${string}`[] {
  const byLowercase = new Map<string, `0x${string}`>();

  groups.forEach((group) => {
    group.forEach((address) => {
      if (!isHexAddress(address)) return;
      byLowercase.set(address.toLowerCase(), address);
    });
  });

  return Array.from(byLowercase.values());
}

function agentStatusesLogKey(statuses: AgentStatus[]) {
  return statuses
    .map((status) => [
      status.agent.toLowerCase(),
      status.phase ?? '',
      status.status,
      status.detail ?? '',
    ].join(':'))
    .sort()
    .join('|');
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function unknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringField(record: Record<string, unknown> | null, ...keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function ensNameFromAgentStatus(status: AgentStatus | undefined) {
  const payload = unknownRecord(status?.payload);
  const explicitEnsName = stringField(payload, 'ensName', 'ens', 'agentEnsName', 'agentEns', 'name');
  if (explicitEnsName?.includes('.')) return explicitEnsName;

  const agentId = payload?.agentId ?? payload?.agent_id ?? payload?.erc8004AgentId;
  const ensFromAgentId = ensNameFromAgentIdValue(agentId);
  if (ensFromAgentId) return ensFromAgentId;

  const label = stringField(payload, 'label', 'agentLabel');
  return ensNameFromAgentLabel(label);
}

function bigintFromAgentIdValue(value: unknown) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return undefined;
}

function agentIdFromAgentStatus(status: AgentStatus | undefined) {
  const payload = unknownRecord(status?.payload);
  return bigintFromAgentIdValue(payload?.agentId ?? payload?.agent_id ?? payload?.erc8004AgentId);
}

function ensNameFromAgentId(agentId: bigint | undefined) {
  if (!agentId || agentId === 0n) return undefined;
  const numericId = Number(agentId);
  const reviewerIndex = numericId - 1000;
  if (Number.isInteger(reviewerIndex) && reviewerIndex >= 1 && reviewerIndex <= 9999) {
    return `reviewer-${reviewerIndex}.daio.eth`;
  }
  return undefined;
}

function ensNameFromAgentIdValue(value: unknown) {
  if (typeof value === 'bigint') return ensNameFromAgentId(value);
  if (typeof value === 'number' && Number.isInteger(value)) return ensNameFromAgentId(BigInt(value));
  if (typeof value === 'string' && /^\d+$/.test(value)) return ensNameFromAgentId(BigInt(value));
  return undefined;
}

function ensNameFromAgentLabel(label: string | undefined) {
  if (!label) return undefined;
  if (label.includes('.')) return label;

  const match = label.match(/^(?:r|reviewer-|agent-)?(\d+)$/i);
  if (!match) return undefined;

  const reviewerIndex = Number(match[1]);
  return Number.isInteger(reviewerIndex) && reviewerIndex > 0
    ? `reviewer-${reviewerIndex}.daio.eth`
    : undefined;
}

function agentDisplayName(
  agentAddress: `0x${string}` | undefined,
  statusByAgentAddress: ReadonlyMap<string, AgentStatus>,
  profileByAddress: ReadonlyMap<string, DaioReviewerProfile>,
  profileByAgentId: ReadonlyMap<string, DaioReviewerProfile>,
  fallbackProfile?: DaioReviewerProfile,
) {
  if (!agentAddress) return fallbackProfile?.ensName ?? ensNameFromAgentId(fallbackProfile?.agentId);

  const lowercaseAddress = agentAddress.toLowerCase();
  const status = statusByAgentAddress.get(lowercaseAddress);
  const profile =
    profileByAddress.get(lowercaseAddress) ??
    profileByAgentId.get(agentIdFromAgentStatus(status)?.toString() ?? '') ??
    fallbackProfile;

  return (
    profile?.ensName ??
    ensNameFromAgentStatus(status) ??
    ensNameFromAgentId(profile?.agentId)
  );
}

function agentStatusByAddress(statuses: AgentStatus[]) {
  return new Map(
    statuses
      .filter((status) => isHexAddress(status.agent))
      .map((status) => [status.agent.toLowerCase(), status]),
  );
}

function numberFromContractScore(value: bigint) {
  return Number(value);
}

function numberFromContractUint(value: bigint | undefined, fallback = 0) {
  if (value === undefined) return fallback;
  return Number(value);
}

function numberFromTokenAmount(value: bigint | undefined, decimals = 18) {
  if (value === undefined) return 0;
  const divisor = 10n ** BigInt(decimals > 0 ? decimals : 18);
  const whole = value / divisor;
  const fraction = value % divisor;
  return Number(whole) + Number(fraction) / Number(divisor);
}

function contractFeeBreakdown(lifecycle: DaioData['requestLifecycle']) {
  if (!lifecycle) {
    return {
      feePaid: 0n,
      rewardPool: 0n,
      protocolFee: 0n,
    };
  }

  const feePaid = lifecycle.feePaid;
  let rewardPool = lifecycle.rewardPool;
  let protocolFee = lifecycle.protocolFee;

  // DAIOCore zeroes rewardPool/protocolFee after closeRequestToTreasury().
  // Reconstruct them from feePaid so the final screen can still show policy accounting.
  if (feePaid > 0n && rewardPool === 0n && protocolFee === 0n) {
    protocolFee = (feePaid * CONTRACT_PROTOCOL_FEE_BPS) / CONTRACT_BPS;
    rewardPool = feePaid - protocolFee;
  }

  return {
    feePaid,
    rewardPool,
    protocolFee,
  };
}

function auditReportQuorumFromDaio(daioData: DaioData) {
  const configQuorum = daioData.requestConfig?.auditRevealQuorum;
  if (configQuorum && configQuorum > 0n) {
    return Math.max(AUDIT_QUORUM, numberFromContractUint(configQuorum, AUDIT_QUORUM));
  }

  const phase = daioData.requestPhase;
  if (
    phase &&
    (phase.status === STATUS_AUDIT_COMMIT || phase.status === STATUS_AUDIT_REVEAL) &&
    phase.quorum > 0n
  ) {
    return Math.max(AUDIT_QUORUM, numberFromContractUint(phase.quorum, AUDIT_QUORUM));
  }

  return AUDIT_QUORUM;
}

function auditReportCountFromDaio(daioData: DaioData) {
  if (daioData.auditReportCount > 0) return daioData.auditReportCount;

  const lifecycleStatus = daioData.requestLifecycle?.status ?? daioData.latestRequestStatus;
  const revealCount = daioData.requestLifecycle?.auditRevealCount ?? 0n;
  const revealQuorum = daioData.requestConfig?.auditRevealQuorum ?? 0n;
  if (lifecycleStatus >= STATUS_FINALIZED || (revealQuorum > 0n && revealCount >= revealQuorum)) {
    return AUDIT_QUORUM;
  }

  return 0;
}

function simulationPhaseFromContractStatus(status: number, daioData: DaioData): SimulationPhase {
  if (status === 1) return 'QUEUED';
  if (status === 2) return 'ROUND_1';
  if (status === 3) return 'ROUND_1';
  if (status === 4) return daioData.roundAggregates.review.closed ? 'ROUND_2_STARTING' : 'ROUND_1';
  if (status === 5) return 'ROUND_2';
  if (status === 6) return daioData.roundAggregates.reputationFinal.closed ? 'EVALUATED' : 'FINALIZING';
  if (status >= 7) return 'FINALIZING';
  return 'IDLE';
}

function reviewPhaseFromContractStatus(status: number, daioData: DaioData): ReviewGamePhase {
  if (status === 1) return 'selection';
  if (status === 2 || status === 3) return 'round1';
  if (status === 4 || status === 5) return 'round2';
  if (status === 6 && daioData.roundAggregates.reputationFinal.closed) return 'final';
  if (status >= 6) return 'round3';
  return 'selection';
}

function currentRoundFromContractStatus(status: number) {
  if (status === 4 || status === 5) return 2;
  if (status >= 6) return 3;
  return 1;
}

function nodeStatusFromContractStatus(status: number, selected: boolean): AICharacter['status'] {
  if (!selected) return 'IDLE';
  if (status === 2 || status === 3) return 'THINKING';
  if (status === 4 || status === 5) return 'DISCUSSING';
  if (status >= 6) return 'IDLE';
  return 'IDLE';
}

function snapshotByAddress(daioData: DaioData) {
  return new Map(daioData.reviewerRoundSnapshots.map((snapshot) => [snapshot.address.toLowerCase(), snapshot]));
}

function firstAvailableScore(snapshot: DaioReviewerRoundSnapshot | undefined, fallback: number) {
  if (snapshot?.review.available) return numberFromContractScore(snapshot.review.score);
  if (snapshot?.auditConsensus.available) return numberFromContractScore(snapshot.auditConsensus.score);
  if (snapshot?.reputationFinal.available) return numberFromContractScore(snapshot.reputationFinal.score);
  return fallback;
}

function applyContractSnapshotToReviewer(
  reviewer: ReviewerNode,
  snapshot: DaioReviewerRoundSnapshot | undefined,
  agentAddress?: `0x${string}`,
  displayName?: string,
): ReviewerNode {
  const proposalScore = firstAvailableScore(snapshot, reviewer.proposalScore);
  const baseName = reviewer.name.replace(/\s+\(0x[a-fA-F0-9]{4}…[a-fA-F0-9]{4}\)$/, '');
  const resolvedAddress = snapshot?.address ?? agentAddress;
  const nextReviewer: ReviewerNode = {
    ...reviewer,
    agentAddress: resolvedAddress ?? reviewer.agentAddress,
    name: displayName ?? (resolvedAddress ? `${baseName} (${shortAddress(resolvedAddress)})` : reviewer.name),
    proposalScore,
  };

  if (!snapshot) return nextReviewer;

  if (snapshot.review.available) {
    nextReviewer.round0 = {
      reviewerScore: numberFromContractScore(snapshot.review.score),
      reviewerWeight: numberFromContractScore(snapshot.review.weight),
      weightedScore: numberFromContractScore(snapshot.review.weightedScore),
    };
  }

  if (snapshot.auditConsensus.available) {
    const auditScore = numberFromContractScore(snapshot.auditConsensus.auditScore);
    const reviewerWeight = numberFromContractScore(snapshot.auditConsensus.weight);
    const weightedScore = numberFromContractScore(snapshot.auditConsensus.weightedScore);
    nextReviewer.round1 = {
      incomingAuditScores: auditScore > 0 ? [auditScore] : [],
      auditScore,
      normalizedQuality: auditScore,
      reliability: reviewerWeight,
      contribution: reviewerWeight,
      reviewerWeight,
      weightedScore,
      scoreImpact: weightedScore - proposalScore,
    };
  }

  if (snapshot.reputationFinal.available) {
    const reputationScore = numberFromContractScore(snapshot.reputationFinal.reputationScore);
    const finalWeight = numberFromContractScore(snapshot.reputationFinal.weight);
    nextReviewer.reputation = {
      sampleCount: reputationScore > 0 ? 1 : 0,
      reportQuality: reputationScore,
      auditReliability: reputationScore,
      finalContribution: finalWeight,
      protocolCompliance: reputationScore,
      reputationScore,
    };
    nextReviewer.round2 = {
      round1Weight: nextReviewer.round1?.reviewerWeight ?? 0,
      reputationScore,
      finalWeight,
      weightedScore: numberFromContractScore(snapshot.reputationFinal.weightedScore),
      finalContribution: finalWeight,
    };
  }

  return nextReviewer;
}

function resetCharacter(char: AICharacter): AICharacter {
  return {
    ...char,
    status: 'IDLE',
    position: char.idlePosition,
    lastScore: undefined,
    isOutlier: false,
    selected: false,
    selectionStatus: 'standby',
    scoreHistory: [],
    scoreReasoning: undefined,
    discussionSummary: undefined,
  };
}

function ResultEffectGif({ src, className, style }: { src: string; className: string; style: CSSProperties }) {
  const [isHidden, setIsHidden] = useState(false);

  if (isHidden) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      style={style}
      onError={() => setIsHidden(true)}
    />
  );
}

function ResultSparkleSequence({ src, baseStyle }: { src: string; baseStyle: CSSProperties }) {
  const [cycle, setCycle] = useState(0);
  const [showRightSparkle, setShowRightSparkle] = useState(true);
  const [showLeftSparkle, setShowLeftSparkle] = useState(false);

  useEffect(() => {
    let rightTimeout: number | undefined;
    let leftTimeout: number | undefined;
    const startCycle = () => {
      setCycle((current) => current + 1);
      setShowRightSparkle(false);
      setShowLeftSparkle(false);
      rightTimeout = window.setTimeout(() => setShowRightSparkle(true), 40);
      leftTimeout = window.setTimeout(() => setShowLeftSparkle(true), 620);
    };

    startCycle();
    const interval = window.setInterval(startCycle, 1900);
    return () => {
      window.clearInterval(interval);
      if (rightTimeout) window.clearTimeout(rightTimeout);
      if (leftTimeout) window.clearTimeout(leftTimeout);
    };
  }, []);

  const left = typeof baseStyle.left === 'string' ? baseStyle.left : '0px';
  const top = typeof baseStyle.top === 'string' ? baseStyle.top : '0px';

  return (
    <>
      {showRightSparkle && (
        <ResultEffectGif
          src={`${src}?sparkle=right-${cycle}`}
          className="result-effect-gif result-sparkle-gif result-sparkle-gif--right"
          style={{
            left: `calc(${left} + 30px)`,
            top: `calc(${top} - 56px)`,
          }}
        />
      )}
      {showLeftSparkle && (
        <ResultEffectGif
          src={`${src}?sparkle=left-${cycle}`}
          className="result-effect-gif result-sparkle-gif result-sparkle-gif--left"
          style={{
            left: `calc(${left} - 28px)`,
            top: `calc(${top} - 20px)`,
          }}
        />
      )}
    </>
  );
}

function ResultExplosionSequence({ src, baseStyle }: { src: string; baseStyle: CSSProperties }) {
  const [cycle, setCycle] = useState(0);
  const [showRightExplosion, setShowRightExplosion] = useState(true);
  const [showLeftExplosion, setShowLeftExplosion] = useState(false);

  useEffect(() => {
    let rightTimeout: number | undefined;
    let leftTimeout: number | undefined;
    const startCycle = () => {
      setCycle((current) => current + 1);
      setShowRightExplosion(false);
      setShowLeftExplosion(false);
      rightTimeout = window.setTimeout(() => setShowRightExplosion(true), 40);
      leftTimeout = window.setTimeout(() => setShowLeftExplosion(true), 620);
    };

    startCycle();
    const interval = window.setInterval(startCycle, 1900);
    return () => {
      window.clearInterval(interval);
      if (rightTimeout) window.clearTimeout(rightTimeout);
      if (leftTimeout) window.clearTimeout(leftTimeout);
    };
  }, []);

  const left = typeof baseStyle.left === 'string' ? baseStyle.left : '0px';
  const top = typeof baseStyle.top === 'string' ? baseStyle.top : '0px';

  return (
    <>
      {showRightExplosion && (
        <ResultEffectGif
          src={`${src}?explosion=right-${cycle}`}
          className="result-effect-gif result-explosion-gif result-explosion-gif--right"
          style={{
            left: `calc(${left} + 24px)`,
            top: `calc(${top} - 48px)`,
          }}
        />
      )}
      {showLeftExplosion && (
        <ResultEffectGif
          src={`${src}?explosion=left-${cycle}`}
          className="result-effect-gif result-explosion-gif result-explosion-gif--left"
          style={{
            left: `calc(${left} - 24px)`,
            top: `calc(${top} - 30px)`,
          }}
        />
      )}
    </>
  );
}

function RoundScorePopup({ character, round, style }: { character: AICharacter; round: 1 | 2 | 3; style: CSSProperties }) {
  const [showDelta, setShowDelta] = useState(true);
  const entry = character.scoreHistory.find((score) => score.round === round);
  const previousScore = character.scoreHistory.find((score) => score.round === round - 1)?.score;
  const delta = previousScore === undefined || !entry ? undefined : entry.score - previousScore;

  useEffect(() => {
    setShowDelta(true);
    const timer = window.setTimeout(() => setShowDelta(false), 1050);
    return () => window.clearTimeout(timer);
  }, [character.id, round]);

  if (!entry) return null;

  return (
    <motion.div
      className="round-score-pop pointer-events-none absolute z-[65] -translate-x-1/2 text-center"
      style={style}
      initial={{ opacity: 0, scale: 0.88, y: 10 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.88, 1.04, 1, 0.94], y: [10, -2, -2, -12] }}
      exit={{ opacity: 0, scale: 0.92, y: -14 }}
      transition={{ duration: 2.45, times: [0, 0.16, 0.78, 1], ease: 'easeOut' }}
    >
      <div className="round-score-value">{entry.score}</div>
      <AnimatePresence>
        {showDelta && typeof delta === 'number' && delta !== 0 && (
          <motion.div
            key={`${character.id}-${round}-delta`}
            className={`round-score-delta ${delta > 0 ? 'round-score-delta--gain' : 'round-score-delta--loss'}`}
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: -6, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.9 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatReportAmount(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}

function reportTimestamp(value: number) {
  return new Date(value).toLocaleString();
}

function slugifyReportName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'review';
}

function buildEvaluationReport({
  roomTitle,
  roomDescription,
  evaluationId,
  finalResult,
  logs,
  reviewBounty,
}: {
  roomTitle: string;
  roomDescription: string;
  evaluationId: string;
  finalResult: FinalResultState;
  logs: LogEntry[];
  reviewBounty: ConfirmedReviewBounty | null;
}) {
  const { summary, nodes } = finalResult;
  const stakeAsset = summary.rewardSource === 'chain' ? summary.bountyAsset : 'TOK';
  const lines: string[] = [
    '# PixelReview Evaluation Report',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    `Evaluation ID: ${evaluationId}`,
    `Review Room: ${roomTitle}`,
    `Room Description: ${roomDescription}`,
    '',
    '## Final Result',
    '',
    `- Final Score: ${formatReportAmount(summary.finalAverage, 1)}`,
    `- Standard Deviation: ${formatReportAmount(summary.standardDeviation, 2)}`,
    `- Accepted Range: ${formatReportAmount(summary.outlierThresholdLow, 1)} - ${formatReportAmount(summary.outlierThresholdHigh, 1)}`,
    `- Bounty Winners: ${summary.eligibleNodeCount} / ${nodes.length}`,
    `- Reward Source: ${summary.rewardSource === 'chain' ? 'Contract accounting' : 'Frontend simulation'}`,
    `- Reward Pool: ${formatReportAmount(summary.rewardPoolAmount ?? summary.reviewBountyAmount, 2)} ${summary.bountyAsset}`,
    `- Protocol Fee: ${formatReportAmount(summary.protocolFeeAmount ?? 0, 2)} ${summary.bountyAsset}`,
    `- Rewards Paid: ${formatReportAmount(summary.totalRewardPaidAmount ?? nodes.reduce((sum, node) => sum + node.rewardAmount, 0), 2)} ${summary.bountyAsset}`,
    `- Slashed Stake Pool: ${formatReportAmount(summary.totalSlashedPool, 2)} ${stakeAsset}`,
    `- Treasury Accrual: ${formatReportAmount(summary.treasuryAccrualAmount ?? 0, 2)} ${summary.bountyAsset}`,
  ];

  if (reviewBounty) {
    lines.push(
      '',
      '## Bounty Payment',
      '',
      `- Amount: ${formatReportAmount(reviewBounty.amount, 2)} ${reviewBounty.asset}`,
      `- Network: ${reviewBounty.network}`,
      `- Transaction Hash: ${reviewBounty.txHash}`,
    );
  }

  lines.push(
    '',
    '## Node Results',
    '',
    '| Node | Final Score | Status | Reputation | Stake | Reward | Slash |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: |',
    ...nodes.map((node) => {
      const displayedReward = summary.rewardSource === 'chain' ? node.rewardAmount : node.bountyRewardAmount;
      return `| ${node.name} | ${node.finalScore} | ${node.status} | ${node.reputationBefore} -> ${node.reputationAfter} | ${formatReportAmount(node.stakeAmount, 1)} ${stakeAsset} | ${formatReportAmount(displayedReward, 2)} ${summary.bountyAsset} | ${formatReportAmount(node.slashAmount, 2)} ${stakeAsset} |`;
    }),
    '',
    '## Node Review History',
  );

  nodes.forEach((node) => {
    lines.push(
      '',
      `### ${node.name}`,
      '',
      `Final Reasoning: ${node.finalReasoning}`,
      '',
    );

    node.roundHistory.forEach((history) => {
      lines.push(
        `- ${history.title}`,
        `  - Phase: ${history.phase}`,
        `  - Score: ${history.scoreBefore !== undefined ? `${history.scoreBefore} -> ` : ''}${history.scoreAfter}`,
        `  - Reasoning: ${history.reasoning}`,
      );

      if (history.discussedWith?.length) {
        lines.push(`  - Discussed With: ${history.discussedWith.join(', ')}`);
      }
      if (history.discussionSummary) {
        lines.push(`  - Discussion Summary: ${history.discussionSummary}`);
      }
      if (history.evidenceUsed?.length) {
        lines.push(`  - Evidence Used: ${history.evidenceUsed.join(', ')}`);
      }
    });
  });

  lines.push(
    '',
    '## Event Log',
    '',
    ...logs.map((log) => `- [${reportTimestamp(log.timestamp)}] ${log.message}`),
    '',
  );

  return lines.join('\n');
}

function buildRoundScore(char: AICharacter, round: number, conversation?: ConversationDrawerData): RoundScore {
  const previousScore = char.scoreHistory.at(-1)?.score;
  const target = 72 + char.quality * 18;
  const spread = (1 - char.quality) * 28;
  const rawScore =
    previousScore === undefined
      ? target + (Math.random() * spread * 2 - spread)
      : previousScore + (target - previousScore) * 0.35 + (Math.random() * 10 - 5);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const peerNames = conversation?.participantNames.filter((name) => name !== char.name);
  const discussion = conversation
    ? conversation.summary
    : round === 1
      ? roundDiscussions[1]
      : `${char.name} had no direct peer conversation this round and kept reviewing locally for the next rotation.`;

  return {
    round,
    score,
    reasoning: `${char.name} weighted evidence quality, novelty, and reviewer confidence. The current estimate is ${score}/100.`,
    discussion,
    changeReason: changeReasons[round as 1 | 2 | 3],
    discussedWith: peerNames,
  };
}

function scoreScaleToChart(value: number) {
  return Math.max(0, Math.min(100, Number((value / 100).toFixed(2))));
}

function buildProtocolRoundScore(
  char: AICharacter,
  reviewer: ReviewerNode,
  reviewState: ReviewRoundState,
  round: number,
): RoundScore {
  if (round === 1) {
    const score = scoreScaleToChart(reviewer.round0?.reviewerScore ?? reviewer.proposalScore);

    return {
      round,
      score,
      reasoning: `${char.name} submitted proposalScore ${reviewer.proposalScore}/10000 as an independent review.`,
      discussion: 'Independent proposal review. All selected reviewers have reviewerWeight 10000.',
      changeReason: 'Round 1 consensus uses the median of individual proposal scores.',
    };
  }

  if (round === 2) {
    const score = scoreScaleToChart(reviewer.proposalScore);
    const incomingCount = reviewer.round1?.incomingAuditScores.length ?? 0;

    return {
      round,
      score,
      reasoning: `${char.name} received auditScore ${reviewer.round1?.auditScore ?? 0}/10000 and reliability ${reviewer.round1?.reliability ?? 0}/10000.`,
      discussion: `Peer audit quorum accepted ${reviewState.acceptedAuditCount}/${reviewState.auditQuorum} first-arriving audits. Self-audits were excluded.`,
      changeReason: `Audit contribution was calculated from ${incomingCount} incoming audit score${incomingCount === 1 ? '' : 's'} and outgoing audit reliability.`,
      discussedWith: reviewState.reviewers.filter((peer) => peer.id !== reviewer.id).map((peer) => peer.name),
    };
  }

  const score = scoreScaleToChart(reviewer.proposalScore);

  return {
    round,
    score,
    reasoning: `${char.name} applied finalWeight ${reviewer.round2?.finalWeight ?? 0}/10000 after reputationScore ${reviewer.round2?.reputationScore ?? 0}/10000.`,
    discussion: reviewer.reputation?.sampleCount === 0
      ? 'No prior samples: the current node reputation baseline was applied before final weighted median.'
      : 'Long-term reputation components adjusted the audit-based reviewer weight.',
    changeReason: 'Round 3 consensus uses finalWeight based weighted median.',
  };
}

function reviewGamePhaseFromSimulation(phase: SimulationPhase): ReviewGamePhase {
  switch (phase) {
    case 'QUEUED':
      return 'selection';
    case 'SELECTION':
      return 'selection';
    case 'MOVING_TO_ROOMS':
    case 'ROUND_1':
      return 'round1';
    case 'ROUND_2_STARTING':
    case 'ROUND_2':
      return 'round2';
    case 'ROUND_3_STARTING':
    case 'ROUND_3':
    case 'FINALIZING':
      return 'round3';
    case 'EVALUATED':
      return 'final';
    default:
      return 'selection';
  }
}

function buildRoomRoundHistory(char: AICharacter, finalScore: number): RoundEvaluationHistory[] {
  const roundHistory: RoundEvaluationHistory[] = char.scoreHistory.map((entry) => ({
    round: entry.round,
    title: `Round ${entry.round} — ${entry.round === 1 ? 'Independent Review' : entry.round === 2 ? 'Cross-lab Discussion' : 'Hallway Discussion'}`,
    phase: entry.round === 1 ? 'independent_review' : entry.round === 2 ? 'cross_lab_discussion' : 'hallway_discussion',
    scoreBefore: char.scoreHistory.find((score) => score.round === entry.round - 1)?.score,
    scoreAfter: entry.score,
    scoreChange: entry.round > 1 ? entry.score - (char.scoreHistory.find((score) => score.round === entry.round - 1)?.score ?? entry.score) : undefined,
    reasoning: entry.reasoning,
    discussedWith: entry.discussedWith,
    discussionSummary: entry.discussion,
    evidenceUsed: [entry.changeReason],
  }));

  const finalPreviousScore = char.scoreHistory.at(-1)?.score ?? finalScore;

  return [
    ...roundHistory,
    {
      round: 'final',
      title: 'Final — Final Scoring',
      phase: 'final_scoring',
      scoreBefore: finalPreviousScore,
      scoreAfter: finalScore,
      scoreChange: finalScore - finalPreviousScore,
      reasoning: `${char.name} submitted ${finalScore} as the final score after this room's discussion cycle.`,
      discussionSummary: 'Final score submitted to the consensus board.',
      evidenceUsed: ['Room-local review history', 'Peer discussion notes', 'Final score reconciliation'],
    },
  ];
}

function buildRoomFinalInputs(characters: AICharacter[]): NodeEvaluationInput[] {
  const mockInputById = new Map(MOCK_FINAL_RESULT_INPUTS.map((node) => [node.id, node]));

  return characters.map((character) => {
    const mockInput = mockInputById.get(character.id);
    const finalScore =
      character.scoreHistory.at(-1)?.score ??
      character.lastScore ??
      mockInput?.finalScore ??
      Math.round(72 + character.quality * 18);

    return {
      id: character.id,
      name: character.name,
      avatar: character.avatar ?? ASSET_PATHS.characters.reviewers[character.id]?.portrait,
      finalScore,
      reputationBefore: character.reputationScore,
      stakeAmount: character.stakeAmount,
      roundHistory: character.scoreHistory.length > 0
        ? buildRoomRoundHistory(character, finalScore)
        : mockInput?.roundHistory,
    };
  });
}

function withPositionOffset(base: ReturnType<typeof getCharacterTarget>, offsetX = 0, offsetY = 0) {
  return {
    ...base,
    offsetX: (base.offsetX || 0) + offsetX,
    offsetY: (base.offsetY || 0) + offsetY,
  };
}

function buildTranscript(first: AICharacter, second: AICharacter, round: number): ConversationDrawerData['transcript'] {
  return [
    {
      speakerId: first.id,
      speakerName: first.name,
      message: `I am checking whether the current score is supported by concrete evidence anchors before we move it in round ${round}.`,
    },
    {
      speakerId: second.id,
      speakerName: second.name,
      message: 'I would separate novelty, reproducibility, and confidence. A strong claim should not raise every component unless the methods are also clear.',
    },
    {
      speakerId: first.id,
      speakerName: first.name,
      message: 'Agreed. I will move only the confidence portion and keep the core quality estimate stable unless the evidence boundary changes.',
    },
    {
      speakerId: second.id,
      speakerName: second.name,
      message: 'Then the next score update should cite the shared evidence rule and avoid reacting to the loudest objection alone.',
    },
  ];
}

function buildDiscussionPlan(characters: AICharacter[], round: number): DiscussionPlan {
  const ordered = characters;
  const idleIndex = ordered.length % 2 === 1
    ? (ordered.length - 1 - ((round - 2) % ordered.length) + ordered.length) % ordered.length
    : -1;
  const idleCharacter = idleIndex >= 0 ? ordered[idleIndex] : undefined;
  const activeCharacters = ordered.filter((_, index) => index !== idleIndex);
  const rotation = activeCharacters.length > 0 ? (round - 2) % activeCharacters.length : 0;
  const rotatedCharacters = [
    ...activeCharacters.slice(rotation),
    ...activeCharacters.slice(0, rotation),
  ];

  const conversations: ConversationDrawerData[] = [];
  for (let index = 0; index < rotatedCharacters.length; index += 2) {
    const first = rotatedCharacters[index];
    const second = rotatedCharacters[index + 1];
    if (!first || !second) continue;

    const locationLabel = round === 2 ? `${first.name} Lab` : `Hallway cluster ${Math.floor(index / 2) + 1}`;
    conversations.push({
      id: `round-${round}-${first.id}-${second.id}`,
      round,
      participantIds: [first.id, second.id],
      participantNames: [first.name, second.name],
      locationLabel,
      summary: `${first.name} and ${second.name} compared evidence and calibrated their next score update.`,
      transcript: buildTranscript(first, second, round),
    });
  }

  return {
    conversations,
    idleNodeId: idleCharacter?.id,
    idleNodeName: idleCharacter?.name,
  };
}

function findConversationForNode(conversations: ConversationDrawerData[], nodeId: string) {
  return conversations.find((conversation) => conversation.participantIds.includes(nodeId));
}

function roomDiscussionPosition(
  character: AICharacter,
  conversation: ConversationDrawerData | undefined,
  participantIndex: number,
  reviewRoomId: ActiveReviewRoomId,
) {
  if (!conversation) return getCharacterTarget(character.id, reviewRoomId);

  const hostTarget = getCharacterTarget(conversation.participantIds[0], reviewRoomId);
  if (participantIndex === 0) return hostTarget;

  const guestOffsetX = hostTarget.x > 50 ? -54 : 54;
  return withPositionOffset(hostTarget, guestOffsetX, 4);
}

function hallwayDiscussionPosition(pairIndex: number, participantIndex: number) {
  const clusters = [
    { x: 44, y: 48, offsetX: -28, offsetY: 0 },
    { x: 44, y: 48, offsetX: 28, offsetY: 0 },
    { x: 56, y: 58, offsetX: -24, offsetY: 0 },
    { x: 56, y: 58, offsetX: 24, offsetY: 0 },
  ];
  return clusters[(pairIndex * 2 + participantIndex) % clusters.length];
}

function reviewTablePosition(index: number) {
  const seats: Coordinates[] = [
    { x: 50, y: 58, offsetX: -58, offsetY: 4 },
    { x: 50, y: 58, offsetX: 0, offsetY: -22 },
    { x: 50, y: 58, offsetX: 58, offsetY: 4 },
  ];

  return seats[index % seats.length];
}

function emptyRoomMeetingPosition(index: number, reviewRoomId: ActiveReviewRoomId) {
  const emptyRoom = REVIEW_ROOM_SCENES[reviewRoomId].rooms.find((room) => !room.reviewerId);
  if (!emptyRoom) return reviewTablePosition(index);

  const base = getCharacterTarget(emptyRoom.id, reviewRoomId);
  const offsets = [
    { x: -34, y: 8 },
    { x: 0, y: -20 },
    { x: 34, y: 8 },
  ];
  const offset = offsets[index % offsets.length];

  return withPositionOffset(base, offset.x, offset.y);
}

function positionsMatch(first: Coordinates, second: Coordinates) {
  return first.x === second.x
    && first.y === second.y
    && (first.offsetX || 0) === (second.offsetX || 0)
    && (first.offsetY || 0) === (second.offsetY || 0);
}

function movementDurationMs(character: AICharacter, nextPosition: Coordinates) {
  return positionsMatch(character.position, nextPosition) ? 0 : CHARACTER_BASE_MOVE_DURATION_MS / character.speed;
}

function ReputationWeightingPanel({ state }: { state: ReviewRoundState }) {
  return (
    <section className="review-room-activity-panel pixel-box warm-panel relative overflow-hidden p-3 text-[#202528]">
      <PixelFrameChrome round={2} />
      <div className="relative z-30">
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#d7b98f] pb-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#2f5d7e]">Reputation Weighting</div>
            <p className="mt-1 text-[10px] leading-snug text-[#6b563f]">
              Round 2 weight x reputation = final weight.
            </p>
          </div>
          <div className="border-2 border-[#d7b98f] bg-[#fffef3] px-2 py-1 text-right">
            <div className="text-[8px] font-bold uppercase text-[#8c745b]">Consensus</div>
            <div className="font-mono text-sm font-bold text-[#2f5d7e]">
              {formatProtocolValue(state.round2ConsensusScore)}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {state.reviewers.map((reviewer) => (
            <div key={reviewer.id} className="border-2 border-[#d7b98f] bg-[#fffef3] px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold text-[#503521]">{reviewer.name}</span>
                {reviewer.reputation?.sampleCount === 0 && (
                  <span className="shrink-0 border border-[#e5b45f] bg-[#fff8e6] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#6b563f]">
                    New
                  </span>
                )}
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-[8px] uppercase tracking-wider text-[#8c745b]">
                <ProtocolMiniStat label="R2 Wt" value={reviewer.round2?.round1Weight} />
                <ProtocolMiniStat label="Reputation" value={reviewer.round2?.reputationScore} />
                <ProtocolMiniStat label="Final" value={reviewer.round2?.finalWeight} />
              </div>
              <div className="mt-2 h-2 border border-[#d7b98f] bg-[#ead9b1]">
                <div
                  className="h-full bg-[#2f5d7e]"
                  style={{ width: `${Math.max(0, Math.min(100, (reviewer.round2?.finalWeight ?? 0) / 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProtocolMiniStat({ label, value }: { label: string; value?: number }) {
  return (
    <span className="min-w-0 border border-[#d7b98f] bg-[#fff8e6] px-1 py-1">
      <span className="block truncate">{label}</span>
      <strong className="block truncate font-mono text-[10px] text-[#2f5d7e]">{formatProtocolValue(value)}</strong>
    </span>
  );
}

function formatProtocolValue(value?: number) {
  return typeof value === 'number' ? value.toLocaleString() : '--';
}

function roundIntroSubtitle(round: 1 | 2 | 3) {
  if (round === 1) return 'Individual Review';
  if (round === 2) return 'Peer Audit';
  return 'Reputation Weighted';
}

export default function App() {
  // Chain data — provides on-chain request status that survives page reload.
  const daioData = useDaioData();

  const [page, setPage] = useState<AppPage>('commons');
  const [selectedRoom, setSelectedRoom] = useState<ActiveReviewRoomId>(() => {
    const saved = localStorage.getItem('daio_selected_room');
    return (saved === 'paper' || saved === 'judgment') ? saved : 'paper';
  });
  const [loadingRoom, setLoadingRoom] = useState<ActiveReviewRoomId>('paper');
  const [characters, setCharacters] = useState<AICharacter[]>(() => buildAICharactersForRoom('paper').map(resetCharacter));
  const [phase, setPhase] = useState<SimulationPhase>('IDLE');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeConversations, setActiveConversations] = useState<ConversationDrawerData[]>([]);
  const [metConversationIds, setMetConversationIds] = useState<string[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedThinkingNodeId, setSelectedThinkingNodeId] = useState<string | null>(null);
  const [pendingDiscussionAdvanceRound, setPendingDiscussionAdvanceRound] = useState<1 | 2 | 3 | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [showChart, setShowChart] = useState(false);
  const [finalResult, setFinalResult] = useState<FinalResultState | null>(null);
  const [roomReviewBounty, setRoomReviewBounty] = useState<ConfirmedReviewBounty | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [openRoomSelectionSignal, setOpenRoomSelectionSignal] = useState(0);
  const [evaluationId, setEvaluationId] = useState(() => `eval_${Date.now()}`);
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [roundIntro, setRoundIntro] = useState<{ round: 1 | 2 | 3; id: number } | null>(null);
  const [roundResultHoldRound, setRoundResultHoldRound] = useState<1 | 2 | 3 | null>(null);
  const [roundProcessStartDelayMs, setRoundProcessStartDelayMs] = useState(0);
  const [isNodeSelectionReady, setIsNodeSelectionReady] = useState(false);
  const [visibleChainAuditCount, setVisibleChainAuditCount] = useState(0);
  const [reviewRoundState, setReviewRoundState] = useState<ReviewRoundState | null>(null);
  const nodeChat = useNodeChat(evaluationId);
  const daioDataRef = useRef(daioData);
  const charactersRef = useRef(characters);
  const reviewRoundStateRef = useRef<ReviewRoundState | null>(reviewRoundState);
  const activeConversationsRef = useRef(activeConversations);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const selectedConversationIdRef = useRef(selectedConversationId);
  const selectedThinkingNodeIdRef = useRef(selectedThinkingNodeId);
  const meetingTimersRef = useRef<number[]>([]);
  const sideboardActivityRef = useRef<HTMLDivElement | null>(null);
  const selectionCompletionLoggedRef = useRef(false);
  const lastContractStatusKeyRef = useRef('');
  const lastContractRequestIdRef = useRef<string | null>(null);
  const lastAgentStatusLogKeyRef = useRef('');
  const contractSelectionAnimatedRequestRef = useRef<string | null>(null);
  const selectedCharacterIdsByRequestRef = useRef<Record<string, string[]>>({});
  const contractMotionRoundsRef = useRef<Record<string, boolean>>({});
  const appliedContractRoundsRef = useRef<Record<1 | 2 | 3, boolean>>({
    1: false,
    2: false,
    3: false,
  });
  const roundApplyTimerRefs = useRef<Record<1 | 2 | 3, number | null>>({
    1: null,
    2: null,
    3: null,
  });
  const finalizedContractRequestRef = useRef<string | null>(null);

  const selectedConversation = useMemo(
    () => activeConversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [activeConversations, selectedConversationId],
  );
  const selectedNodeResult = useMemo(
    () => finalResult?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [finalResult, selectedNodeId],
  );
  const activeRoomConfig = useMemo(() => getRoomConfig(selectedRoom), [selectedRoom]);
  const activeRoomScene = REVIEW_ROOM_SCENES[selectedRoom];
  const loadingReviewers = useMemo(
    () => buildAICharactersForRoom(loadingRoom).map(resetCharacter),
    [loadingRoom],
  );
  const reviewParticipants = useMemo(() => getReviewParticipants(characters), [characters]);
  const selectedReviewCharacterCount = useMemo(() => getSelectedReviewNodes(characters).length, [characters]);
  const releasedRounds = useMemo(() => {
    const maxRound = characters.reduce((latest, character) => Math.max(
      latest,
      character.scoreHistory.reduce((max, entry) => Math.max(max, entry.round), 0),
    ), 0);
    return { 1: maxRound >= 1, 2: maxRound >= 2, 3: maxRound >= 3 } as const;
  }, [characters]);
  const sceneCharacters = phase === 'IDLE' || phase === 'QUEUED' || phase === 'SELECTION' || phase === 'MOVING_TO_ROOMS' ? characters : reviewParticipants;
  const sideboardCharacters = characters;
  const selectedThinkingNode = useMemo(
    () => reviewParticipants.find((character) => character.id === selectedThinkingNodeId && character.status === 'THINKING') ?? null,
    [reviewParticipants, selectedThinkingNodeId],
  );
  /**
   * Room grid "In Progress" — from chain: latestRequestId > 0 and not terminal (PaymentRouter.latestRequestState:
   * completed once status >= Finalized). Also true while the local simulation runs.
   */
  const hasActiveOnChainRequest =
    daioData.latestRequestId > 0n && !daioData.latestRequestCompleted;

  const isEvaluationInProgress =
    phase !== 'IDLE' ||
    Boolean(finalResult) ||
    hasActiveOnChainRequest;
  const activeAgentStatusRequestId =
    roomReviewBounty?.requestId ??
    (hasActiveOnChainRequest ? daioData.latestRequestId.toString() : null);
  const isContractDrivenReview = Boolean(activeAgentStatusRequestId);
  const chainAuditQuorum = auditReportQuorumFromDaio(daioData);
  const chainAuditReportTargetCount = Math.min(
    chainAuditQuorum,
    auditReportCountFromDaio(daioData),
  );
  const displayedChainAuditCount = Math.min(visibleChainAuditCount, chainAuditQuorum);
  const auditQuorumDisplayReady =
    !isContractDrivenReview ||
    chainAuditReportTargetCount < chainAuditQuorum ||
    displayedChainAuditCount >= chainAuditQuorum;
  const agentStatusSyncKey = agentStatusesLogKey(agentStatuses);
  const chainParticipantsKey = [
    daioData.reviewCommitters.join(','),
    daioData.revealedReviewers.join(','),
    daioData.reviewParticipants.join(','),
    daioData.auditParticipants.join(','),
  ].join('|');
  const chainAuditProgressKey = [
    daioData.requestPhase?.status ?? '',
    daioData.requestPhase?.count ?? '',
    daioData.requestPhase?.quorum ?? '',
    daioData.requestLifecycle?.auditCommitCount ?? '',
    daioData.requestLifecycle?.auditRevealCount ?? '',
    daioData.auditReportCount,
    daioData.requestConfig?.auditRevealQuorum ?? '',
    displayedChainAuditCount,
  ].map(String).join('|');
  const chainRoundAggregateKey = [
    daioData.roundAggregates.review.score,
    daioData.roundAggregates.review.totalWeight,
    daioData.roundAggregates.review.closed,
    daioData.roundAggregates.auditConsensus.score,
    daioData.roundAggregates.auditConsensus.totalWeight,
    daioData.roundAggregates.auditConsensus.closed,
    daioData.roundAggregates.reputationFinal.score,
    daioData.roundAggregates.reputationFinal.totalWeight,
    daioData.roundAggregates.reputationFinal.closed,
  ].map(String).join('|');
  const chainReviewerSnapshotKey = daioData.reviewerRoundSnapshots.map((snapshot) => [
    snapshot.address,
    snapshot.review.available,
    snapshot.review.score,
    snapshot.review.weight,
    snapshot.auditConsensus.available,
    snapshot.auditConsensus.score,
    snapshot.auditConsensus.weight,
    snapshot.auditConsensus.auditScore,
    snapshot.reputationFinal.available,
    snapshot.reputationFinal.score,
    snapshot.reputationFinal.weight,
    snapshot.reputationFinal.reputationScore,
    snapshot.finalAccounting.reward,
    snapshot.finalAccounting.slashed,
    snapshot.finalAccounting.slashCount,
    snapshot.finalAccounting.protocolFault,
    snapshot.finalAccounting.semanticFault,
  ].map(String).join(':')).join('|');
  const chainReviewerProfileKey = daioData.reviewerProfiles.map((profile) => [
    profile.address,
    profile.ensName ?? '',
    profile.agentId,
    profile.registered,
    profile.active,
    profile.suspended,
    profile.reputation.samples,
    profile.reputation.reportQuality,
    profile.reputation.auditReliability,
    profile.reputation.finalContribution,
    profile.reputation.protocolCompliance,
  ].map(String).join(':')).join('|');
  const activeReviewRoundState = useMemo(
    () => reviewRoundState ? { ...reviewRoundState, phase: reviewGamePhaseFromSimulation(phase) } : null,
    [phase, reviewRoundState],
  );
  const selectedReviewerNode = useMemo(
    () => activeReviewRoundState?.reviewers.find((reviewer) => reviewer.id === selectedNodeId) ?? null,
    [activeReviewRoundState, selectedNodeId],
  );
  const selectedReviewerCharacter = useMemo(
    () => reviewParticipants.find((character) => character.id === selectedNodeId) ?? null,
    [reviewParticipants, selectedNodeId],
  );
  const selectedReviewerRoundCompleted = useMemo(() => {
    if (!selectedReviewerCharacter || !activeReviewRoundState) return false;
    const roundForPhase = activeReviewRoundState.phase === 'round1'
      ? 1
      : activeReviewRoundState.phase === 'round2'
        ? 2
        : activeReviewRoundState.phase === 'round3' || activeReviewRoundState.phase === 'final'
          ? 3
          : 0;
    return roundForPhase === 0 || selectedReviewerCharacter.scoreHistory.some((entry) => entry.round === roundForPhase);
  }, [activeReviewRoundState, selectedReviewerCharacter]);
  const selectedReviewerIdsForRooms = useMemo(
    () => new Set(activeReviewRoundState?.selectedReviewerIds ?? []),
    [activeReviewRoundState?.selectedReviewerIds],
  );
  const shouldDimInactiveLabs = Boolean(activeReviewRoundState)
    && phase !== 'IDLE'
    && phase !== 'QUEUED'
    && phase !== 'SELECTION'
    && phase !== 'MOVING_TO_ROOMS';
  const showAuditQuorumTracker = Boolean(
    activeReviewRoundState?.phase === 'round2' &&
    (phase === 'ROUND_2_STARTING' || phase === 'ROUND_2'),
  );
  const showReputationWeightingPanel = Boolean(activeReviewRoundState?.phase === 'round3');
  const showNodeReputationPanel = !showAuditQuorumTracker;

  useEffect(() => {
    if (!isContractDrivenReview || !activeAgentStatusRequestId) {
      if (visibleChainAuditCount !== 0) setVisibleChainAuditCount(0);
      return undefined;
    }

    const targetCount = chainAuditReportTargetCount;
    if (visibleChainAuditCount > targetCount) {
      setVisibleChainAuditCount(targetCount);
      return undefined;
    }

    if (!showAuditQuorumTracker || visibleChainAuditCount >= targetCount) return undefined;

    const revealDelay = visibleChainAuditCount === 0
      ? roundProcessStartDelayMs + FLOW_REVEAL_INITIAL_DELAY_MS
      : FLOW_REVEAL_STEP_MS;
    const timer = window.setTimeout(() => {
      setVisibleChainAuditCount((current) => Math.min(current + 1, targetCount));
    }, revealDelay);

    return () => window.clearTimeout(timer);
  }, [
    activeAgentStatusRequestId,
    chainAuditReportTargetCount,
    isContractDrivenReview,
    roundProcessStartDelayMs,
    showAuditQuorumTracker,
    visibleChainAuditCount,
  ]);

  useEffect(() => {
    daioDataRef.current = daioData;
  }, [daioData]);

  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  useEffect(() => {
    reviewRoundStateRef.current = reviewRoundState;
  }, [reviewRoundState]);

  useEffect(() => {
    setVisibleChainAuditCount(0);
  }, [activeAgentStatusRequestId]);

  useEffect(() => {
    activeConversationsRef.current = activeConversations;
  }, [activeConversations]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    selectedThinkingNodeIdRef.current = selectedThinkingNodeId;
  }, [selectedThinkingNodeId]);

  useEffect(() => {
    if (selectedThinkingNodeId && !selectedThinkingNode) {
      setSelectedThinkingNodeId(null);
    }
  }, [selectedThinkingNode, selectedThinkingNodeId]);

  useEffect(() => {
    if (!activeAgentStatusRequestId || !isEvaluationInProgress) {
      setAgentStatuses([]);
      return undefined;
    }

    let cancelled = false;
    const pollAgentStatuses = async () => {
      const statuses = await getAgentStatuses(activeAgentStatusRequestId);
      if (cancelled) return;

      setAgentStatuses(statuses);
      const statusKey = `${activeAgentStatusRequestId}:${agentStatusesLogKey(statuses)}`;
      if (lastAgentStatusLogKeyRef.current !== statusKey) {
        lastAgentStatusLogKeyRef.current = statusKey;
        logReview('agent-statuses:changed', {
          source: 'api',
          requestId: activeAgentStatusRequestId,
          count: statuses.length,
          statuses: statuses.map((status) => ({
            agent: status.agent,
            phase: status.phase,
            status: status.status,
          })),
        });
      }
    };

    void pollAgentStatuses();
    const interval = window.setInterval(() => {
      void pollAgentStatuses();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeAgentStatusRequestId, isEvaluationInProgress]);

  useEffect(() => {
    if (!selectedConversation && !selectedThinkingNode) return undefined;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sideboardActivityRef.current?.contains(target)) return;

      setSelectedConversationId(null);
      setSelectedThinkingNodeId(null);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [selectedConversation, selectedThinkingNode]);

  useEffect(() => {
    if (phase !== 'EVALUATED') {
      setConfirmArmed(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'SELECTION') return;
    if (phase === 'EVALUATED') return;

    setSelectedNodeId((current) => {
      if (!current) return current;
      return reviewRoundStateRef.current?.reviewers.some((reviewer) => reviewer.id === current) ? current : null;
    });
  }, [phase]);

  const clearMeetingTimers = useCallback(() => {
    meetingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    meetingTimersRef.current = [];
  }, []);

  const clearRoundResultHoldTimer = useCallback(() => {
    setRoundResultHoldRound(null);
  }, []);

  useEffect(() => () => {
    clearMeetingTimers();
  }, [clearMeetingTimers]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      { id: Math.random().toString(), timestamp: Date.now(), message },
      ...prev,
    ].slice(0, 50));
  }, [clearMeetingTimers]);

  useEffect(() => {
    if (!isContractDrivenReview || !activeAgentStatusRequestId) return;

    const requestStatus = daioData.requestLifecycle?.status ?? daioData.latestRequestStatus;
    const requestStatusName = daioData.requestLifecycle?.statusName ?? daioData.latestRequestStatusName;
    let nextRound = currentRoundFromContractStatus(requestStatus);
    const statusKey = `${activeAgentStatusRequestId}:${requestStatus}:${daioData.requestAttempt.toString()}`;
    const round2MotionKey = `${activeAgentStatusRequestId}:2`;
    const round3MotionKey = `${activeAgentStatusRequestId}:3`;
    const round2MotionAlreadyPlayed = Boolean(contractMotionRoundsRef.current[round2MotionKey]);
    const round3MotionAlreadyPlayed = Boolean(contractMotionRoundsRef.current[round3MotionKey]);
    const selectionAlreadyAnimated = contractSelectionAnimatedRequestRef.current === activeAgentStatusRequestId;
    let nextPhase = simulationPhaseFromContractStatus(requestStatus, daioData);

    if (lastContractRequestIdRef.current !== activeAgentStatusRequestId) {
      lastContractRequestIdRef.current = activeAgentStatusRequestId;
      appliedContractRoundsRef.current = { 1: false, 2: false, 3: false };
      ([1, 2, 3] as const).forEach((roundKey) => {
        const timerId = roundApplyTimerRefs.current[roundKey];
        if (timerId !== null) {
          window.clearTimeout(timerId);
          roundApplyTimerRefs.current[roundKey] = null;
        }
      });
      finalizedContractRequestRef.current = null;
      contractSelectionAnimatedRequestRef.current = null;
      contractMotionRoundsRef.current = {};
      selectedCharacterIdsByRequestRef.current = {
        ...selectedCharacterIdsByRequestRef.current,
        [activeAgentStatusRequestId]: [],
      };
      lastAgentStatusLogKeyRef.current = '';
      lastContractStatusKeyRef.current = '';
      selectionCompletionLoggedRef.current = false;
      clearMeetingTimers();
      clearRoundResultHoldTimer();
      setRoundIntro(null);
      setPendingDiscussionAdvanceRound(null);
      setIsNodeSelectionReady(false);
      setVisibleChainAuditCount(0);
      const cleanedCharacters = charactersRef.current.map(resetCharacter);
      charactersRef.current = cleanedCharacters;
      reviewRoundStateRef.current = null;
      setCharacters(cleanedCharacters);
      setReviewRoundState(null);
      setFinalResult(null);
      setShowChart(false);
      addLog(`Tracking on-chain request #${activeAgentStatusRequestId}. Waiting for contract state changes.`);
    }

    const shouldHoldForAuditReveal =
      requestStatus >= STATUS_FINALIZED &&
      chainAuditReportTargetCount >= chainAuditQuorum &&
      !auditQuorumDisplayReady;

    if (requestStatus >= 2 && requestStatus <= 3 && !selectionAlreadyAnimated) {
      nextPhase = 'SELECTION';
    } else if (requestStatus >= 2 && requestStatus <= 3 && phase === 'MOVING_TO_ROOMS') {
      nextPhase = 'MOVING_TO_ROOMS';
    } else if (
      (requestStatus === 4 || requestStatus === 5) &&
      round2MotionAlreadyPlayed &&
      (phase === 'ROUND_2_STARTING' || phase === 'ROUND_2')
    ) {
      nextPhase = 'ROUND_2';
    } else if ((requestStatus === 4 || requestStatus === 5) && phase === 'ROUND_2_STARTING') {
      nextPhase = 'ROUND_2_STARTING';
    } else if (
      (requestStatus === 4 || requestStatus === 5) &&
      daioData.roundAggregates.review.closed &&
      !round2MotionAlreadyPlayed
    ) {
      nextPhase = 'ROUND_2_STARTING';
    } else if (shouldHoldForAuditReveal) {
      nextRound = 2;
      nextPhase = round2MotionAlreadyPlayed || phase === 'ROUND_2'
        ? 'ROUND_2'
        : 'ROUND_2_STARTING';
    } else if (
      requestStatus >= 6 &&
      round3MotionAlreadyPlayed &&
      !daioData.roundAggregates.reputationFinal.closed &&
      (phase === 'ROUND_3_STARTING' || phase === 'ROUND_3')
    ) {
      nextPhase = 'ROUND_3';
    } else if (requestStatus >= 6 && phase === 'ROUND_3_STARTING') {
      nextPhase = 'ROUND_3_STARTING';
    } else if (
      requestStatus >= 6 &&
      daioData.roundAggregates.auditConsensus.closed &&
      !round3MotionAlreadyPlayed
    ) {
      nextPhase = 'ROUND_3_STARTING';
    } else if (
      requestStatus >= 6 &&
      daioData.roundAggregates.reputationFinal.closed &&
      finalizedContractRequestRef.current !== activeAgentStatusRequestId
    ) {
      nextPhase = 'FINALIZING';
    }

    const round1Applied = appliedContractRoundsRef.current[1];
    const round2Applied = appliedContractRoundsRef.current[2];
    const round3Applied = appliedContractRoundsRef.current[3];
    const advancedPastRound1: SimulationPhase[] = ['ROUND_2_STARTING', 'ROUND_2', 'ROUND_3_STARTING', 'ROUND_3', 'FINALIZING', 'EVALUATED'];
    const advancedPastRound2: SimulationPhase[] = ['ROUND_3_STARTING', 'ROUND_3', 'FINALIZING', 'EVALUATED'];
    const advancedPastRound3: SimulationPhase[] = ['FINALIZING', 'EVALUATED'];

    if (!round1Applied && advancedPastRound1.includes(nextPhase)) {
      nextPhase = phase === 'ROUND_1' || phase === 'MOVING_TO_ROOMS' || phase === 'SELECTION' || phase === 'QUEUED'
        ? phase
        : 'ROUND_1';
    }

    if (round1Applied && !round2Applied && advancedPastRound2.includes(nextPhase)) {
      nextPhase = phase === 'ROUND_2' || phase === 'ROUND_2_STARTING'
        ? phase
        : 'ROUND_2';
    }

    if (round2Applied && !round3Applied && advancedPastRound3.includes(nextPhase)) {
      nextPhase = phase === 'ROUND_3' || phase === 'ROUND_3_STARTING'
        ? phase
        : 'ROUND_3';
    }

    if (!roomReviewBounty && daioData.requestLifecycle) {
      setRoomReviewBounty({
        amount: numberFromTokenAmount(daioData.requestLifecycle.feePaid, daioData.usdaioDecimals),
        asset: 'USDAIO',
        network: 'Ethereum Sepolia',
        txHash: '',
        requestId: activeAgentStatusRequestId,
      });
    }

    setCurrentRound(nextRound);
    setPhase((current) => current === nextPhase ? current : nextPhase);
    setIsNodeSelectionReady(requestStatus >= 2 && nextPhase !== 'SELECTION');

    const currentCharacters = charactersRef.current.length > 0
      ? charactersRef.current
      : buildAICharactersForRoom(selectedRoom).map(resetCharacter);
    const apiAgentAddresses = agentStatuses
      .map((status) => status.agent)
      .filter(isHexAddress);
    const chainSnapshots = daioData.reviewerRoundSnapshots;
    const statusByAgentAddress = agentStatusByAddress(agentStatuses);
    const profileByAddress = new Map(daioData.reviewerProfiles.map((profile) => [profile.address.toLowerCase(), profile]));
    const profileByAgentId = new Map(
      daioData.reviewerProfiles
        .filter((profile) => profile.agentId !== 0n)
        .map((profile) => [profile.agentId.toString(), profile]),
    );
    const registeredReviewerProfiles = daioData.registeredReviewerProfiles;
    const registeredReviewerAddresses = registeredReviewerProfiles.map((profile) => profile.address);
    const chainSelectedAgentAddresses = uniqueHexAddresses([
      daioData.reviewCommitters,
      daioData.revealedReviewers,
      daioData.reviewParticipants,
      chainSnapshots.map((snapshot) => snapshot.address),
    ]);
    const selectedAgentAddresses = chainSelectedAgentAddresses;
    const selectedAgentAddressSet = new Set(selectedAgentAddresses.map((address) => address.toLowerCase()));
    const fallbackAgentAddresses = registeredReviewerAddresses.length > 0
      ? registeredReviewerAddresses
      : apiAgentAddresses;
    const profileForCharacter = (index: number, agentAddress: `0x${string}` | undefined) => (
      (agentAddress ? profileByAddress.get(agentAddress.toLowerCase()) : undefined) ??
      registeredReviewerProfiles[index]
    );
    let lockedSelectedIds = selectedCharacterIdsByRequestRef.current[activeAgentStatusRequestId] ?? [];
    if (lockedSelectedIds.length === 0 && requestStatus >= 2) {
      const registrySelectedIds = selectedAgentAddresses
        .map((address) => {
          const rosterIndex = registeredReviewerAddresses.findIndex(
            (reviewerAddress) => reviewerAddress.toLowerCase() === address.toLowerCase(),
          );
          return rosterIndex >= 0 ? currentCharacters[rosterIndex]?.id : undefined;
        })
        .filter((id): id is string => Boolean(id));
      const initialSelectedIds = registrySelectedIds.length >= CONTRACT_EXPECTED_REVIEWER_COUNT
        ? registrySelectedIds
        : [];

      lockedSelectedIds = initialSelectedIds.slice(0, CONTRACT_EXPECTED_REVIEWER_COUNT);
      selectedCharacterIdsByRequestRef.current = {
        ...selectedCharacterIdsByRequestRef.current,
        [activeAgentStatusRequestId]: lockedSelectedIds,
      };
    }

    const lockedSelectedIdSet = new Set(lockedSelectedIds);
    const selectedSlotByCharacterId = new Map(lockedSelectedIds.map((id, index) => [id, index]));
    const standbyAgentAddresses = fallbackAgentAddresses.filter(
      (address) => !selectedAgentAddressSet.has(address.toLowerCase()),
    );
    let standbyAgentIndex = 0;
    const nextCharacters = currentCharacters.map((character, index) => {
      const selectedSlot = selectedSlotByCharacterId.get(character.id);
      const selected = lockedSelectedIdSet.has(character.id);
      const agentAddress = selected
        ? selectedAgentAddresses[selectedSlot ?? index] ?? character.agentAddress ?? fallbackAgentAddresses[index]
        : standbyAgentAddresses[standbyAgentIndex++] ?? character.agentAddress ?? fallbackAgentAddresses[index];
      const fallbackProfile = profileForCharacter(index, agentAddress);
      const chainReputationScore = daioProfileReputationPercent(fallbackProfile);
      const displayName = agentDisplayName(
        agentAddress,
        statusByAgentAddress,
        profileByAddress,
        profileByAgentId,
        fallbackProfile,
      );
      return {
        ...character,
        agentAddress,
        name: displayName ?? character.name,
        reputationScore: fallbackProfile ? chainReputationScore : character.reputationScore,
        selected,
        selectionStatus: selected ? ('selected' as const) : ('standby' as const),
        status: nextPhase === 'SELECTION'
          ? 'IDLE'
          : nextPhase === 'MOVING_TO_ROOMS' && character.status === 'MOVING'
            ? 'MOVING'
            : nodeStatusFromContractStatus(requestStatus, selected),
      };
    });
    const reviewCharacters = getSelectedReviewNodes(nextCharacters);
    const currentState = reviewRoundStateRef.current;
    const reviewCharacterIds = reviewCharacters.map((reviewer) => reviewer.id).join('|');
    const currentReviewerIds = currentState?.reviewers.map((reviewer) => reviewer.id).join('|') ?? '';
    const baseState = !currentState ||
      currentState.reviewers.length !== reviewCharacters.length ||
      currentReviewerIds !== reviewCharacterIds
      ? createReviewRoundState(reviewCharacters)
      : currentState;
    const snapshots = snapshotByAddress(daioData);
    const patchedReviewers = baseState.reviewers.map((reviewer, index) => {
      const agentAddress = reviewer.agentAddress ?? selectedAgentAddresses[index] ?? chainSnapshots[index]?.address;
      const snapshot = agentAddress ? snapshots.get(agentAddress.toLowerCase()) : chainSnapshots[index];
      const fallbackProfile = profileForCharacter(
        currentCharacters.findIndex((character) => character.id === reviewer.id),
        agentAddress,
      );
      const displayName = agentDisplayName(
        agentAddress,
        statusByAgentAddress,
        profileByAddress,
        profileByAgentId,
        fallbackProfile,
      );
      return applyContractSnapshotToReviewer(
        {
          ...reviewer,
          agentAddress,
        },
        snapshot,
        agentAddress,
        displayName,
      );
    });
    const contractAuditQuorum = chainAuditQuorum;
    const contractReviewPhase: ReviewGamePhase = shouldHoldForAuditReveal
      ? 'round2'
      : reviewPhaseFromContractStatus(requestStatus, daioData);
    const patchedState: ReviewRoundState = {
      ...baseState,
      phase: contractReviewPhase,
      selectedReviewerIds: patchedReviewers.map((reviewer) => reviewer.id),
      reviewers: patchedReviewers,
      round0ConsensusScore: daioData.roundAggregates.review.closed || daioData.roundAggregates.review.score > 0n
        ? numberFromContractScore(daioData.roundAggregates.review.score)
        : baseState.round0ConsensusScore,
      round1ConsensusScore: daioData.roundAggregates.auditConsensus.closed || daioData.roundAggregates.auditConsensus.score > 0n
        ? numberFromContractScore(daioData.roundAggregates.auditConsensus.score)
        : baseState.round1ConsensusScore,
      round2ConsensusScore: daioData.roundAggregates.reputationFinal.closed || daioData.roundAggregates.reputationFinal.score > 0n
        ? numberFromContractScore(daioData.roundAggregates.reputationFinal.score)
        : baseState.round2ConsensusScore,
      auditQuorum: contractAuditQuorum,
      acceptedAuditCount: Math.min(contractAuditQuorum, displayedChainAuditCount),
    };

    charactersRef.current = nextCharacters;
    reviewRoundStateRef.current = patchedState;
    setCharacters(nextCharacters);
    setReviewRoundState(patchedState);

    if (lastContractStatusKeyRef.current !== statusKey) {
      lastContractStatusKeyRef.current = statusKey;
      logReview('contract:status_changed', {
        requestId: activeAgentStatusRequestId,
        source: 'chain',
        status: requestStatus,
        statusName: requestStatusName,
        nextPhase,
        nextRound,
        attempt: daioData.requestAttempt.toString(),
        reviewParticipants: daioData.reviewParticipants,
        auditParticipants: daioData.auditParticipants,
        roundAggregates: {
          reviewClosed: daioData.roundAggregates.review.closed,
          auditClosed: daioData.roundAggregates.auditConsensus.closed,
          finalClosed: daioData.roundAggregates.reputationFinal.closed,
        },
      });
      addLog(`Contract status changed: ${requestStatusName} (request #${activeAgentStatusRequestId}, attempt ${daioData.requestAttempt.toString()}).`);
    }
  }, [
    activeAgentStatusRequestId,
    addLog,
    auditQuorumDisplayReady,
    chainAuditProgressKey,
    chainParticipantsKey,
    chainReviewerProfileKey,
    chainReviewerSnapshotKey,
    chainRoundAggregateKey,
    clearMeetingTimers,
    clearRoundResultHoldTimer,
    agentStatusSyncKey,
    daioData.latestRequestStatus,
    daioData.latestRequestStatusName,
    daioData.requestAttempt,
    daioData.requestLifecycle?.status,
    daioData.requestLifecycle?.statusName,
    daioData.requestLifecycle?.feePaid,
    daioData.requestLifecycle?.retryCount,
    daioData.usdaioDecimals,
    phase,
    isContractDrivenReview,
    roomReviewBounty,
    selectedRoom,
  ]);

  const continueAfterRoundResult = useCallback((holdRound: 1 | 2 | 3) => {
    setSelectedNodeId(null);
    setRoundResultHoldRound(null);
    setRoundProcessStartDelayMs(0);

    if (holdRound === 1) {
      setCurrentRound(2);
      setRoundIntro({ round: 2, id: Date.now() });
      setPhase('ROUND_2_STARTING');
      return;
    }

    if (holdRound === 2) {
      setCurrentRound(3);
      setRoundIntro({ round: 3, id: Date.now() });
      setPhase('ROUND_3_STARTING');
      return;
    }

    const finalCharacters = getReviewParticipants(charactersRef.current);
    const finalPositionById = new Map(finalCharacters.map((character) => [character.id, character.idlePosition]));
    const moveDuration = Math.max(
      0,
      ...finalCharacters.map((character) => {
        const targetPosition = finalPositionById.get(character.id);
        return targetPosition ? movementDurationMs(character, targetPosition) : 0;
      }),
    );
    setRoundProcessStartDelayMs(moveDuration + ROUND_MOVEMENT_SETTLE_MS);
    setPhase('FINALIZING');
    addLog('Final round complete. Nodes are returning to their starting positions for the result.');
    setCharacters((prev) =>
      prev.map((character) => ({
        ...character,
        status: finalPositionById.has(character.id) && !positionsMatch(character.position, finalPositionById.get(character.id) ?? character.idlePosition)
          ? 'RETURNING'
          : 'IDLE',
        position: finalPositionById.get(character.id) ?? character.idlePosition,
      })),
    );
  }, [addLog]);

  const resetCycle = useCallback((roomId: ActiveReviewRoomId = selectedRoom) => {
    setPhase('IDLE');
    setCurrentRound(1);
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setActiveConversations([]);
    setMetConversationIds([]);
    setShowChart(false);
    setFinalResult(null);
    setReviewRoundState(null);
    setConfirmArmed(false);
    setRoundIntro(null);
    setRoundResultHoldRound(null);
    setRoundProcessStartDelayMs(0);
    setIsNodeSelectionReady(false);
    selectedCharacterIdsByRequestRef.current = {};
    setVisibleChainAuditCount(0);
    selectionCompletionLoggedRef.current = false;
    setCharacters(buildAICharactersForRoom(roomId).map(resetCharacter));
  }, [clearMeetingTimers, clearRoundResultHoldTimer, selectedRoom]);

  const startRoomSelection = (roomId: ActiveReviewRoomId) => {
    if (isEvaluationInProgress) {
      if (roomId === selectedRoom) {
        setSelectedNodeId(null);
        setSelectedConversationId(null);
        setSelectedThinkingNodeId(null);
        setPendingDiscussionAdvanceRound(null);
        setRoundProcessStartDelayMs(0);
        setPage('room');
      }
      return;
    }

    setLoadingRoom(roomId);
    setPage('loading');
  };

  const enterRoom = useCallback(() => {
    setSelectedRoom(loadingRoom);
    localStorage.setItem('daio_selected_room', loadingRoom);
    resetCycle(loadingRoom);
    setRoomReviewBounty(null);
    setLogs([]);
    setActiveConversations([]);
    setMetConversationIds([]);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setRoundProcessStartDelayMs(0);
    setPage('room');
    addLog(`${REVIEW_ROOMS[loadingRoom].title} is ready.`);
  }, [addLog, loadingRoom, resetCycle]);

  const leaveRoom = () => {
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setRoundProcessStartDelayMs(0);
    setConfirmArmed(false);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setPage('commons');
  };

  const returnToRoomSelection = () => {
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setRoundProcessStartDelayMs(0);
    setConfirmArmed(false);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setPage('commons');
    setOpenRoomSelectionSignal((signal) => signal + 1);
  };

  const handleNavigate = (target: 'dashboard' | 'commons') => {
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setRoundProcessStartDelayMs(0);
    setConfirmArmed(false);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setPage(target);
  };

  const confirmReviewResults = () => {
    setConfirmArmed(false);
    resetCycle();
    setRoomReviewBounty(null);
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setRoundProcessStartDelayMs(0);
    setPage('commons');
    addLog('Review results confirmed. Evaluation closed.');
  };

  const requestConfirmReviewResults = () => {
    if (phase !== 'EVALUATED' || !finalResult) return;

    if (!confirmArmed) {
      setConfirmArmed(true);
      addLog('Final confirmation requested. Click Confirm again to close the room.');
      return;
    }

    confirmReviewResults();
  };

  const downloadEvaluationReport = () => {
    if (!finalResult) return;

    const room = REVIEW_ROOMS[selectedRoom];
    const report = buildEvaluationReport({
      roomTitle: room.title,
      roomDescription: room.description,
      evaluationId,
      finalResult,
      logs,
      reviewBounty: roomReviewBounty,
    });
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

    anchor.href = url;
    anchor.download = `pixelreview-${slugifyReportName(room.title)}-${dateStamp}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    addLog('Evaluation report downloaded.');
  };

  const completeNodeSelection = useCallback(() => {
    const selectedCount = getSelectedReviewNodes(charactersRef.current).length;
    if (isContractDrivenReview && selectedCount < DEFAULT_SELECTED_NODE_COUNT) {
      logReview('selection:waiting_for_chain_reviewers', {
        requestId: activeAgentStatusRequestId,
        selectedCount,
        requiredCount: DEFAULT_SELECTED_NODE_COUNT,
      });
      return;
    }

    setIsNodeSelectionReady(true);

    if (selectionCompletionLoggedRef.current) return;
    selectionCompletionLoggedRef.current = true;

    const selectedNames = getSelectedReviewNodes(charactersRef.current)
      .map((character) => character.name)
      .join(', ');

    logReview('selection:completed', {
      requestedCount: DEFAULT_SELECTED_NODE_COUNT,
      selectedNames,
    });
    addLog(`${DEFAULT_SELECTED_NODE_COUNT} review nodes selected${selectedNames ? `: ${selectedNames}` : ''}.`);
  }, [activeAgentStatusRequestId, addLog, isContractDrivenReview]);

  useEffect(() => {
    if (phase !== 'SELECTION' || isNodeSelectionReady) return undefined;
    if (isContractDrivenReview && selectedReviewCharacterCount < DEFAULT_SELECTED_NODE_COUNT) return undefined;

    const timer = window.setTimeout(completeNodeSelection, NODE_SELECTION_DRAW_MS);
    return () => window.clearTimeout(timer);
  }, [
    completeNodeSelection,
    isContractDrivenReview,
    isNodeSelectionReady,
    phase,
    selectedReviewCharacterCount,
  ]);

  const queueRoundOneFromSelection = useCallback((source: 'local' | 'chain') => {
    const participants = getReviewParticipants(charactersRef.current);
    setSelectedNodeId(null);
    setPhase('MOVING_TO_ROOMS');
    setCurrentRound(1);
    setRoundIntro({ round: 1, id: Date.now() });
    setRoundResultHoldRound(null);
    setRoundProcessStartDelayMs(0);
    logReview('selection:round1_queued', {
      source,
      participantCount: participants.length,
      participants: participants.map((participant) => ({
        id: participant.id,
        name: participant.name,
      })),
    });
    addLog(`Round 1 queued for ${participants.length} selected review nodes.`);
  }, [addLog]);

  useEffect(() => {
    if (phase !== 'SELECTION' || !isNodeSelectionReady) return undefined;
    if (
      isContractDrivenReview &&
      activeAgentStatusRequestId &&
      contractSelectionAnimatedRequestRef.current === activeAgentStatusRequestId
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (isContractDrivenReview && activeAgentStatusRequestId) {
        if (contractSelectionAnimatedRequestRef.current === activeAgentStatusRequestId) return;

        contractSelectionAnimatedRequestRef.current = activeAgentStatusRequestId;
        queueRoundOneFromSelection('chain');
        return;
      }

      queueRoundOneFromSelection('local');
    }, NODE_SELECTION_SELECTED_HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [
    activeAgentStatusRequestId,
    isContractDrivenReview,
    isNodeSelectionReady,
    phase,
    queueRoundOneFromSelection,
  ]);

  const handleSubmit = (title: string, link = '', submittedReviewBounty?: ConfirmedReviewBounty) => {
    const effectiveReviewBounty = submittedReviewBounty ?? roomReviewBounty;
    const nextCharacters = selectReviewNodes(
      charactersRef.current.map(resetCharacter),
      DEFAULT_SELECTED_NODE_COUNT,
    );
    const selectedCharacters = getSelectedReviewNodes(nextCharacters);
    const reviewCharacters = (
      selectedCharacters.length === DEFAULT_SELECTED_NODE_COUNT
        ? selectedCharacters
        : getReviewParticipants(nextCharacters).slice(0, DEFAULT_SELECTED_NODE_COUNT)
    );
    const nextReviewRoundState = createReviewRoundState(reviewCharacters);

    setEvaluationId(`eval_${Date.now()}`);
    setPhase('SELECTION');
    setCurrentRound(1);
    setIsNodeSelectionReady(false);
    selectedCharacterIdsByRequestRef.current = {};
    selectionCompletionLoggedRef.current = false;
    setRoundIntro(null);
    setRoundResultHoldRound(null);
    setShowChart(false);
    setFinalResult(null);
    setReviewRoundState(nextReviewRoundState);
    setConfirmArmed(false);
    setSelectedNodeId(null);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setPendingDiscussionAdvanceRound(null);
    setRoundProcessStartDelayMs(0);
    setVisibleChainAuditCount(0);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setActiveConversations([]);
    logReview('submit:protocol_initialized', {
      title,
      source: link,
      requestId: effectiveReviewBounty?.requestId,
      proposalURI: effectiveReviewBounty?.proposalURI,
      proposalHash: effectiveReviewBounty?.proposalHash,
      selectedReviewerCount: selectedCharacters.length,
      activeReviewerCount: reviewCharacters.length,
      reviewers: nextReviewRoundState.reviewers.map((reviewer) => ({
        id: reviewer.id,
        name: reviewer.name,
        proposalScore: reviewer.proposalScore,
        reputationScore: reviewer.reputationScore,
      })),
      consensus: {
        round1Review: nextReviewRoundState.round0ConsensusScore,
        round2Audit: nextReviewRoundState.round1ConsensusScore,
        round3Reputation: nextReviewRoundState.round2ConsensusScore,
      },
      acceptedAudits: nextReviewRoundState.acceptedAuditCount,
      auditQuorum: nextReviewRoundState.auditQuorum,
    });
    addLog(`Protocol initialized for "${title}".`);
    if (link) {
      addLog(`Submission source attached: ${link}.`);
    }
    if (effectiveReviewBounty) {
      addLog(`Review bounty funded: ${effectiveReviewBounty.amount.toFixed(2)} ${effectiveReviewBounty.asset} on ${effectiveReviewBounty.network}.`);
    }
    addLog(`Selecting ${DEFAULT_SELECTED_NODE_COUNT} review nodes from ${nextCharacters.length} candidates.`);

    charactersRef.current = nextCharacters;
    reviewRoundStateRef.current = nextReviewRoundState;
    setCharacters(nextCharacters);
  };

  const applyRoundScores = useCallback((round: number) => {
    const roundConversations = activeConversationsRef.current.filter((conversation) => conversation.round === round);
    const protocolState = reviewRoundStateRef.current;
    const protocolReviewerById = new Map(protocolState?.reviewers.map((reviewer) => [reviewer.id, reviewer]) ?? []);
    setCharacters((prev) => {
      const participantIds = new Set(getReviewParticipants(prev).map((character) => character.id));

      const nextCharacters: AICharacter[] = prev.map((character): AICharacter => {
        if (!participantIds.has(character.id)) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
          };
        }

        const conversation = findConversationForNode(roundConversations, character.id);
        const protocolReviewer = protocolReviewerById.get(character.id);
        const entry = protocolState && protocolReviewer
          ? buildProtocolRoundScore(character, protocolReviewer, protocolState, round)
          : buildRoundScore(character, round, conversation);

        return {
          ...character,
          status: 'IDLE',
          lastScore: entry.score,
          scoreHistory: [...character.scoreHistory, entry],
          scoreReasoning: entry.reasoning,
          discussionSummary: entry.discussion,
        };
      });

      charactersRef.current = nextCharacters;
      return nextCharacters;
    });
    logReview(`round-${round}:scores_submitted`, {
      round,
      consensusScore:
        round === 1
          ? protocolState?.round0ConsensusScore
          : round === 2
            ? protocolState?.round1ConsensusScore
            : protocolState?.round2ConsensusScore,
      reviewers: protocolState?.reviewers.map((reviewer) => ({
        id: reviewer.id,
        name: reviewer.name,
        proposalScore: reviewer.proposalScore,
        round0: reviewer.round0,
        round1: reviewer.round1,
        round2: reviewer.round2,
      })) ?? [],
    });
    addLog(`Round ${round} scores submitted to the board.`);
  }, [addLog]);

  const finalizeScores = useCallback(() => {
    const daioSnapshot = daioDataRef.current;
    const activeCharacters = getReviewParticipants(charactersRef.current);
    const activeCharacterIds = new Set(activeCharacters.map((character) => character.id));
    const finalPositionById = new Map(activeCharacters.map((character) => [character.id, character.idlePosition]));
    const roomFinalInputs = buildRoomFinalInputs(activeCharacters);
    const protocolState = reviewRoundStateRef.current;
    const protocolReviewerById = new Map(protocolState?.reviewers.map((reviewer) => [reviewer.id, reviewer]) ?? []);
    const calculated = buildNodeResultRows(roomFinalInputs, undefined, roomReviewBounty?.amount ?? 0);
    const chainSnapshotByAddress = snapshotByAddress(daioSnapshot);
    const profileReputationByAddress = new Map(
      daioSnapshot.reviewerProfiles.map((profile) => [
        profile.address.toLowerCase(),
        daioProfileReputationPercent(profile),
      ]),
    );
    const shouldUseChainAccounting = isContractDrivenReview && daioSnapshot.roundAggregates.reputationFinal.closed;

    if (protocolState?.round2ConsensusScore !== undefined) {
      const finalConsensusForChart = scoreScaleToChart(protocolState.round2ConsensusScore);
      calculated.summary.finalAverage = finalConsensusForChart;
      calculated.summary.outlierThresholdLow = finalConsensusForChart - calculated.summary.standardDeviation;
      calculated.summary.outlierThresholdHigh = finalConsensusForChart + calculated.summary.standardDeviation;
      calculated.nodes = calculated.nodes.map((node) => {
        const reviewNode = protocolReviewerById.get(node.id);
        if (!reviewNode) return node;
        const snapshot = reviewNode.agentAddress
          ? chainSnapshotByAddress.get(reviewNode.agentAddress.toLowerCase())
          : undefined;
        const accounting = snapshot?.finalAccounting;
        const chainRewardAmount = shouldUseChainAccounting
          ? numberFromTokenAmount(accounting?.reward, daioSnapshot.usdaioDecimals)
          : node.rewardAmount;
        const chainSlashAmount = shouldUseChainAccounting
          ? numberFromTokenAmount(accounting?.slashed, daioSnapshot.usdaioDecimals)
          : node.slashAmount;
        const slashCount = shouldUseChainAccounting ? Number(accounting?.slashCount ?? 0n) : undefined;
        const protocolFault = shouldUseChainAccounting ? accounting?.protocolFault ?? false : undefined;
        const semanticFault = shouldUseChainAccounting ? accounting?.semanticFault ?? false : undefined;
        const hasFault = Boolean(protocolFault || semanticFault || (slashCount ?? 0) > 0);
        const status = shouldUseChainAccounting
          ? chainSlashAmount > 0 || hasFault
            ? 'slashed'
            : chainRewardAmount > 0
              ? 'rewarded'
              : 'within_range'
          : node.status;
        const stakeAmount = shouldUseChainAccounting && snapshot?.profile?.stake !== undefined
          ? numberFromTokenAmount(snapshot.profile.stake, daioSnapshot.usdaioDecimals)
          : node.stakeAmount;
        const chainFaultNote = [
          protocolFault ? 'protocolFault=true: reward is forced to 0 and 5% slash policy can apply' : null,
          semanticFault ? 'semanticFault=true: semantic strike accounting was recorded' : null,
        ].filter(Boolean).join('; ');

        return {
          ...node,
          finalScore: scoreScaleToChart(reviewNode.proposalScore),
          reputationAfter: reviewNode.round2?.reputationScore !== undefined
            ? scoreScaleToChart(reviewNode.round2.reputationScore)
            : node.reputationAfter,
          stakeAmount,
          isOutlier: shouldUseChainAccounting ? chainSlashAmount > 0 || hasFault : node.isOutlier,
          slashAmount: shouldUseChainAccounting ? chainSlashAmount : node.slashAmount,
          rewardAmount: shouldUseChainAccounting ? chainRewardAmount : node.rewardAmount,
          bountyRewardAmount: shouldUseChainAccounting ? chainRewardAmount : node.bountyRewardAmount,
          rewardSource: shouldUseChainAccounting ? 'chain' : node.rewardSource,
          protocolFault,
          semanticFault,
          slashCount,
          status,
          finalReasoning: shouldUseChainAccounting
            ? `${node.name} used proposalScore ${reviewNode.proposalScore}/10000, audit contribution weight ${reviewNode.round1?.reviewerWeight ?? 0}/10000, and reputation-adjusted finalWeight ${reviewNode.round2?.finalWeight ?? 0}/10000. Contract reward = rewardPool * finalWeight / sum(finalWeight), paid ${chainRewardAmount.toFixed(2)} USDAIO, slashed ${chainSlashAmount.toFixed(2)} USDAIO.${chainFaultNote ? ` ${chainFaultNote}.` : ''} Final consensus is ${protocolState.round2ConsensusScore}/10000 (${finalConsensusForChart}/100).`
            : `${node.name} contributed proposalScore ${reviewNode.proposalScore}/10000 with finalWeight ${reviewNode.round2?.finalWeight ?? 0}/10000. Final consensus is ${protocolState.round2ConsensusScore}/10000 (${finalConsensusForChart}/100).`,
          reviewNode,
        };
      });
    }

    if (shouldUseChainAccounting) {
      const { feePaid, rewardPool, protocolFee } = contractFeeBreakdown(daioSnapshot.requestLifecycle);
      const feePaidAmount = numberFromTokenAmount(feePaid, daioSnapshot.usdaioDecimals);
      const rewardPoolAmount = numberFromTokenAmount(rewardPool, daioSnapshot.usdaioDecimals);
      const protocolFeeAmount = numberFromTokenAmount(protocolFee, daioSnapshot.usdaioDecimals);
      const totalRewardPaidAmount = calculated.nodes.reduce((sum, node) => sum + node.rewardAmount, 0);
      const totalSlashedPool = calculated.nodes.reduce((sum, node) => sum + node.slashAmount, 0);
      const treasuryRemainderAmount = Math.max(0, rewardPoolAmount - totalRewardPaidAmount);
      const eligibleNodeCount = calculated.nodes.filter((node) => node.rewardAmount > 0).length;

      calculated.summary = {
        ...calculated.summary,
        rewardSource: 'chain',
        reviewBountyAmount: rewardPoolAmount || Math.max(0, feePaidAmount - protocolFeeAmount),
        rewardPoolAmount,
        protocolFeeAmount,
        totalRewardPaidAmount,
        totalSlashedPool,
        eligibleNodeCount,
        redistributionPerNode: 0,
        bountyPerEligibleNode: eligibleNodeCount > 0 ? totalRewardPaidAmount / eligibleNodeCount : 0,
        treasuryRemainderAmount,
        treasuryAccrualAmount: treasuryRemainderAmount + protocolFeeAmount + totalSlashedPool,
      };
    }

    setFinalResult(calculated);

    setCharacters((prev) =>
      prev.map((character) => {
        const result = calculated.nodes.find((node) => node.id === character.id);
        if (!activeCharacterIds.has(character.id)) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
            isOutlier: false,
            lastScore: undefined,
          };
        }

        if (!result) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
          };
        }

        return {
          ...character,
          status: result.isOutlier ? 'SLASHED' : 'REWARDED',
          position: finalPositionById.get(character.id) ?? character.idlePosition,
          isOutlier: result.isOutlier,
          lastScore: result.finalScore,
          stakeAmount: Math.max(0, result.stakeAmount + (result.rewardSource === 'chain' ? -result.slashAmount : result.rewardAmount - result.slashAmount)),
          reputationScore: result.rewardSource === 'chain' && result.reviewNode?.agentAddress
            ? profileReputationByAddress.get(result.reviewNode.agentAddress.toLowerCase()) ?? result.reputationAfter
            : result.reputationAfter,
        };
      }),
    );

    setPhase('EVALUATED');
    setShowChart(true);
    logReview('final:scores_computed', {
      requestId: roomReviewBounty?.requestId,
      finalConsensusScore10000: protocolState?.round2ConsensusScore,
      finalAverage100: calculated.summary.finalAverage,
      standardDeviation: calculated.summary.standardDeviation,
      eligibleNodeCount: calculated.summary.eligibleNodeCount,
      rewardSource: calculated.summary.rewardSource,
      rewardPoolAmount: calculated.summary.rewardPoolAmount,
      protocolFeeAmount: calculated.summary.protocolFeeAmount,
      totalRewardPaidAmount: calculated.summary.totalRewardPaidAmount,
      treasuryAccrualAmount: calculated.summary.treasuryAccrualAmount,
      nodes: calculated.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        finalScore: node.finalScore,
        status: node.status,
        rewardAmount: node.rewardAmount,
        slashAmount: node.slashAmount,
        rewardSource: node.rewardSource,
        protocolFault: node.protocolFault,
        semanticFault: node.semanticFault,
      })),
    });
    addLog(`Final scores computed for ${roomFinalInputs.length} room nodes. Review bounty, slashing, and node rewards updated.`);
  }, [
    addLog,
    isContractDrivenReview,
    roomReviewBounty,
  ]);

  useEffect(() => {
    if (!isContractDrivenReview || !activeAgentStatusRequestId) return;

    const scheduleRoundApply = (
      roundKey: 1 | 2 | 3,
      eligible: boolean,
      run: () => void,
    ) => {
      const currentTimer = roundApplyTimerRefs.current[roundKey];
      if (eligible && currentTimer === null && !appliedContractRoundsRef.current[roundKey]) {
        roundApplyTimerRefs.current[roundKey] = window.setTimeout(() => {
          roundApplyTimerRefs.current[roundKey] = null;
          if (appliedContractRoundsRef.current[roundKey]) return;
          appliedContractRoundsRef.current[roundKey] = true;
          run();
        }, ROUND_REVEAL_BUFFER_MS);
      } else if (!eligible && currentTimer !== null) {
        window.clearTimeout(currentTimer);
        roundApplyTimerRefs.current[roundKey] = null;
      }
    };

    scheduleRoundApply(
      1,
      daioData.roundAggregates.review.closed && phase === 'ROUND_1',
      () => {
        applyRoundScores(1);
        setRoundResultHoldRound(1);
        addLog(`Round 1 ledger snapshot closed at ${daioData.roundAggregates.review.score.toString()}/10000.`);
      },
    );

    scheduleRoundApply(
      2,
      daioData.roundAggregates.auditConsensus.closed && phase === 'ROUND_2' && auditQuorumDisplayReady,
      () => {
        applyRoundScores(2);
        setRoundResultHoldRound(2);
        addLog(`Round 2 audit consensus closed at ${daioData.roundAggregates.auditConsensus.score.toString()}/10000.`);
      },
    );

    scheduleRoundApply(
      3,
      daioData.roundAggregates.reputationFinal.closed && phase === 'ROUND_3',
      () => {
        applyRoundScores(3);
        setRoundResultHoldRound(3);
        addLog(`Round 3 reputation final closed at ${daioData.roundAggregates.reputationFinal.score.toString()}/10000.`);
      },
    );
  }, [
    activeAgentStatusRequestId,
    addLog,
    applyRoundScores,
    auditQuorumDisplayReady,
    daioData.roundAggregates.auditConsensus.closed,
    daioData.roundAggregates.auditConsensus.score,
    daioData.roundAggregates.reputationFinal.closed,
    daioData.roundAggregates.reputationFinal.score,
    daioData.roundAggregates.review.closed,
    daioData.roundAggregates.review.score,
    isContractDrivenReview,
    phase,
  ]);

  useEffect(() => {
    if (!isContractDrivenReview || !activeAgentStatusRequestId) return;
    if (!daioData.roundAggregates.reputationFinal.closed) return;
    if (!auditQuorumDisplayReady) return;
    if (finalizedContractRequestRef.current === activeAgentStatusRequestId) return;
    if (!appliedContractRoundsRef.current[2]) return;

    const round3MotionKey = `${activeAgentStatusRequestId}:3`;
    if (!contractMotionRoundsRef.current[round3MotionKey]) {
      setCurrentRound(3);
      setRoundIntro((current) => current?.round === 3 ? current : { round: 3, id: Date.now() });
      setPhase((current) => current === 'ROUND_3_STARTING' || current === 'ROUND_3'
        ? current
        : 'ROUND_3_STARTING');
      return;
    }

    if (!appliedContractRoundsRef.current[3]) return;
    if (roundResultHoldRound === 3) return;
    if (phase !== 'ROUND_3' && phase !== 'FINALIZING') return;

    finalizedContractRequestRef.current = activeAgentStatusRequestId;
    setPhase('FINALIZING');

    const timer = window.setTimeout(
      finalizeScores,
      Math.max(roundProcessStartDelayMs, ROUND_MOVEMENT_SETTLE_MS) + FINAL_RESULT_EXPAND_DELAY_MS,
    );
    meetingTimersRef.current.push(timer);
  }, [
    activeAgentStatusRequestId,
    auditQuorumDisplayReady,
    daioData.roundAggregates.reputationFinal.closed,
    finalizeScores,
    isContractDrivenReview,
    phase,
    roundProcessStartDelayMs,
    roundResultHoldRound,
  ]);

  const inspectReviewer = (reviewerId: string) => {
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setSelectedNodeId(reviewerId);
  };

  const inspectSceneNode = (nodeId: string) => {
    const protocolReviewer = reviewRoundStateRef.current?.reviewers.find((reviewer) => reviewer.id === nodeId);
    if (protocolReviewer) {
      inspectReviewer(nodeId);
      return;
    }

    if (finalResult) {
      const node = finalResult.nodes.find((result) => result.id === nodeId);
      setSelectedNodeId(node?.id ?? null);
      setSelectedConversationId(null);
      setSelectedThinkingNodeId(null);
      return;
    }

    const clickedCharacter = charactersRef.current.find((character) => character.id === nodeId);
    const metConversations = activeConversationsRef.current.filter((conversation) => metConversationIds.includes(conversation.id));
    const conversation = findConversationForNode(metConversations, nodeId);
    if (conversation) {
      setSelectedConversationId(conversation.id);
      setSelectedThinkingNodeId(null);
      setSelectedNodeId(null);
      return;
    }

    if (clickedCharacter?.status === 'THINKING') {
      setSelectedThinkingNodeId(nodeId);
      setSelectedConversationId(null);
      setSelectedNodeId(null);
      return;
    }

    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setSelectedNodeId(null);
  };

  const startDiscussionRound = useCallback((round: 2 | 3) => {
    const activeCharacters = getReviewParticipants(charactersRef.current);
    const activeCharacterIds = new Set(activeCharacters.map((character) => character.id));
    const discussionPlan = buildDiscussionPlan(activeCharacters, round);
    const conversationIndexById = new Map(discussionPlan.conversations.map((conversation, index) => [conversation.id, index]));
    const targetPositionById = new Map<string, Coordinates>(activeCharacters.map((character, index) => {
      const conversation = findConversationForNode(discussionPlan.conversations, character.id);
      const participantIndex = conversation?.participantIds.indexOf(character.id) ?? 0;
      const conversationIndex = conversation ? (conversationIndexById.get(conversation.id) ?? 0) : index;

      return [
        character.id,
        round === 2
          ? roomDiscussionPosition(character, conversation, participantIndex, selectedRoom)
          : conversation
            ? hallwayDiscussionPosition(conversationIndex, participantIndex)
            : character.idlePosition,
      ] as [string, Coordinates];
    }));
    const protocolState = reviewRoundStateRef.current;

    clearMeetingTimers();
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setActiveConversations(discussionPlan.conversations);
    setMetConversationIds([]);

    if (round === 2) {
      const acceptedAudits = protocolState?.audits.filter((audit) => audit.status === 'accepted').sort((a, b) => a.arrivalOrder - b.arrivalOrder) ?? [];
      const effectiveAuditQuorum = isContractDrivenReview ? chainAuditQuorum : (protocolState?.auditQuorum ?? AUDIT_QUORUM);
      const chainAuditCount = isContractDrivenReview ? Math.min(effectiveAuditQuorum, displayedChainAuditCount) : undefined;
      const visibleAcceptedAudits = chainAuditCount !== undefined
        ? acceptedAudits.slice(0, chainAuditCount)
        : acceptedAudits;
      const ignoredAudits = chainAuditCount !== undefined
        ? []
        : protocolState?.audits.filter((audit) => audit.status === 'ignored') ?? [];
      logReview('round-2:audit_started', {
        source: chainAuditCount !== undefined ? 'chain' : 'local',
        acceptedCount: chainAuditCount ?? acceptedAudits.length,
        ignoredCount: ignoredAudits.length,
        auditQuorum: effectiveAuditQuorum,
        acceptedAudits: visibleAcceptedAudits,
        ignoredAudits,
      });
      addLog(`Round 2 peer audit started. Audit quorum is ${chainAuditCount ?? acceptedAudits.length}/${effectiveAuditQuorum}.`);
      visibleAcceptedAudits.forEach((audit) => {
        const fromName = protocolState?.reviewers.find((reviewer) => reviewer.id === audit.fromReviewerId)?.name ?? audit.fromReviewerId;
        const toName = protocolState?.reviewers.find((reviewer) => reviewer.id === audit.toReviewerId)?.name ?? audit.toReviewerId;
        addLog(`Audit #${audit.arrivalOrder} accepted: ${fromName} audited ${toName} with ${audit.score}/10000.`);
      });
    } else {
      logReview('round-3:reputation_started', {
        reviewers: protocolState?.reviewers.map((reviewer) => ({
          id: reviewer.id,
          name: reviewer.name,
          round1Weight: reviewer.round2?.round1Weight,
          reputationScore: reviewer.round2?.reputationScore,
          finalWeight: reviewer.round2?.finalWeight,
        })) ?? [],
      });
      addLog('Round 3 reputation weighting started. Nodes return to their starting table seats before the final weighted review.');
    }

    const moveDuration = Math.max(
      0,
      ...activeCharacters.map((character) => {
        const targetPosition = targetPositionById.get(character.id);
        return targetPosition ? movementDurationMs(character, targetPosition) : 0;
      }),
    );
    setRoundProcessStartDelayMs(moveDuration + ROUND_MOVEMENT_SETTLE_MS);

    const conversationRevealTimers = discussionPlan.conversations.map((conversation, index) => (
      window.setTimeout(() => {
        setMetConversationIds((current) => current.includes(conversation.id)
          ? current
          : [...current, conversation.id]);
      }, moveDuration + ROUND_MOVEMENT_SETTLE_MS + 240 + index * 620)
    ));
    meetingTimersRef.current.push(...conversationRevealTimers);

    setCharacters((prev) =>
      prev.map((character) => {
        if (!activeCharacterIds.has(character.id)) {
          return {
            ...character,
            status: 'IDLE',
            position: character.idlePosition,
          };
        }

        return {
          ...character,
          status: 'DISCUSSING',
          position: targetPositionById.get(character.id) ?? character.position,
        };
      }),
    );

    if (round === 3) {
      const timer = window.setTimeout(() => {
        setCharacters((prev) => {
          const participantIds = new Set(getReviewParticipants(prev).map((character) => character.id));
          return prev.map((character) => participantIds.has(character.id)
            ? { ...character, status: 'THINKING' }
            : character);
        });
      }, moveDuration + ROUND_MOVEMENT_SETTLE_MS);
      meetingTimersRef.current.push(timer);
    }
  }, [addLog, chainAuditQuorum, clearMeetingTimers, displayedChainAuditCount, isContractDrivenReview, selectedRoom]);

  const advanceFromRound2 = useCallback(() => {
    setPendingDiscussionAdvanceRound(null);
    applyRoundScores(2);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setActiveConversations([]);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setRoundResultHoldRound(2);
  }, [applyRoundScores, clearMeetingTimers, clearRoundResultHoldTimer]);

  const advanceFromRound3 = useCallback(() => {
    setPendingDiscussionAdvanceRound(null);
    applyRoundScores(3);
    clearMeetingTimers();
    clearRoundResultHoldTimer();
    setMetConversationIds([]);
    setActiveConversations([]);
    setSelectedConversationId(null);
    setSelectedThinkingNodeId(null);
    setRoundResultHoldRound(3);
  }, [applyRoundScores, clearMeetingTimers, clearRoundResultHoldTimer]);

  useEffect(() => {
    if (selectedNodeId || selectedConversationId || selectedThinkingNodeId || pendingDiscussionAdvanceRound === null) return;
    if (pendingDiscussionAdvanceRound === 1 && phase === 'ROUND_1') {
      setPendingDiscussionAdvanceRound(null);
      applyRoundScores(1);
      setRoundResultHoldRound(1);
      return;
    }
    if (pendingDiscussionAdvanceRound === 2 && phase === 'ROUND_2') advanceFromRound2();
    if (pendingDiscussionAdvanceRound === 3 && phase === 'ROUND_3') advanceFromRound3();
  }, [advanceFromRound2, advanceFromRound3, applyRoundScores, pendingDiscussionAdvanceRound, phase, selectedConversationId, selectedNodeId, selectedThinkingNodeId]);

  useEffect(() => {
    if (roundResultHoldRound === null || selectedNodeId || selectedConversationId || selectedThinkingNodeId) return undefined;

    const timer = window.setTimeout(() => {
      continueAfterRoundResult(roundResultHoldRound);
    }, roundResultHoldRound === 3 ? ROUND_THREE_RESULT_HOLD_MS : ROUND_RESULT_HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [continueAfterRoundResult, roundResultHoldRound, selectedConversationId, selectedNodeId, selectedThinkingNodeId]);

  useEffect(() => {
    if (!roundIntro) return undefined;

    const intro = roundIntro;
    const timer = window.setTimeout(() => {
      setRoundIntro((current) => current?.id === intro.id ? null : current);
    }, ROUND_INTRO_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [roundIntro]);

  useEffect(() => {
    const contractMotionPhase =
      phase === 'MOVING_TO_ROOMS' ||
      phase === 'ROUND_2_STARTING' ||
      phase === 'ROUND_3_STARTING';
    if (isContractDrivenReview && !contractMotionPhase) return undefined;
    if (roundIntro) return undefined;
    if (roundResultHoldRound !== null) return undefined;

    if (phase === 'MOVING_TO_ROOMS') {
      addLog('Round 1 started. Nodes are moving to their labs.');
      const allCharacters = charactersRef.current;
      const activeCharacters = getReviewParticipants(allCharacters);
      const activeCharacterIds = new Set(activeCharacters.map((character) => character.id));
      const moveDuration = Math.max(
        0,
        ...allCharacters.map((character) => movementDurationMs(character, getCharacterTarget(character.id, selectedRoom))),
      );

      setCharacters((prev) =>
        prev.map((character) => ({
          ...character,
          status: 'MOVING',
          position: getCharacterTarget(character.id, selectedRoom),
        })),
      );

      const timer = window.setTimeout(() => {
        setPhase('ROUND_1');
        setRoundProcessStartDelayMs(0);
        setCharacters((prev) => {
          const participantIds = new Set(getReviewParticipants(prev).map((character) => character.id));

          return prev.map((character) => participantIds.has(character.id)
            ? { ...character, status: 'THINKING' }
            : character);
        });
        addLog('Round 1 started. Nodes are reviewing independently.');
      }, moveDuration + ROUND_MOVEMENT_SETTLE_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_1') {
      const timer = window.setTimeout(() => {
        if (selectedNodeIdRef.current || selectedThinkingNodeIdRef.current) {
          setPendingDiscussionAdvanceRound(1);
          return;
        }
        applyRoundScores(1);
        setRoundResultHoldRound(1);
      }, roundProcessDurationMs(3));
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_2_STARTING') {
      const timer = window.setTimeout(() => {
        if (isContractDrivenReview && activeAgentStatusRequestId) {
          contractMotionRoundsRef.current[`${activeAgentStatusRequestId}:2`] = true;
        }
        setCurrentRound(2);
        setPhase('ROUND_2');
        startDiscussionRound(2);
      }, 150);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_2') {
      if (isContractDrivenReview) return undefined;

      const timer = window.setTimeout(() => {
        if (selectedNodeIdRef.current || selectedConversationIdRef.current || selectedThinkingNodeIdRef.current) {
          setPendingDiscussionAdvanceRound(2);
          return;
        }
        advanceFromRound2();
      }, roundProcessStartDelayMs + roundProcessDurationMs(AUDIT_QUORUM));
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_3_STARTING') {
      const timer = window.setTimeout(() => {
        if (isContractDrivenReview && activeAgentStatusRequestId) {
          contractMotionRoundsRef.current[`${activeAgentStatusRequestId}:3`] = true;
        }
        setCurrentRound(3);
        setPhase('ROUND_3');
        startDiscussionRound(3);
      }, 150);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'ROUND_3') {
      const timer = window.setTimeout(() => {
        if (selectedNodeIdRef.current || selectedConversationIdRef.current || selectedThinkingNodeIdRef.current) {
          setPendingDiscussionAdvanceRound(3);
          return;
        }
        advanceFromRound3();
      }, roundProcessStartDelayMs + roundProcessDurationMs(4));
      return () => window.clearTimeout(timer);
    }

    if (phase === 'FINALIZING') {
      const timer = window.setTimeout(finalizeScores, roundProcessStartDelayMs + FINAL_RESULT_EXPAND_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [activeAgentStatusRequestId, addLog, advanceFromRound2, advanceFromRound3, applyRoundScores, clearMeetingTimers, finalizeScores, isContractDrivenReview, phase, roundIntro, roundProcessStartDelayMs, roundResultHoldRound, selectedRoom, startDiscussionRound]);

  const isFinalResultVisible = phase === 'EVALUATED' && Boolean(finalResult);
  const hasReviewScores = reviewParticipants.some((character) => typeof character.lastScore === 'number');
  const isRoundBillboardPhase = (
    phase === 'QUEUED' ||
    phase === 'SELECTION' ||
    phase === 'ROUND_1' ||
    phase === 'ROUND_2_STARTING' ||
    phase === 'ROUND_2' ||
    phase === 'ROUND_3_STARTING' ||
    phase === 'ROUND_3' ||
    phase === 'FINALIZING'
  );
  const showReviewBillboard = isFinalResultVisible || hasReviewScores || isRoundBillboardPhase;
  const confirmButtonFrame = !isFinalResultVisible
    ? {
        border: '#6f8d9d',
        fill: '#c6d9e3',
        highlight: 'rgba(255, 255, 255, 0.38)',
        shadow: 'rgba(54, 80, 94, 0.2)',
        text: 'text-[#4c6673]',
      }
    : confirmArmed
      ? {
          border: '#9c342d',
          fill: '#ffd5c7',
          highlight: 'rgba(255, 255, 255, 0.55)',
          shadow: 'rgba(95, 33, 28, 0.3)',
          text: 'text-[#7e241f]',
        }
      : {
          border: '#315d75',
          fill: '#9ed4e8',
          highlight: 'rgba(255, 255, 255, 0.62)',
          shadow: 'rgba(38, 59, 72, 0.3)',
          text: 'text-[#17384b]',
        };
  const handleRoomPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase === 'EVALUATED') return;
    if (!selectedReviewerNode) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('[data-reviewer-detail-trigger="true"]')) return;

    setSelectedNodeId(null);
  }, [phase, selectedReviewerNode]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#f2e7c9] font-pixel text-[#503521]">
      {page !== 'room' && page !== 'loading' && <Navbar activePage={page} onNavigate={handleNavigate} />}

      {page === 'dashboard' && <DashboardPage daioData={daioData} />}
      {page === 'commons' && (
        <CommonsPage
          onRoomSelected={startRoomSelection}
          activeRoomId={selectedRoom}
          isEvaluationInProgress={isEvaluationInProgress}
          openRoomSelectionSignal={openRoomSelectionSignal}
        />
      )}
      {page === 'loading' && <LoadingTransition roomId={loadingRoom} reviewers={loadingReviewers} onComplete={enterRoom} />}
      {page === 'room' && (
        <div className="evaluation-room-cool relative flex h-screen overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div
              className="relative min-h-0 flex-1 overflow-hidden border-b-4 border-[#7b5835]"
              onPointerDownCapture={handleRoomPointerDownCapture}
            >
              <ConferenceHall tiles={activeRoomScene.tiles} />

              <section className="absolute bottom-6 left-16 z-40 max-w-xl">
                <p className="pixel-text-shadow text-sm uppercase tracking-widest text-white">Active review room</p>
                <h1 className="pixel-text-shadow text-5xl font-bold leading-none text-white">
                  {REVIEW_ROOMS[selectedRoom].title}
                </h1>
                <p className="pixel-text-shadow mt-3 max-w-md text-lg leading-snug text-white">
                  {REVIEW_ROOMS[selectedRoom].description}
                </p>
              </section>

              {(Object.entries(activeRoomConfig) as [string, RoomConfigEntry][]).map(([id, config]) => (
                <ProjectRoom
                  key={id}
                  label={config.label}
                  position={config.position}
                  imageUrl={ASSET_PATHS.rooms[config.roomAssetId]}
                  inactive={shouldDimInactiveLabs && Boolean(config.reviewerId) && !selectedReviewerIdsForRooms.has(config.reviewerId ?? '')}
                />
              ))}

              <Billboard
                characters={reviewParticipants}
                visible={showReviewBillboard}
                showDetails={showReviewBillboard || showChart}
                finalSummary={finalResult?.summary}
                finalNodeCount={finalResult?.nodes.length}
                finalNodes={finalResult?.nodes ?? []}
                selectedNodeId={selectedNodeId}
                onInspectNode={(node) => inspectReviewer(node.id)}
                phase={phase}
                currentRound={currentRound}
                reviewRoundState={activeReviewRoundState}
                roundResultHoldRound={roundResultHoldRound}
              />

              <AnimatePresence>
                {phase === 'SELECTION' && (
                  <NodeSelectionScene
                    nodes={characters}
                    isComplete={isNodeSelectionReady}
                    onInspectNode={inspectReviewer}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {roundIntro && (
                  <motion.div
                    key={roundIntro.id}
                    className="pointer-events-none absolute inset-0 z-[80] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <motion.div
                      className="scoreboard-round-intro flex min-w-[420px] flex-col items-center gap-3 px-8 py-6 text-center font-bold uppercase tracking-widest"
                      initial={{ opacity: 0, scale: 0.86, y: 16 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.08, y: -18 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                    >
                      <span className="text-5xl leading-none">Round {String(roundIntro.round).padStart(2, '0')} Start</span>
                      <span className="border-2 border-[#f1c46d] bg-[#332b1f] px-3 py-1.5 text-sm leading-none tracking-[0.18em] text-[#ffd98a] shadow-[2px_2px_0_rgba(7,17,31,0.55)]">
                        {roundIntroSubtitle(roundIntro.round)}
                      </span>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="absolute inset-0 pointer-events-none">
                {sceneCharacters.map((character) => (
                  <div key={character.id} className="pointer-events-auto">
                    {(() => {
                      const result = finalResult?.nodes.find((node) => node.id === character.id);
                      const tokenFlow = result ? result.rewardAmount - result.slashAmount : 0;
                      const activeConversation = findConversationForNode(activeConversations, character.id);
                      const hasMetPartner = Boolean(activeConversation && metConversationIds.includes(activeConversation.id));
                      const isRoundTwoTableTalk = phase === 'ROUND_2' && character.status === 'DISCUSSING';
                      const characterAnchorStyle = {
                        left: `calc(${character.position.x}% + ${character.position.offsetX || 0}px)`,
                        top: `calc(${character.position.y}% + ${character.position.offsetY || 0}px)`,
                      };
                      const isReviewerCharacter = Boolean(activeReviewRoundState?.reviewers.some((reviewer) => reviewer.id === character.id));

                      return (
                        <div
                          className={result?.isOutlier ? 'node--slashed' : result ? 'node--rewarded' : undefined}
                          data-reviewer-detail-trigger={isReviewerCharacter ? 'true' : undefined}
                        >
                          <Character
                            data={character}
                            onClick={() => inspectSceneNode(character.id)}
                            isSelected={
                              selectedNodeId === character.id ||
                              selectedThinkingNodeId === character.id ||
                              Boolean(selectedConversation?.participantIds.includes(character.id))
                            }
                            showTalkingBubble={hasMetPartner || isRoundTwoTableTalk}
                            showThoughtCloud={character.status === 'THINKING'}
                          />
                          <AnimatePresence>
                            {roundResultHoldRound && (
                              <RoundScorePopup
                                character={character}
                                round={roundResultHoldRound}
                                style={{
                                  left: characterAnchorStyle.left,
                                  top: `calc(${characterAnchorStyle.top} - 82px)`,
                                }}
                              />
                            )}
                          </AnimatePresence>
                          {isFinalResultVisible && result && result.isOutlier && (
                            <ResultExplosionSequence
                              src={ASSET_PATHS.effects.explosion}
                              baseStyle={characterAnchorStyle}
                            />
                          )}
                          {isFinalResultVisible && result && !result.isOutlier && (
                            <ResultSparkleSequence
                              src={ASSET_PATHS.effects.sparkle}
                              baseStyle={characterAnchorStyle}
                            />
                          )}
                          {isFinalResultVisible && result && tokenFlow !== 0 && (
                            <div className={`absolute z-50 -translate-x-1/2 text-xs font-bold ${tokenFlow > 0 ? 'token-float--gain' : 'token-float--loss'}`}
                              style={{
                                left: characterAnchorStyle.left,
                                top: `calc(${characterAnchorStyle.top} - 54px)`,
                              }}
                            >
                              {tokenFlow > 0 ? '+' : ''}
                              {tokenFlow.toFixed(1)} {result.rewardSource === 'chain' ? 'USDAIO' : 'TOK'}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>

              <div className="pointer-events-none absolute bottom-6 right-6 z-[75] flex flex-col items-end gap-2">
                {isFinalResultVisible && confirmArmed && (
                  <div className="pointer-events-none relative isolate max-w-[190px] select-none bg-transparent px-3 py-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wider text-[#9c342d]">
                    <PixelFrameChrome
                      round={2}
                      thickness={3}
                      color="#d87965"
                      fillColor="#fff0ea"
                      innerHighlightColor="rgba(255, 255, 255, 0.52)"
                      outerShadowColor="rgba(80, 53, 33, 0.16)"
                      outerShadowOffsetX={3}
                      outerShadowOffsetY={3}
                    />
                    <span className="relative z-40">Confirm final results? Click once more to close this room.</span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  {isFinalResultVisible && (
                    <button
                      type="button"
                      onClick={downloadEvaluationReport}
                      className={`pointer-events-auto relative isolate flex h-24 w-32 appearance-none flex-col items-center justify-center gap-1 border-0 bg-transparent px-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wider shadow-none transition-transform hover:-translate-y-0.5 active:translate-y-0.5 ${confirmButtonFrame.text}`}
                      aria-label="Download evaluation report"
                    >
                      <PixelFrameChrome
                        round={2}
                        thickness={4}
                        color={confirmButtonFrame.border}
                        fillColor={confirmButtonFrame.fill}
                        innerHighlightColor={confirmButtonFrame.highlight}
                        outerShadowColor={confirmButtonFrame.shadow}
                        outerShadowOffsetX={5}
                        outerShadowOffsetY={5}
                      />
                      <span className="relative z-40 flex flex-col items-center justify-center gap-1">
                        <FileDown size={20} />
                        <span>Download Report</span>
                        <span className="text-[8px] opacity-80">Markdown file</span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!isFinalResultVisible}
                    onClick={requestConfirmReviewResults}
                    className={`pointer-events-auto relative isolate flex h-24 w-32 appearance-none flex-col items-center justify-center gap-1 border-0 bg-transparent px-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wider shadow-none ${
                      confirmButtonFrame.text
                    } ${isFinalResultVisible ? 'transition-transform hover:-translate-y-0.5 active:translate-y-0.5' : 'cursor-not-allowed opacity-95'}`}
                    aria-label={isFinalResultVisible ? 'Confirm review results' : 'Review in progress'}
                  >
                    <PixelFrameChrome
                      round={2}
                      thickness={4}
                      color={confirmButtonFrame.border}
                      fillColor={confirmButtonFrame.fill}
                      innerHighlightColor={confirmButtonFrame.highlight}
                      outerShadowColor={confirmButtonFrame.shadow}
                      outerShadowOffsetX={5}
                      outerShadowOffsetY={5}
                    />
                    <span className="relative z-40 flex flex-col items-center justify-center gap-1">
                      <CheckCircle2 size={20} />
                      <span>{isFinalResultVisible ? (confirmArmed ? 'Confirm?' : 'Confirm Review') : 'Reviewing'}</span>
                      <span className="text-[8px] opacity-80">
                        {isFinalResultVisible ? (confirmArmed ? 'Click again' : 'Final ready') : 'Locked'}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="review-room-sideboard z-30 flex w-84 flex-col gap-4 overflow-hidden border-l-4 border-[#7b5835] bg-[#fff8e6] p-4 shadow-[-4px_0_0_rgba(80,53,33,0.12)]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleNavigate('dashboard')}
                className="scoreboard-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>
              <button
                type="button"
                onClick={leaveRoom}
                className="scoreboard-button flex items-center justify-center gap-2 px-3 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5"
              >
                <DoorOpen size={16} />
                Leave Room
              </button>
            </div>
            <div ref={sideboardActivityRef} className="min-h-0 flex flex-1 flex-col">
              <AnimatePresence mode="wait" initial={false}>
                {!isFinalResultVisible && activeReviewRoundState && selectedReviewerNode ? (
                  <motion.div
                    key={`reviewer-side-${selectedReviewerNode.id}-${activeReviewRoundState.phase}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="min-h-0 flex-1"
                  >
                    <ReviewerSidePanel
                      state={activeReviewRoundState}
                      reviewer={selectedReviewerNode}
                      roundCompleted={selectedReviewerRoundCompleted}
                      onClose={() => setSelectedNodeId(null)}
                    />
                  </motion.div>
                ) : selectedConversation ? (
                  <ConversationDrawer
                    conversation={selectedConversation}
                    onClose={() => setSelectedConversationId(null)}
                  />
                ) : selectedThinkingNode ? (
                  <ThinkingDrawer
                    character={selectedThinkingNode}
                    phase={phase}
                    currentRound={currentRound}
                    onClose={() => setSelectedThinkingNodeId(null)}
                  />
                ) : (
                  <motion.div
                    key="sideboard-default"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="flex min-h-0 flex-1 flex-col gap-4"
                  >
                    {isContractDrivenReview && (
                      <ContractStatePanel daioData={daioData} requestId={activeAgentStatusRequestId} releasedRounds={releasedRounds} />
                    )}
                    {showAuditQuorumTracker && activeReviewRoundState && (
                      <AuditQuorumTracker
                        audits={activeReviewRoundState.audits}
                        reviewers={activeReviewRoundState.reviewers}
                        quorum={activeReviewRoundState.auditQuorum}
                        isActive={showAuditQuorumTracker}
                        startDelayMs={roundProcessStartDelayMs}
                        onChainAuditCount={isContractDrivenReview ? displayedChainAuditCount : undefined}
                      />
                    )}
                    {showReputationWeightingPanel && activeReviewRoundState && (
                      <ReputationWeightingPanel state={activeReviewRoundState} />
                    )}
                    {showNodeReputationPanel && (
                      <ReputationScorePanel
                        characters={sideboardCharacters}
                        selectedIds={activeReviewRoundState?.selectedReviewerIds}
                        dimInactive={Boolean(activeReviewRoundState)}
                      />
                    )}
                    <div className="min-h-0 flex-1">
                      <LogPanel logs={logs} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>

          <AnimatePresence>
            {isFinalResultVisible && selectedNodeResult && (
              <NodeDetailDrawer
                node={selectedNodeResult}
                open={Boolean(selectedNodeResult)}
                chat={nodeChat.getChatState(selectedNodeResult)}
                isChatSending={nodeChat.getIsSending(selectedNodeResult)}
                chatError={nodeChat.getError(selectedNodeResult)}
                onClose={() => setSelectedNodeId(null)}
                onSendChatMessage={(message) => nodeChat.sendMessage(selectedNodeResult, message)}
                requestId={daioData.latestRequestId}
              />
            )}
          </AnimatePresence>

          {!isFinalResultVisible && phase === 'IDLE' && !isContractDrivenReview && (
            <ReviewBountyGateOverlay
              roomId={selectedRoom}
              reviewBounty={roomReviewBounty}
              onBack={returnToRoomSelection}
              onConfirmed={(reviewBounty) => {
                setRoomReviewBounty(reviewBounty);
                addLog(`${reviewBounty.amount.toFixed(2)} ${reviewBounty.asset} review bounty paid.`);
              }}
              onSubmitPaper={handleSubmit}
            />
          )}
        </div>
      )}
    </div>
  );
}
