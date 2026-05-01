interface ScoreChangeIndicatorProps {
  change?: number;
}

export default function ScoreChangeIndicator({ change }: ScoreChangeIndicatorProps) {
  if (!change) {
    return <span className="score-change-indicator score-change-indicator--flat border-2 border-[#d7b98f] bg-[#fff8e6] px-2 py-0.5 text-xs font-bold text-[#6b563f]">No change</span>;
  }

  const tone = change > 0
    ? 'score-change-indicator--gain border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]'
    : 'score-change-indicator--loss border-[#d87965] bg-[#fff0ea] text-[#9c342d]';
  return <span className={`score-change-indicator border-2 px-2 py-0.5 text-xs font-bold ${tone}`}>{change > 0 ? '+' : ''}{change}</span>;
}
