/**
 * usePayReviewBounty — executes the on-chain Review Bounty payment flow.
 *
 * USDAIO payment flow:
 *   1. Check current allowance (from daioData).
 *   2. If insufficient → ERC-20 approve(PaymentRouter, amount). Wait for confirmation.
 *   3. createRequestWithUSDAIO(...). Wait for confirmation.
 *
 * ETH payment flow:
 *   1. Compute intentHash off-chain (same inputs PaymentRouter will use on-chain).
 *   2. Build Universal Router calldata (V4 exact-output ETH → USDAIO swap + sweep).
 *   3. createRequestWithETH(routerCalldata, ...) with value = ethAmountMax. Wait.
 *
 * The hook exposes a minimal state machine:
 *   idle → approving? → signing → confirming → confirmed
 *                                              ↘ error
 *
 * Call reset() to return to idle after an error or confirmation.
 */

import { useState, useCallback } from 'react';
import { usePublicClient, useWriteContract, useChainId } from 'wagmi';
import { encodeAbiParameters, keccak256, parseUnits } from 'viem';
import { sepolia } from 'wagmi/chains';
import { USDAIO_ABI, PAYMENT_ROUTER_ABI } from '../../contracts/abis';
import type { DaioData } from './useDaioData';
import {
  CONTRACT_ADDRESS,
  computeIntentHash,
  buildV4RouterCalldata,
} from './ethSwapCalldata';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentStep =
  | 'idle'
  | 'approving'   // USDAIO: waiting for approve tx
  | 'signing'     // waiting for wallet signature on the pay tx
  | 'confirming'  // tx submitted, waiting for on-chain confirmation
  | 'confirmed'   // tx mined successfully
  | 'error';

export interface PayReviewBountyResult {
  step:    PaymentStep;
  txHash:  string;
  error:   string | null;
  execute: (params: ExecuteParams) => Promise<void>;
  reset:   () => void;
}

export interface ExecuteParams {
  asset:        'USDAIO' | 'ETH';
  /** Human-readable USDAIO amount (e.g. 100.5) */
  bountyUsdaio: number;
  /** Human-readable ETH amount to spend (e.g. 0.001) — used only when asset=ETH */
  ethAmount:    number;
  walletAddress: `0x${string}`;
  daioData:     DaioData;
}

// ─── Protocol defaults (replace with real content hashes from the paper) ──────
const DOMAIN_RESEARCH = 1n;
const TIER_FAST       = 0;
const PROPOSAL_URI    = 'content://proposals/review-bounty-placeholder';

/** ETH slippage: send 10% more ETH than the rate-based estimate. */
const ETH_SLIPPAGE_PCT = 1.1;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePayReviewBounty(): PayReviewBountyResult {
  const [step,   setStep]   = useState<PaymentStep>('idle');
  const [txHash, setTxHash] = useState('');
  const [error,  setError]  = useState<string | null>(null);

  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const reset = useCallback(() => {
    setStep('idle');
    setTxHash('');
    setError(null);
  }, []);

  const execute = useCallback(async (params: ExecuteParams) => {
    if (!publicClient) {
      setError('No RPC client available. Check your network.');
      setStep('error');
      return;
    }

    const { asset, bountyUsdaio, ethAmount, walletAddress, daioData } = params;
    const decimals       = daioData.usdaioDecimals > 0 ? daioData.usdaioDecimals : 18;
    const baseRequestFee = daioData.baseRequestFee ?? 0n;

    // Use 6 decimal places for float→wei to avoid float precision artefacts.
    const amountWei = parseUnits(bountyUsdaio.toFixed(Math.min(6, decimals)), decimals);

    // ── Validate minimum ─────────────────────────────────────────────────────
    if (baseRequestFee > 0n && amountWei < baseRequestFee) {
      const minHuman = Number(baseRequestFee) / 10 ** decimals;
      setError(`Minimum bounty is ${minHuman} USDAIO (base request fee). Please increase the amount.`);
      setStep('error');
      return;
    }

    // ── priorityFee = amount the user pays above the base fee ────────────────
    // PaymentRouter on-chain: requiredUsdaio = baseRequestFee + priorityFee
    const priorityFee    = amountWei > baseRequestFee ? amountWei - baseRequestFee : 0n;
    const requiredUsdaio = baseRequestFee + priorityFee; // identical to amountWei when valid

    // Fixed proposal / rubric hashes (placeholder — replace with real content).
    const proposalHash = keccak256(encodeAbiParameters([{ type: 'string' }], [PROPOSAL_URI]));
    const rubricHash   = keccak256(encodeAbiParameters([{ type: 'string' }], [`${PROPOSAL_URI}:rubric`]));

    try {
      // ═══════════════════════════════════════════════════════════════════════
      //  USDAIO payment flow
      // ═══════════════════════════════════════════════════════════════════════
      if (asset === 'USDAIO') {
        const currentAllowance = daioData.usdaioAllowance ?? 0n;

        if (currentAllowance < requiredUsdaio) {
          // ── Step 1: Approve ─────────────────────────────────────────────
          setStep('approving');
          const approveTxHash = await writeContractAsync({
            address:      CONTRACT_ADDRESS.usdaio,
            abi:          USDAIO_ABI,
            functionName: 'approve',
            args:         [CONTRACT_ADDRESS.paymentRouter, requiredUsdaio],
            account:      walletAddress,
            chain:        sepolia,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        }

        // ── Step 2: createRequestWithUSDAIO ─────────────────────────────
        setStep('signing');
        const payTxHash = await writeContractAsync({
          address:      CONTRACT_ADDRESS.paymentRouter,
          abi:          PAYMENT_ROUTER_ABI,
          functionName: 'createRequestWithUSDAIO',
          args: [
            PROPOSAL_URI,
            proposalHash,
            rubricHash,
            DOMAIN_RESEARCH,
            TIER_FAST,
            priorityFee,  // ← dynamic: bountyUsdaio - baseRequestFee
          ],
          account: walletAddress,
          chain:   sepolia,
        });
        setTxHash(payTxHash);

        setStep('confirming');
        await publicClient.waitForTransactionReceipt({ hash: payTxHash });
        setStep('confirmed');
      }

      // ═══════════════════════════════════════════════════════════════════════
      //  ETH payment flow
      // ═══════════════════════════════════════════════════════════════════════
      else {
        // ── intentHash must mirror PaymentRouter's on-chain computation exactly
        //    PaymentRouter: intentHash = keccak256(requester, address(0), requiredUsdaio, ...)
        //    where requiredUsdaio = baseRequestFee + priorityFee
        const intentHash = computeIntentHash({
          requester:      walletAddress,
          requiredUsdaio, // ← must match on-chain value
          proposalHash,
          rubricHash,
          domainMask:     DOMAIN_RESEARCH,
          tier:           TIER_FAST,
          priorityFee,    // ← dynamic
          chainId,
        });

        // ── Compute ETH max from requiredUsdaio using the live pool rate ────
        //    (more accurate than using the user-typed ETH amount, which was
        //     derived from bountyUsdaio before slippage / rounding)
        const effectiveRate = daioData.effectiveUsdaioPerEth ?? 0;
        let ethNeededHuman: number;
        if (effectiveRate > 0) {
          const requiredUsdaioHuman = Number(requiredUsdaio) / 10 ** decimals;
          ethNeededHuman = requiredUsdaioHuman / effectiveRate;
        } else {
          // Fallback: use the UI-computed ETH amount if rate unavailable
          ethNeededHuman = ethAmount;
        }
        const ethAmountMax = parseUnits(
          (ethNeededHuman * ETH_SLIPPAGE_PCT).toFixed(9),
          18,
        );

        // ── Build Universal Router calldata for the V4 swap ─────────────────
        const routerCalldata = buildV4RouterCalldata({
          amountOut:       requiredUsdaio, // ← exact USDAIO the swap must produce
          amountInMaximum: ethAmountMax,
          intentHash,
        });

        // ── createRequestWithETH (payable) ──────────────────────────────────
        setStep('signing');
        const payTxHash = await writeContractAsync({
          address:      CONTRACT_ADDRESS.paymentRouter,
          abi:          PAYMENT_ROUTER_ABI,
          functionName: 'createRequestWithETH',
          args: [
            routerCalldata,
            PROPOSAL_URI,
            proposalHash,
            rubricHash,
            DOMAIN_RESEARCH,
            TIER_FAST,
            priorityFee,  // ← dynamic
          ],
          value:   ethAmountMax,
          account: walletAddress,
          chain:   sepolia,
        });
        setTxHash(payTxHash);

        setStep('confirming');
        await publicClient.waitForTransactionReceipt({ hash: payTxHash });
        setStep('confirmed');
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : 'Transaction failed';
      // Surface short reason from wallet/contract if available.
      const shortMsg = msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
      setError(shortMsg);
      setStep('error');
    }
  }, [chainId, publicClient, writeContractAsync]);

  return { step, txHash, error, execute, reset };
}
