import { CheckCircle2, Loader2 } from 'lucide-react';
import { PixelFrameChrome } from './PixelFrame';

interface SelectionStatusBarProps {
  isComplete: boolean;
  selectedCount: number;
}

export default function SelectionStatusBar({ isComplete, selectedCount }: SelectionStatusBarProps) {
  return (
    <div
      className="node-selection-status pointer-events-none absolute left-1/2 top-6 z-[86] w-full max-w-md -translate-x-1/2 px-4"
      aria-live="polite"
    >
      <div className="relative isolate mx-auto flex items-center justify-center gap-3 bg-transparent px-5 py-3 text-center text-lg font-bold uppercase tracking-widest">
        <PixelFrameChrome
          round={2}
          thickness={4}
          color={isComplete ? '#5f4328' : '#2f5d7e'}
          fillColor={isComplete ? '#f4ffd9' : '#edf5fa'}
          innerHighlightColor="rgba(255, 255, 255, 0.46)"
          outerShadowColor="rgba(7, 17, 31, 0.24)"
          outerShadowOffsetX={4}
          outerShadowOffsetY={4}
        />
        <span className="relative z-40 flex items-center gap-2 text-[#17384b]">
          {isComplete ? <CheckCircle2 size={18} /> : <Loader2 size={18} className="animate-spin" />}
          {isComplete ? `${selectedCount} Review Nodes Selected` : 'Selecting Review Nodes...'}
        </span>
      </div>
    </div>
  );
}
