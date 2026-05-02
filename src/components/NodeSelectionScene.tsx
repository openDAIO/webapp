import { FastForward, Play } from 'lucide-react';
import { motion } from 'motion/react';
import type { AICharacter } from '../types';
import NodeBottle from './NodeBottle';
import { PixelFrameChrome } from './PixelFrame';
import SelectionStatusBar from './SelectionStatusBar';

interface NodeSelectionSceneProps {
  nodes: AICharacter[];
  isComplete: boolean;
  onSkip: () => void;
  onStartReview: () => void;
}

export default function NodeSelectionScene({
  nodes,
  isComplete,
  onSkip,
  onStartReview,
}: NodeSelectionSceneProps) {
  const selectedCount = nodes.filter((node) => node.selected).length;

  return (
    <motion.section
      className="node-selection-scene pointer-events-none absolute inset-0 z-[78]"
      role="region"
      aria-label="Review node selection"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <div className="node-selection-scene__wash absolute inset-0" aria-hidden="true" />
      <SelectionStatusBar isComplete={isComplete} selectedCount={selectedCount} />

      <div className="absolute inset-0" role="list" aria-label="Review node candidates">
        {nodes.map((node, index) => (
          <NodeBottle
            key={node.id}
            node={node}
            index={index}
            isComplete={isComplete}
          />
        ))}
      </div>

      <div
        className={`pointer-events-auto absolute left-1/2 z-[87] flex -translate-x-1/2 items-center justify-center gap-3 ${
          isComplete ? 'node-selection-controls--status' : 'bottom-8'
        }`}
      >
        {!isComplete ? (
          <button
            type="button"
            onClick={onSkip}
            className="node-selection-button node-selection-button--secondary relative isolate flex h-12 min-w-28 items-center justify-center gap-2 border-0 bg-transparent px-4 text-sm font-bold uppercase tracking-wider text-[#17384b] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
          >
            <PixelFrameChrome
              round={2}
              thickness={4}
              color="#2f5d7e"
              fillColor="#edf5fa"
              innerHighlightColor="rgba(255, 255, 255, 0.42)"
              outerShadowColor="rgba(7, 17, 31, 0.24)"
              outerShadowOffsetX={4}
              outerShadowOffsetY={4}
            />
            <span className="relative z-40 flex items-center gap-2">
              <FastForward size={16} />
              Skip
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartReview}
            className="node-selection-button relative isolate flex h-14 min-w-40 items-center justify-center gap-2 border-0 bg-transparent px-5 text-base font-bold uppercase tracking-wider text-[#23351f] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
          >
            <PixelFrameChrome
              round={2}
              thickness={4}
              color="#5f4328"
              fillColor="#e5b45f"
              innerHighlightColor="rgba(255, 255, 255, 0.34)"
              outerShadowColor="rgba(80, 53, 33, 0.28)"
              outerShadowOffsetX={5}
              outerShadowOffsetY={5}
            />
            <span className="relative z-40 flex items-center gap-2">
              <Play size={17} />
              Start Review
            </span>
          </button>
        )}
      </div>
    </motion.section>
  );
}
