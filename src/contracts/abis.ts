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

// ─── Uniswap V4 PoolManager ───────────────────────────────────────────────────
// getSlot0 returns the current pool price as sqrtPriceX96.
// PoolId is bytes32 (the poolKeyHash from addresses.json).
export const UNISWAP_V4_POOL_MANAGER_ABI = [
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
