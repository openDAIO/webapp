/**
 * Builds the contracts[] array passed to wagmi's useReadContracts.
 *
 * All reads are batched into a single eth_call via the Multicall3 contract so
 * they consume exactly one RPC round-trip.
 *
 * Slot indices (DAIO_SLOT) are the source of truth for indexing into the
 * result array in useDaioData.ts.
 */
import ADDRESSES_JSON from '../../contracts/addresses.json';
import {
  DAIO_CORE_ABI,
  PAYMENT_ROUTER_ABI,
  USDAIO_ABI,
  UNISWAP_V4_POOL_MANAGER_ABI,
} from '../../contracts/abis';

const ADDR = ADDRESSES_JSON.sepolia;

/** Typed Sepolia addresses for direct import in action hooks. */
export const CONTRACT_ADDRESSES = {
  daioCore:             ADDR.daioCore             as `0x${string}`,
  paymentRouter:        ADDR.paymentRouter         as `0x${string}`,
  usdaio:               ADDR.usdaio               as `0x${string}`,
  stakeVault:           ADDR.stakeVault            as `0x${string}`,
  uniswapV4PoolManager: ADDR.uniswapV4PoolManager  as `0x${string}`,
  poolKeyHash:          ADDR.pool.poolKeyHash       as `0x${string}`,
  poolFee:              ADDR.pool.fee,
} as const;

/**
 * Slot index → result position mapping.
 * Keep in sync with the contracts array returned by buildDaioContracts().
 */
export const DAIO_SLOT = {
  /** DAIOCore.baseRequestFee() → bigint */
  BASE_REQUEST_FEE:       0,
  /** USDAIO.balanceOf(wallet) → bigint  (undefined when not connected) */
  USDAIO_BALANCE:         1,
  /** USDAIO.allowance(wallet, paymentRouter) → bigint  (undefined when not connected) */
  USDAIO_ALLOWANCE:       2,
  /** USDAIO.decimals() → number */
  USDAIO_DECIMALS:        3,
  /** PoolManager.getSlot0(poolKeyHash) → [sqrtPriceX96, tick, protocolFee, lpFee] */
  POOL_SLOT0:             4,
  /**
   * PaymentRouter.latestRequestState(wallet) → [requestId, status, processing, completed]
   * undefined when wallet not connected.
   */
  LATEST_REQUEST_STATE:   5,
} as const;

/**
 * Builds the contracts array for wagmi useReadContracts.
 * Wallet-dependent calls (balance / allowance) are skipped when walletAddress
 * is undefined by passing address: undefined — wagmi omits those slots from
 * the multicall and returns undefined in the result.
 */
export function buildDaioContracts(walletAddress: `0x${string}` | undefined) {
  return [
    // slot 0 — always: protocol base fee
    {
      address:      CONTRACT_ADDRESSES.daioCore,
      abi:          DAIO_CORE_ABI,
      functionName: 'baseRequestFee' as const,
    },
    // slot 1 — wallet only: USDAIO balance
    {
      address:      walletAddress ? CONTRACT_ADDRESSES.usdaio : undefined,
      abi:          USDAIO_ABI,
      functionName: 'balanceOf' as const,
      args:         walletAddress ? ([walletAddress] as const) : undefined,
    },
    // slot 2 — wallet only: USDAIO allowance to PaymentRouter
    {
      address:      walletAddress ? CONTRACT_ADDRESSES.usdaio : undefined,
      abi:          USDAIO_ABI,
      functionName: 'allowance' as const,
      args:         walletAddress
        ? ([walletAddress, CONTRACT_ADDRESSES.paymentRouter] as const)
        : undefined,
    },
    // slot 3 — always: token decimals (almost always 18, but read from chain)
    {
      address:      CONTRACT_ADDRESSES.usdaio,
      abi:          USDAIO_ABI,
      functionName: 'decimals' as const,
    },
    // slot 4 — always: Uniswap V4 pool sqrtPrice for live ETH/USDAIO rate
    {
      address:      CONTRACT_ADDRESSES.uniswapV4PoolManager,
      abi:          UNISWAP_V4_POOL_MANAGER_ABI,
      functionName: 'getSlot0' as const,
      args:         [CONTRACT_ADDRESSES.poolKeyHash] as const,
    },
    // slot 5 — wallet only: latest request status from PaymentRouter
    {
      address:      walletAddress ? CONTRACT_ADDRESSES.paymentRouter : undefined,
      abi:          PAYMENT_ROUTER_ABI,
      functionName: 'latestRequestState' as const,
      args:         walletAddress ? ([walletAddress] as const) : undefined,
    },
  ] as const;
}

export type DaioContracts = ReturnType<typeof buildDaioContracts>;

// ─── Re-export ABI fragments for action hooks ─────────────────────────────────
export { DAIO_CORE_ABI, PAYMENT_ROUTER_ABI, USDAIO_ABI };
