/**
 * useDaioData — single multicall read hook for the Review Bounty Gate.
 *
 * Fetches in a single RPC round-trip (Multicall3) every 10 s:
 *   - DAIOCore.baseRequestFee
 *   - USDAIO.balanceOf / allowance  (wallet-dependent)
 *   - USDAIO.decimals
 *   - UniswapV4 PoolManager.getSlot0  → live ETH/USDAIO sqrtPriceX96
 *
 * Call `refresh()` after a transaction to re-fetch immediately.
 */
import { useCallback } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { DAIO_SLOT, buildDaioContracts, CONTRACT_ADDRESSES } from './queries';
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
  /** Raw sqrtPriceX96 from PoolManager.getSlot0. */
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

  // ── Convenience addresses ──────────────────────────────────────────────────
  paymentRouterAddress: `0x${string}`;
  usdaioAddress: `0x${string}`;

  // ── Meta ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  /** Call after a transaction to immediately re-fetch chain state. */
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useDaioData(): DaioData {
  const { address: walletAddress } = useAccount();

  const { data, isLoading, refetch } = useReadContracts({
    contracts: buildDaioContracts(walletAddress),
    query: {
      refetchInterval:            10_000,
      staleTime:                  0,
      refetchIntervalInBackground: false,
    },
  });

  // ── Unwrap results by slot index ─────────────────────────────────────────
  const baseRequestFee  = data?.[DAIO_SLOT.BASE_REQUEST_FEE]?.result  as bigint | undefined;
  const usdaioBalance   = data?.[DAIO_SLOT.USDAIO_BALANCE]?.result    as bigint | undefined;
  const usdaioAllowance = data?.[DAIO_SLOT.USDAIO_ALLOWANCE]?.result  as bigint | undefined;
  const usdaioDecimals  = (data?.[DAIO_SLOT.USDAIO_DECIMALS]?.result  as number | undefined) ?? 18;

  // getSlot0 returns a tuple [sqrtPriceX96, tick, protocolFee, lpFee]
  const slot0 = data?.[DAIO_SLOT.POOL_SLOT0]?.result as
    | readonly [bigint, number, number, number]
    | undefined;
  const poolSqrtPriceX96 = slot0?.[0];

  // ── Compute pool rate ─────────────────────────────────────────────────────
  const poolRateUsdaioPerEth = poolSqrtPriceX96
    ? sqrtPriceX96ToUsdaioPerEth(poolSqrtPriceX96)
    : 0;

  const effectiveUsdaioPerEth =
    poolRateUsdaioPerEth > 0
      ? poolRateUsdaioPerEth * (1 - POOL_FEE_FRACTION)
      : FALLBACK_USDAIO_PER_ETH;

  const refresh = useCallback(() => { refetch(); }, [refetch]);

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
    poolFeePct: POOL_FEE_FRACTION * 100,  // e.g. 0.3
    effectiveUsdaioPerEth,

    paymentRouterAddress: CONTRACT_ADDRESSES.paymentRouter,
    usdaioAddress:        CONTRACT_ADDRESSES.usdaio,

    isLoading,
    refresh,
  };
}
