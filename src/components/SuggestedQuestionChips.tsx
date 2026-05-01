import { NodeEvaluationResult } from '../types';

interface SuggestedQuestionChipsProps {
  node: NodeEvaluationResult;
  disabled?: boolean;
  onSelect: (question: string) => void;
}

const baseQuestions = [
  'Why did you give this score?',
  'Which evidence mattered most?',
  'What changed your mind?',
  'Why did your score change after Round 2?',
];

const slashedQuestions = [
  'Why were you outside the score range?',
  'Do you think the slashing was fair?',
];

export default function SuggestedQuestionChips({ node, disabled, onSelect }: SuggestedQuestionChipsProps) {
  const questions = node.isOutlier ? [...baseQuestions, ...slashedQuestions] : baseQuestions;

  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="border-2 border-[#d7b98f] bg-[#fffef3] px-2 py-1 text-left text-xs font-bold text-[#503521] shadow-[2px_2px_0_rgba(80,53,33,0.12)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
