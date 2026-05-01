import { CheckCircle2 } from 'lucide-react';
import { FinalEvaluationSummary } from '../types';
import { PixelFrameChrome } from './PixelFrame';

interface FinalResultSummaryCardProps {
  summary: FinalEvaluationSummary;
}

function formatNumber(value: number) {
  return value.toFixed(1);
}

export default function FinalResultSummaryCard({ summary }: FinalResultSummaryCardProps) {
  return (
    <section className="pixel-box warm-panel">
      <PixelFrameChrome round={2} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#d7b98f] pb-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-[#6b563f]">Evaluation Completed</p>
          <h1 className="text-4xl font-bold leading-none text-[#503521]">Final Results</h1>
        </div>
        <div className="flex items-center gap-2 border-2 border-[#8ab66b] bg-[#f4ffd9] px-3 py-2 text-sm font-bold text-[#2f6f35]">
          <CheckCircle2 size={18} />
          Completed
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Final Average Score" value={formatNumber(summary.finalAverage)} />
        <Metric label="Standard Deviation" value={formatNumber(summary.standardDeviation)} />
        <Metric
          label="Outlier Range"
          value={`${formatNumber(summary.outlierThresholdLow)} - ${formatNumber(summary.outlierThresholdHigh)}`}
        />
        <Metric label="Status" value="Completed" />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-[#d7b98f] bg-[#fffef3] p-3">
      <div className="text-xs uppercase tracking-wider text-[#6b563f]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[#503521]">{value}</div>
    </div>
  );
}
