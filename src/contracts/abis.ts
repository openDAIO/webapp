/**
 * Minimal ABI fragments for Sepolia DAIO contracts.
 * Only the functions actually called from the webapp are included.
 * Add more entries here as new contract interactions are introduced.
 */

// ─── USDAIO (ERC-20) ──────────────────────────────────────────────────────────
export const USDAIO_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ─── DAIOCore ─────────────────────────────────────────────────────────────────
export const DAIO_CORE_ABI = [
  {
    name: 'baseRequestFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'maxActiveRequests',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getRequestLifecycle',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      { name: 'requester',       type: 'address' },
      { name: 'status',          type: 'uint8'   },
      { name: 'feePaid',         type: 'uint256' },
      { name: 'priorityFee',     type: 'uint256' },
      { name: 'retryCount',      type: 'uint256' },
      { name: 'committeeEpoch',  type: 'uint256' },
      { name: 'auditEpoch',      type: 'uint256' },
      { name: 'activePriority',  type: 'uint256' },
      { name: 'lowConfidence',   type: 'bool'    },
    ],
  },
] as const;

// ─── DAIOInfoReader ───────────────────────────────────────────────────────────
export const DAIO_INFO_READER_ABI = [
  {
    name: 'requestInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'requester',          type: 'address' },
          { name: 'proposalHash',       type: 'bytes32' },
          { name: 'rubricHash',         type: 'bytes32' },
          { name: 'domainMask',         type: 'uint256' },
          { name: 'tier',               type: 'uint8' },
          { name: 'status',             type: 'uint8' },
          { name: 'feePaid',            type: 'uint256' },
          { name: 'priorityFee',        type: 'uint256' },
          { name: 'rewardPool',         type: 'uint256' },
          { name: 'protocolFee',        type: 'uint256' },
          { name: 'createdAt',          type: 'uint256' },
          { name: 'phaseStartedAt',     type: 'uint256' },
          { name: 'phaseStartedBlock',  type: 'uint256' },
          { name: 'activePriority',     type: 'uint256' },
          { name: 'retryCount',         type: 'uint256' },
          { name: 'committeeEpoch',     type: 'uint256' },
          { name: 'auditEpoch',         type: 'uint256' },
          { name: 'reviewCommitCount',  type: 'uint256' },
          { name: 'reviewRevealCount',  type: 'uint256' },
          { name: 'auditCommitCount',   type: 'uint256' },
          { name: 'auditRevealCount',   type: 'uint256' },
          { name: 'finalProposalScore', type: 'uint256' },
          { name: 'confidence',         type: 'uint256' },
          { name: 'auditCoverage',      type: 'uint256' },
          { name: 'scoreDispersion',    type: 'uint256' },
          { name: 'finalReliability',   type: 'uint256' },
          { name: 'lowConfidence',      type: 'bool' },
          { name: 'faultCount',         type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'requestPhase',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: 'phase',
        type: 'tuple',
        components: [
          { name: 'status',         type: 'uint8' },
          { name: 'processing',     type: 'bool' },
          { name: 'completed',      type: 'bool' },
          { name: 'count',          type: 'uint256' },
          { name: 'quorum',         type: 'uint256' },
          { name: 'phaseStartedAt', type: 'uint256' },
          { name: 'timeout',        type: 'uint256' },
          { name: 'deadline',       type: 'uint256' },
          { name: 'timedOut',       type: 'bool' },
          { name: 'retryCount',     type: 'uint256' },
          { name: 'maxRetries',     type: 'uint256' },
          { name: 'lowConfidence',  type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'requestConfig',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        name: 'config',
        type: 'tuple',
        components: [
          { name: 'reviewElectionDifficulty', type: 'uint16' },
          { name: 'auditElectionDifficulty',  type: 'uint16' },
          { name: 'reviewCommitQuorum',       type: 'uint16' },
          { name: 'reviewRevealQuorum',       type: 'uint16' },
          { name: 'auditCommitQuorum',        type: 'uint16' },
          { name: 'auditRevealQuorum',        type: 'uint16' },
          { name: 'auditTargetLimit',         type: 'uint16' },
          { name: 'minIncomingAudit',         type: 'uint16' },
          { name: 'auditCoverageQuorum',      type: 'uint16' },
          { name: 'contributionThreshold',    type: 'uint16' },
          { name: 'reviewEpochSize',          type: 'uint16' },
          { name: 'auditEpochSize',           type: 'uint16' },
          { name: 'finalityFactor',           type: 'uint16' },
          { name: 'maxRetries',               type: 'uint16' },
          { name: 'minorityThreshold',        type: 'uint16' },
          { name: 'semanticStrikeThreshold',  type: 'uint16' },
          { name: 'protocolFaultSlashBps',    type: 'uint16' },
          { name: 'missedRevealSlashBps',     type: 'uint16' },
          { name: 'semanticSlashBps',         type: 'uint16' },
          { name: 'cooldownBlocks',           type: 'uint32' },
          { name: 'reviewCommitTimeout',      type: 'uint32' },
          { name: 'reviewRevealTimeout',      type: 'uint32' },
          { name: 'auditCommitTimeout',       type: 'uint32' },
          { name: 'auditRevealTimeout',       type: 'uint32' },
        ],
      },
    ],
  },
  {
    name: 'requestParticipants',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      { name: 'reviewCommitters', type: 'address[]' },
      { name: 'revealedReviewers', type: 'address[]' },
    ],
  },
  {
    name: 'auditTargets',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'auditor',   type: 'address' },
    ],
    outputs: [
      { name: 'submittedTargets', type: 'address[]' },
      { name: 'canonicalTargets', type: 'address[]' },
    ],
  },
] as const;

// ─── PaymentRouter ────────────────────────────────────────────────────────────
export const PAYMENT_ROUTER_ABI = [
  {
    name: 'latestRequestByRequester',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requester', type: 'address' }],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    name: 'latestRequestState',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requester', type: 'address' }],
    outputs: [
      { name: 'requestId',  type: 'uint256' },
      { name: 'status',     type: 'uint8'   },
      { name: 'processing', type: 'bool'    },
      { name: 'completed',  type: 'bool'    },
    ],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'requester', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'createRequestWithUSDAIO',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalURI',  type: 'string'  },
      { name: 'proposalHash', type: 'bytes32' },
      { name: 'rubricHash',   type: 'bytes32' },
      { name: 'domainMask',   type: 'uint256' },
      { name: 'tier',         type: 'uint8'   },
      { name: 'priorityFee',  type: 'uint256' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    name: 'createRequestWithETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'routerCalldata', type: 'bytes'   },
      { name: 'proposalURI',    type: 'string'  },
      { name: 'proposalHash',   type: 'bytes32' },
      { name: 'rubricHash',     type: 'bytes32' },
      { name: 'domainMask',     type: 'uint256' },
      { name: 'tier',           type: 'uint8'   },
      { name: 'priorityFee',    type: 'uint256' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    name: 'RequestPaid',
    type: 'event',
    inputs: [
      { name: 'requester',    type: 'address', indexed: true  },
      { name: 'requestId',    type: 'uint256', indexed: true  },
      { name: 'paymentToken', type: 'address', indexed: true  },
      { name: 'amountPaid',   type: 'uint256', indexed: false },
    ],
  },
] as const;

// ─── DAIORoundLedger ──────────────────────────────────────────────────────────
export const ROUND_LEDGER_ABI = [
  {
    name: 'getRoundAggregate',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'attempt',   type: 'uint256' },
      { name: 'round',     type: 'uint8'   },
    ],
    outputs: [
      { name: 'score',         type: 'uint256' },
      { name: 'totalWeight',   type: 'uint256' },
      { name: 'confidence',    type: 'uint256' },
      { name: 'coverage',      type: 'uint256' },
      { name: 'lowConfidence', type: 'bool'    },
      { name: 'closed',        type: 'bool'    },
      { name: 'aborted',       type: 'bool'    },
    ],
  },
  {
    name: 'getReviewerRoundScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'attempt',   type: 'uint256' },
      { name: 'round',     type: 'uint8'   },
      { name: 'reviewer',  type: 'address' },
    ],
    outputs: [
      { name: 'score',           type: 'uint256' },
      { name: 'weight',          type: 'uint256' },
      { name: 'weightedScore',   type: 'uint256' },
      { name: 'auditScore',      type: 'uint256' },
      { name: 'reputationScore', type: 'uint256' },
      { name: 'available',       type: 'bool'    },
    ],
  },
  {
    name: 'getReviewerRoundAccounting',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'attempt',   type: 'uint256' },
      { name: 'round',     type: 'uint8'   },
      { name: 'reviewer',  type: 'address' },
    ],
    outputs: [
      { name: 'reward',              type: 'uint256' },
      { name: 'slashed',             type: 'uint256' },
      { name: 'slashCount',          type: 'uint256' },
      { name: 'lastSlashReasonHash', type: 'bytes32' },
      { name: 'protocolFault',       type: 'bool'    },
      { name: 'semanticFault',       type: 'bool'    },
    ],
  },
] as const;

// ─── DAIOCommitRevealManager ──────────────────────────────────────────────────
export const COMMIT_REVEAL_ABI = [
  {
    name: 'getReviewParticipants',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'attempt',   type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'getAuditParticipants',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'attempt',   type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const;

// ─── ReviewerRegistry ────────────────────────────────────────────────────────
export const REVIEWER_REGISTRY_ABI = [
  {
    name: 'getReviewers',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    name: 'reviewerCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'reviewerAt',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getReviewer',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reviewerAddress', type: 'address' }],
    outputs: [
      { name: 'registered',         type: 'bool'    },
      { name: 'active',             type: 'bool'    },
      { name: 'suspended',          type: 'bool'    },
      { name: 'agentId',            type: 'uint256' },
      { name: 'stake',              type: 'uint256' },
      { name: 'domainMask',         type: 'uint256' },
      { name: 'completedRequests',  type: 'uint256' },
      { name: 'semanticStrikes',    type: 'uint256' },
      { name: 'protocolFaults',     type: 'uint256' },
      { name: 'cooldownUntilBlock', type: 'uint256' },
      { name: 'ensNode',            type: 'bytes32' },
      { name: 'ensName',            type: 'string'  },
    ],
  },
  {
    name: 'availableStake',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reviewerAddress', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'lockedStake',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reviewer', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── ReputationLedger ─────────────────────────────────────────────────────────
export const REPUTATION_LEDGER_ABI = [
  {
    name: 'reputations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'reviewer', type: 'address' }],
    outputs: [
      { name: 'samples',            type: 'uint256' },
      { name: 'reportQuality',      type: 'uint256' },
      { name: 'auditReliability',   type: 'uint256' },
      { name: 'finalContribution',  type: 'uint256' },
      { name: 'protocolCompliance', type: 'uint256' },
    ],
  },
] as const;

// ─── ERC-8004 Adapter ─────────────────────────────────────────────────────────
export const ERC8004_ADAPTER_ABI = [
  {
    name: 'identityRegistry',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'reputationRegistry',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'agentWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ─── Uniswap V4 StateView ─────────────────────────────────────────────────────
// PoolManager owns state, but off-chain/frontends read pool state through StateView.
// PoolId is bytes32 (the poolKeyHash from addresses.json).
export const UNISWAP_V4_STATE_VIEW_ABI = [
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick',         type: 'int24'   },
      { name: 'protocolFee',  type: 'uint24'  },
      { name: 'lpFee',        type: 'uint24'  },
    ],
  },
] as const;
