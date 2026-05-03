import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import type { Audit, ReviewRoundState, ReviewerNode } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';
import { REVIEWER_COUNT, SCORE_SCALE } from '../utils/reviewScoring';
import { flowRevealItemDelayMs } from '../constants/reviewFlowTiming';
import ReputationMeter from './ReputationMeter';
import { PixelFrameChrome } from './PixelFrame';

interface ReviewerSidePanelProps {
  state: ReviewRoundState;
  reviewer: ReviewerNode;
  roundCompleted?: boolean;
  onClose: () => void;
}

type ReviewerPanelTab = 'summary' | 'thought';

function formatScore(value?: number) {
  return typeof value === 'number' ? value.toLocaleString() : '--';
}

function roleForPhase(state: ReviewRoundState) {
  switch (state.phase) {
    case 'selection':
      return 'Selected reviewer';
    case 'round1':
      return 'Individual proposal reviewer';
    case 'round2':
      return 'Peer auditor and audited reviewer';
    case 'round3':
      return 'Reputation weighted reviewer';
    case 'final':
      return 'Final contributor';
    default:
      return 'Reviewer';
  }
}

function currentWeight(reviewer: ReviewerNode, state: ReviewRoundState, revealCurrentRound = true) {
  if ((state.phase === 'round3' || state.phase === 'final') && revealCurrentRound) return reviewer.round2?.finalWeight;
  if ((state.phase === 'round3' || state.phase === 'final') && !revealCurrentRound) return reviewer.round1?.reviewerWeight;
  if (state.phase === 'round2' && revealCurrentRound) return reviewer.round1?.reviewerWeight;
  if (state.phase === 'round2' && !revealCurrentRound) return reviewer.round0?.reviewerWeight;
  return reviewer.round0?.reviewerWeight;
}

function currentWeightedScore(reviewer: ReviewerNode, state: ReviewRoundState, revealCurrentRound = true) {
  if ((state.phase === 'round3' || state.phase === 'final') && revealCurrentRound) return reviewer.round2?.weightedScore;
  if ((state.phase === 'round3' || state.phase === 'final') && !revealCurrentRound) return reviewer.round1?.weightedScore;
  if (state.phase === 'round2' && revealCurrentRound) return reviewer.round1?.weightedScore;
  if (state.phase === 'round2' && !revealCurrentRound) return reviewer.round0?.weightedScore;
  return reviewer.round0?.weightedScore;
}

function currentConsensus(state: ReviewRoundState, revealCurrentRound = true) {
  if ((state.phase === 'round3' || state.phase === 'final') && revealCurrentRound) return state.round2ConsensusScore;
  if ((state.phase === 'round3' || state.phase === 'final') && !revealCurrentRound) return state.round1ConsensusScore;
  if (state.phase === 'round2' && revealCurrentRound) return state.round1ConsensusScore;
  if (state.phase === 'round2' && !revealCurrentRound) return state.round0ConsensusScore;
  return state.round0ConsensusScore;
}

function reviewerName(id: string, state: ReviewRoundState) {
  return state.reviewers.find((reviewer) => reviewer.id === id)?.name ?? id;
}

export default function ReviewerSidePanel({ state, reviewer, roundCompleted = false, onClose }: ReviewerSidePanelProps) {
  const defaultTab: ReviewerPanelTab = roundCompleted || state.phase === 'selection' ? 'summary' : 'thought';
  const [activeTab, setActiveTab] = useState<ReviewerPanelTab>(defaultTab);
  const thoughtItems = useMemo(() => thoughtFlowItems(state, reviewer), [reviewer, state]);
  const [visibleThoughtCount, setVisibleThoughtCount] = useState(() => (
    roundCompleted ? thoughtItems.length : state.phase === 'selection' ? thoughtItems.length : 0
  ));

  useEffect(() => {
    setActiveTab(roundCompleted || state.phase === 'selection' ? 'summary' : 'thought');
    setVisibleThoughtCount(roundCompleted || state.phase === 'selection' ? thoughtItems.length : 0);

    if (roundCompleted || state.phase === 'selection') return undefined;

    const timers = thoughtItems.map((_, index) => (
      window.setTimeout(() => setVisibleThoughtCount(index + 1), flowRevealItemDelayMs(index))
    ));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reviewer.id, roundCompleted, state.phase, thoughtItems.length]);

  const thoughtFlowComplete = visibleThoughtCount >= thoughtItems.length;
  const revealCurrentRound = roundCompleted || thoughtFlowComplete || state.phase === 'selection';
  const avatar = reviewer.avatar ?? ASSET_PATHS.characters.reviewers[reviewer.id]?.portrait ?? ASSET_PATHS.characters.reviewers[reviewer.id]?.idle;
  const weight = currentWeight(reviewer, state, revealCurrentRound);
  const weightedScore = currentWeightedScore(reviewer, state, revealCurrentRound);
  const consensus = currentConsensus(state, revealCurrentRound);
  const proposalScore = reviewer.proposalScore;
  const impact = typeof proposalScore === 'number' && typeof consensus === 'number'
    ? proposalScore - consensus
    : undefined;
  const currentScoreLabel = revealCurrentRound
    ? formatScore(proposalScore)
    : state.phase === 'round1'
      ? 'Pending'
      : formatScore(proposalScore);

  return (
    <section className="review-room-activity-panel pixel-box warm-panel relative flex h-full min-h-0 w-full flex-col overflow-hidden p-4 text-[#202528]">
      <PixelFrameChrome round={2} />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-40 flex h-8 w-8 items-center justify-center border-2 border-[#7b5835] bg-[#e5b45f] text-[#503521] transition-transform hover:-translate-y-0.5"
        aria-label="Close reviewer details"
      >
        <X size={16} />
      </button>

      <div className="relative z-30 flex min-h-0 flex-1 flex-col">
        <header className="mb-3 flex items-start gap-3 border-b-2 border-[#d7b98f] pb-3 pr-8">
          {avatar && (
            <img
              src={avatar}
              alt=""
              aria-hidden="true"
              className="h-16 w-16 shrink-0 object-contain pixelated"
            />
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#2f5d7e]">Reviewer Panel</div>
            <h2 className="mt-1 truncate text-xl font-bold leading-tight text-[#503521]">{reviewer.name}</h2>
            <div className="mt-1 inline-flex border-2 border-[#d7b98f] bg-[#fffef3] px-2 py-0.5 text-[9px] font-bold uppercase text-[#6b563f]">
              {roleForPhase(state)}
            </div>
          </div>
        </header>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>
            Summary
          </TabButton>
          <TabButton active={activeTab === 'thought'} onClick={() => setActiveTab('thought')}>
            Thought Flow
          </TabButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'summary' ? (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="space-y-3"
              >
                <Section title="Summary">
                  <div className="grid grid-cols-2 gap-2">
                    <Info label="Current Score" value={currentScoreLabel} />
                    <Info label="Current Weight" value={revealCurrentRound ? formatScore(weight) : formatPendingPrevious(weight)} />
                  </div>
                  {!revealCurrentRound && (
                    <div className="mt-2 border border-dashed border-[#d7b98f] bg-[#fffef3] px-2 py-2 text-[10px] font-bold uppercase leading-snug text-[#8c745b]">
                      Thought flow in progress. Round values update when this analysis completes.
                    </div>
                  )}
                  <p className="mt-2 border border-[#d7b98f] bg-[#fffef3] px-2 py-2 text-[11px] leading-snug text-[#5f4328]">
                    {reviewer.reviewSummary}
                  </p>
                </Section>

                <Section title="Score Breakdown">
                  <div className="grid grid-cols-2 gap-2">
                    <Info label="proposalScore" value={formatScore(reviewer.proposalScore)} />
                    <Info label="currentWeight" value={revealCurrentRound ? formatScore(weight) : formatPendingPrevious(weight)} />
                    <Info label="weightedScore" value={revealCurrentRound ? formatScore(weightedScore) : formatPendingPrevious(weightedScore)} />
                    <Info
                      label="Consensus impact"
                      value={revealCurrentRound ? formatSigned(impact) : '--'}
                      tone={impact && impact < 0 ? 'negative' : 'positive'}
                    />
                  </div>
                </Section>

                <RoundSpecificSummary
                  state={state}
                  reviewer={reviewer}
                  revealCurrentRound={revealCurrentRound}
                />
              </motion.div>
            ) : (
              <motion.div
                key="thought"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <ThoughtFlowDetails items={thoughtItems} visibleCount={visibleThoughtCount} complete={thoughtFlowComplete} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-2 px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-transform hover:-translate-y-0.5 ${
        active
          ? 'border-[#2f5d7e] bg-[#d9f7ff] text-[#17384b]'
          : 'border-[#d7b98f] bg-[#fffef3] text-[#6b563f]'
      }`}
    >
      {children}
    </button>
  );
}

function RoundSpecificSummary({
  state,
  reviewer,
  revealCurrentRound,
}: {
  state: ReviewRoundState;
  reviewer: ReviewerNode;
  revealCurrentRound: boolean;
}) {
  if (state.phase === 'selection') {
    return (
      <Section title="Round-specific Details">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Info label="scale" value={`0-${SCORE_SCALE.toLocaleString()}`} />
          <Info label="selected" value={`${state.selectedReviewerIds.length}/${REVIEWER_COUNT}`} />
        </div>
        <p className="text-[11px] leading-snug text-[#5f4328]">
          This reviewer was selected from the upload-triggered candidate pool and will participate in all three rounds.
        </p>
      </Section>
    );
  }

  if (state.phase === 'round1') {
    return (
      <Section title="Round-specific Details">
        <div className="grid grid-cols-2 gap-2">
          <Info label="reviewerWeight" value={revealCurrentRound ? '10,000' : '--'} />
          <Info label="weightedScore" value={revealCurrentRound ? formatScore(reviewer.round0?.weightedScore) : '--'} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-[#5f4328]">
          Independent proposal review. This round uses equal reviewerWeight and the consensus is the median proposal score.
        </p>
      </Section>
    );
  }

  if (state.phase === 'round2') {
    return <RoundTwoDetails state={state} reviewer={reviewer} revealCurrentRound={revealCurrentRound} />;
  }

  return <RoundThreeDetails reviewer={reviewer} revealCurrentRound={revealCurrentRound} />;
}

function RoundTwoDetails({
  state,
  reviewer,
  revealCurrentRound,
}: {
  state: ReviewRoundState;
  reviewer: ReviewerNode;
  revealCurrentRound: boolean;
}) {
  const incomingAudits = state.audits.filter((audit) => audit.toReviewerId === reviewer.id);
  const outgoingAudits = state.audits.filter((audit) => audit.fromReviewerId === reviewer.id);

  return (
    <Section title="Round-specific Details">
      <div className="grid grid-cols-2 gap-2">
        <Info label="auditScore" value={revealCurrentRound ? formatScore(reviewer.round1?.auditScore) : '--'} />
        <Info label="normalizedQuality" value={revealCurrentRound ? formatScore(reviewer.round1?.normalizedQuality) : '--'} />
        <Info label="reliability" value={revealCurrentRound ? formatScore(reviewer.round1?.reliability) : '--'} />
        <Info label="contribution" value={revealCurrentRound ? formatScore(reviewer.round1?.contribution) : '--'} />
        <Info label="reviewerWeight" value={revealCurrentRound ? formatScore(reviewer.round1?.reviewerWeight) : formatPendingPrevious(reviewer.round0?.reviewerWeight)} />
        <Info label="Audit Quorum" value={`${state.acceptedAuditCount}/${state.auditQuorum}`} />
      </div>

      {revealCurrentRound ? (
        <>
          <AuditList title="Incoming audits" audits={incomingAudits} state={state} reviewerDirection="from" />
          <AuditList title="Outgoing audits" audits={outgoingAudits} state={state} reviewerDirection="to" />
        </>
      ) : (
        <div className="mt-3 border border-dashed border-[#d7b98f] bg-[#fffef3] px-2 py-2 text-[10px] font-bold uppercase leading-snug text-[#8c745b]">
          Audit details pending. They appear after the thought flow completes.
        </div>
      )}

      <p className="mt-2 text-[11px] leading-snug text-[#5f4328]">
        Audit quorum {state.auditQuorum}/{state.auditQuorum} closes the round. Accepted audits calculate quality and reliability; ignored audits are not used.
      </p>
    </Section>
  );
}

function RoundThreeDetails({ reviewer, revealCurrentRound }: { reviewer: ReviewerNode; revealCurrentRound: boolean }) {
  const reputation = reviewer.reputation;

  return (
    <Section title="Round-specific Details">
      <div className="mb-2">
        <ReputationMeter value={reviewer.round2?.reputationScore ?? 0} label="Reputation" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Info label="round1Weight" value={formatScore(reviewer.round2?.round1Weight)} />
        <Info label="sample count" value={reputation?.sampleCount ?? '--'} />
        <Info label="reportQuality" value={revealCurrentRound ? formatScore(reputation?.reportQuality) : '--'} />
        <Info label="auditReliability" value={revealCurrentRound ? formatScore(reputation?.auditReliability) : '--'} />
        <Info label="finalContribution" value={revealCurrentRound ? formatScore(reputation?.finalContribution) : '--'} />
        <Info label="protocolCompliance" value={revealCurrentRound ? formatScore(reputation?.protocolCompliance) : '--'} />
        <Info label="reputationScore" value={revealCurrentRound ? formatScore(reviewer.round2?.reputationScore) : '--'} />
        <Info label="finalWeight" value={revealCurrentRound ? formatScore(reviewer.round2?.finalWeight) : formatPendingPrevious(reviewer.round1?.reviewerWeight)} />
      </div>
      {reputation?.sampleCount === 0 && (
        <div className="mt-2 border-2 border-[#e5b45f] bg-[#fff8e6] px-2 py-1.5 text-[10px] font-bold uppercase text-[#6b563f]">
          No prior samples. Current node reputation baseline applied.
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-[#5f4328]">
        Reputation adjusted final weight is applied to the proposal score for the final weighted median.
      </p>
    </Section>
  );
}

function ThoughtFlowDetails({
  items,
  visibleCount,
  complete,
}: {
  items: ReturnType<typeof thoughtFlowItems>;
  visibleCount: number;
  complete: boolean;
}) {
  return (
    <div className="relative space-y-3 pl-1 pr-1">
      <span className="absolute bottom-3 left-[9px] top-2 w-px bg-[#d7b98f]" aria-hidden="true" />
      <AnimatePresence initial={false}>
        {items.slice(0, visibleCount).map((item, index) => (
          <motion.div
            key={`${item.title}-${index}`}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-2"
          >
            <span className="relative z-10 mt-1 flex h-4 w-4 items-center justify-center border border-[#d7b98f] bg-[#e5b45f] font-mono text-[8px] font-bold text-[#503521] shadow-[2px_2px_0_rgba(80,53,33,0.16)]">
              {index + 1}
            </span>
            <span className="min-w-0 bg-[#fffef3]/70 px-2 py-1.5">
              <strong className="block text-[10px] uppercase tracking-wider text-[#2f5d7e]">{item.title}</strong>
              <span className="mt-0.5 block text-[10px] leading-snug text-[#5f4328]">{item.body}</span>
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
      {!complete && (
        <motion.div
          className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="relative z-10 mt-1 h-4 w-4 border border-dashed border-[#d7b98f] bg-[#fffef3]" />
          <span className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8c745b]">
            Thinking...
          </span>
        </motion.div>
      )}
    </div>
  );
}

function thoughtFlowItems(state: ReviewRoundState, reviewer: ReviewerNode) {
  if (state.phase === 'selection') {
    return [
      { title: 'Selection locked', body: 'Chosen by the VRF-style selection stage and reserved for all review rounds.' },
      { title: 'Ready state', body: 'Proposal score, audit duties, and reputation weighting are prepared before Round 1 starts.' },
    ];
  }

  if (state.phase === 'round1') {
    return [
      { title: 'Individual Review', body: 'Reads the submission alone and separates evidence quality from presentation polish.' },
      { title: 'Proposal score', body: `Submits ${formatScore(reviewer.proposalScore)} with equal reviewerWeight 10,000.` },
      { title: 'Median anchor', body: 'Round 1 consensus uses the median of the three independent proposal scores.' },
    ];
  }

  if (state.phase === 'round2') {
    return [
      { title: 'Peer Audit', body: 'Compares peer review outputs at the shared table and excludes self-audits.' },
      { title: 'Quality check', body: `Incoming audit median is ${formatScore(reviewer.round1?.auditScore)}.` },
      { title: 'Reliability check', body: `Outgoing audits are compared against peer medians; reliability is ${formatScore(reviewer.round1?.reliability)}.` },
      { title: 'Weight update', body: `Contribution becomes reviewerWeight ${formatScore(reviewer.round1?.reviewerWeight)}.` },
    ];
  }

  return [
    { title: 'Reputation Weighted', body: 'Returns to a private seat and applies long-term reputation to the audit-based weight.' },
    { title: 'Reputation sample', body: `Reputation score is ${formatScore(reviewer.round2?.reputationScore)} from sample count ${reviewer.reputation?.sampleCount ?? '--'}.` },
    { title: 'Final weight', body: `Round 2 weight ${formatScore(reviewer.round2?.round1Weight)} becomes finalWeight ${formatScore(reviewer.round2?.finalWeight)}.` },
    { title: 'Final contribution', body: `Weighted score is ${formatScore(reviewer.round2?.weightedScore)} before weighted median consensus.` },
  ];
}

function AuditList({
  title,
  audits,
  state,
  reviewerDirection,
}: {
  title: string;
  audits: Audit[];
  state: ReviewRoundState;
  reviewerDirection: 'from' | 'to';
}) {
  return (
    <div className="mt-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#2f5d7e]">{title}</div>
      {audits.length === 0 ? (
        <div className="mt-1 border border-dashed border-[#d7b98f] px-2 py-1.5 text-[10px] text-[#8c745b]">
          No incoming audits or insufficient audit data.
        </div>
      ) : (
        <div className="mt-1 space-y-1">
          {audits.sort((a, b) => a.arrivalOrder - b.arrivalOrder).map((audit) => (
            <div
              key={audit.id}
              className={`border px-2 py-1.5 text-[10px] ${
                audit.status === 'accepted'
                  ? 'border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]'
                  : 'border-[#d7b98f] bg-[#fffef3] text-[#8c745b]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">
                  {reviewerDirection === 'from'
                    ? reviewerName(audit.fromReviewerId, state)
                    : reviewerName(audit.toReviewerId, state)}
                </span>
                <span className="uppercase">{audit.status}</span>
              </div>
              <div className="mt-0.5 font-mono font-bold">{audit.score.toLocaleString()} · #{audit.arrivalOrder}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-2 border-[#d7b98f] bg-[#fff8e6] p-3">
      <h3 className="mb-2 border-b border-[#d7b98f] pb-1 text-[11px] font-bold uppercase tracking-wider text-[#503521]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Info({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'positive' | 'negative';
}) {
  const toneClass = tone === 'positive' ? 'text-[#2f6f35]' : tone === 'negative' ? 'text-[#9c342d]' : 'text-[#2f5d7e]';

  return (
    <div className="border border-[#d7b98f] bg-[#fffef3] px-2 py-1.5">
      <div className="truncate text-[8px] font-bold uppercase tracking-wider text-[#8c745b]">{label}</div>
      <strong className={`mt-0.5 block truncate font-mono text-[12px] ${toneClass}`}>{value}</strong>
    </div>
  );
}

function formatSigned(value?: number) {
  if (typeof value !== 'number') return '--';
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
}

function formatPendingPrevious(value?: number) {
  return typeof value === 'number' ? `${value.toLocaleString()} prev` : '--';
}
