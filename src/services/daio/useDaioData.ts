/**
 * useDaioData — multicall read hook for on-chain DAIO state.
 *
 * Batched RPC round-trips (Multicall3) every 5 s:
 *   Batch 1 (always): baseRequestFee, balances, StateView pool slot0, latestRequestState
 *   Batch 2 (request-dependent): DAIOInfoReader lifecycle/phase/participants
 *   Batch 3 (request+attempt-dependent): round aggregates and audit participants
 *
 * Call `refresh()` after a transaction to re-fetch immediately.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import {
  DAIO_SLOT,
  buildDaioContracts,
  CONTRACT_ADDRESSES,
  ROUND_LEDGER_ABI,
  COMMIT_REVEAL_ABI,
  DAIO_INFO_READER_ABI,
  REVIEWER_REGISTRY_ABI,
  REPUTATION_LEDGER_ABI,
  ERC8004_ADAPTER_ABI,
} from './queries';
import ADDRESSES_JSON from '../../contracts/addresses.json';

// ─── Pool constants ───────────────────────────────────────────────────────────
/** Uniswap V4 fee in pips (1/1_000_000). 3000 pips = 0.3 % */
const POOL_FEE_PIPS = ADDRESSES_JSON.sepolia.pool.fee;
/** Pool fee as a fraction (0–1). */
const POOL_FEE_FRACTION = POOL_FEE_PIPS / 1_000_000;

// ─── Fallback values (used while chain data is loading / unavailable) ─────────
const FALLBACK_USDAIO_PER_ETH =
  ADDRESSES_JSON.sepolia.pool.initialPriceUsdaioPerEth * (1 - POOL_FEE_FRACTION);

// ─── Math helpers ─────────────────────────────────────────────────────────────
const Q192 = 2n ** 192n;
const PRICE_PRECISION = 1_000_000n; // 6 decimal places of precision
const REQUEST_ATTEMPT_FALLBACK = 0n;
const ROUND_REVIEW = 0;
const ROUND_AUDIT_CONSENSUS = 1;
const ROUND_REPUTATION_FINAL = 2;
const CHAIN_REFETCH_INTERVAL_MS = 5_000;
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

export const DAIO_REQUEST_STATUS_NAMES = [
  'None',
  'Queued',
  'ReviewCommit',
  'ReviewReveal',
  'AuditCommit',
  'AuditReveal',
  'Finalized',
  'Cancelled',
  'Failed',
  'Unresolved',
] as const;

export function daioRequestStatusName(status: number) {
  return DAIO_REQUEST_STATUS_NAMES[status] ?? `Unknown(${status})`;
}

/**
 * Converts Uniswap V4 sqrtPriceX96 to a human-readable USDAIO-per-ETH rate.
 *
 * price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
 *
 * Currency0 = ETH (18 dec), Currency1 = USDAIO (18 dec) → no decimal adjustment.
 * We scale by PRICE_PRECISION before integer division to preserve 6 decimal places.
 */
function sqrtPriceX96ToUsdaioPerEth(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const scaled = (sqrtPriceX96 * sqrtPriceX96 * PRICE_PRECISION) / Q192;
  return Number(scaled) / Number(PRICE_PRECISION);
}

/**
 * Converts a raw token bigint (18-decimal) to a human-readable float.
 * Falls back to 18 if decimals is 0 or undefined.
 */
function formatUnits(raw: bigint, decimals: number): number {
  const d = decimals > 0 ? decimals : 18;
  const divisor = 10n ** BigInt(d);
  const whole = raw / divisor;
  const frac  = raw % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

// ─── Public interface ─────────────────────────────────────────────────────────
export interface DaioData {
  // ── Protocol ──────────────────────────────────────────────────────────────
  /** Raw base request fee (18-decimal bigint). Undefined while loading. */
  baseRequestFee: bigint | undefined;
  /** Human-readable USDAIO (e.g. 100.0 for 100 USDAIO). */
  baseRequestFeeFormatted: number;

  // ── USDAIO Token ──────────────────────────────────────────────────────────
  /** Raw USDAIO balance of the connected wallet. Undefined when not connected. */
  usdaioBalance: bigint | undefined;
  /** Human-readable USDAIO balance. */
  usdaioBalanceFormatted: number;
  /** Raw USDAIO allowance of wallet → PaymentRouter. */
  usdaioAllowance: bigint | undefined;
  usdaioDecimals: number;

  // ── Uniswap V4 pool rate ───────────────────────────────────────────────────
  /** Raw sqrtPriceX96 from Uniswap v4 StateView.getSlot0. */
  poolSqrtPriceX96: bigint | undefined;
  /** Pool spot rate: USDAIO received per 1 ETH (before fee). */
  poolRateUsdaioPerEth: number;
  /** Pool fee as a human-readable percentage (e.g. 0.3 for 0.3 %). */
  poolFeePct: number;
  /**
   * Effective rate after pool fee: USDAIO received per 1 ETH spent.
   * Falls back to FALLBACK_USDAIO_PER_ETH while chain data is unavailable.
   */
  effectiveUsdaioPerEth: number;

  // ── Latest request (wallet) ───────────────────────────────────────────────
  /** Most recent requestId for the connected wallet. 0n when none. */
  latestRequestId: bigint;
  /**
   * Raw status code from DAIOCore.RequestStatus:
   *   0=None 1=Queued 2=ReviewCommit 3=ReviewReveal 4=AuditCommit
   *   5=AuditReveal 6=Finalized 7=Cancelled 8=Failed 9=Unresolved
   */
  latestRequestStatus: number;
  latestRequestStatusName: string;
  /** true while the request is actively being processed (Queued → AuditReveal). */
  latestRequestProcessing: boolean;
  /** true once the request reached a terminal state (Finalized / Cancelled / Failed / Unresolved). */
  latestRequestCompleted: boolean;
  requestLifecycle: DaioRequestLifecycle | null;
  requestPhase: DaioRequestPhase | null;
  requestConfig: DaioRequestConfig | null;

  // ── Round data (requestId-dependent) ──────────────────────────────────────
  /** Total score aggregated across all reviewers for this request. */
  roundTotalScore: bigint;
  /** Aggregate totalWeight in the latest closed RoundLedger round. */
  roundReviewerCount: bigint;
  /** Latest closed RoundLedger round id: 0=review, 1=audit_consensus, 2=reputation_final. */
  roundNumber: number;
  /** Current request retry attempt used for round-ledger reads. */
  requestAttempt: bigint;
  roundAggregates: {
    review: DaioRoundAggregate;
    auditConsensus: DaioRoundAggregate;
    reputationFinal: DaioRoundAggregate;
  };
  /** Addresses of reviewers who committed/revealed in this round. */
  reviewParticipants: readonly `0x${string}`[];
  /** Accepted review committers from DAIOInfoReader request storage. */
  reviewCommitters: readonly `0x${string}`[];
  /** Reviewers that revealed review reports in DAIOCore request storage. */
  revealedReviewers: readonly `0x${string}`[];
  /** Addresses of auditors who participated. */
  auditParticipants: readonly `0x${string}`[];
  /** Submitted audit report count from DAIOInfoReader.auditTargets(requestId, auditor). */
  auditReportCount: number;
  /** Registered reviewer roster from ReviewerRegistry.getReviewers(). */
  registeredReviewers: readonly `0x${string}`[];
  reviewerRoundSnapshots: DaioReviewerRoundSnapshot[];
  reviewerProfiles: DaioReviewerProfile[];
  registeredReviewerProfiles: DaioReviewerProfile[];

  // ── Convenience addresses ──────────────────────────────────────────────────
  paymentRouterAddress: `0x${string}`;
  usdaioAddress: `0x${string}`;

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  /** Call after a transaction to immediately re-fetch chain state. */
  refresh: () => void;
}

export interface DaioRoundAggregate {
  score: bigint;
  totalWeight: bigint;
  confidence: bigint;
  coverage: bigint;
  lowConfidence: boolean;
  closed: boolean;
  aborted: boolean;
}

export interface DaioRequestLifecycle {
  requester: `0x${string}` | '';
  status: number;
  statusName: string;
  feePaid: bigint;
  priorityFee: bigint;
  rewardPool: bigint;
  protocolFee: bigint;
  retryCount: bigint;
  committeeEpoch: bigint;
  auditEpoch: bigint;
  reviewCommitCount: bigint;
  reviewRevealCount: bigint;
  auditCommitCount: bigint;
  auditRevealCount: bigint;
  auditCoverage: bigint;
  activePriority: bigint;
  lowConfidence: boolean;
}

export interface DaioRequestConfig {
  reviewCommitQuorum: bigint;
  reviewRevealQuorum: bigint;
  auditCommitQuorum: bigint;
  auditRevealQuorum: bigint;
  auditTargetLimit: bigint;
  maxRetries: bigint;
  auditCommitTimeout: bigint;
  auditRevealTimeout: bigint;
}

export interface DaioRequestPhase {
  status: number;
  processing: boolean;
  completed: boolean;
  count: bigint;
  quorum: bigint;
  phaseStartedAt: bigint;
  timeout: bigint;
  deadline: bigint;
  timedOut: boolean;
  retryCount: bigint;
  maxRetries: bigint;
  lowConfidence: boolean;
}

export interface DaioReviewerRoundScore {
  score: bigint;
  weight: bigint;
  weightedScore: bigint;
  auditScore: bigint;
  reputationScore: bigint;
  available: boolean;
}

export interface DaioReviewerRoundAccounting {
  reward: bigint;
  slashed: bigint;
  slashCount: bigint;
  lastSlashReasonHash: `0x${string}`;
  protocolFault: boolean;
  semanticFault: boolean;
}

export interface DaioReviewerRoundSnapshot {
  address: `0x${string}`;
  review: DaioReviewerRoundScore;
  auditConsensus: DaioReviewerRoundScore;
  reputationFinal: DaioReviewerRoundScore;
  finalAccounting: DaioReviewerRoundAccounting;
  profile?: DaioReviewerProfile;
}

export interface DaioReviewerProfile {
  address: `0x${string}`;
  ensNode: `0x${string}`;
  ensName?: string;
  registered: boolean;
  active: boolean;
  suspended: boolean;
  agentId: bigint;
  stake: bigint;
  availableStake: bigint;
  lockedStake: bigint;
  domainMask: bigint;
  completedRequests: bigint;
  semanticStrikes: bigint;
  protocolFaults: bigint;
  cooldownUntilBlock: bigint;
  erc8004AgentWallet?: `0x${string}`;
  reputation: DaioReviewerReputation;
}

export interface DaioReviewerReputation {
  samples: bigint;
  reportQuality: bigint;
  auditReliability: bigint;
  finalContribution: bigint;
  protocolCompliance: bigint;
}

const EMPTY_ROUND_AGGREGATE: DaioRoundAggregate = {
  score: 0n,
  totalWeight: 0n,
  confidence: 0n,
  coverage: 0n,
  lowConfidence: false,
  closed: false,
  aborted: false,
};

const EMPTY_REVIEWER_ROUND_SCORE: DaioReviewerRoundScore = {
  score: 0n,
  weight: 0n,
  weightedScore: 0n,
  auditScore: 0n,
  reputationScore: 0n,
  available: false,
};

const EMPTY_REVIEWER_ROUND_ACCOUNTING: DaioReviewerRoundAccounting = {
  reward: 0n,
  slashed: 0n,
  slashCount: 0n,
  lastSlashReasonHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  protocolFault: false,
  semanticFault: false,
};

const EMPTY_REVIEWER_REPUTATION: DaioReviewerReputation = {
  samples: 0n,
  reportQuality: 0n,
  auditReliability: 0n,
  finalContribution: 0n,
  protocolCompliance: 0n,
};

function parseRoundAggregate(
  aggregate: readonly [bigint, bigint, bigint, bigint, boolean, boolean, boolean] | undefined,
): DaioRoundAggregate {
  if (!aggregate) return EMPTY_ROUND_AGGREGATE;
  return {
    score: aggregate[0],
    totalWeight: aggregate[1],
    confidence: aggregate[2],
    coverage: aggregate[3],
    lowConfidence: aggregate[4],
    closed: aggregate[5],
    aborted: aggregate[6],
  };
}

function parseReviewerRoundScore(
  score: readonly [bigint, bigint, bigint, bigint, bigint, boolean] | undefined,
): DaioReviewerRoundScore {
  if (!score) return EMPTY_REVIEWER_ROUND_SCORE;
  return {
    score: score[0],
    weight: score[1],
    weightedScore: score[2],
    auditScore: score[3],
    reputationScore: score[4],
    available: score[5],
  };
}

function parseReviewerRoundAccounting(
  accounting: readonly [bigint, bigint, bigint, `0x${string}`, boolean, boolean] | undefined,
): DaioReviewerRoundAccounting {
  if (!accounting) return EMPTY_REVIEWER_ROUND_ACCOUNTING;
  return {
    reward: accounting[0],
    slashed: accounting[1],
    slashCount: accounting[2],
    lastSlashReasonHash: accounting[3],
    protocolFault: accounting[4],
    semanticFault: accounting[5],
  };
}

function tupleField<T>(tuple: unknown, index: number, name: string, fallback: T): T {
  const named = tuple && typeof tuple === 'object'
    ? (tuple as Record<string, unknown>)[name]
    : undefined;
  if (named !== undefined) return named as T;
  if (Array.isArray(tuple) && tuple[index] !== undefined) return tuple[index] as T;
  return fallback;
}

function uintField(tuple: unknown, index: number, name: string, fallback = 0n) {
  const value = tupleField<unknown>(tuple, index, name, fallback);
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.max(0, Math.trunc(value)));
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return fallback;
}

function parseRequestConfig(config: unknown): DaioRequestConfig | null {
  if (!config) return null;

  return {
    reviewCommitQuorum: uintField(config, 2, 'reviewCommitQuorum'),
    reviewRevealQuorum: uintField(config, 3, 'reviewRevealQuorum'),
    auditCommitQuorum: uintField(config, 4, 'auditCommitQuorum'),
    auditRevealQuorum: uintField(config, 5, 'auditRevealQuorum'),
    auditTargetLimit: uintField(config, 6, 'auditTargetLimit'),
    maxRetries: uintField(config, 13, 'maxRetries'),
    auditCommitTimeout: uintField(config, 22, 'auditCommitTimeout'),
    auditRevealTimeout: uintField(config, 23, 'auditRevealTimeout'),
  };
}

function addressArray(value: unknown): readonly `0x${string}`[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is `0x${string}` => typeof entry === 'string' && entry.startsWith('0x'))
    : [];
}

function uniqueAddresses(groups: readonly (readonly `0x${string}`[])[]): `0x${string}`[] {
  const byLowercase = new Map<string, `0x${string}`>();
  groups.forEach((group) => {
    group.forEach((address) => byLowercase.set(address.toLowerCase(), address));
  });
  return Array.from(byLowercase.values());
}

function latestClosedRound(input: {
  review: DaioRoundAggregate;
  auditConsensus: DaioRoundAggregate;
  reputationFinal: DaioRoundAggregate;
}): { round: number; aggregate: DaioRoundAggregate } {
  if (input.reputationFinal.closed) return { round: ROUND_REPUTATION_FINAL, aggregate: input.reputationFinal };
  if (input.auditConsensus.closed) return { round: ROUND_AUDIT_CONSENSUS, aggregate: input.auditConsensus };
  if (input.review.closed) return { round: ROUND_REVIEW, aggregate: input.review };
  return { round: 0, aggregate: EMPTY_ROUND_AGGREGATE };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDaioData(): DaioData {
  const { address: walletAddress } = useAccount();
  const lastLatestRequestLogKeyRef = useRef('');
  const lastRoundSnapshotLogKeyRef = useRef('');

  // ── Batch 1: always-on + wallet-dependent calls (slots 0-5) ─────────────
  const { data, isLoading, refetch } = useReadContracts({
    contracts: buildDaioContracts(walletAddress),
    query: {
      refetchInterval:            CHAIN_REFETCH_INTERVAL_MS,
      staleTime:                  0,
      refetchIntervalInBackground: false,
    },
  });

  // ── Unwrap results by slot index ─────────────────────────────────────────
  const baseRequestFee  = data?.[DAIO_SLOT.BASE_REQUEST_FEE]?.result  as bigint | undefined;
  const usdaioBalance   = data?.[DAIO_SLOT.USDAIO_BALANCE]?.result    as bigint | undefined;
  const usdaioAllowance = data?.[DAIO_SLOT.USDAIO_ALLOWANCE]?.result  as bigint | undefined;
  const usdaioDecimals  = (data?.[DAIO_SLOT.USDAIO_DECIMALS]?.result  as number | undefined) ?? 18;

  // StateView.getSlot0 returns a tuple [sqrtPriceX96, tick, protocolFee, lpFee]
  const slot0 = data?.[DAIO_SLOT.POOL_SLOT0]?.result as
    | readonly [bigint, number, number, number]
    | undefined;
  const poolSqrtPriceX96 = slot0?.[0];

  // latestRequestState returns [requestId, status, processing, completed]
  const requestState = data?.[DAIO_SLOT.LATEST_REQUEST_STATE]?.result as
    | readonly [bigint, number, boolean, boolean]
    | undefined;
  const latestRequestId         = requestState?.[0] ?? 0n;
  const routerRequestStatus     = requestState?.[1] ?? 0;
  const routerRequestProcessing = requestState?.[2] ?? false;
  const routerRequestCompleted  = requestState?.[3] ?? false;
  const registeredReviewers = useMemo(
    () => addressArray(data?.[DAIO_SLOT.REGISTERED_REVIEWERS]?.result),
    [data],
  );

  // ── Batch 2: request lifecycle/phase/participants through DAIOInfoReader ──
  //   Runs only once we know the latestRequestId from Batch 1.
  const hasRequest = latestRequestId > 0n;
  const { data: requestData, refetch: refetchRequest } = useReadContracts({
    contracts: hasRequest
      ? ([
          {
            address:      CONTRACT_ADDRESSES.daioInfoReader,
            abi:          DAIO_INFO_READER_ABI,
            functionName: 'requestInfo' as const,
            args:         [latestRequestId] as const,
          },
          {
            address:      CONTRACT_ADDRESSES.daioInfoReader,
            abi:          DAIO_INFO_READER_ABI,
            functionName: 'requestPhase' as const,
            args:         [latestRequestId] as const,
          },
          {
            address:      CONTRACT_ADDRESSES.daioInfoReader,
            abi:          DAIO_INFO_READER_ABI,
            functionName: 'requestParticipants' as const,
            args:         [latestRequestId] as const,
          },
          {
            address:      CONTRACT_ADDRESSES.daioInfoReader,
            abi:          DAIO_INFO_READER_ABI,
            functionName: 'requestConfig' as const,
            args:         [latestRequestId] as const,
          },
        ] as const)
      : [],
    query: {
      enabled:                     hasRequest,
      refetchInterval:             CHAIN_REFETCH_INTERVAL_MS,
      staleTime:                   0,
      refetchIntervalInBackground: false,
    },
  });

  const requestInfo = hasRequest ? requestData?.[0]?.result : undefined;
  const requestPhaseTuple = hasRequest ? requestData?.[1]?.result : undefined;
  const requestParticipantsTuple = hasRequest ? requestData?.[2]?.result : undefined;
  const requestConfigTuple = hasRequest ? requestData?.[3]?.result : undefined;
  const requestConfig = parseRequestConfig(requestConfigTuple);
  const requestAttempt = requestInfo
    ? tupleField<bigint>(requestInfo, 14, 'retryCount', REQUEST_ATTEMPT_FALLBACK)
    : REQUEST_ATTEMPT_FALLBACK;
  const latestRequestStatus = requestInfo
    ? tupleField<number>(requestInfo, 5, 'status', routerRequestStatus)
    : routerRequestStatus;
  const latestRequestStatusName = daioRequestStatusName(latestRequestStatus);
  const latestRequestProcessing = requestPhaseTuple
    ? tupleField<boolean>(requestPhaseTuple, 1, 'processing', routerRequestProcessing)
    : routerRequestProcessing;
  const latestRequestCompleted = requestPhaseTuple
    ? tupleField<boolean>(requestPhaseTuple, 2, 'completed', routerRequestCompleted)
    : routerRequestCompleted;
  const requestLifecycle: DaioRequestLifecycle | null = requestInfo
    ? {
        requester: tupleField<`0x${string}` | ''>(requestInfo, 0, 'requester', ''),
        status: latestRequestStatus,
        statusName: latestRequestStatusName,
        feePaid: tupleField<bigint>(requestInfo, 6, 'feePaid', 0n),
        priorityFee: tupleField<bigint>(requestInfo, 7, 'priorityFee', 0n),
        rewardPool: tupleField<bigint>(requestInfo, 8, 'rewardPool', 0n),
        protocolFee: tupleField<bigint>(requestInfo, 9, 'protocolFee', 0n),
        retryCount: requestAttempt,
        committeeEpoch: tupleField<bigint>(requestInfo, 15, 'committeeEpoch', 0n),
        auditEpoch: tupleField<bigint>(requestInfo, 16, 'auditEpoch', 0n),
        reviewCommitCount: tupleField<bigint>(requestInfo, 17, 'reviewCommitCount', 0n),
        reviewRevealCount: tupleField<bigint>(requestInfo, 18, 'reviewRevealCount', 0n),
        auditCommitCount: tupleField<bigint>(requestInfo, 19, 'auditCommitCount', 0n),
        auditRevealCount: tupleField<bigint>(requestInfo, 20, 'auditRevealCount', 0n),
        auditCoverage: tupleField<bigint>(requestInfo, 23, 'auditCoverage', 0n),
        activePriority: tupleField<bigint>(requestInfo, 13, 'activePriority', 0n),
        lowConfidence: tupleField<boolean>(requestInfo, 26, 'lowConfidence', false),
      }
    : null;
  const requestPhase: DaioRequestPhase | null = requestPhaseTuple
    ? {
        status: tupleField<number>(requestPhaseTuple, 0, 'status', latestRequestStatus),
        processing: latestRequestProcessing,
        completed: latestRequestCompleted,
        count: tupleField<bigint>(requestPhaseTuple, 3, 'count', 0n),
        quorum: tupleField<bigint>(requestPhaseTuple, 4, 'quorum', 0n),
        phaseStartedAt: tupleField<bigint>(requestPhaseTuple, 5, 'phaseStartedAt', 0n),
        timeout: tupleField<bigint>(requestPhaseTuple, 6, 'timeout', 0n),
        deadline: tupleField<bigint>(requestPhaseTuple, 7, 'deadline', 0n),
        timedOut: tupleField<boolean>(requestPhaseTuple, 8, 'timedOut', false),
        retryCount: tupleField<bigint>(requestPhaseTuple, 9, 'retryCount', requestAttempt),
        maxRetries: tupleField<bigint>(requestPhaseTuple, 10, 'maxRetries', 0n),
        lowConfidence: tupleField<boolean>(requestPhaseTuple, 11, 'lowConfidence', false),
      }
    : null;
  const { reviewCommitters, revealedReviewers, reviewParticipants } = useMemo(() => {
    const committers = addressArray(tupleField<unknown>(requestParticipantsTuple, 0, 'reviewCommitters', []));
    const revealed = addressArray(tupleField<unknown>(requestParticipantsTuple, 1, 'revealedReviewers', []));
    return {
      reviewCommitters: committers,
      revealedReviewers: revealed,
      reviewParticipants: revealed.length > 0 ? revealed : committers,
    };
  }, [requestParticipantsTuple]);

  // ── Batch 3: requestId+attempt-dependent round reads ──────────────────────
  const { data: roundData, refetch: refetchRound } = useReadContracts({
    contracts: hasRequest
      ? ([
          {
            address:      CONTRACT_ADDRESSES.daioRoundLedger,
            abi:          ROUND_LEDGER_ABI,
            functionName: 'getRoundAggregate' as const,
            args:         [latestRequestId, requestAttempt, ROUND_REVIEW] as const,
          },
          {
            address:      CONTRACT_ADDRESSES.daioRoundLedger,
            abi:          ROUND_LEDGER_ABI,
            functionName: 'getRoundAggregate' as const,
            args:         [latestRequestId, requestAttempt, ROUND_AUDIT_CONSENSUS] as const,
          },
          {
            address:      CONTRACT_ADDRESSES.daioRoundLedger,
            abi:          ROUND_LEDGER_ABI,
            functionName: 'getRoundAggregate' as const,
            args:         [latestRequestId, requestAttempt, ROUND_REPUTATION_FINAL] as const,
          },
          {
            address:      CONTRACT_ADDRESSES.daioCommitReveal,
            abi:          COMMIT_REVEAL_ABI,
            functionName: 'getAuditParticipants' as const,
            args:         [latestRequestId, requestAttempt] as const,
          },
        ] as const)
      : [],
    query: {
      enabled:                     hasRequest,
      refetchInterval:             CHAIN_REFETCH_INTERVAL_MS,
      staleTime:                   0,
      refetchIntervalInBackground: false,
    },
  });

  // getRoundAggregate → [score, totalWeight, confidence, coverage, lowConfidence, closed, aborted]
  const reviewRoundAggregate = (hasRequest ? roundData?.[0]?.result : undefined) as
    | readonly [bigint, bigint, bigint, bigint, boolean, boolean, boolean]
    | undefined;
  const auditRoundAggregate = (hasRequest ? roundData?.[1]?.result : undefined) as
    | readonly [bigint, bigint, bigint, bigint, boolean, boolean, boolean]
    | undefined;
  const reputationRoundAggregate = (hasRequest ? roundData?.[2]?.result : undefined) as
    | readonly [bigint, bigint, bigint, bigint, boolean, boolean, boolean]
    | undefined;

  const roundAggregates = {
    review: parseRoundAggregate(reviewRoundAggregate),
    auditConsensus: parseRoundAggregate(auditRoundAggregate),
    reputationFinal: parseRoundAggregate(reputationRoundAggregate),
  };
  const latestRound = latestClosedRound(roundAggregates);
  const roundTotalScore = latestRound.aggregate.score;
  const roundReviewerCount = latestRound.aggregate.totalWeight;
  const roundNumber = latestRound.round;

  const auditParticipants = useMemo(
    () => addressArray(hasRequest ? roundData?.[3]?.result : undefined),
    [hasRequest, roundData],
  );

  const auditTargetContracts = useMemo(() => {
    if (!hasRequest || auditParticipants.length === 0) return [];

    return auditParticipants.map((auditor) => ({
      address:      CONTRACT_ADDRESSES.daioInfoReader,
      abi:          DAIO_INFO_READER_ABI,
      functionName: 'auditTargets' as const,
      args:         [latestRequestId, auditor] as const,
    }));
  }, [auditParticipants, hasRequest, latestRequestId]);

  const { data: auditTargetData, refetch: refetchAuditTargets } = useReadContracts({
    contracts: auditTargetContracts,
    query: {
      enabled:                     hasRequest && auditTargetContracts.length > 0,
      refetchInterval:             CHAIN_REFETCH_INTERVAL_MS,
      staleTime:                   0,
      refetchIntervalInBackground: false,
    },
  });

  const auditReportCount = useMemo(
    () => auditParticipants.reduce((count, _, index) => {
      const targets = auditTargetData?.[index]?.result;
      const submittedTargets = addressArray(tupleField<unknown>(targets, 0, 'submittedTargets', []));
      return count + submittedTargets.length;
    }, 0),
    [auditParticipants, auditTargetData],
  );

  const reviewerAddresses = useMemo(
    () => uniqueAddresses([reviewParticipants, auditParticipants]),
    [auditParticipants, reviewParticipants],
  );

  const reviewerScoreContracts = useMemo(() => {
    if (!hasRequest || reviewerAddresses.length === 0) return [];

    return reviewerAddresses.flatMap((reviewer) => ([
      {
        address:      CONTRACT_ADDRESSES.daioRoundLedger,
        abi:          ROUND_LEDGER_ABI,
        functionName: 'getReviewerRoundScore' as const,
        args:         [latestRequestId, requestAttempt, ROUND_REVIEW, reviewer] as const,
      },
      {
        address:      CONTRACT_ADDRESSES.daioRoundLedger,
        abi:          ROUND_LEDGER_ABI,
        functionName: 'getReviewerRoundScore' as const,
        args:         [latestRequestId, requestAttempt, ROUND_AUDIT_CONSENSUS, reviewer] as const,
      },
      {
        address:      CONTRACT_ADDRESSES.daioRoundLedger,
        abi:          ROUND_LEDGER_ABI,
        functionName: 'getReviewerRoundScore' as const,
        args:         [latestRequestId, requestAttempt, ROUND_REPUTATION_FINAL, reviewer] as const,
      },
      {
        address:      CONTRACT_ADDRESSES.daioRoundLedger,
        abi:          ROUND_LEDGER_ABI,
        functionName: 'getReviewerRoundAccounting' as const,
        args:         [latestRequestId, requestAttempt, ROUND_REPUTATION_FINAL, reviewer] as const,
      },
    ]));
  }, [hasRequest, latestRequestId, requestAttempt, reviewerAddresses]);

  const { data: reviewerScoreData, refetch: refetchReviewerScores } = useReadContracts({
    contracts: reviewerScoreContracts,
    query: {
      enabled:                     hasRequest && reviewerScoreContracts.length > 0,
      refetchInterval:             CHAIN_REFETCH_INTERVAL_MS,
      staleTime:                   0,
      refetchIntervalInBackground: false,
    },
  });

  const profileAddresses = useMemo(
    () => uniqueAddresses([registeredReviewers, reviewerAddresses]),
    [registeredReviewers, reviewerAddresses],
  );

  const reviewerProfileContracts = useMemo(() => {
    if (profileAddresses.length === 0) return [];

    return profileAddresses.flatMap((reviewer) => ([
      {
        address:      CONTRACT_ADDRESSES.reviewerRegistry,
        abi:          REVIEWER_REGISTRY_ABI,
        functionName: 'getReviewer' as const,
        args:         [reviewer] as const,
      },
      {
        address:      CONTRACT_ADDRESSES.reviewerRegistry,
        abi:          REVIEWER_REGISTRY_ABI,
        functionName: 'availableStake' as const,
        args:         [reviewer] as const,
      },
      {
        address:      CONTRACT_ADDRESSES.reviewerRegistry,
        abi:          REVIEWER_REGISTRY_ABI,
        functionName: 'lockedStake' as const,
        args:         [reviewer] as const,
      },
      {
        address:      CONTRACT_ADDRESSES.reputationLedger,
        abi:          REPUTATION_LEDGER_ABI,
        functionName: 'reputations' as const,
        args:         [reviewer] as const,
      },
    ]));
  }, [profileAddresses]);

  const { data: reviewerProfileData, refetch: refetchReviewerProfiles } = useReadContracts({
    contracts: reviewerProfileContracts,
    query: {
      enabled:                     reviewerProfileContracts.length > 0,
      refetchInterval:             CHAIN_REFETCH_INTERVAL_MS,
      staleTime:                   0,
      refetchIntervalInBackground: false,
    },
  });

  const baseReviewerProfiles = useMemo(
    () => profileAddresses.map((address, index): DaioReviewerProfile | null => {
      const baseIndex = index * 4;
      const profile = reviewerProfileData?.[baseIndex]?.result;
      if (!profile) return null;

      const availableStake = (reviewerProfileData?.[baseIndex + 1]?.result ?? 0n) as bigint;
      const lockedStake = (reviewerProfileData?.[baseIndex + 2]?.result ?? 0n) as bigint;
      const reputation = reviewerProfileData?.[baseIndex + 3]?.result as
        | readonly [bigint, bigint, bigint, bigint, bigint]
        | undefined;
      const ensName = tupleField<string>(profile, 11, 'ensName', '').trim();

      return {
        address,
        ensNode: tupleField<`0x${string}`>(profile, 10, 'ensNode', ZERO_BYTES32),
        ensName: ensName || undefined,
        registered: tupleField(profile, 0, 'registered', false),
        active: tupleField(profile, 1, 'active', false),
        suspended: tupleField(profile, 2, 'suspended', false),
        agentId: tupleField(profile, 3, 'agentId', 0n),
        stake: tupleField(profile, 4, 'stake', 0n),
        availableStake,
        lockedStake,
        domainMask: tupleField(profile, 5, 'domainMask', 0n),
        completedRequests: tupleField(profile, 6, 'completedRequests', 0n),
        semanticStrikes: tupleField(profile, 7, 'semanticStrikes', 0n),
        protocolFaults: tupleField(profile, 8, 'protocolFaults', 0n),
        cooldownUntilBlock: tupleField(profile, 9, 'cooldownUntilBlock', 0n),
        reputation: reputation
          ? {
              samples: reputation[0],
              reportQuality: reputation[1],
              auditReliability: reputation[2],
              finalContribution: reputation[3],
              protocolCompliance: reputation[4],
            }
          : EMPTY_REVIEWER_REPUTATION,
      };
    }).filter((profile): profile is DaioReviewerProfile => Boolean(profile)),
    [profileAddresses, reviewerProfileData],
  );

  const erc8004AgentProfiles = useMemo(
    () => baseReviewerProfiles.filter((profile) => profile.agentId !== 0n),
    [baseReviewerProfiles],
  );

  const erc8004AgentWalletContracts = useMemo(() => (
    erc8004AgentProfiles.map((profile) => ({
      address:      CONTRACT_ADDRESSES.erc8004Adapter,
      abi:          ERC8004_ADAPTER_ABI,
      functionName: 'agentWallet' as const,
      args:         [profile.agentId] as const,
    }))
  ), [erc8004AgentProfiles]);

  const { data: erc8004AgentWalletData, refetch: refetchErc8004AgentWallets } = useReadContracts({
    contracts: erc8004AgentWalletContracts,
    query: {
      enabled:                     erc8004AgentWalletContracts.length > 0,
      refetchInterval:             CHAIN_REFETCH_INTERVAL_MS,
      staleTime:                   0,
      refetchIntervalInBackground: false,
    },
  });

  const reviewerProfiles = useMemo<DaioReviewerProfile[]>(() => {
    const walletByAddress = new Map<string, `0x${string}`>();
    erc8004AgentProfiles.forEach((profile, index) => {
      const wallet = erc8004AgentWalletData?.[index]?.result as `0x${string}` | undefined;
      if (wallet && wallet !== '0x0000000000000000000000000000000000000000') {
        walletByAddress.set(profile.address.toLowerCase(), wallet);
      }
    });

    return baseReviewerProfiles.map((profile) => {
      const erc8004AgentWallet = walletByAddress.get(profile.address.toLowerCase());
      return erc8004AgentWallet ? { ...profile, erc8004AgentWallet } : profile;
    });
  }, [baseReviewerProfiles, erc8004AgentProfiles, erc8004AgentWalletData]);

  const registeredReviewerProfiles = useMemo(() => {
    const profileByAddress = new Map(reviewerProfiles.map((profile) => [profile.address.toLowerCase(), profile]));
    return registeredReviewers
      .map((address) => profileByAddress.get(address.toLowerCase()))
      .filter((profile): profile is DaioReviewerProfile => Boolean(profile));
  }, [registeredReviewers, reviewerProfiles]);

  const reviewerRoundSnapshots = useMemo(
    () => reviewerAddresses.map((address, index): DaioReviewerRoundSnapshot => {
      const baseIndex = index * 4;
      const profile = reviewerProfiles.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase());
      const reviewScore = (reviewerScoreData?.[baseIndex]?.result ?? undefined) as
        | readonly [bigint, bigint, bigint, bigint, bigint, boolean]
        | undefined;
      const auditScore = (reviewerScoreData?.[baseIndex + 1]?.result ?? undefined) as
        | readonly [bigint, bigint, bigint, bigint, bigint, boolean]
        | undefined;
      const finalScore = (reviewerScoreData?.[baseIndex + 2]?.result ?? undefined) as
        | readonly [bigint, bigint, bigint, bigint, bigint, boolean]
        | undefined;
      const finalAccounting = (reviewerScoreData?.[baseIndex + 3]?.result ?? undefined) as
        | readonly [bigint, bigint, bigint, `0x${string}`, boolean, boolean]
        | undefined;

      return {
        address,
        review: parseReviewerRoundScore(reviewScore),
        auditConsensus: parseReviewerRoundScore(auditScore),
        reputationFinal: parseReviewerRoundScore(finalScore),
        finalAccounting: parseReviewerRoundAccounting(finalAccounting),
        profile,
      };
    }),
    [reviewerAddresses, reviewerProfiles, reviewerScoreData],
  );

  // ── Compute pool rate ─────────────────────────────────────────────────────
  const poolRateUsdaioPerEth = poolSqrtPriceX96
    ? sqrtPriceX96ToUsdaioPerEth(poolSqrtPriceX96)
    : 0;

  const effectiveUsdaioPerEth =
    poolRateUsdaioPerEth > 0
      ? poolRateUsdaioPerEth * (1 - POOL_FEE_FRACTION)
      : FALLBACK_USDAIO_PER_ETH;

  const refresh = useCallback(() => {
    console.debug('[DAIO][chain] refresh requested', {
      latestRequestId: latestRequestId.toString(),
      requestAttempt: requestAttempt.toString(),
    });
    refetch();
    if (hasRequest) refetchRequest();
    if (hasRequest) refetchRound();
    if (hasRequest && auditTargetContracts.length > 0) refetchAuditTargets();
    if (hasRequest && reviewerScoreContracts.length > 0) refetchReviewerScores();
    if (reviewerProfileContracts.length > 0) refetchReviewerProfiles();
    if (erc8004AgentWalletContracts.length > 0) refetchErc8004AgentWallets();
  }, [
    refetch,
    refetchRequest,
    refetchRound,
    refetchAuditTargets,
    refetchReviewerScores,
    refetchReviewerProfiles,
    refetchErc8004AgentWallets,
    hasRequest,
    latestRequestId,
    requestAttempt,
    auditTargetContracts.length,
    reviewerScoreContracts.length,
    reviewerProfileContracts.length,
    erc8004AgentWalletContracts.length,
  ]);

  useEffect(() => {
    const lifecycleKey = requestLifecycle
      ? [
          requestLifecycle.requester,
          requestLifecycle.status,
          requestLifecycle.feePaid,
          requestLifecycle.priorityFee,
          requestLifecycle.rewardPool,
          requestLifecycle.protocolFee,
          requestLifecycle.retryCount,
          requestLifecycle.committeeEpoch,
          requestLifecycle.auditEpoch,
          requestLifecycle.reviewCommitCount,
          requestLifecycle.reviewRevealCount,
          requestLifecycle.auditCommitCount,
          requestLifecycle.auditRevealCount,
          requestLifecycle.auditCoverage,
          requestLifecycle.activePriority,
          requestLifecycle.lowConfidence,
        ].map(String).join(':')
      : 'none';
    const logKey = [
      walletAddress ?? 'no-wallet',
      latestRequestId,
      latestRequestStatus,
      latestRequestProcessing,
      latestRequestCompleted,
      registeredReviewers.join(','),
      lifecycleKey,
    ].map(String).join('|');

    if (lastLatestRequestLogKeyRef.current === logKey) return;
    lastLatestRequestLogKeyRef.current = logKey;

    console.debug('[DAIO][chain] latestRequestState', {
      walletAddress,
      requestId: latestRequestId.toString(),
      status: latestRequestStatus,
      statusName: latestRequestStatusName,
      processing: latestRequestProcessing,
      completed: latestRequestCompleted,
      registeredReviewers,
      lifecycle: requestLifecycle
        ? {
            requester: requestLifecycle.requester,
            statusName: requestLifecycle.statusName,
            feePaid: requestLifecycle.feePaid.toString(),
            priorityFee: requestLifecycle.priorityFee.toString(),
            rewardPool: requestLifecycle.rewardPool.toString(),
            protocolFee: requestLifecycle.protocolFee.toString(),
            retryCount: requestLifecycle.retryCount.toString(),
            committeeEpoch: requestLifecycle.committeeEpoch.toString(),
            auditEpoch: requestLifecycle.auditEpoch.toString(),
            reviewCommitCount: requestLifecycle.reviewCommitCount.toString(),
            reviewRevealCount: requestLifecycle.reviewRevealCount.toString(),
            auditCommitCount: requestLifecycle.auditCommitCount.toString(),
            auditRevealCount: requestLifecycle.auditRevealCount.toString(),
            auditCoverage: requestLifecycle.auditCoverage.toString(),
            activePriority: requestLifecycle.activePriority.toString(),
            lowConfidence: requestLifecycle.lowConfidence,
          }
        : null,
      phase: requestPhase
        ? {
            status: requestPhase.status,
            count: requestPhase.count.toString(),
            quorum: requestPhase.quorum.toString(),
            deadline: requestPhase.deadline.toString(),
            timedOut: requestPhase.timedOut,
          }
        : null,
      requestConfig: requestConfig
        ? {
            reviewCommitQuorum: requestConfig.reviewCommitQuorum.toString(),
            reviewRevealQuorum: requestConfig.reviewRevealQuorum.toString(),
            auditCommitQuorum: requestConfig.auditCommitQuorum.toString(),
            auditRevealQuorum: requestConfig.auditRevealQuorum.toString(),
            auditTargetLimit: requestConfig.auditTargetLimit.toString(),
          }
        : null,
    });
  }, [
    walletAddress,
    latestRequestId,
    latestRequestStatus,
    latestRequestStatusName,
    latestRequestProcessing,
    latestRequestCompleted,
    registeredReviewers,
    requestLifecycle,
    requestPhase,
    requestConfig,
  ]);

  useEffect(() => {
    if (!hasRequest) return;
    const logKey = [
      latestRequestId,
      requestAttempt,
      roundAggregates.review.score,
      roundAggregates.review.totalWeight,
      roundAggregates.review.confidence,
      roundAggregates.review.coverage,
      roundAggregates.review.closed,
      roundAggregates.review.aborted,
      roundAggregates.auditConsensus.score,
      roundAggregates.auditConsensus.totalWeight,
      roundAggregates.auditConsensus.confidence,
      roundAggregates.auditConsensus.coverage,
      roundAggregates.auditConsensus.closed,
      roundAggregates.auditConsensus.aborted,
      roundAggregates.reputationFinal.score,
      roundAggregates.reputationFinal.totalWeight,
      roundAggregates.reputationFinal.confidence,
      roundAggregates.reputationFinal.coverage,
      roundAggregates.reputationFinal.closed,
      roundAggregates.reputationFinal.aborted,
      reviewCommitters.join(','),
      revealedReviewers.join(','),
      reviewParticipants.join(','),
      auditParticipants.join(','),
      auditReportCount,
      reviewerRoundSnapshots.map((snapshot) => [
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
      ].map(String).join(':')).join('|'),
    ].map(String).join('|');

    if (lastRoundSnapshotLogKeyRef.current === logKey) return;
    lastRoundSnapshotLogKeyRef.current = logKey;

    console.debug('[DAIO][chain] round snapshot', {
      requestId: latestRequestId.toString(),
      attempt: requestAttempt.toString(),
      aggregates: {
        review: {
          score: roundAggregates.review.score.toString(),
          totalWeight: roundAggregates.review.totalWeight.toString(),
          confidence: roundAggregates.review.confidence.toString(),
          coverage: roundAggregates.review.coverage.toString(),
          closed: roundAggregates.review.closed,
        },
        auditConsensus: {
          score: roundAggregates.auditConsensus.score.toString(),
          totalWeight: roundAggregates.auditConsensus.totalWeight.toString(),
          confidence: roundAggregates.auditConsensus.confidence.toString(),
          coverage: roundAggregates.auditConsensus.coverage.toString(),
          closed: roundAggregates.auditConsensus.closed,
        },
        reputationFinal: {
          score: roundAggregates.reputationFinal.score.toString(),
          totalWeight: roundAggregates.reputationFinal.totalWeight.toString(),
          confidence: roundAggregates.reputationFinal.confidence.toString(),
          coverage: roundAggregates.reputationFinal.coverage.toString(),
          closed: roundAggregates.reputationFinal.closed,
        },
      },
      reviewCommitters,
      revealedReviewers,
      reviewParticipants,
      auditParticipants,
      auditReportCount,
      reviewerRoundSnapshots: reviewerRoundSnapshots.map((snapshot) => ({
        address: snapshot.address,
        review: {
          available: snapshot.review.available,
          score: snapshot.review.score.toString(),
          weight: snapshot.review.weight.toString(),
        },
        auditConsensus: {
          available: snapshot.auditConsensus.available,
          score: snapshot.auditConsensus.score.toString(),
          weight: snapshot.auditConsensus.weight.toString(),
          auditScore: snapshot.auditConsensus.auditScore.toString(),
        },
        reputationFinal: {
          available: snapshot.reputationFinal.available,
          score: snapshot.reputationFinal.score.toString(),
          weight: snapshot.reputationFinal.weight.toString(),
          reputationScore: snapshot.reputationFinal.reputationScore.toString(),
        },
        finalAccounting: {
          reward: snapshot.finalAccounting.reward.toString(),
          slashed: snapshot.finalAccounting.slashed.toString(),
          slashCount: snapshot.finalAccounting.slashCount.toString(),
          protocolFault: snapshot.finalAccounting.protocolFault,
          semanticFault: snapshot.finalAccounting.semanticFault,
        },
        profile: snapshot.profile
          ? {
              agentId: snapshot.profile.agentId.toString(),
              ensName: snapshot.profile.ensName,
              registered: snapshot.profile.registered,
              active: snapshot.profile.active,
              suspended: snapshot.profile.suspended,
            }
          : undefined,
      })),
    });
  }, [
    hasRequest,
    latestRequestId,
    requestAttempt,
    roundAggregates.review.score,
    roundAggregates.review.totalWeight,
    roundAggregates.review.confidence,
    roundAggregates.review.coverage,
    roundAggregates.review.closed,
    roundAggregates.auditConsensus.score,
    roundAggregates.auditConsensus.totalWeight,
    roundAggregates.auditConsensus.confidence,
    roundAggregates.auditConsensus.coverage,
    roundAggregates.auditConsensus.closed,
    roundAggregates.reputationFinal.score,
    roundAggregates.reputationFinal.totalWeight,
    roundAggregates.reputationFinal.confidence,
    roundAggregates.reputationFinal.coverage,
    roundAggregates.reputationFinal.closed,
    reviewCommitters,
    revealedReviewers,
    reviewParticipants,
    auditParticipants,
    auditReportCount,
    reviewerRoundSnapshots,
  ]);

  return {
    baseRequestFee,
    baseRequestFeeFormatted: baseRequestFee
      ? formatUnits(baseRequestFee, usdaioDecimals)
      : 0,

    usdaioBalance,
    usdaioBalanceFormatted: usdaioBalance
      ? formatUnits(usdaioBalance, usdaioDecimals)
      : 0,
    usdaioAllowance,
    usdaioDecimals,

    poolSqrtPriceX96,
    poolRateUsdaioPerEth,
    poolFeePct: POOL_FEE_FRACTION * 100,
    effectiveUsdaioPerEth,

    latestRequestId,
    latestRequestStatus,
    latestRequestStatusName,
    latestRequestProcessing,
    latestRequestCompleted,
    requestLifecycle,
    requestPhase,
    requestConfig,

    roundTotalScore,
    roundReviewerCount,
    roundNumber,
    requestAttempt,
    roundAggregates,
    reviewParticipants,
    reviewCommitters,
    revealedReviewers,
    auditParticipants,
    auditReportCount,
    registeredReviewers,
    reviewerRoundSnapshots,
    reviewerProfiles,
    registeredReviewerProfiles,

    paymentRouterAddress: CONTRACT_ADDRESSES.paymentRouter,
    usdaioAddress:        CONTRACT_ADDRESSES.usdaio,

    isLoading,
    refresh,
  };
}
