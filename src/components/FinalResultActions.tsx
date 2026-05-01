import { DoorOpen, RotateCcw } from 'lucide-react';
import { PixelFrameChrome } from './PixelFrame';

interface FinalResultActionsProps {
  onBackToCommons: () => void;
  onStartAnotherEvaluation: () => void;
}

export default function FinalResultActions({ onBackToCommons, onStartAnotherEvaluation }: FinalResultActionsProps) {
  return (
    <section className="pixel-box warm-panel flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <PixelFrameChrome round={2} />
      <p className="max-w-2xl text-sm leading-relaxed text-[#5f4328]">
        Final review complete. The review bounty was paid to eligible nodes, and outlier nodes were penalized from their own stake.
      </p>
      <div className="flex flex-wrap gap-3">
        <button onClick={onBackToCommons} className="pixel-button flex items-center gap-2 bg-[#fff8e6] text-sm font-bold text-[#503521]">
          <DoorOpen size={18} />
          Back to Commons
        </button>
        <button onClick={onStartAnotherEvaluation} className="pixel-button flex items-center gap-2 bg-[#e5b45f] text-sm font-bold text-[#503521]">
          <RotateCcw size={18} />
          Start Another Evaluation
        </button>
      </div>
    </section>
  );
}
