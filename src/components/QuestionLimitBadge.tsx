import { NodeChatState } from '../types';

interface QuestionLimitBadgeProps {
  chat: NodeChatState;
}

export default function QuestionLimitBadge({ chat }: QuestionLimitBadgeProps) {
  const questionsLeft = Math.max(0, chat.maxQuestions - chat.questionsUsed);
  const isEmpty = questionsLeft === 0;

  return (
    <span
      className={`inline-flex border-2 px-2 py-1 text-xs font-bold ${
        isEmpty
          ? 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]'
          : 'border-[#82a8c7] bg-[#eef8ff] text-[#2f5d7e]'
      }`}
    >
      Questions left: {questionsLeft} / {chat.maxQuestions}
    </span>
  );
}
