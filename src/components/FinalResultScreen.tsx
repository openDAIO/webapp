import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { NodeEvaluationResult } from '../types';
import NodeResultsTable from './NodeResultsTable';

interface FinalResultScreenProps {
  nodes: NodeEvaluationResult[];
  selectedNodeId?: string | null;
  onInspectNode: (node: NodeEvaluationResult) => void;
  onConfirmResults: () => void;
}

export default function FinalResultScreen({
  nodes,
  selectedNodeId,
  onInspectNode,
  onConfirmResults,
}: FinalResultScreenProps) {
  return (
    <motion.section
      initial={{ y: 140, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 140, opacity: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 220 }}
      className="scoreboard-shell pointer-events-auto mx-auto flex max-h-[52vh] w-full max-w-[700px] flex-col p-4"
      aria-live="polite"
    >
      <div className="scoreboard-title mb-3 px-4 py-2 text-center text-2xl font-bold uppercase tracking-widest">
        Final Result
      </div>
      <div className="scoreboard-panel min-h-0 flex-1 p-3">
        <div className="max-h-[44vh] overflow-y-auto pr-1 custom-scrollbar">
          <NodeResultsTable
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onInspect={onInspectNode}
            embedded
            headerAction={
              <button
                type="button"
                onClick={onConfirmResults}
                className="scoreboard-button flex shrink-0 items-center gap-2 px-3 py-1.5 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm"
              >
                <CheckCircle2 size={16} />
                Confirm Review Results
              </button>
            }
            variant="scoreboard"
          />
        </div>
      </div>
    </motion.section>
  );
}
