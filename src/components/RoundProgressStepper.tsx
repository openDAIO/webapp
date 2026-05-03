import { Check } from 'lucide-react';
import type { ReviewGamePhase } from '../types';

interface RoundProgressStepperProps {
  phase: ReviewGamePhase;
}

const steps: Array<{ phase: ReviewGamePhase; label: string }> = [
  { phase: 'selection', label: 'Selection' },
  { phase: 'round1', label: 'Round 0' },
  { phase: 'round2', label: 'Round 1' },
  { phase: 'round3', label: 'Round 2' },
  { phase: 'final', label: 'Final' },
];

export default function RoundProgressStepper({ phase }: RoundProgressStepperProps) {
  const activeIndex = steps.findIndex((step) => step.phase === phase);

  return (
    <div className="grid grid-cols-5 gap-1 text-left" aria-label="Review round progress">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;

        return (
          <div
            key={step.phase}
            className={`min-w-0 border px-1.5 py-1 ${
              isActive
                ? 'border-[#f1c46d] bg-[#332b1f] text-[#ffd98a]'
                : isComplete
                  ? 'border-[#7ff4ff] bg-[#172a3a] text-[#9ff8ff]'
                  : 'border-[#566b7a] bg-[#1e2c38] text-[#9eb6c3]'
            }`}
          >
            <div className="flex min-w-0 items-center justify-center gap-1">
              {isComplete && <Check size={10} />}
              <span className="truncate text-[8px] font-bold uppercase tracking-wider">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
