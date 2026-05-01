import { RewardLedgerEntry } from '../types';
import { PixelFrameChrome } from './PixelFrame';

interface RewardLedgerPanelProps {
  entries: RewardLedgerEntry[];
}

export default function RewardLedgerPanel({ entries }: RewardLedgerPanelProps) {
  const totalRedistributed = entries
    .filter((entry) => entry.type === 'redistribution' || entry.type === 'reward')
    .reduce((sum, entry) => sum + Math.max(entry.amount, 0), 0);

  return (
    <section className="pixel-box warm-panel w-full">
      <PixelFrameChrome round={2} />
      <div className="mb-3 border-b-2 border-[#d7b98f] pb-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#503521]">Reward Ledger</h2>
        <p className="text-xs text-[#6b563f]">{totalRedistributed > 0 ? `${totalRedistributed.toFixed(1)} TOK redistributed` : 'Waiting for finalization'}</p>
      </div>
      <div className="max-h-44 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {entries.length > 0 ? (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`border-2 px-2 py-1 text-xs leading-snug ${
                entry.amount < 0
                  ? 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]'
                  : 'border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]'
              }`}
            >
              <div className="flex justify-between gap-2 font-bold">
                <span>{entry.nodeName}</span>
                <span>
                  {entry.amount > 0 ? '+' : ''}
                  {entry.amount.toFixed(1)} TOK
                </span>
              </div>
              <p>{entry.message}</p>
            </div>
          ))
        ) : (
          <div className="border-2 border-dashed border-[#d7b98f] p-3 text-xs text-[#6b563f]">
            Slashing and rewards will appear here after final scores are submitted.
          </div>
        )}
      </div>
    </section>
  );
}
