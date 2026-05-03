import { AICharacter, SimulationPhase } from '../types';
import { PixelFrameChrome } from './PixelFrame';
import StandardDeviationChart from './StandardDeviationChart';
import { displayRoundNumber } from '../constants/reviewFlowTiming';

interface RoundBoardProps {
  phase: SimulationPhase;
  currentRound: number;
  characters: AICharacter[];
}

const phaseLabel: Partial<Record<SimulationPhase, string>> = {
  IDLE: 'Waiting for Submission',
  QUEUED: 'Request Queued On-chain',
  SELECTION: 'Selecting Review Nodes',
  MOVING_TO_ROOMS: 'Nodes Walking to Labs',
  ROUND_1: 'Round 0 in Progress',
  ROUND_2_STARTING: 'Round 1 Starting',
  ROUND_2: 'Round 1 in Discussion',
  ROUND_3_STARTING: 'Round 2 Starting',
  ROUND_3: 'Round 2 Encounters',
  FINALIZING: 'Final Round: Submitting Scores',
  EVALUATED: 'Final Results',
};

export default function RoundBoard({ phase, currentRound, characters }: RoundBoardProps) {
  const hasScores = characters.some((character) => typeof character.lastScore === 'number');
  const latestResultRound = characters.reduce((latest, character) => {
    const characterLatest = character.scoreHistory.reduce((max, score) => Math.max(max, score.round), 0);
    return Math.max(latest, characterLatest);
  }, 0);
  const resultLabel = latestResultRound > 0
    ? `After Round ${displayRoundNumber(latestResultRound, false)}`
    : 'Waiting for Scores';

  return (
    <section className="pixel-box warm-panel absolute left-1/2 top-3 z-40 w-full max-w-lg -translate-x-1/2 p-2 text-center">
      <PixelFrameChrome round={2} />
      <div className="text-xs uppercase tracking-widest text-[#6b563f]">Round Board</div>
      <h2 className="text-2xl font-bold leading-tight text-[#503521]">{phaseLabel[phase]}</h2>
      <div className="mx-auto mt-2 flex max-w-[410px] flex-wrap items-center justify-center gap-2">
        <span className="border-2 border-[#86a7b8] bg-[#edf5f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#263b48]">
          Current: Round {displayRoundNumber(currentRound, false)}
        </span>
        <span className="border-2 border-[#86a7b8] bg-[#edf5f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#263b48]">
          Result: {resultLabel}
        </span>
      </div>
      <div className="mx-auto mt-1.5 min-h-[104px] w-full max-w-[420px]">
        {hasScores ? (
          <StandardDeviationChart characters={characters} visible prominent stickyDomain />
        ) : (
          <div className="flex min-h-[104px] items-center justify-center text-sm text-[#6b563f]">
            Scores will appear after Round {displayRoundNumber(currentRound, false)} submissions.
          </div>
        )}
      </div>
    </section>
  );
}
