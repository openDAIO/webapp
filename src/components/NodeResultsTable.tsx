import { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { NodeEvaluationResult, NodeEvaluationStatus } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';
import { PixelFrameChrome } from './PixelFrame';
import TokenFlowBadge from './TokenFlowBadge';
import ReputationChangeBadge from './ReputationChangeBadge';

interface NodeResultsTableProps {
  nodes: NodeEvaluationResult[];
  selectedNodeId?: string | null;
  onInspect: (node: NodeEvaluationResult) => void;
  embedded?: boolean;
  headerAction?: ReactNode;
  compact?: boolean;
  variant?: 'default' | 'scoreboard';
}

const statusLabels: Record<NodeEvaluationStatus, string> = {
  within_range: 'Within Range',
  outlier: 'Outlier',
  rewarded: 'Bounty Won',
  slashed: 'Slashed',
};

const statusClass: Record<NodeEvaluationStatus, string> = {
  within_range: 'border-[#82a8c7] bg-[#eef8ff] text-[#2f5d7e]',
  outlier: 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]',
  rewarded: 'border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]',
  slashed: 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]',
};

const scoreboardStatusClass: Record<NodeEvaluationStatus, string> = {
  within_range: 'border-[#7ff4ff] bg-[#172a3a] text-[#9ff8ff]',
  outlier: 'border-[#ff8b7d] bg-[#351f25] text-[#ffc0b8]',
  rewarded: 'border-[#f1c46d] bg-[#332b1f] text-[#ffd98a]',
  slashed: 'border-[#ff8b7d] bg-[#351f25] text-[#ffc0b8]',
};

function formatProtocolValue(value?: number) {
  return typeof value === 'number' ? value.toLocaleString() : '--';
}

function ProtocolCell({
  node,
  isScoreboard,
}: {
  node: NodeEvaluationResult;
  isScoreboard: boolean;
}) {
  const reviewNode = node.reviewNode;

  if (!reviewNode) {
    return <span className={isScoreboard ? 'text-[#718696]' : 'text-[#8c745b]'}>--</span>;
  }

  const itemClass = isScoreboard
    ? 'border border-[#566b7a] bg-[#172a3a] text-[#9eb6c3]'
    : 'border border-[#d7b98f] bg-[#fff8e6] text-[#8c745b]';
  const valueClass = isScoreboard ? 'text-[#ffd98a]' : 'text-[#2f5d7e]';

  return (
    <div className="grid grid-cols-2 gap-1 text-[8px] uppercase leading-tight tracking-wider">
      <span className={`${itemClass} px-1 py-0.5`}>
        <span className="block truncate">Proposal</span>
        <strong className={`block truncate font-mono text-[9px] ${valueClass}`}>{formatProtocolValue(reviewNode.proposalScore)}</strong>
      </span>
      <span className={`${itemClass} px-1 py-0.5`}>
        <span className="block truncate">Reputation</span>
        <strong className={`block truncate font-mono text-[9px] ${valueClass}`}>{formatProtocolValue(reviewNode.round2?.reputationScore)}</strong>
      </span>
      <span className={`${itemClass} px-1 py-0.5`}>
        <span className="block truncate">Final Wt</span>
        <strong className={`block truncate font-mono text-[9px] ${valueClass}`}>{formatProtocolValue(reviewNode.round2?.finalWeight)}</strong>
      </span>
      <span className={`${itemClass} px-1 py-0.5`}>
        <span className="block truncate">Weighted</span>
        <strong className={`block truncate font-mono text-[9px] ${valueClass}`}>{formatProtocolValue(reviewNode.round2?.weightedScore)}</strong>
      </span>
    </div>
  );
}

export default function NodeResultsTable({
  nodes,
  selectedNodeId,
  onInspect,
  embedded = false,
  headerAction,
  compact = false,
  variant = 'default',
}: NodeResultsTableProps) {
  const isScoreboard = variant === 'scoreboard';
  const hasProtocolData = nodes.some((node) => Boolean(node.reviewNode));

  const content = (
    <>
      {!compact && (
        <div className={`mb-3 flex flex-wrap items-start justify-between gap-3 ${isScoreboard ? 'border-b-2 border-[#718696] pb-3' : ''}`}>
          <div className="min-w-0">
            <h2 className={`text-xl font-bold leading-none ${isScoreboard ? 'text-[#d9f7ff]' : 'text-[#503521]'}`}>Node Results</h2>
            <p className={`mt-2 text-sm leading-tight ${isScoreboard ? 'text-[#9eb6c3]' : 'text-[#6b563f]'}`}>
              Winners receive bounty only. Slashed nodes lose staked TOK.
            </p>
          </div>
          {headerAction}
        </div>
      )}

      {nodes.length === 0 ? (
        <div className={`border-2 border-dashed p-4 text-sm ${isScoreboard ? 'border-[#566b7a] text-[#9eb6c3]' : 'border-[#d7b98f] text-[#6b563f]'}`}>
          No node results are available yet.
        </div>
      ) : (
        <div className="w-full overflow-visible">
          <table className={`w-full table-fixed border-separate text-left ${
            compact ? 'border-spacing-y-2 text-sm' : 'border-spacing-y-2 text-sm lg:text-base'
          }`}>
            <thead className={`${compact ? 'text-[9px]' : 'text-[10px] lg:text-xs'} uppercase tracking-wider ${isScoreboard ? 'text-[#9ff8ff]' : 'text-[#6b563f]'}`}>
              <tr>
                <th className={`${hasProtocolData ? 'w-[24%]' : 'w-[34%]'} px-1 py-1 lg:px-2`}>Node</th>
                <th className={`${hasProtocolData ? 'w-[8%]' : 'w-[11%]'} px-1 py-1 lg:px-2`}>Score</th>
                {hasProtocolData && <th className="w-[23%] px-1 py-1 lg:px-2">Protocol</th>}
                <th className={`${hasProtocolData ? 'w-[10%]' : 'w-[15%]'} px-1 py-1 lg:px-2`}>Reputation</th>
                <th className={`${hasProtocolData ? 'w-[14%]' : 'w-[17%]'} px-1 py-1 lg:px-2`}>Bounty</th>
                <th className={`${hasProtocolData ? 'w-[14%]' : 'w-[15%]'} px-1 py-1 lg:px-2`}>Stake</th>
                <th className={`${hasProtocolData ? 'w-[7%]' : 'w-[8%]'} px-1 py-1 lg:px-2`}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const stakeFlow = -node.slashAmount;
                const isSelected = selectedNodeId === node.id;
                const reputationChange = node.reputationAfter - node.reputationBefore;
                const reputationTone = reputationChange > 0 ? 'text-[#9effc2]' : reputationChange < 0 ? 'text-[#ffb3aa]' : 'text-[#d9f7ff]';
                const stakeTone = stakeFlow < 0 ? 'text-[#ffb3aa]' : 'text-[#9effc2]';
                const cellClass = isScoreboard
                  ? `border-y-2 border-[#718696] px-1 lg:px-2 ${compact ? 'py-2.5' : 'py-3'}`
                  : `border-y-2 border-[#d7b98f] px-1 lg:px-2 ${compact ? 'py-2.5' : 'py-3'}`;

                return (
                  <tr
                    key={node.id}
                    className={
                      isScoreboard
                        ? isSelected ? 'bg-[#314457] text-[#effbff]' : 'bg-[#1e2c38] text-[#d9f7ff]'
                        : isSelected ? 'bg-[#dff0c8]' : 'bg-[#fffef3]'
                    }
                  >
                    <td className={`overflow-visible border-l-2 font-bold leading-tight ${isScoreboard ? 'border-[#718696]' : 'border-[#d7b98f]'} ${cellClass}`}>
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <img
                          src={`/assets/characters/reviewers/faces/${node.id}.png`}
                          alt={node.name}
                          className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} shrink-0 object-contain`}
                          onError={(event) => {
                            const fallbackAvatar = node.avatar ?? ASSET_PATHS.characters.reviewers[node.id]?.portrait;
                            if (!fallbackAvatar || event.currentTarget.src.endsWith(fallbackAvatar)) return;
                            event.currentTarget.src = fallbackAvatar;
                          }}
                        />
                        <span className="min-w-0 break-words text-sm font-bold">{node.name}</span>
                        <span className={`inline-flex max-w-none rotate-[-10deg] border-2 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none shadow-[2px_2px_0_rgba(0,0,0,0.24)] ${isScoreboard ? scoreboardStatusClass[node.status] : statusClass[node.status]}`}>
                          {statusLabels[node.status]}
                        </span>
                      </span>
                    </td>
                    <td className={`${cellClass} ${isScoreboard ? 'font-mono text-sm font-bold text-[#9ff8ff]' : 'text-sm font-bold'}`}>{node.finalScore}</td>
                    {hasProtocolData && (
                      <td className={cellClass}>
                        <ProtocolCell node={node} isScoreboard={isScoreboard} />
                      </td>
                    )}
                    <td className={cellClass}>
                      {isScoreboard ? (
                        <span className={`font-mono text-sm font-bold ${reputationTone}`}>
                          {reputationChange > 0 ? `+${reputationChange}` : reputationChange < 0 ? reputationChange : '0'}
                        </span>
                      ) : (
                        <ReputationChangeBadge before={node.reputationBefore} after={node.reputationAfter} />
                      )}
                    </td>
                    <td className={`break-words font-bold leading-tight ${isScoreboard ? 'text-[#ffd98a]' : 'text-[#2f6f35]'} ${cellClass}`}>
                      {node.bountyRewardAmount > 0 ? `${node.bountyRewardAmount.toFixed(2)} USDT` : '--'}
                    </td>
                    <td className={`${cellClass} whitespace-nowrap`}>
                      {isScoreboard ? (
                        <span className={`whitespace-nowrap font-mono text-sm font-bold ${stakeTone}`}>
                          {stakeFlow < 0 ? stakeFlow.toFixed(1) : '0'} TOK
                        </span>
                      ) : (
                        <TokenFlowBadge amount={stakeFlow} />
                      )}
                    </td>
                    <td className={`border-r-2 ${isScoreboard ? 'border-[#718696]' : 'border-[#d7b98f]'} ${cellClass}`}>
                      <button
                        aria-label={`View ${node.name}`}
                        onClick={() => onInspect(node)}
                        className={`inline-flex items-center gap-1 border-2 px-1.5 py-1 font-bold shadow-[2px_2px_0_rgba(80,53,33,0.18)] hover:-translate-y-0.5 lg:px-2 ${compact ? 'text-[9px]' : 'text-[10px] lg:text-xs'} ${isScoreboard ? 'border-[#9ff8ff] bg-[#263948] text-[#9ff8ff]' : 'border-[#7b5835] bg-[#e5b45f] text-[#503521]'}`}
                      >
                        <ArrowRight size={compact ? 12 : 14} />
                        <span className="hidden xl:inline">View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <section className="pixel-box warm-panel h-full">
      <PixelFrameChrome round={2} />
      {content}
    </section>
  );
}
