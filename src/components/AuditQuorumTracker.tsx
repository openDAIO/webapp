import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { Audit, ReviewerNode } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';
import { flowRevealItemDelayMs } from '../constants/reviewFlowTiming';

interface AuditQuorumTrackerProps {
  audits: Audit[];
  reviewers: ReviewerNode[];
  quorum: number;
  isActive: boolean;
  startDelayMs?: number;
  /** On-chain submitted audit report count from DAIOInfoReader.auditTargets(). */
  onChainAuditCount?: number;
}

function reviewerName(id: string, reviewers: ReviewerNode[]) {
  return reviewers.find((reviewer) => reviewer.id === id)?.name ?? id;
}

function reviewerAvatarFallback(id: string, reviewers: ReviewerNode[]) {
  const reviewer = reviewers.find((candidate) => candidate.id === id);
  return reviewer?.avatar ?? ASSET_PATHS.characters.reviewers[id]?.portrait ?? ASSET_PATHS.characters.reviewers[id]?.idle;
}

function reviewerFace(id: string) {
  return `/assets/characters/reviewers/faces/${id}.png`;
}

export default function AuditQuorumTracker({ audits, reviewers, quorum, isActive, startDelayMs = 0, onChainAuditCount }: AuditQuorumTrackerProps) {
  const acceptedAudits = useMemo(
    () => audits
      .filter((audit) => audit.status === 'accepted')
      .sort((a, b) => a.arrivalOrder - b.arrivalOrder),
    [audits],
  );
  const ignoredAudits = useMemo(
    () => audits
      .filter((audit) => audit.status !== 'accepted')
      .sort((a, b) => a.arrivalOrder - b.arrivalOrder),
    [audits],
  );
  const [visibleAcceptedCount, setVisibleAcceptedCount] = useState(isActive ? 0 : acceptedAudits.length);

  useEffect(() => {
    if (!isActive) {
      setVisibleAcceptedCount(acceptedAudits.length);
      return undefined;
    }

    setVisibleAcceptedCount(0);
    const timers = acceptedAudits.map((_, index) => (
      window.setTimeout(() => setVisibleAcceptedCount(index + 1), startDelayMs + flowRevealItemDelayMs(index))
    ));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [acceptedAudits, isActive, startDelayMs]);

  // Prefer on-chain count when available (source of truth); fall back to local simulation
  const displayCount = onChainAuditCount !== undefined
    ? Math.min(onChainAuditCount, quorum)
    : Math.min(visibleAcceptedCount, quorum);
  const isComplete = displayCount >= quorum;
  const visibleAcceptedAudits = onChainAuditCount !== undefined
    ? acceptedAudits.slice(0, displayCount)
    : acceptedAudits.slice(0, Math.min(visibleAcceptedCount, quorum));
  const visibleIgnoredAudits = onChainAuditCount === undefined ? ignoredAudits : [];

  return (
    <section className="scoreboard-panel p-3 text-left">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#9ff8ff]">Audit Quorum</div>
          <div className="mt-1 font-mono text-2xl font-bold leading-none text-[#ffd98a]">
            {displayCount}/{quorum}
            {onChainAuditCount !== undefined && (
              <span className="ml-1.5 text-[9px] font-normal text-[#9ff8ff] opacity-70">on-chain</span>
            )}
          </div>
        </div>
        <div className={`border-2 px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
          isComplete
            ? 'border-[#9effc2] bg-[#183224] text-[#9effc2]'
            : 'border-[#f1c46d] bg-[#332b1f] text-[#ffd98a]'
        }`}>
          {isComplete ? 'Quorum Complete' : `First ${quorum} reports`}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {Array.from({ length: quorum }, (_, index) => {
          const audit = visibleAcceptedAudits[index];
          const isVisible = Boolean(audit);

          if (!isVisible || !audit) {
            return (
              <div
                key={audit?.id ?? `audit-slot-${index}`}
                className="h-[54px] border-2 border-dashed border-[#566b7a] bg-[#17212c]/70"
                aria-label={`Empty audit slot ${index + 1}`}
              />
            );
          }

          return (
            <div
              key={audit.id}
              className={`grid grid-cols-[54px_20px_54px_minmax(58px,1fr)] items-center gap-1 border-2 px-2 py-1.5 text-[9px] leading-tight ${
                'border-[#7ff4ff] bg-[#172a3a] text-[#d9f7ff]'
              }`}
            >
              <ReviewerSlot reviewerId={audit.fromReviewerId} reviewers={reviewers} />
              <div className="flex flex-col items-center justify-center gap-0.5">
                <CheckCircle2 size={11} />
                <ArrowRight size={13} />
              </div>
              <ReviewerSlot reviewerId={audit.toReviewerId} reviewers={reviewers} />
              <div className="min-w-0 text-right">
                <div className="truncate text-[8px] font-bold uppercase tracking-wider">
                  Audit #{audit.arrivalOrder}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] font-bold text-[#ffd98a]">
                  {audit.score.toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visibleIgnoredAudits.length > 0 && (
        <div className="mt-2 border border-dashed border-[#566b7a] bg-[#17212c] px-2 py-1.5 text-[9px] leading-tight text-[#9eb6c3]">
          <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[#ffb3aa]">
            <XCircle size={11} />
            Later audits ignored
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {visibleIgnoredAudits.map((audit) => (
              <span key={audit.id} className="border border-[#566b7a] px-1 py-0.5">
                #{audit.arrivalOrder} {reviewerName(audit.fromReviewerId, reviewers)} -&gt; {reviewerName(audit.toReviewerId, reviewers)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewerSlot({ reviewerId, reviewers }: { reviewerId?: string; reviewers: ReviewerNode[] }) {
  const name = reviewerId ? reviewerName(reviewerId, reviewers) : '--';
  const avatar = reviewerId ? reviewerFace(reviewerId) : undefined;
  const fallbackAvatar = reviewerId ? reviewerAvatarFallback(reviewerId, reviewers) : undefined;

  return (
    <div className="flex min-w-0 flex-col items-center">
      {avatar ? (
        <img
          src={avatar}
          alt=""
          aria-hidden="true"
          className="h-7 w-7 object-contain pixelated"
          onError={(event) => {
            event.currentTarget.onerror = null;
            if (fallbackAvatar) {
              event.currentTarget.src = fallbackAvatar;
            }
          }}
        />
      ) : (
        <span className="h-7 w-7 border border-[#566b7a] bg-[#17212c]" />
      )}
      <span className="mt-0.5 w-full truncate text-center text-[7px] font-bold uppercase leading-none">
        {name}
      </span>
    </div>
  );
}
