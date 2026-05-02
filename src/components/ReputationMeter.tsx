import { motion } from 'motion/react';
import { SCORE_SCALE } from '../utils/reviewScoring';

interface ReputationMeterProps {
  value: number;
  label?: string;
  compact?: boolean;
}

export default function ReputationMeter({ value, label = 'Reputation', compact = false }: ReputationMeterProps) {
  const width = `${Math.max(0, Math.min(100, (value / SCORE_SCALE) * 100))}%`;
  const tone = value >= 8000 ? 'bg-[#9effc2]' : value >= 5500 ? 'bg-[#ffd98a]' : 'bg-[#ff9b8f]';

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wider text-[#9eb6c3]">
        <span>{label}</span>
        <span className="font-mono text-[#d9f7ff]">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden border border-[#718696] bg-[#172a3a] shadow-[inset_2px_2px_0_rgba(0,0,0,0.18)]">
        <motion.div
          className={`h-full ${tone}`}
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        />
      </div>
    </div>
  );
}
