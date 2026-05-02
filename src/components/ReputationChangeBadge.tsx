interface ReputationChangeBadgeProps {
  before: number;
  after: number;
}

export default function ReputationChangeBadge({ before, after }: ReputationChangeBadgeProps) {
  const change = after - before;
  const tone =
    change > 0
      ? 'border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]'
      : change < 0
        ? 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]'
        : 'border-[#d7b98f] bg-[#fff8e6] text-[#6b563f]';
  const label = change > 0 ? `+${change} Reputation` : change < 0 ? `${change} Reputation` : 'No Change';

  return <span className={`inline-flex border-2 px-2 py-0.5 text-xs font-bold ${tone}`}>{label}</span>;
}
