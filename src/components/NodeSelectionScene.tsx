import { motion } from 'motion/react';
import type { AICharacter } from '../types';
import NodeBottle from './NodeBottle';
import SelectionStatusBar from './SelectionStatusBar';

interface NodeSelectionSceneProps {
  nodes: AICharacter[];
  isComplete: boolean;
  onInspectNode?: (nodeId: string) => void;
}

export default function NodeSelectionScene({
  nodes,
  isComplete,
  onInspectNode,
}: NodeSelectionSceneProps) {
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
      <SelectionStatusBar isComplete={isComplete} />

      <div className="absolute inset-0" role="list" aria-label="Review node candidates">
        {nodes.map((node, index) => (
          <NodeBottle
            key={node.id}
            node={node}
            index={index}
            isComplete={isComplete}
            decorateOnly
            onClick={onInspectNode}
          />
        ))}
      </div>

      {isComplete && (
        <motion.div
          className="node-selection-detail-bubble pointer-events-none absolute left-1/2 top-[56%] z-[92] -translate-x-1/2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0.82, 1, 0.82], y: [4, 0, 4] }}
          transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
        >
          Click a reviewer for details
        </motion.div>
      )}
    </motion.section>
  );
}
