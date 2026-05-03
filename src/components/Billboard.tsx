
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, CircleAlert } from 'lucide-react';
import { AICharacter, FinalEvaluationSummary, NodeEvaluationResult, ReviewRoundState, SimulationPhase } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';
import { AUDIT_VRF_PROBABILITY, REVIEW_VRF_PROBABILITY, REVIEWER_COUNT } from '../utils/reviewScoring';
import StandardDeviationChart from './StandardDeviationChart';
import NodeResultsTable from './NodeResultsTable';
import RoundProgressStepper from './RoundProgressStepper';

interface BillboardProps {
  characters: AICharacter[];
  visible: boolean;
  showDetails?: boolean;
  finalSummary?: FinalEvaluationSummary;
  finalNodeCount?: number;
  finalNodes?: NodeEvaluationResult[];
  selectedNodeId?: string | null;
  onInspectNode?: (node: NodeEvaluationResult) => void;
  phase?: SimulationPhase;
  currentRound?: number;
  reviewRoundState?: ReviewRoundState | null;
  action?: ReactNode;
}

function formatNumber(value: number) {
  return value.toFixed(1);
}

function activeRoundFromPhase(phase?: SimulationPhase, currentRound = 1) {
  switch (phase) {
    case 'QUEUED':
      return 1;
    case 'MOVING_TO_ROOMS':
    case 'ROUND_1':
      return 1;
    case 'ROUND_2_STARTING':
    case 'ROUND_2':
      return 2;
    case 'ROUND_3_STARTING':
    case 'ROUND_3':
      return 3;
    default:
      return currentRound;
  }
}

function titleForPhase(phase?: SimulationPhase, currentRound = 1) {
  switch (phase) {
    case 'QUEUED':
      return 'Queued';
    case 'SELECTION':
      return 'Selection';
    case 'MOVING_TO_ROOMS':
    case 'ROUND_1':
      return 'Round 01';
    case 'ROUND_2_STARTING':
    case 'ROUND_2':
      return 'Round 02';
    case 'ROUND_3_STARTING':
    case 'ROUND_3':
      return 'Round 03';
    case 'FINALIZING':
      return 'Finalizing';
    case 'EVALUATED':
      return 'Final Result';
    default:
      return `Round ${String(currentRound).padStart(2, '0')}`;
  }
}

function resultKeyLabel(value: number | 'final') {
  return value === 'final' ? 'FINAL' : `ROUND ${String(value).padStart(2, '0')}`;
}

export default function Billboard({
  characters,
  visible,
  showDetails,
  finalSummary,
  finalNodeCount,
  finalNodes = [],
  selectedNodeId,
  onInspectNode,
  phase,
  currentRound,
  reviewRoundState,
  action,
}: BillboardProps) {
  const isFinal = Boolean(finalSummary);
  const nodeCount = finalNodeCount ?? characters.length;
  const isChartVisible = isFinal || (showDetails ?? true);
  const [showRangeTooltip, setShowRangeTooltip] = useState(false);
  const [showNodeResults, setShowNodeResults] = useState(false);
  const billboardRef = useRef<HTMLDivElement | null>(null);
  const hasNodeResults = isFinal && finalNodes.length > 0 && Boolean(onInspectNode);
  const bountyWinnerNodes = finalNodes.filter((node) => node.bountyRewardAmount > 0);
  const isSelection = phase === 'SELECTION' || reviewRoundState?.phase === 'selection';
  const latestResultRound = characters.reduce((latest, character) => {
    const characterLatest = character.scoreHistory.reduce((max, score) => Math.max(max, score.round), 0);
    return Math.max(latest, characterLatest);
  }, 0);
  const activeRound = activeRoundFromPhase(phase, currentRound);
  const latestResultKey: number | 'final' = isFinal ? 'final' : latestResultRound;
  const resultKeys = [
    ...Array.from({ length: latestResultRound }, (_, index) => index + 1)
      .filter((round) => !(isFinal && round === 3)),
    ...(isFinal ? (['final'] as const) : []),
  ];
  const [selectedResultKey, setSelectedResultKey] = useState<number | 'final'>(latestResultKey || 1);
  const [highlightConsensus, setHighlightConsensus] = useState(false);
  const isFinalizing = phase === 'FINALIZING';
  const isRoundInProgress = !isFinal && !isSelection && (activeRound > latestResultRound || isFinalizing);
  const shouldShowEmptyActiveRound = !isFinal && !isSelection && latestResultRound === 0;
  const displayResultKey = shouldShowEmptyActiveRound
    ? activeRound
    : resultKeys.includes(selectedResultKey)
      ? selectedResultKey
      : latestResultKey || activeRound;
  const selectedResultIndex = resultKeys.findIndex((key) => key === displayResultKey);
  const canBrowseResults = resultKeys.length > 1;
  const progressPhase: ReviewRoundState['phase'] = reviewRoundState?.phase ?? (isFinal ? 'final' : isSelection ? 'selection' : activeRound === 2 ? 'round2' : activeRound === 3 ? 'round3' : 'round1');

  useEffect(() => {
    if (!showNodeResults) return undefined;
    if (selectedNodeId) return undefined;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (billboardRef.current?.contains(target)) return;
      setShowNodeResults(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [selectedNodeId, showNodeResults]);

  useEffect(() => {
    if (isFinal) {
      setShowNodeResults(false);
    }
  }, [isFinal]);

  useEffect(() => {
    if (!latestResultKey) return;
    setSelectedResultKey(latestResultKey);
    setHighlightConsensus(true);
    const timer = window.setTimeout(() => setHighlightConsensus(false), 1200);
    return () => window.clearTimeout(timer);
  }, [latestResultKey]);

  const showPreviousResult = () => {
    if (!canBrowseResults) return;
    const currentIndex = resultKeys.findIndex((key) => key === displayResultKey);
    setSelectedResultKey(resultKeys[Math.max(0, currentIndex - 1)]);
  };

  const showNextResult = () => {
    if (!canBrowseResults) return;
    const currentIndex = resultKeys.findIndex((key) => key === displayResultKey);
    setSelectedResultKey(resultKeys[Math.min(resultKeys.length - 1, currentIndex + 1)]);
  };

  const chart = (
    <motion.div
      layout
      className={`mx-auto w-full ${isFinal ? 'max-w-[300px]' : isRoundInProgress ? 'max-w-[280px]' : 'max-w-[420px]'}`}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
    >
      <StandardDeviationChart
        characters={characters}
        visible={isChartVisible}
        prominent
        stickyDomain={false}
        averageBoxed={false}
        scoreboard
        displayRound={displayResultKey}
        analysisRoundLabel={resultKeyLabel(displayResultKey)}
        highlightUpdate={highlightConsensus}
        compact={isRoundInProgress}
        averageDetail={finalSummary ? (
          <span className="relative flex items-center justify-center gap-1 font-mono text-[13px] font-bold leading-none text-[#ffd98a]">
            <button
              type="button"
              aria-label="Accepted Range"
              onClick={() => setShowRangeTooltip((current) => !current)}
              className="relative inline-flex h-4 w-4 items-center justify-center text-[#9ff8ff] hover:text-[#d9f7ff]"
            >
              <CircleAlert size={12} />
            </button>
            <span>
              {formatNumber(finalSummary.outlierThresholdLow)}-{formatNumber(finalSummary.outlierThresholdHigh)}
            </span>
            {showRangeTooltip && (
              <span className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap border-2 border-[#9ff8ff] bg-[#172a3a] px-2 py-1 text-[10px] tracking-wider text-[#d9f7ff] shadow-[2px_2px_0_rgba(0,0,0,0.36)]">
                Accepted Range
              </span>
            )}
          </span>
        ) : undefined}
      />
    </motion.div>
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={billboardRef}
          layout
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 220 }}
          className={`absolute left-1/2 top-2 z-[70] w-full -translate-x-1/2 px-2 ${
            isFinal
              ? (showNodeResults ? 'max-w-[940px]' : 'max-w-[560px]')
              : isSelection
                ? 'max-w-[520px]'
              : isRoundInProgress
                ? 'max-w-[380px]'
                : 'max-w-xl'
          }`}
        >
          <span className="scoreboard-hanger left-[30%]" aria-hidden="true" />
          <span className="scoreboard-hanger right-[30%]" aria-hidden="true" />
          <div className={`scoreboard-shell text-center ${isRoundInProgress ? 'p-2.5' : 'p-4'}`}>
            {reviewRoundState && (
              <div className="mb-2">
                <RoundProgressStepper phase={progressPhase} />
              </div>
            )}
            <div className={`flex min-w-0 items-center justify-center gap-2 sm:gap-3 ${isRoundInProgress ? 'mb-1.5' : 'mb-3'}`}>
              <div className={`scoreboard-side-light hidden items-center justify-between px-2 sm:flex ${isRoundInProgress ? 'h-7' : 'h-10'}`}>
                <span className="scoreboard-led" />
                <span className="h-2 w-1/2 bg-[#9ff8ff]" />
              </div>
              <motion.h2
                layout
                className={`scoreboard-title min-w-0 max-w-full whitespace-nowrap font-bold uppercase leading-none tracking-widest ${
                  isRoundInProgress ? 'px-3 py-1.5 text-[17px] sm:px-4 sm:text-[22px]' : 'px-4 py-2 text-[20px] sm:px-6 sm:text-[30px]'
                }`}
              >
                {isFinal ? (
                  'Final Result'
                ) : (
                  <>
                    {titleForPhase(phase, activeRound)}
                    {!isSelection && (
                      <span className="scoreboard-loading-dots" aria-hidden="true">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    )}
                  </>
                )}
              </motion.h2>
              <div className={`scoreboard-side-light hidden items-center justify-between px-2 sm:flex ${isRoundInProgress ? 'h-7' : 'h-10'}`}>
                <span className="h-2 w-1/2 bg-[#9ff8ff]" />
                <span className="scoreboard-led" />
              </div>
            </div>

            <motion.div
              layout
              className={`grid items-stretch ${
                isFinal
                  ? 'gap-3 md:grid-cols-[minmax(0,1fr)_176px]'
                  : 'grid-cols-1 gap-2'
              }`}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              <motion.div key="chart-column" layout className="min-w-0 p-2">
                {isSelection ? (
                  <SelectionRulesPanel />
                ) : (
                  <div className="relative pb-8">
                    {chart}
                    {canBrowseResults && (
                      <div className="pointer-events-none absolute bottom-0 -left-3 -right-3 z-50 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={showPreviousResult}
                          disabled={selectedResultIndex <= 0}
                          className="scoreboard-nav-button pointer-events-auto disabled:opacity-35"
                          aria-label="Previous round result"
                        >
                          &lt;
                        </button>
                        <button
                          type="button"
                          onClick={showNextResult}
                          disabled={selectedResultIndex >= resultKeys.length - 1}
                          className="scoreboard-nav-button pointer-events-auto disabled:opacity-35"
                          aria-label="Next round result"
                        >
                          &gt;
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>

              {finalSummary && (
                <motion.div
                  key="bounty-summary"
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                  className="flex flex-col justify-start gap-3"
                >
                  <Metric
                    label="Bounty Winners"
                    value={`${finalSummary.eligibleNodeCount} / ${nodeCount}`}
                    leadingFaces={bountyWinnerNodes}
                    prominent
                  />
                  <Metric
                    label="Bounty Per Winner"
                    value={`+${finalSummary.bountyPerEligibleNode.toFixed(2)} ${finalSummary.bountyAsset}`}
                    prominent
                  />
                  {hasNodeResults && (
                    <button
                      type="button"
                      onClick={() => setShowNodeResults((current) => !current)}
                      className="scoreboard-button mt-1 flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-bold uppercase leading-tight tracking-wider transition-transform hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0.5"
                      aria-expanded={showNodeResults}
                    >
                      {showNodeResults ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showNodeResults ? 'Collapse Results' : 'Expand Results'}
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>

            {action && (
              <div className="mt-2 flex justify-end">
                {action}
              </div>
            )}

            {characters.some(c => c.isOutlier) && !showDetails && (
              <div className="mt-2 text-[8px] text-[#b93c2f] bg-[#fff0ea] py-0.5 uppercase tracking-widest animate-pulse border-y border-[#d87965]/60">
                Outliers detected: reputation and stake penalties applied
              </div>
            )}

            {hasNodeResults && (
              <div className="mt-2">
                <AnimatePresence initial={false}>
                  {showNodeResults && onInspectNode && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                      className="scoreboard-panel mt-2 overflow-visible p-2 text-left"
                    >
                      <NodeResultsTable
                        nodes={finalNodes}
                        selectedNodeId={selectedNodeId}
                        onInspect={onInspectNode}
                        embedded
                        compact
                        variant="scoreboard"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SelectionRulesPanel() {
  return (
    <motion.div
      key="selection-rules"
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ type: 'spring', damping: 24, stiffness: 220 }}
      className="mx-auto max-w-[420px] text-left text-[10px] font-bold uppercase leading-relaxed tracking-wider text-[#d9f7ff]"
    >
      <p>
        Review sortition {(REVIEW_VRF_PROBABILITY * 100).toFixed(0)}%. Final reviewers are capped by quorum {REVIEWER_COUNT}.
      </p>
      <p className="mt-1 text-[#9ff8ff]">
        Audit VRF {(AUDIT_VRF_PROBABILITY * 100).toFixed(0)}%. Only selected reviewers enter rounds 1, 2, and 3.
      </p>
      <p className="mt-1 text-[#9eb6c3]">
        Click highlighted lab reviewers to open their detail page.
      </p>
    </motion.div>
  );
}

function Metric({
  label,
  value,
  leadingFaces,
  prominent = false,
}: {
  label: string;
  value: string;
  leadingFaces?: NodeEvaluationResult[];
  prominent?: boolean;
}) {
  return (
    <div className={`scoreboard-panel text-left ${prominent ? 'p-3' : 'p-1.5'}`}>
      <div className={`flex items-center gap-1 ${prominent ? 'text-[10px]' : 'text-[8px]'} uppercase tracking-wider text-[#9eb6c3]`}>
        <span className="scoreboard-led h-[6px] w-[6px]" />
        {label}
      </div>
      <div className={`mt-2 flex items-center gap-2 font-mono font-bold leading-none text-[#ffd98a] ${prominent ? 'text-lg' : 'text-sm'}`}>
        {leadingFaces && leadingFaces.length > 0 && (
          <span className="flex shrink-0 -space-x-1">
            {leadingFaces.map((node) => (
              <img
                key={node.id}
                src={`/assets/characters/reviewers/faces/${node.id}.png`}
                alt={node.name}
                className="h-5 w-5 object-contain"
                onError={(event) => {
                  const fallbackAvatar = node.avatar ?? ASSET_PATHS.characters.reviewers[node.id]?.portrait;
                  if (!fallbackAvatar || event.currentTarget.src.endsWith(fallbackAvatar)) return;
                  event.currentTarget.src = fallbackAvatar;
                }}
              />
            ))}
          </span>
        )}
        <span>{value}</span>
      </div>
    </div>
  );
}
