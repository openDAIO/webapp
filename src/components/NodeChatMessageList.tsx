import { NodeChatMessage, NodeEvaluationResult } from '../types';

interface NodeChatMessageListProps {
  node: NodeEvaluationResult;
  messages: NodeChatMessage[];
  isSending?: boolean;
}

export default function NodeChatMessageList({ node, messages, isSending }: NodeChatMessageListProps) {
  if (messages.length === 0 && !isSending) {
    return (
      <div className="border-2 border-dashed border-[#d7b98f] bg-[#fffef3] p-3 text-sm text-[#6b563f]">
        No questions yet. Ask about the score, evidence, discussions, or final outcome.
      </div>
    );
  }

  return (
    <div className="node-chat-messages space-y-3 overflow-y-auto pr-1 custom-scrollbar">
      {messages.map((message) => (
        <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[88%] border-2 p-3 text-sm leading-relaxed shadow-[2px_2px_0_rgba(80,53,33,0.12)] ${
              message.role === 'user'
                ? 'border-[#82a8c7] bg-[#eef8ff] text-[#2f5d7e]'
                : message.role === 'system'
                  ? 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]'
                  : 'border-[#d7b98f] bg-[#fffef3] text-[#503521]'
            }`}
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-75">
              {message.role === 'user' ? 'You' : message.role === 'system' ? 'System' : node.name}
            </div>
            <p>{message.content}</p>
          </div>
        </article>
      ))}

      {isSending && (
        <article className="flex justify-start">
          <div className="border-2 border-[#d7b98f] bg-[#fffef3] p-3 text-sm text-[#6b563f] shadow-[2px_2px_0_rgba(80,53,33,0.12)]">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-75">{node.name}</div>
            Thinking through the review notes...
          </div>
        </article>
      )}
    </div>
  );
}
