import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { AICharacter, SimulationPhase } from '../types';
import ActivityTrace, { type ActivityTraceItem, useElapsedActivity } from './ActivityTrace';

interface ThinkingDrawerProps {
  character: AICharacter | null;
  phase: SimulationPhase;
  currentRound: number;
  onClose: () => void;
}

function phaseContext(phase: SimulationPhase, currentRound: number) {
  switch (phase) {
    case 'ROUND_1':
      return 'Independent review';
    case 'ROUND_2':
      return 'Local review during Round 1';
    case 'ROUND_3':
      return 'Local review during Round 2';
    case 'FINALIZING':
      return 'Final reconciliation';
    default:
      return `Round ${Math.max(0, currentRound - 1)} local review`;
  }
}

export default function ThinkingDrawer({ character, phase, currentRound, onClose }: ThinkingDrawerProps) {
  const [visibleStepCount, setVisibleStepCount] = useState(2);
  const elapsedSeconds = useElapsedActivity(`${character?.id ?? 'none'}-${phase}-${currentRound}`);

  const steps = useMemo(() => {
    if (!character) return [];

    const latestScore = character.lastScore ?? character.scoreHistory.at(-1)?.score;
    const latestHistory = character.scoreHistory.at(-1);
    const scoreText = typeof latestScore === 'number' ? `${latestScore}/100` : 'not submitted yet';

    return [
      {
        title: 'Preparing a private review plan',
        body: `${character.name} is mapping the current room task into review criteria: claim strength, evidence quality, reproducibility, citation support, and score confidence.`,
        meta: phaseContext(phase, currentRound),
      },
      {
        title: 'Extracting evidence anchors',
        body: `${character.name} is separating direct evidence from weak supporting language, then checking which claims can actually justify a score movement.`,
      },
      {
        title: 'Checking scoring risk',
        body: character.scoreReasoning ?? `${character.name} is testing whether the provisional score overweights novelty, underweights reproducibility, or drifts too far from the consensus band.`,
      },
      {
        title: 'Calibrating without a peer partner',
        body: latestHistory?.discussion ?? `${character.name} has no active dialogue partner in this rotation, so the node is keeping a local audit trail and waiting for the next shared calibration point.`,
      },
      {
        title: 'Recording provisional output',
        body: `Current provisional score is ${scoreText}. The node is preparing a concise justification that can be compared against the next round's mean and accepted range.`,
      },
    ] satisfies ActivityTraceItem[];
  }, [character, currentRound, phase]);

  useEffect(() => {
    setVisibleStepCount(2);
  }, [character?.id, phase, currentRound]);

  useEffect(() => {
    if (!character || steps.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setVisibleStepCount((count) => Math.min(steps.length, count + 1));
    }, 650);

    return () => window.clearInterval(timer);
  }, [character, steps.length]);

  if (!character) return null;

  const visibleSteps = steps.slice(0, visibleStepCount);
  const activeStep = Math.min(visibleStepCount, steps.length) - 1;

  return (
    <motion.div
      key={`${character.id}-${phase}-${currentRound}`}
      initial={{ x: 18, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 18, opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="review-room-activity-panel pixel-box warm-panel h-full min-h-0 w-full overflow-y-auto p-4 text-[#202528]"
      aria-label={`${character.name} thinking process`}
    >
      <ActivityTrace
        title="Careful local review"
        subtitle={`${character.name} is working without an active peer dialogue and is keeping a professional audit trail of the review process.`}
        elapsedSeconds={elapsedSeconds}
        items={visibleSteps}
        activeIndex={activeStep}
        closeLabel="Close thinking process"
        onClose={onClose}
      />
    </motion.div>
  );
}
