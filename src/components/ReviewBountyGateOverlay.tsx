import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  CircleDollarSign,
  Coins,
  FileText,
  Loader2,
  LockKeyhole,
  Upload,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import PixelFrame, { PixelFrameChrome } from './PixelFrame';
import { useWallet } from '../services/wallet/useWallet';
import type { ActiveReviewRoomId } from '../constants/reviewRoomScenes';

export type PaymentAsset = 'USDAIO' | 'ETH';

export interface ConfirmedReviewBounty {
  amount: number;
  asset: 'USDAIO';
  network: string;
  txHash: string;
  paidWith?: {
    asset: 'ETH';
    amount: number;
    rate: number;
    poolFeePct: number;
    hook: string;
  };
}

interface ReviewBountyGateOverlayProps {
  roomId: ActiveReviewRoomId;
  reviewBounty: ConfirmedReviewBounty | null;
  onConfirmed: (reviewBounty: ConfirmedReviewBounty) => void;
  onSubmitPaper: (title: string, link: string) => void;
  onBack: () => void;
}

type PaymentStep = 'idle' | 'signing' | 'confirming' | 'confirmed';

const ROOM_BOUNTY_USDAIO: Record<ActiveReviewRoomId, number> = {
  paper: 10,
  judgment: 20,
};
const NETWORK_FEE_NATIVE = 0.0008;
const NETWORK_FEE_SYMBOL = 'ETH';
const NETWORK_NAME = 'Ethereum Sepolia';
// Uniswap V4 Hook auto-swap (mock values — replace with on-chain quoter once the hook is deployed).
const MOCK_ETH_TO_USDAIO_RATE = 3500;
const UNISWAP_V4_HOOK_FEE_PCT = 0.05;
const UNISWAP_V4_HOOK_LABEL = 'Uniswap V4 Hook';
/** USDAIO received per 1 ETH after mock pool fee (fixed — replace with quoter later). */
const EFFECTIVE_USDAIO_PER_ETH =
  MOCK_ETH_TO_USDAIO_RATE * (1 - UNISWAP_V4_HOOK_FEE_PCT / 100);

function usdaioReceivedForEth(eth: number) {
  return eth * EFFECTIVE_USDAIO_PER_ETH;
}

function ethPaidForUsdaioTarget(usdaio: number) {
  return usdaio / EFFECTIVE_USDAIO_PER_ETH;
}
// USDAIO contract is not yet deployed on Sepolia — show a mocked balance until ERC20 read is wired up.
const MOCK_USDAIO_BALANCE = 1250.0;
const SCANNER_IDLE_SRC = '/assets/submission-scanner/file-upload-scanner.png';
const SCANNER_SUBMITTING_SRC = '/assets/submission-scanner/file-upload-scanner-submit.gif';
const PAPER_FILE_ACCEPT = '.pdf,.doc,.docx,.md,.txt,application/pdf,text/markdown,text/plain';

function buildMockTxHash() {
  const chars = '0123456789abcdef';
  return `0x${Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
}

function fileNameToPaperTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 || value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function ReviewBountyGateOverlay({
  roomId,
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

  const [paymentAsset, setPaymentAsset] = useState<PaymentAsset>('USDAIO');
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle');
  const [txHash, setTxHash] = useState('');
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [isPaperDragActive, setIsPaperDragActive] = useState(false);
  const [isPaperSubmitting, setIsPaperSubmitting] = useState(false);
  const [scannerImageError, setScannerImageError] = useState(false);
  const [bountyUsdaio, setBountyUsdaio] = useState(() => ROOM_BOUNTY_USDAIO[roomId]);
  /** Rate row: toggle quote direction (1 ETH → USDAIO vs 1 USDAIO → ETH). */
  const [invertRateQuote, setInvertRateQuote] = useState(false);
  const paperFileInputRef = useRef<HTMLInputElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    setBountyUsdaio(ROOM_BOUNTY_USDAIO[roomId]);
  }, [roomId]);

  const isEthMode = paymentAsset === 'ETH';
  const inputSymbol: PaymentAsset = paymentAsset;
  const ethPayAmount = ethPaidForUsdaioTarget(bountyUsdaio);
  const amount = isEthMode ? ethPayAmount : bountyUsdaio;
  const settledUsdaio = bountyUsdaio;
  const balanceForAsset = isEthMode ? walletBalance : MOCK_USDAIO_BALANCE;
  const balanceSymbolForAsset = isEthMode ? walletBalanceSymbol : 'USDAIO';
  const isAmountValid =
    Number.isFinite(amount) &&
    amount > 0 &&
    bountyUsdaio > 0 &&
    amount <= balanceForAsset;
  const canConfirm = isAmountValid && paymentStep === 'idle' && isWalletConnected;
  const isReviewBountyConfirmed = Boolean(reviewBounty) || paymentStep === 'confirmed';

  const ethPerOneUsdaio = 1 / EFFECTIVE_USDAIO_PER_ETH;

  const rateDisplayLine = useMemo(() => {
    if (invertRateQuote) {
      return `1 USDAIO ≈ ${ethPerOneUsdaio.toLocaleString(undefined, { maximumSignificantDigits: 8 })} ETH`;
    }
    return `1 ETH ≈ ${EFFECTIVE_USDAIO_PER_ETH.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDAIO`;
  }, [ethPerOneUsdaio, invertRateQuote]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const handleAssetChange = (asset: PaymentAsset) => {
    if (paymentStep !== 'idle' || asset === paymentAsset) return;
    setPaymentAsset(asset);
  };

  const handlePaperFileSelect = (file: File | null) => {
    if (!file) return;

    setPaperFile(file);
  };

  const handlePaperFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handlePaperFileSelect(event.target.files?.[0] ?? null);
  };

  const handlePaperFileRemove = () => {
    setPaperFile(null);
    setIsPaperDragActive(false);
    if (paperFileInputRef.current) {
      paperFileInputRef.current.value = '';
    }
  };

  const handlePaperFileDragOver = (event: DragEvent<HTMLButtonElement>) => {
    if (isPaperSubmitting) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsPaperDragActive(true);
  };

  const handlePaperFileDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsPaperDragActive(false);
  };

  const handlePaperFileDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isPaperSubmitting) return;

    setIsPaperDragActive(false);
    handlePaperFileSelect(event.dataTransfer.files?.[0] ?? null);
  };

  const helperText = useMemo(() => {
    if (!isWalletConnected) return 'Connect your wallet to fund the review bounty.';
    if (!Number.isFinite(bountyUsdaio) || bountyUsdaio <= 0) return 'Enter a valid review bounty amount.';
    if (!Number.isFinite(amount) || amount <= 0) return `Enter a valid ${inputSymbol} amount.`;
    if (amount > balanceForAsset) {
      return `Bounty cannot exceed your ${balanceSymbolForAsset} balance (${balanceForAsset.toFixed(isEthMode ? 4 : 2)} ${balanceSymbolForAsset}).`;
    }
    if (isEthMode) {
      return `Auto-swap ~${ethPayAmount.toFixed(4)} ETH → ${bountyUsdaio.toFixed(2)} USDAIO via ${UNISWAP_V4_HOOK_LABEL}.`;
    }
    return `Room default ${ROOM_BOUNTY_USDAIO[roomId].toFixed(0)} USDAIO — edit amount above.`;
  }, [
    amount,
    balanceForAsset,
    balanceSymbolForAsset,
    bountyUsdaio,
    ethPayAmount,
    inputSymbol,
    isEthMode,
    isWalletConnected,
    roomId,
  ]);

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
        amount: settledUsdaio,
        asset: 'USDAIO',
        network: NETWORK_NAME,
        txHash: nextTxHash,
        paidWith: isEthMode
          ? {
              asset: 'ETH',
              amount,
              rate: MOCK_ETH_TO_USDAIO_RATE,
              poolFeePct: UNISWAP_V4_HOOK_FEE_PCT,
              hook: UNISWAP_V4_HOOK_LABEL,
            }
          : undefined,
      });
    }, 1900));
  };

  const handlePaperSubmit = () => {
    if (!paperFile || isPaperSubmitting) return;

    const paperTitle = fileNameToPaperTitle(paperFile.name) || paperFile.name;

    setScannerImageError(false);
    setIsPaperSubmitting(true);
    timersRef.current.push(window.setTimeout(() => {
      onSubmitPaper(paperTitle, `${paperFile.name} (${formatFileSize(paperFile.size)})`);
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
                  <span>{(reviewBounty?.amount ?? settledUsdaio).toFixed(2)} USDAIO</span>
                </div>
                {reviewBounty?.paidWith && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#2f5d7e]">
                    <Zap size={12} />
                    Auto-swapped from {reviewBounty.paidWith.amount.toFixed(4)} ETH via {reviewBounty.paidWith.hook}
                  </div>
                )}
              </PixelFrame>

                <label className="block text-sm font-bold" htmlFor="paper-file">
                  Paper File
                </label>
                <input
                  ref={paperFileInputRef}
                  id="paper-file"
                  type="file"
                  accept={PAPER_FILE_ACCEPT}
                  disabled={isPaperSubmitting}
                  onChange={handlePaperFileChange}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => paperFileInputRef.current?.click()}
                  onDragOver={handlePaperFileDragOver}
                  onDragLeave={handlePaperFileDragLeave}
                  onDrop={handlePaperFileDrop}
                  disabled={isPaperSubmitting}
                  className="pixel-frame min-h-[6.75rem] w-full px-4 py-4 text-left text-[#503521] transition-transform hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                  aria-describedby="paper-file-help"
                >
                  <PixelFrameChrome
                    round={2}
                    thickness={4}
                    color={paperFile ? '#8ab66b' : isPaperDragActive ? '#83add0' : '#d7b98f'}
                    fillColor={paperFile ? '#f4ffd9' : isPaperDragActive ? '#edf5fa' : '#ffffff'}
                    innerHighlightColor="rgba(255, 255, 255, 0.42)"
                    outerShadowOffsetX={0}
                    outerShadowOffsetY={0}
                    outerShadowColor="transparent"
                  />
                  <span className="relative z-40 flex h-full min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center text-[#2f5d7e]">
                      {paperFile ? <FileText size={34} /> : <Upload size={34} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-bold leading-none">
                        {paperFile ? paperFile.name : 'Choose a file or drop it here'}
                      </span>
                      <span id="paper-file-help" className="mt-2 block text-xs font-bold text-[#6b563f]">
                        {paperFile
                          ? `${formatFileSize(paperFile.size)} · ready to upload`
                          : 'PDF, DOCX, MD, or TXT'}
                      </span>
                    </span>
                  </span>
                </button>
                {paperFile && (
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#2f6f35]">
                    <span className="min-w-0 truncate">
                      Attached: {paperFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={handlePaperFileRemove}
                      disabled={isPaperSubmitting}
                      className="pixel-frame flex h-7 w-7 flex-shrink-0 items-center justify-center text-[#5f211c] transition-transform hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-50 disabled:hover:translate-y-0"
                      aria-label="Remove selected file"
                      title="Remove selected file"
                    >
                      <PixelFrameChrome
                        round={1}
                        thickness={3}
                        color="#9c342d"
                        fillColor="#f0c0b1"
                        innerHighlightColor="rgba(255, 255, 255, 0.24)"
                        outerShadowColor="rgba(95, 33, 28, 0.16)"
                        outerShadowOffsetX={1}
                        outerShadowOffsetY={1}
                      />
                      <X className="relative z-40" size={14} />
                    </button>
                  </div>
                )}

              <button
                type="button"
                onClick={handlePaperSubmit}
                disabled={!paperFile || isPaperSubmitting}
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
                      Upload & Submit Paper
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
                <div className="mt-2 grid gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isEthMode ? 'text-[#2f5d7e]' : 'text-[#9b8161]'
                      }`}
                    >
                      ETH
                    </span>
                    <span className={`text-sm font-bold ${isEthMode ? 'text-[#17384b]' : 'text-[#503521]'}`}>
                      {wallet.isBalanceLoading ? 'Loading…' : walletBalance.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isEthMode ? 'text-[#9b8161]' : 'text-[#2f6f35]'
                      }`}
                    >
                      USDAIO
                    </span>
                    <span className={`text-sm font-bold ${isEthMode ? 'text-[#503521]' : 'text-[#23351f]'}`}>
                      {MOCK_USDAIO_BALANCE.toFixed(2)}
                    </span>
                  </div>
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

        <div className="mb-3">
          <div className="mb-2 flex items-end justify-between gap-2">
            <label className="text-sm font-bold">Pay With</label>
            <span className="text-[10px] uppercase tracking-wider text-[#6b563f]">
              Bounty settles in USDAIO
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['USDAIO', 'ETH'] as const).map((asset) => {
              const isSelected = paymentAsset === asset;
              const tone =
                asset === 'USDAIO'
                  ? {
                      activeFill: '#8fbf7a',
                      activeBorder: '#5f4328',
                      activeText: '#23351f',
                    }
                  : {
                      activeFill: '#ffd7ef',
                      activeBorder: '#e95fb3',
                      activeText: '#76255b',
                    };
              const fill = isSelected ? tone.activeFill : '#fff8e6';
              const border = isSelected ? tone.activeBorder : '#d7b98f';
              const text = isSelected ? tone.activeText : '#7b5835';
              const subtext = isSelected ? `${tone.activeText}cc` : '#9b8161';
              return (
                <button
                  key={asset}
                  type="button"
                  onClick={() => handleAssetChange(asset)}
                  disabled={paymentStep !== 'idle'}
                  aria-pressed={isSelected}
                  className="pixel-frame relative flex items-center gap-2 px-3 py-2 text-left font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                  style={{ color: text }}
                >
                  <PixelFrameChrome
                    round={2}
                    thickness={4}
                    color={border}
                    fillColor={fill}
                    innerHighlightColor={isSelected ? 'rgba(255, 255, 255, 0.36)' : 'rgba(255, 255, 255, 0.5)'}
                    outerShadowColor={isSelected ? 'rgba(80, 53, 33, 0.22)' : 'rgba(80, 53, 33, 0.12)'}
                    outerShadowOffsetX={isSelected ? 3 : 1}
                    outerShadowOffsetY={isSelected ? 3 : 1}
                  />
                  <span className="relative z-40 flex items-center gap-2">
                    {asset === 'USDAIO' ? <Coins size={18} /> : <ArrowRightLeft size={18} />}
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm">{asset}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: subtext }}>
                        {asset === 'USDAIO' ? 'Direct settle' : `Auto-swap · ${UNISWAP_V4_HOOK_LABEL}`}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {!isEthMode ? (
          <>
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
                min={0}
                max={isWalletConnected ? balanceForAsset : undefined}
                step="0.01"
                inputMode="decimal"
                value={Number.isFinite(bountyUsdaio) ? bountyUsdaio : ''}
                onChange={(event) => {
                  const next = parseFloat(event.target.value);
                  if (Number.isFinite(next) && next >= 0) setBountyUsdaio(next);
                }}
                disabled={paymentStep !== 'idle' || !isWalletConnected}
                className="number-input-clean min-w-0 bg-transparent px-4 py-3 text-2xl font-bold text-[#503521] outline-none disabled:opacity-70"
              />
              <span
                className="review-bounty-unit flex items-center justify-center border-l-4 text-lg font-bold"
                style={{
                  borderColor: '#7b5835',
                  backgroundColor: '#e5b45f',
                  color: '#503521',
                }}
              >
                USDAIO
              </span>
            </PixelFrame>
          </>
        ) : null}
        {!isEthMode && (
          <div className={`mb-3 text-xs font-bold ${isAmountValid ? 'text-[#2f6f35]' : 'text-[#9c342d]'}`}>
            {helperText}
          </div>
        )}

        {isEthMode && (
          <PixelFrame
            className="mb-2 p-4"
            color="#e95fb3"
            fillColor="#fff4fb"
            round={2}
            thickness={5}
            outerShadowOffsetX={0}
            outerShadowOffsetY={0}
            outerShadowColor="transparent"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <img
                  src="/assets/ui/brands/uniswap/uniswap.png"
                  alt="Uniswap"
                  className="h-8 w-8 flex-shrink-0 pixelated drop-shadow-[2px_2px_0_rgba(118,37,91,0.2)]"
                  referrerPolicy="no-referrer"
                />
                <span className="min-w-0 leading-none">
                  <span className="block text-xl font-bold text-[#76255b]">
                    {UNISWAP_V4_HOOK_LABEL} Auto-Swap
                  </span>
                  <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-[#9b3f78]">
                    Route Preview
                  </span>
                </span>
              </span>
              <span className="flex-shrink-0 border-2 border-[#e95fb3] bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#76255b]">
                ETH ⇄ USDAIO
              </span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-end gap-2">
              <div className="min-w-0 flex-1 text-left">
                <div className="mb-2 border-l-4 border-[#e95fb3] pl-2 text-sm font-bold uppercase tracking-wider text-[#76255b]">
                  You pay
                </div>
                <PixelFrame
                  className="flex min-h-[3.35rem] items-stretch"
                  color="#e95fb3"
                  fillColor="#ffffff"
                  round={2}
                  thickness={3}
                  outerShadowOffsetX={0}
                  outerShadowOffsetY={0}
                  outerShadowColor="transparent"
                >
                  <input
                    type="number"
                    min={0}
                    step="0.000001"
                    inputMode="decimal"
                    disabled={paymentStep !== 'idle' || !isWalletConnected}
                    value={Number.isFinite(ethPayAmount) ? ethPayAmount : ''}
                    onChange={(event) => {
                      const eth = parseFloat(event.target.value);
                      if (Number.isFinite(eth) && eth >= 0) {
                        setBountyUsdaio(usdaioReceivedForEth(eth));
                      }
                    }}
                    className="number-input-clean min-w-0 flex-1 bg-transparent px-3 py-2 text-xl font-bold text-[#76255b] outline-none disabled:opacity-70"
                    aria-label="ETH amount you pay"
                  />
                  <span className="flex items-center border-l-[3px] border-[#e95fb3] bg-[#ffd7ef] px-2 text-sm font-bold text-[#76255b]">
                    ETH
                  </span>
                </PixelFrame>
              </div>
              <div className="mb-1 flex h-10 w-10 flex-shrink-0 items-center justify-center self-end text-[#e95fb3]">
                <ArrowRightLeft size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 text-right">
                <div className="mb-2 border-r-4 border-[#2f6f35] pr-2 text-sm font-bold uppercase tracking-wider text-[#23351f]">
                  You receive
                </div>
                <PixelFrame
                  className="flex min-h-[3.35rem] items-stretch"
                  color="#6aa76b"
                  fillColor="#ffffff"
                  round={2}
                  thickness={3}
                  outerShadowOffsetX={0}
                  outerShadowOffsetY={0}
                  outerShadowColor="transparent"
                >
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    disabled={paymentStep !== 'idle' || !isWalletConnected}
                    value={Number.isFinite(bountyUsdaio) ? bountyUsdaio : ''}
                    onChange={(event) => {
                      const u = parseFloat(event.target.value);
                      if (Number.isFinite(u) && u >= 0) setBountyUsdaio(u);
                    }}
                    className="number-input-clean min-w-0 flex-1 bg-transparent px-3 py-2 text-xl font-bold text-[#2f6f35] outline-none disabled:opacity-70"
                    aria-label="USDAIO amount you receive"
                  />
                  <span className="flex items-center border-l-[3px] border-[#6aa76b] bg-[#b8dcb8] px-2 text-sm font-bold text-[#23351f]">
                    USDAIO
                  </span>
                </PixelFrame>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInvertRateQuote((v) => !v)}
              aria-pressed={invertRateQuote}
              title="Toggle rate direction"
              className="pixel-frame mt-3 grid w-full cursor-pointer grid-cols-2 gap-2 px-3 py-2 text-left text-[11px] font-bold text-[#76255b] transition-transform hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0.5"
            >
              <PixelFrameChrome
                round={2}
                thickness={3}
                color="#e95fb3"
                fillColor="#fff9fd"
                innerHighlightColor="rgba(255, 255, 255, 0.55)"
                outerShadowColor="rgba(118, 37, 91, 0.14)"
                outerShadowOffsetX={2}
                outerShadowOffsetY={2}
              />
              <span className="relative z-40">Pool fee · {UNISWAP_V4_HOOK_FEE_PCT}%</span>
              <span className="relative z-40 text-right">
                Rate · {rateDisplayLine}
              </span>
            </button>
          </PixelFrame>
        )}
        {isEthMode && (
          <div className={`mb-3 text-right text-xs font-bold ${isAmountValid ? 'text-[#2f6f35]' : 'text-[#9c342d]'}`}>
            {helperText}
          </div>
        )}

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
            <strong className="text-[#503521]">
              {isAmountValid ? settledUsdaio.toFixed(2) : '0.00'} USDAIO
            </strong>
          </div>
          {isEthMode && (
            <div className="mt-1 flex justify-between gap-3">
              <span>You pay (pre-swap)</span>
              <strong className="text-[#503521]">
                {isAmountValid ? amount.toFixed(4) : '0.0000'} ETH
              </strong>
            </div>
          )}
          <div className="mt-1 flex justify-between gap-3">
            <span>Estimated gas fee</span>
            <strong className="text-[#503521]">
              {NETWORK_FEE_NATIVE.toFixed(4)} {NETWORK_FEE_SYMBOL}
            </strong>
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
            {paymentStep === 'idle' && (
              <>
                {isEthMode ? <Zap size={18} /> : null}
                {isEthMode ? 'Swap & Pay Review Bounty' : 'Pay Review Bounty'}
              </>
            )}
            {paymentStep === 'signing' && (
              <>
                <Loader2 size={18} className="animate-spin" />
                {isEthMode ? `Routing through ${UNISWAP_V4_HOOK_LABEL}…` : 'Wallet payment pending'}
              </>
            )}
            {paymentStep === 'confirming' && (
              <>
                <Loader2 size={18} className="animate-spin" />
                {isEthMode ? 'Waiting for swap confirmation' : 'Waiting for payment confirmation'}
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
