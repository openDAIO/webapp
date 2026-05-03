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
import { decodeEventLog, parseUnits, type TransactionReceipt } from 'viem';
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
  step:      PaymentStep;
  txHash:    string;
  /** On-chain requestId parsed from the RequestPaid event after confirmation. 0n when not yet confirmed. */
  requestId: bigint;
  error:     string | null;
  execute:   (params: ExecuteParams) => Promise<PaymentExecutionResult | null>;
  reset:     () => void;
}

export interface ExecuteParams {
  asset:        'USDAIO' | 'ETH';
  /** Human-readable USDAIO amount (e.g. 100.5) */
  bountyUsdaio: number;
  /** Human-readable ETH amount to spend (e.g. 0.001) — used only when asset=ETH */
  ethAmount:    number;
  walletAddress: `0x${string}`;
  daioData:     DaioData;
  document:     PaymentDocument;
}

export interface PaymentDocument {
  proposalURI: string;
  proposalHash: `0x${string}`;
  rubricHash: `0x${string}`;
}

export interface PaymentExecutionResult {
  txHash: `0x${string}`;
  requestId: bigint;
  proposalURI: string;
  proposalHash: `0x${string}`;
  rubricHash: `0x${string}`;
  asset: ExecuteParams['asset'];
  requiredUsdaio: bigint;
  priorityFee: bigint;
}

// ─── Protocol defaults ────────────────────────────────────────────────────────
const DOMAIN_RESEARCH = 1n;
const TIER_FAST       = 0;

/** ETH slippage: thin Sepolia V4 liquidity needs a wider exact-output buffer; unused ETH is refunded. */
const ETH_SLIPPAGE_PCT = 1.25;
const GAS_LIMIT_BUFFER_NUMERATOR = 110n;
const GAS_LIMIT_BUFFER_DENOMINATOR = 100n;
const WALLET_LOG_PREFIX = '[DAIO][wallet]';

function logWallet(event: string, payload: Record<string, unknown>) {
  console.debug(`${WALLET_LOG_PREFIX} ${event}`, payload);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Parse RequestPaid(requester, requestId, paymentToken, amountPaid) from receipt logs. */
function parseRequestIdFromReceipt(receipt: TransactionReceipt): bigint {
  for (const log of receipt.logs) {
    try {
      const logWithTopics = log as unknown as { topics: readonly `0x${string}`[]; data: `0x${string}` };
      const decoded = decodeEventLog({
        abi: PAYMENT_ROUTER_ABI,
        eventName: 'RequestPaid',
        topics: logWithTopics.topics as [`0x${string}`, ...`0x${string}`[]],
        data: logWithTopics.data,
      });
      if (decoded.args.requestId !== undefined) return decoded.args.requestId as bigint;
    } catch {
      // not the RequestPaid event
    }
  }
  return 0n;
}

export function usePayReviewBounty(): PayReviewBountyResult {
  const [step,      setStep]      = useState<PaymentStep>('idle');
  const [txHash,    setTxHash]    = useState('');
  const [requestId, setRequestId] = useState<bigint>(0n);
  const [error,     setError]     = useState<string | null>(null);

  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const reset = useCallback(() => {
    setStep('idle');
    setTxHash('');
    setRequestId(0n);
    setError(null);
  }, []);

  const execute = useCallback(async (params: ExecuteParams) => {
    if (!publicClient) {
      logWallet('execute:error', { reason: 'missing_public_client' });
      setError('No RPC client available. Check your network.');
      setStep('error');
      return null;
    }

    const { asset, bountyUsdaio, ethAmount, walletAddress, daioData, document } = params;

    const decimals       = daioData.usdaioDecimals > 0 ? daioData.usdaioDecimals : 18;
    const baseRequestFee = daioData.baseRequestFee ?? 0n;

    // Use 6 decimal places for float→wei to avoid float precision artefacts.
    const amountWei = parseUnits(bountyUsdaio.toFixed(Math.min(6, decimals)), decimals);

    if (baseRequestFee <= 0n) {
      logWallet('execute:error', { reason: 'base_fee_not_loaded' });
      setError('Protocol fee is still loading. Please wait a moment and try again.');
      setStep('error');
      return null;
    }

    // ── Validate minimum ─────────────────────────────────────────────────────
    if (baseRequestFee > 0n && amountWei < baseRequestFee) {
      const minHuman = Number(baseRequestFee) / 10 ** decimals;
      logWallet('execute:error', {
        reason: 'below_base_fee',
        amountWei: amountWei.toString(),
        baseRequestFee: baseRequestFee.toString(),
      });
      setError(`Minimum bounty is ${minHuman} USDAIO (base request fee). Please increase the amount.`);
      setStep('error');
      return null;
    }

    // ── priorityFee = amount the user pays above the base fee ────────────────
    // PaymentRouter on-chain: requiredUsdaio = baseRequestFee + priorityFee
    const priorityFee    = amountWei > baseRequestFee ? amountWei - baseRequestFee : 0n;
    const requiredUsdaio = baseRequestFee + priorityFee; // identical to amountWei when valid

    const { proposalURI, proposalHash, rubricHash } = document;

    try {
      logWallet('execute:start', {
        asset,
        chainId,
        walletAddress,
        proposalURI,
        proposalHash,
        rubricHash,
        bountyUsdaio,
        amountWei: amountWei.toString(),
        baseRequestFee: baseRequestFee.toString(),
        priorityFee: priorityFee.toString(),
        requiredUsdaio: requiredUsdaio.toString(),
      });

      // ═══════════════════════════════════════════════════════════════════════
      //  USDAIO payment flow
      // ═══════════════════════════════════════════════════════════════════════
      if (asset === 'USDAIO') {
        const currentAllowance = daioData.usdaioAllowance ?? 0n;
        logWallet('USDAIO allowance checked', {
          currentAllowance: currentAllowance.toString(),
          requiredUsdaio: requiredUsdaio.toString(),
          approvalNeeded: currentAllowance < requiredUsdaio,
        });

        if (currentAllowance < requiredUsdaio) {
          // ── Step 1: Approve ─────────────────────────────────────────────
          setStep('approving');
          logWallet('approve:start', {
            token: CONTRACT_ADDRESS.usdaio,
            spender: CONTRACT_ADDRESS.paymentRouter,
            amount: requiredUsdaio.toString(),
          });
          const approveTxHash = await writeContractAsync({
            address:      CONTRACT_ADDRESS.usdaio,
            abi:          USDAIO_ABI,
            functionName: 'approve',
            args:         [CONTRACT_ADDRESS.paymentRouter, requiredUsdaio],
            account:      walletAddress,
            chain:        sepolia,
          });
          logWallet('approve:tx_submitted', { txHash: approveTxHash });
          const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
          logWallet('approve:confirmed', {
            txHash: approveTxHash,
            blockNumber: approveReceipt.blockNumber.toString(),
            status: approveReceipt.status,
          });
        }

        // ── Step 2: createRequestWithUSDAIO ─────────────────────────────
        setStep('signing');
        logWallet('createRequestWithUSDAIO:start', {
          paymentRouter: CONTRACT_ADDRESS.paymentRouter,
          proposalURI,
          proposalHash,
          rubricHash,
          domainMask: DOMAIN_RESEARCH.toString(),
          tier: TIER_FAST,
          priorityFee: priorityFee.toString(),
        });
        const payTxHash = await writeContractAsync({
          address:      CONTRACT_ADDRESS.paymentRouter,
          abi:          PAYMENT_ROUTER_ABI,
          functionName: 'createRequestWithUSDAIO',
          args: [
            proposalURI,
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
        logWallet('createRequestWithUSDAIO:tx_submitted', { txHash: payTxHash });

        setStep('confirming');
        const receipt1 = await publicClient.waitForTransactionReceipt({ hash: payTxHash });
        const confirmedRequestId = parseRequestIdFromReceipt(receipt1);
        logWallet('createRequestWithUSDAIO:confirmed', {
          txHash: payTxHash,
          requestId: confirmedRequestId.toString(),
          blockNumber: receipt1.blockNumber.toString(),
          status: receipt1.status,
        });
        setRequestId(confirmedRequestId);
        setStep('confirmed');
        return {
          txHash: payTxHash,
          requestId: confirmedRequestId,
          proposalURI,
          proposalHash,
          rubricHash,
          asset,
          requiredUsdaio,
          priorityFee,
        };
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
        logWallet('ETH intent hash computed', {
          intentHash,
          requiredUsdaio: requiredUsdaio.toString(),
          priorityFee: priorityFee.toString(),
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
        logWallet('ETH quote computed', {
          effectiveRate,
          ethNeededHuman,
          ethAmountMax: ethAmountMax.toString(),
          slippagePct: ETH_SLIPPAGE_PCT,
        });

        // ── Build Universal Router calldata for the V4 swap ─────────────────
        const routerCalldata = buildV4RouterCalldata({
          amountOut:       requiredUsdaio, // ← exact USDAIO the swap must produce
          amountInMaximum: ethAmountMax,
          intentHash,
        });
        logWallet('ETH router calldata built', {
          calldataBytes: Math.max(0, (routerCalldata.length - 2) / 2),
        });

        // ── createRequestWithETH (payable) ──────────────────────────────────
        setStep('signing');
        const ethGasEstimate = await publicClient.estimateContractGas({
          address:      CONTRACT_ADDRESS.paymentRouter,
          abi:          PAYMENT_ROUTER_ABI,
          functionName: 'createRequestWithETH',
          args: [
            routerCalldata,
            proposalURI,
            proposalHash,
            rubricHash,
            DOMAIN_RESEARCH,
            TIER_FAST,
            priorityFee,
          ],
          value:   ethAmountMax,
          account: walletAddress,
        });
        const ethGasLimit = (ethGasEstimate * GAS_LIMIT_BUFFER_NUMERATOR) / GAS_LIMIT_BUFFER_DENOMINATOR;
        logWallet('createRequestWithETH:gas_estimated', {
          gasEstimate: ethGasEstimate.toString(),
          gasLimit: ethGasLimit.toString(),
        });
        logWallet('createRequestWithETH:start', {
          paymentRouter: CONTRACT_ADDRESS.paymentRouter,
          value: ethAmountMax.toString(),
          proposalURI,
          proposalHash,
          rubricHash,
          domainMask: DOMAIN_RESEARCH.toString(),
          tier: TIER_FAST,
          priorityFee: priorityFee.toString(),
        });
        const payTxHash = await writeContractAsync({
          address:      CONTRACT_ADDRESS.paymentRouter,
          abi:          PAYMENT_ROUTER_ABI,
          functionName: 'createRequestWithETH',
          args: [
            routerCalldata,
            proposalURI,
            proposalHash,
            rubricHash,
            DOMAIN_RESEARCH,
            TIER_FAST,
            priorityFee,  // ← dynamic
          ],
          value:   ethAmountMax,
          gas:     ethGasLimit,
          account: walletAddress,
          chain:   sepolia,
        });
        setTxHash(payTxHash);
        logWallet('createRequestWithETH:tx_submitted', { txHash: payTxHash });

        setStep('confirming');
        const receipt2 = await publicClient.waitForTransactionReceipt({ hash: payTxHash });
        const confirmedRequestId = parseRequestIdFromReceipt(receipt2);
        logWallet('createRequestWithETH:confirmed', {
          txHash: payTxHash,
          requestId: confirmedRequestId.toString(),
          blockNumber: receipt2.blockNumber.toString(),
          status: receipt2.status,
        });
        setRequestId(confirmedRequestId);
        setStep('confirmed');
        return {
          txHash: payTxHash,
          requestId: confirmedRequestId,
          proposalURI,
          proposalHash,
          rubricHash,
          asset,
          requiredUsdaio,
          priorityFee,
        };
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
      logWallet('execute:failed', {
        asset,
        message: shortMsg,
      });
      setError(shortMsg);
      setStep('error');
      return null;
    }
  }, [chainId, publicClient, writeContractAsync]);

  return { step, txHash, requestId, error, execute, reset };
}
