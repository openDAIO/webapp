interface TokenFlowBadgeProps {
  amount: number;
}

export default function TokenFlowBadge({ amount }: TokenFlowBadgeProps) {
  const tone =
    amount > 0
      ? 'border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]'
      : amount < 0
        ? 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]'
        : 'border-[#d7b98f] bg-[#fff8e6] text-[#6b563f]';
  const label = amount > 0 ? `+${amount.toFixed(1)} TOK` : amount < 0 ? `${amount.toFixed(1)} TOK` : '0 TOK';

  return <span className={`token-flow-badge inline-flex border-2 px-2 py-0.5 text-xs font-bold ${tone}`}>{label}</span>;
}
