import { FinalEvaluationSummary, NodeEvaluationResult } from '../types';
import { PixelFrameChrome } from './PixelFrame';

interface RewardLedgerProps {
  summary: FinalEvaluationSummary;
  nodes: NodeEvaluationResult[];
}

export default function RewardLedger({ summary, nodes }: RewardLedgerProps) {
  const losses = nodes.filter((node) => node.slashAmount > 0);
  const nodeCount = nodes.length;
  const outlierCount = nodeCount - summary.eligibleNodeCount;

  return (
    <section className="pixel-box warm-panel h-full">
      <PixelFrameChrome round={2} />
      <div className="mb-3 border-b-2 border-[#d7b98f] pb-2">
        <h2 className="text-xl font-bold text-[#503521]">Result Notes</h2>
        <p className="text-sm text-[#6b563f]">
          {nodeCount} AI nodes finished review: {summary.eligibleNodeCount} aligned with consensus
          {outlierCount > 0 ? `, ${outlierCount} outside the accepted range.` : ', no outliers detected.'}
        </p>
      </div>

      <div className="mb-4 grid gap-2 text-sm">
        <LedgerMetric label="AI Nodes in Room" value={`${nodeCount}`} />
        <LedgerMetric label="Accepted Score Range" value={`${summary.outlierThresholdLow.toFixed(1)} - ${summary.outlierThresholdHigh.toFixed(1)}`} />
        <LedgerMetric label="Bounty Winners" value={`${summary.eligibleNodeCount} / ${nodeCount}`} />
        <LedgerMetric label="Bounty Per Eligible Node" value={`${summary.bountyPerEligibleNode.toFixed(2)} ${summary.bountyAsset}`} />
        <LedgerMetric label="Slashed Stake" value={`${summary.totalSlashedPool.toFixed(1)} TOK`} />
      </div>

      {losses.length === 0 ? (
        <div className="mb-4 border-2 border-[#8ab66b] bg-[#f4ffd9] p-3 text-sm text-[#2f6f35]">
          <strong>No nodes were slashed this round.</strong>
          <p>All nodes stayed within the accepted score range.</p>
        </div>
      ) : (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[#9c342d]">Losses</h3>
          <div className="space-y-2">
            {losses.map((node) => (
              <div key={node.id} className="border-2 border-[#d87965] bg-[#fff0ea] p-2 text-sm text-[#9c342d]">
                {node.name} scored {node.finalScore}, missed the accepted range, and lost {node.slashAmount.toFixed(1)} TOK from stake.
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-2 border-[#82a8c7] bg-[#eef8ff] p-3 text-sm leading-relaxed text-[#2f5d7e]">
        {summary.reviewBountyAmount > 0
          ? `${summary.reviewBountyAmount.toFixed(2)} ${summary.bountyAsset} review bounty was split across ${summary.eligibleNodeCount} eligible nodes. `
          : 'No review bounty was funded for this run. '}
        {summary.totalSlashedPool > 0
          ? `${summary.totalSlashedPool.toFixed(1)} TOK was removed from losing nodes' stake. It is not paid to winning nodes.`
          : 'No stake redistribution occurred because no node was slashed.'}
      </div>
    </section>
  );
}

function LedgerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-2 border-[#d7b98f] bg-[#fffef3] px-3 py-2">
      <span className="text-[#6b563f]">{label}</span>
      <strong className="text-[#503521]">{value}</strong>
    </div>
  );
}
