import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CircleDollarSign, Loader2, LockKeyhole, Upload, Wallet } from 'lucide-react';
import PixelFrame, { PixelFrameChrome } from './PixelFrame';
import { useWallet } from '../services/wallet/useWallet';

export interface ConfirmedReviewBounty {
  amount: number;
  asset: 'USDT';
  network: string;
  txHash: string;
}

interface ReviewBountyGateOverlayProps {
  reviewBounty: ConfirmedReviewBounty | null;
  onConfirmed: (reviewBounty: ConfirmedReviewBounty) => void;
  onSubmitPaper: (title: string, link: string) => void;
  onBack: () => void;
}

type PaymentStep = 'idle' | 'signing' | 'confirming' | 'confirmed';

const MIN_REVIEW_BOUNTY = 10;
const NETWORK_FEE_NATIVE = 0.0008;
const NETWORK_FEE_SYMBOL = 'ETH';
const NETWORK_NAME = 'Ethereum Sepolia';
const SCANNER_IDLE_SRC = '/assets/submission-scanner/file-upload-scanner.png';
const SCANNER_SUBMITTING_SRC = '/assets/submission-scanner/file-upload-scanner-submit.gif';

function buildMockTxHash() {
  const chars = '0123456789abcdef';
  return `0x${Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
}

export default function ReviewBountyGateOverlay({
  reviewBounty,
  onConfirmed,
  onSubmitPaper,
  onBack,
}: ReviewBountyGateOverlayProps) {
  const wallet = useWallet();
  const isWalletConnected = wallet.isConnected;
  const isWalletReady = wallet.isReady;
  const isWalletConnecting = wallet.isConnecting;
  const walletAddress = wallet.shortAddress ?? '';
  const walletBalance = wallet.balance;
  const walletBalanceSymbol = wallet.balanceSymbol;

  const [amountInput, setAmountInput] = useState('50');
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle');
  const [txHash, setTxHash] = useState('');
  const [paperTitle, setPaperTitle] = useState('');
  const [paperLink, setPaperLink] = useState('');
  const [isPaperSubmitting, setIsPaperSubmitting] = useState(false);
  const [scannerImageError, setScannerImageError] = useState(false);
  const timersRef = useRef<number[]>([]);

  const amount = Number(amountInput);
  const isAmountValid = Number.isFinite(amount) && amount >= MIN_REVIEW_BOUNTY && amount <= walletBalance;
  const canConfirm = isAmountValid && paymentStep === 'idle' && isWalletConnected;
  const isReviewBountyConfirmed = Boolean(reviewBounty) || paymentStep === 'confirmed';

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const helperText = useMemo(() => {
    if (!isWalletConnected) return 'Connect your wallet to fund the review bounty.';
    if (!amountInput) return `Enter at least ${MIN_REVIEW_BOUNTY} USDT.`;
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid USDT amount.';
    if (amount < MIN_REVIEW_BOUNTY) return `Minimum review bounty is ${MIN_REVIEW_BOUNTY} USDT.`;
    if (amount > walletBalance) return `Review bounty cannot exceed your wallet balance (${walletBalance.toFixed(2)} ${walletBalanceSymbol}).`;
    return 'Amount verified against your wallet balance.';
  }, [amount, amountInput, isWalletConnected, walletBalance, walletBalanceSymbol]);

  const handleConfirm = () => {
    if (!canConfirm) return;

    const nextTxHash = buildMockTxHash();
    setTxHash(nextTxHash);
    setPaymentStep('signing');

    timersRef.current.push(window.setTimeout(() => {
      setPaymentStep('confirming');
    }, 900));

    timersRef.current.push(window.setTimeout(() => {
      setPaymentStep('confirmed');
      onConfirmed({
        amount,
        asset: 'USDT',
        network: NETWORK_NAME,
        txHash: nextTxHash,
      });
    }, 1900));
  };

  const handlePaperSubmit = () => {
    const trimmedTitle = paperTitle.trim();
    if (!trimmedTitle || isPaperSubmitting) return;

    setScannerImageError(false);
    setIsPaperSubmitting(true);
    timersRef.current.push(window.setTimeout(() => {
      onSubmitPaper(trimmedTitle, paperLink.trim());
    }, 1400));
  };

  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#503521]/55 px-4 py-6 backdrop-blur-[3px]">
      <section
        className="pixel-box warm-panel w-full max-w-2xl p-6 text-[#503521] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-bounty-title"
      >
        <PixelFrameChrome round={2} />

        {isReviewBountyConfirmed ? (
          <>
          <button
            type="button"
            onClick={onBack}
            disabled={isPaperSubmitting}
            className="pixel-frame absolute right-6 top-6 z-40 flex h-8 w-8 items-center justify-center text-[#5f211c] transition-transform hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-50 disabled:hover:translate-y-0"
            aria-label="Back to room selection"
            title="Back to room selection"
          >
            <PixelFrameChrome
              round={2}
              thickness={4}
              color="#9c342d"
              fillColor="#d87965"
              innerHighlightColor="rgba(255, 255, 255, 0.24)"
              outerShadowColor="rgba(95, 33, 28, 0.22)"
              outerShadowOffsetX={2}
              outerShadowOffsetY={2}
            />
            <ArrowLeft className="relative z-40" size={18} />
          </button>

          <div className="grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="mb-2">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2f5d7e]">
                    <Upload size={16} />
                    Paper Upload
                  </div>
                  <h2 id="review-bounty-title" className="text-3xl font-bold leading-none text-[#503521]">
                    <span className="block">Upload your paper</span>
                    <span className="block">to enter the review room.</span>
                  </h2>
                </div>
              </div>

              <PixelFrame
                className="p-3 text-sm text-[#2f6f35]"
                color="#8ab66b"
                fillColor="#f4ffd9"
                round={2}
                thickness={4}
                outerShadowOffsetX={0}
                outerShadowOffsetY={0}
                outerShadowColor="transparent"
              >
                <div className="flex items-center justify-between gap-3 font-bold">
                  <span>Review Bounty Paid</span>
                  <span>{(reviewBounty?.amount ?? amount).toFixed(2)} USDT</span>
                </div>
              </PixelFrame>

                <label className="block text-sm font-bold" htmlFor="paper-title">
                  Paper Title
                </label>
                <PixelFrame
                  className="flex items-stretch"
                  color="#d7b98f"
                  fillColor="#ffffff"
                  round={2}
                  thickness={4}
                  outerShadowOffsetX={0}
                  outerShadowOffsetY={0}
                  outerShadowColor="transparent"
                >
                  <input
                    id="paper-title"
                    type="text"
                    value={paperTitle}
                    disabled={isPaperSubmitting}
                    onChange={(event) => setPaperTitle(event.target.value)}
                    placeholder="Paper Title..."
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-bold text-[#503521] outline-none disabled:opacity-70"
                  />
                </PixelFrame>

                <label className="block text-sm font-bold" htmlFor="paper-link">
                  Link / File Path
                </label>
                <PixelFrame
                  className="flex items-stretch"
                  color="#d7b98f"
                  fillColor="#ffffff"
                  round={2}
                  thickness={4}
                  outerShadowOffsetX={0}
                  outerShadowOffsetY={0}
                  outerShadowColor="transparent"
                >
                  <input
                    id="paper-link"
                    type="text"
                    value={paperLink}
                    disabled={isPaperSubmitting}
                    onChange={(event) => setPaperLink(event.target.value)}
                    placeholder="Optional"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[#503521] outline-none disabled:opacity-70"
                  />
                </PixelFrame>

              <button
                type="button"
                onClick={handlePaperSubmit}
                disabled={!paperTitle.trim() || isPaperSubmitting}
                className="pixel-frame flex w-full items-center justify-center gap-2 px-4 py-3 text-lg font-bold text-[#23351f] transition-transform hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <PixelFrameChrome
                  round={2}
                  thickness={4}
                  color="#5f4328"
                  fillColor="#e5b45f"
                  innerHighlightColor="rgba(255, 255, 255, 0.24)"
                  outerShadowColor="rgba(80, 53, 33, 0.25)"
                  outerShadowOffsetX={4}
                  outerShadowOffsetY={4}
                />
                <span className="relative z-40 flex items-center justify-center gap-2">
                  {isPaperSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Submitting Paper
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Submit Paper
                    </>
                  )}
                </span>
              </button>
            </div>

            <div className="flex min-h-[26rem] items-center justify-start">
              {scannerImageError ? (
                <div className="px-3 text-center text-xs font-bold text-[#6b563f]">
                  Add scanner art at
                  <br />
                  /public/assets/submission-scanner/
                </div>
              ) : (
                <div className="h-[26rem] w-[15rem] overflow-hidden">
                  <img
                    src={isPaperSubmitting ? SCANNER_SUBMITTING_SRC : SCANNER_IDLE_SRC}
                    alt="Paper upload scanner"
                    className="h-[26rem] w-[26rem] max-w-none -translate-x-[5.5rem] object-contain pixelated drop-shadow-[4px_5px_0_rgba(80,53,33,0.22)]"
                    onError={() => setScannerImageError(true)}
                  />
                </div>
              )}
            </div>
          </div>
          </>
        ) : (
          <>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2f5d7e]">
              <LockKeyhole size={16} />
              Review Bounty
            </div>
            <h2 id="review-bounty-title" className="text-3xl font-bold leading-none text-[#503521]">
              <span className="block">Pay the Review Bounty</span>
              <span className="block">to start the research analysis.</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={paymentStep !== 'idle'}
            className="pixel-frame flex h-8 w-8 flex-shrink-0 items-center justify-center text-[#5f211c] transition-transform hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-50 disabled:hover:translate-y-0"
            aria-label="Back to room selection"
            title="Back to room selection"
          >
            <PixelFrameChrome
              round={2}
              thickness={4}
              color="#9c342d"
              fillColor="#d87965"
              innerHighlightColor="rgba(255, 255, 255, 0.24)"
              outerShadowColor="rgba(95, 33, 28, 0.22)"
              outerShadowOffsetX={2}
              outerShadowOffsetY={2}
            />
            <ArrowLeft className="relative z-40" size={18} />
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <PixelFrame
            className="p-3"
            color="#d7b98f"
            fillColor="#fff8e6"
            round={2}
            thickness={4}
            outerShadowOffsetX={0}
            outerShadowOffsetY={0}
            outerShadowColor="transparent"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Wallet size={18} />
              {isWalletConnected ? 'Connected Wallet' : 'Wallet Not Connected'}
            </div>
            {isWalletConnected ? (
              <button
                type="button"
                onClick={wallet.openAccount}
                className="group block w-full text-left transition-transform hover:-translate-y-0.5"
                title="Manage wallet"
              >
                <div className="truncate text-xs text-[#6b563f] group-hover:text-[#3f2818]">
                  {walletAddress}
                </div>
                <div className="mt-2 text-lg font-bold">
                  {wallet.isBalanceLoading
                    ? 'Loading…'
                    : `${walletBalance.toFixed(4)} ${walletBalanceSymbol}`}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider text-[#2f5d7e] opacity-0 transition-opacity group-hover:opacity-100">
                  Click to manage →
                </div>
              </button>
            ) : (
              <>
                <div className="text-xs text-[#9c342d]">Connect via WalletConnect to continue.</div>
                <button
                  type="button"
                  onClick={wallet.open}
                  disabled={!isWalletReady || isWalletConnecting}
                  className="pixel-frame mt-2 flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-[#23351f] transition-transform hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <PixelFrameChrome
                    round={2}
                    thickness={3}
                    color="#5f4328"
                    fillColor="#8fbf7a"
                    innerHighlightColor="rgba(255, 255, 255, 0.24)"
                    outerShadowColor="rgba(80, 53, 33, 0.25)"
                    outerShadowOffsetX={2}
                    outerShadowOffsetY={2}
                  />
                  <span className="relative z-40 flex items-center gap-2">
                    {isWalletConnecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Wallet size={14} />
                    )}
                    {isWalletReady ? 'Connect Wallet' : 'WalletConnect Disabled'}
                  </span>
                </button>
              </>
            )}
          </PixelFrame>
          <PixelFrame
            className="p-3"
            color="#d7b98f"
            fillColor="#fff8e6"
            round={2}
            thickness={4}
            outerShadowOffsetX={0}
            outerShadowOffsetY={0}
            outerShadowColor="transparent"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              <CircleDollarSign size={18} />
              Reward Pool Contract
            </div>
            <div className="text-xs text-[#6b563f]">Network: {NETWORK_NAME}</div>
            <div className="mt-2 text-lg font-bold">Gas {NETWORK_FEE_NATIVE.toFixed(4)} {NETWORK_FEE_SYMBOL}</div>
          </PixelFrame>
        </div>

        <label className="mb-2 block text-sm font-bold" htmlFor="review-bounty-amount">
          Review Bounty Amount
        </label>
          <PixelFrame
            className="mb-2 grid grid-cols-[minmax(0,1fr)_6rem]"
            color="#7b5835"
            fillColor="#ffffff"
            round={2}
            thickness={4}
            outerShadowOffsetX={0}
            outerShadowOffsetY={0}
            outerShadowColor="transparent"
          >
            <input
              id="review-bounty-amount"
              type="number"
              min={MIN_REVIEW_BOUNTY}
              max={isWalletConnected ? walletBalance : undefined}
              step="1"
              inputMode="decimal"
              value={amountInput}
              disabled={paymentStep !== 'idle' || !isWalletConnected}
              onChange={(event) => setAmountInput(event.target.value)}
              className="number-input-clean min-w-0 bg-transparent px-4 py-3 text-2xl font-bold text-[#503521] outline-none disabled:opacity-70"
            />
            <span className="review-bounty-unit flex items-center justify-center border-l-4 border-[#7b5835] bg-[#e5b45f] text-lg font-bold text-[#503521]">
              USDT
            </span>
          </PixelFrame>
        <div className={`mb-4 text-xs font-bold ${isAmountValid ? 'text-[#2f6f35]' : 'text-[#9c342d]'}`}>
          {helperText}
        </div>

        <PixelFrame
          className="mb-5 p-3 text-xs text-[#6b563f]"
          color="#d7b98f"
          fillColor="#fff8e6"
          round={1}
          thickness={2}
          outerShadowOffsetX={0}
          outerShadowOffsetY={0}
          outerShadowColor="transparent"
        >
          <div className="flex justify-between gap-3">
            <span>Node reward pool</span>
            <strong className="text-[#503521]">{isAmountValid ? amount.toFixed(2) : '0.00'} USDT</strong>
          </div>
          <div className="mt-1 flex justify-between gap-3">
            <span>Estimated gas fee</span>
            <strong className="text-[#503521]">{NETWORK_FEE_NATIVE.toFixed(4)} {NETWORK_FEE_SYMBOL}</strong>
          </div>
          {txHash && <div className="mt-2 truncate text-[#2f5d7e]">Tx: {txHash}</div>}
        </PixelFrame>

        {isWalletConnected ? (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="pixel-frame flex w-full items-center justify-center gap-2 px-4 py-3 text-lg font-bold text-[#23351f] transition-transform hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <PixelFrameChrome
              round={2}
              thickness={4}
              color="#5f4328"
              fillColor="#8fbf7a"
              innerHighlightColor="rgba(255, 255, 255, 0.24)"
              outerShadowColor="rgba(80, 53, 33, 0.25)"
              outerShadowOffsetX={4}
              outerShadowOffsetY={4}
            />
            <span className="relative z-40 flex items-center justify-center gap-2">
            {paymentStep === 'idle' && 'Pay Review Bounty'}
            {paymentStep === 'signing' && (
              <>
                <Loader2 size={18} className="animate-spin" />
                Wallet payment pending
              </>
            )}
            {paymentStep === 'confirming' && (
              <>
                <Loader2 size={18} className="animate-spin" />
                Waiting for payment confirmation
              </>
            )}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={wallet.open}
            disabled={!isWalletReady || isWalletConnecting}
            className="pixel-frame flex w-full items-center justify-center gap-2 px-4 py-3 text-lg font-bold text-[#23351f] transition-transform hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <PixelFrameChrome
              round={2}
              thickness={4}
              color="#5f4328"
              fillColor="#8fbf7a"
              innerHighlightColor="rgba(255, 255, 255, 0.24)"
              outerShadowColor="rgba(80, 53, 33, 0.25)"
              outerShadowOffsetX={4}
              outerShadowOffsetY={4}
            />
            <span className="relative z-40 flex items-center justify-center gap-2">
              {isWalletConnecting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Connecting wallet…
                </>
              ) : (
                <>
                  <Wallet size={18} />
                  {isWalletReady ? 'Connect Wallet to Continue' : 'WalletConnect Not Configured'}
                </>
              )}
            </span>
          </button>
        )}
          </>
        )}
      </section>
    </div>
  );
}
