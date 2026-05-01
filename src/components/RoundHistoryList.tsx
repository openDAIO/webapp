import { RoundEvaluationHistory, RoundHistoryPhase } from '../types';
import ScoreChangeIndicator from './ScoreChangeIndicator';

interface RoundHistoryListProps {
  history: RoundEvaluationHistory[];
}

const phaseLabels: Record<RoundHistoryPhase, string> = {
  independent_review: 'Independent Review',
  cross_lab_discussion: 'Cross-lab Discussion',
  hallway_discussion: 'Hallway Discussion',
  final_scoring: 'Final Scoring',
};

export default function RoundHistoryList({ history }: RoundHistoryListProps) {
  if (history.length === 0) {
    return (
      <div className="border-2 border-dashed border-[#d7b98f] p-3 text-sm text-[#6b563f]">
        No round history is available for this node yet.
      </div>
    );
  }

  return (
    <ol className="round-history-list relative space-y-3 border-l-4 border-[#d7b98f] pl-4">
      {history.map((item) => (
        <RoundHistoryItem key={`${item.round}-${item.title}`} item={item} />
      ))}
    </ol>
  );
}

function RoundHistoryItem({ item }: { item: RoundEvaluationHistory; key?: string }) {
  return (
    <li className="relative">
      <span className="round-history-dot absolute -left-[27px] top-3 h-4 w-4 border-2 border-[#7b5835] bg-[#e5b45f]" />
      <article className="border-2 border-[#d7b98f] bg-[#fffef3] p-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[#503521]">{item.title}</h4>
            <p className="text-xs uppercase tracking-wider text-[#6b563f]">{phaseLabels[item.phase]}</p>
          </div>
          <ScoreChangeIndicator change={item.scoreChange} />
        </div>

        <div className="round-history-score-line mb-2 font-bold text-[#503521]">
          <span>Score</span>
          <strong>
            {item.scoreBefore !== undefined ? (
              <>
                <span className="round-history-score-value">{item.scoreBefore}</span>
                <span className="round-history-score-arrow">-&gt;</span>
                <span className="round-history-score-value">{item.scoreAfter}</span>
              </>
            ) : (
              <span className="round-history-score-value">{item.scoreAfter}</span>
            )}
          </strong>
        </div>

        {item.discussedWith && item.discussedWith.length > 0 && (
          <p className="mb-2 text-xs text-[#6b563f]">
            <strong>Discussed with:</strong> {item.discussedWith.join(', ')}
          </p>
        )}

        {item.discussionSummary && (
          <DiscussionSummaryBlock summary={item.discussionSummary} />
        )}

        <div className="mt-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-[#503521]">Reasoning</h5>
          <p className="text-sm leading-relaxed text-[#5f4328]">{item.reasoning}</p>
        </div>

        <EvidenceList evidence={item.evidenceUsed ?? []} />
      </article>
    </li>
  );
}

function DiscussionSummaryBlock({ summary }: { summary: string }) {
  return (
    <div className="border-2 border-[#82a8c7] bg-[#eef8ff] p-2 text-sm leading-relaxed text-[#2f5d7e]">
      <strong>Discussion:</strong> {summary}
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: string[] }) {
  if (evidence.length === 0) {
    return (
      <div className="mt-2 border-2 border-dashed border-[#d7b98f] p-2 text-xs text-[#6b563f]">
        No evidence references were attached for this round.
      </div>
    );
  }

  return (
    <div className="mt-2">
      <h5 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#503521]">Evidence Used</h5>
      <ul className="grid gap-1 text-xs text-[#6b563f]">
        {evidence.map((item) => (
          <li key={item} className="border border-[#d7b98f] bg-[#fff8e6] px-2 py-1">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
