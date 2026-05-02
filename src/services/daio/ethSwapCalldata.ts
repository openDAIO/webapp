/**
 * Builds the Universal Router calldata for an ETH → USDAIO exact-output V4 swap.
 *
 * Architecture:
 *   PaymentRouter.createRequestWithETH(routerCalldata, ...)
 *     → UniswapV4SwapAdapter.swapExactOutputETH{value}(routerCalldata, ...)
 *       → universalRouter.call{value}(routerCalldata)
 *
 * Universal Router command layout:
 *   [0x10] V4_SWAP  — runs the V4 exact-output single-hop swap
 *   [0x04] SWEEP    — returns unused ETH to the SwapAdapter (msg.sender of execute())
 *
 * V4 router actions inside V4_SWAP:
 *   [0x08] SWAP_EXACT_OUT_SINGLE — ETH (currency0) → USDAIO (currency1)
 *   [0x0c] SETTLE_ALL            — pays the pool's ETH claim from the UR's balance (msg.value)
 *   [0x0e] TAKE                  — sends USDAIO to PaymentRouter (explicit recipient)
 *
 * References (v4-periphery@1.0.3, universal-router@2.1.0):
 *   Actions.sol    — SWAP_EXACT_OUT_SINGLE=0x08, SETTLE_ALL=0x0c, TAKE=0x0e
 *   Commands.sol   — V4_SWAP=0x10, SWEEP=0x04
 *   ActionConstants— OPEN_DELTA=0, MSG_SENDER=address(1)
 */

import {
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  keccak256,
} from 'viem';
import addresses from '../../contracts/addresses.json';

const sepolia = addresses.sepolia;

export const CONTRACT_ADDRESS = {
  paymentRouter:     sepolia.paymentRouter     as `0x${string}`,
  usdaio:            sepolia.usdaio            as `0x${string}`,
  daioCore:          sepolia.daioCore          as `0x${string}`,
  uniswapV4PoolManager: sepolia.uniswapV4PoolManager as `0x${string}`,
  universalRouter:   sepolia.uniswapUniversalRouter as `0x${string}`,
  swapAdapter:       sepolia.uniswapV4SwapAdapter as `0x${string}`,
  hook:              sepolia.pool.hook         as `0x${string}`,
} as const;

const POOL = {
  currency0:   '0x0000000000000000000000000000000000000000' as `0x${string}`, // native ETH
  currency1:   CONTRACT_ADDRESS.usdaio,
  fee:         sepolia.pool.fee,
  tickSpacing: sepolia.pool.tickSpacing,
  hooks:       CONTRACT_ADDRESS.hook,
} as const;

// ─── action + command bytes ────────────────────────────────────────────────────
const SWAP_EXACT_OUT_SINGLE = 0x08;
const SETTLE_ALL            = 0x0c;
const TAKE                  = 0x0e;

const CMD_V4_SWAP = 0x10;
const CMD_SWEEP   = 0x04;

/** ActionConstants.MSG_SENDER — UR maps this to the execute() caller (swapAdapter). */
const MSG_SENDER = '0x0000000000000000000000000000000000000001' as `0x${string}`;

/** ActionConstants.OPEN_DELTA — signals "take all available credit". */
const OPEN_DELTA = 0n;

// ─── Universal Router ABI (execute with deadline) ─────────────────────────────
const UNIVERSAL_ROUTER_ABI = [
  {
    name: 'execute',
    type: 'function' as const,
    stateMutability: 'payable' as const,
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs',   type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

// ─── ExactOutputSingleParams encoding (IV4Router v1.0.3) ──────────────────────
// Struct definition (src/interfaces/IV4Router.sol):
//   struct ExactOutputSingleParams {
//     PoolKey poolKey;
//     bool    zeroForOne;
//     uint128 amountOut;
//     uint128 amountInMaximum;
//     bytes   hookData;
//   }
// NOTE: There is NO sqrtPriceLimitX96 or minHopPriceX36 field in this version.
const EXACT_OUTPUT_SINGLE_PARAMS_ABI = [
  {
    type: 'tuple',
    components: [
      {
        name: 'poolKey',
        type: 'tuple',
        components: [
          { name: 'currency0',   type: 'address' },
          { name: 'currency1',   type: 'address' },
          { name: 'fee',         type: 'uint24'  },
          { name: 'tickSpacing', type: 'int24'   },
          { name: 'hooks',       type: 'address' },
        ],
      },
      { name: 'zeroForOne',      type: 'bool'    },
      { name: 'amountOut',       type: 'uint128' },
      { name: 'amountInMaximum', type: 'uint128' },
      { name: 'hookData',        type: 'bytes'   },
    ],
  },
] as const;

/**
 * Computes the intent hash that PaymentRouter embeds in the swap hookData.
 *
 * Mirrors:
 *   keccak256(abi.encode(
 *     msg.sender, address(0), requiredUsdaio,
 *     proposalHash, rubricHash, domainMask, tier, priorityFee, block.chainid
 *   ))
 */
export function computeIntentHash(params: {
  requester:     `0x${string}`;
  requiredUsdaio: bigint;        // in wei (18 dp)
  proposalHash:  `0x${string}`; // bytes32
  rubricHash:    `0x${string}`; // bytes32
  domainMask:    bigint;
  tier:          number;
  priorityFee:   bigint;
  chainId:       number;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'uint8'   },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [
        params.requester,
        '0x0000000000000000000000000000000000000000',
        params.requiredUsdaio,
        params.proposalHash,
        params.rubricHash,
        params.domainMask,
        params.tier,
        params.priorityFee,
        BigInt(params.chainId),
      ],
    ),
  );
}

/**
 * Builds the full Universal Router calldata for an ETH → USDAIO exact-output swap.
 *
 * @param amountOut         - exact USDAIO to receive (wei)
 * @param amountInMaximum   - max ETH to spend (wei) — excess is swept back to swapAdapter
 * @param intentHash        - computed via computeIntentHash(); passed to the hook in hookData
 * @param deadlineSec       - unix timestamp for the UR deadline (default: now + 10 min)
 */
export function buildV4RouterCalldata(params: {
  amountOut:       bigint;
  amountInMaximum: bigint;
  intentHash:      `0x${string}`;
  deadlineSec?:    number;
}): `0x${string}` {
  const { amountOut, amountInMaximum, intentHash } = params;
  const deadline = BigInt(params.deadlineSec ?? Math.floor(Date.now() / 1000) + 600);

  // hookData = abi.encode(intentHash)
  const hookData = encodeAbiParameters([{ type: 'bytes32' }], [intentHash]);

  // ── SWAP_EXACT_OUT_SINGLE params ──────────────────────────────────────────
  const swapActionParams = encodeAbiParameters(EXACT_OUTPUT_SINGLE_PARAMS_ABI, [
    {
      poolKey: {
        currency0:   POOL.currency0,
        currency1:   POOL.currency1,
        fee:         POOL.fee,
        tickSpacing: POOL.tickSpacing,
        hooks:       POOL.hooks,
      },
      zeroForOne:      true,  // ETH (currency0) → USDAIO (currency1)
      amountOut,
      amountInMaximum,
      hookData,
    },
  ]);

  // ── SETTLE_ALL params: pay ETH debt from the UR's msg.value balance ───────
  const settleAllParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [POOL.currency0, amountInMaximum],
  );

  // ── TAKE params: send USDAIO to PaymentRouter (explicit recipient) ─────────
  // OPEN_DELTA (0) means "take all available credit for this currency".
  const takeParams = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }],
    [CONTRACT_ADDRESS.usdaio, CONTRACT_ADDRESS.paymentRouter, OPEN_DELTA],
  );

  // ── Pack the three V4 actions into a bytes sequence ───────────────────────
  const v4Actions = encodePacked(
    ['uint8', 'uint8', 'uint8'],
    [SWAP_EXACT_OUT_SINGLE, SETTLE_ALL, TAKE],
  );

  // ── V4_SWAP input: abi.encode(bytes actions, bytes[] params) ─────────────
  const v4SwapInput = encodeAbiParameters(
    [{ type: 'bytes' }, { type: 'bytes[]' }],
    [v4Actions, [swapActionParams, settleAllParams, takeParams]],
  );

  // ── SWEEP input: return unused ETH to swapAdapter (msgSender of UR) ───────
  const sweepInput = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }],
    [POOL.currency0, MSG_SENDER, 0n],
  );

  // ── Commands: [V4_SWAP, SWEEP] ────────────────────────────────────────────
  const commands = encodePacked(['uint8', 'uint8'], [CMD_V4_SWAP, CMD_SWEEP]);

  return encodeFunctionData({
    abi:          UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args:         [commands, [v4SwapInput, sweepInput], deadline],
  });
}
