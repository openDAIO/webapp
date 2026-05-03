import type { DaioData, DaioRoundAggregate } from '../services/daio/useDaioData';
import { AUDIT_QUORUM } from '../utils/reviewScoring';
import { PixelFrameChrome } from './PixelFrame';

interface ContractStatePanelProps {
  daioData: DaioData;
  requestId?: string | null;
}

function formatBigInt(value: bigint, fallback = '--') {
  return value > 0n ? value.toString() : fallback;
}

function formatScore(value: bigint) {
  return `${(Number(value) / 100).toFixed(2)}%`;
}

function RoundRow({ label, round }: { label: string; round: DaioRoundAggregate }) {
  const status = round.closed ? (round.aborted ? 'aborted' : 'closed') : 'open';
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.25rem] items-center gap-2 border border-[#d7b98f] bg-[#fffef3] px-2 py-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#6b563f]">{label}</span>
      <span className="min-w-0 font-mono text-[10px] font-bold text-[#2f5d7e]">
        score {formatScore(round.score)} · weight {formatBigInt(round.totalWeight, '0')}
      </span>
      <span className={`text-right text-[9px] font-bold uppercase ${
        round.closed ? 'text-[#2f6f35]' : 'text-[#9c6a2e]'
      }`}>
        {status}
      </span>
    </div>
  );
}

export default function ContractStatePanel({ daioData, requestId }: ContractStatePanelProps) {
  if (!requestId || daioData.latestRequestId <= 0n) return null;

  const lifecycle = daioData.requestLifecycle;
  const phaseProgress = daioData.requestPhase && daioData.requestPhase.quorum > 0n
    ? `${daioData.requestPhase.count.toString()}/${daioData.requestPhase.quorum.toString()}`
    : '--';
  const auditReportQuorum = Math.max(AUDIT_QUORUM, Number(daioData.requestConfig?.auditRevealQuorum ?? 0n));
  const auditReportProgress = `${Math.min(daioData.auditReportCount, auditReportQuorum)}/${auditReportQuorum}`;
  const reviewReady = daioData.roundAggregates.review.closed;
  const auditReady = daioData.roundAggregates.auditConsensus.closed;
  const finalReady = daioData.roundAggregates.reputationFinal.closed;

  return (
    <section className="pixel-box warm-panel relative p-3 text-[#503521]">
      <PixelFrameChrome round={2} />
      <div className="relative z-30">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#2f5d7e]">Contract State</div>
            <h3 className="mt-0.5 text-lg font-bold leading-tight">Request #{requestId}</h3>
          </div>
          <div className="border-2 border-[#86a7b8] bg-[#edf5f8] px-2 py-1 text-right">
            <div className="text-[8px] font-bold uppercase text-[#6b563f]">status</div>
            <div className="font-mono text-[10px] font-bold text-[#17384b]">
              {lifecycle?.statusName ?? daioData.latestRequestStatusName}
            </div>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-4 gap-1.5">
          <Info label="attempt" value={lifecycle?.retryCount.toString() ?? daioData.requestAttempt.toString()} />
          <Info label="agents" value={String(daioData.registeredReviewers.length)} />
          <Info label="reviewers" value={String(daioData.reviewParticipants.length)} />
          <Info label="audit q" value={auditReportProgress} />
        </div>
        {phaseProgress !== '--' && (
          <div className="mb-2 border border-[#d7b98f] bg-[#fffef3] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#6b563f]">
            Reader phase progress <span className="font-mono text-[#2f5d7e]">{phaseProgress}</span>
          </div>
        )}

        <div className="space-y-1">
          <RoundRow label="Round 0" round={daioData.roundAggregates.review} />
          <RoundRow label="Round 1" round={daioData.roundAggregates.auditConsensus} />
          <RoundRow label="Round 2" round={daioData.roundAggregates.reputationFinal} />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <Pill active={reviewReady}>Review</Pill>
          <Pill active={auditReady}>Audit</Pill>
          <Pill active={finalReady}>Final</Pill>
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d7b98f] bg-[#fffef3] px-2 py-1">
      <div className="text-[8px] font-bold uppercase tracking-wider text-[#8c745b]">{label}</div>
      <strong className="block truncate font-mono text-[11px] text-[#2f5d7e]">{value}</strong>
    </div>
  );
}

function Pill({ active, children }: { active: boolean; children: string }) {
  return (
    <span className={`border px-1.5 py-1 text-[8px] font-bold uppercase tracking-wider ${
      active
        ? 'border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]'
        : 'border-[#d7b98f] bg-[#fffef3] text-[#8c745b]'
    }`}>
      {children}
    </span>
  );
}
