import { useState } from 'react';
import { CircleAlert, MessageSquare } from 'lucide-react';
import { NodeChatState, NodeEvaluationResult } from '../types';
import NodeChatInput from './NodeChatInput';
import NodeChatMessageList from './NodeChatMessageList';
import QuestionLimitBadge from './QuestionLimitBadge';
import SuggestedQuestionChips from './SuggestedQuestionChips';

interface NodeChatPanelProps {
  node: NodeEvaluationResult;
  chat: NodeChatState;
  isSending?: boolean;
  error?: string | null;
  onSend: (message: string) => void;
}

export default function NodeChatPanel({ node, chat, isSending, error, onSend }: NodeChatPanelProps) {
  const [showInterviewNote, setShowInterviewNote] = useState(false);
  const questionsLeft = Math.max(0, chat.maxQuestions - chat.questionsUsed);
  const limitReached = questionsLeft === 0;

  return (
    <section className="node-chat-panel">
      <div className="node-chat-header">
        <div className="node-chat-title-row">
          <div className="node-chat-title-group">
            <MessageSquare size={18} />
            <h3>Chat with {node.name}</h3>
            <span className="node-chat-note-anchor">
              <button
                type="button"
                className="node-chat-note-button"
                onClick={() => setShowInterviewNote((current) => !current)}
                aria-expanded={showInterviewNote}
                aria-label="Show interview note"
              >
                <CircleAlert size={16} />
              </button>
              {showInterviewNote && (
                <span className="node-chat-note-bubble" role="tooltip">
                  Post-review interview only. This chat will not change the final score.
                </span>
              )}
            </span>
          </div>
          <QuestionLimitBadge chat={chat} />
        </div>
        <p>
          Ask this node about its score, reasoning, discussions, or evidence.
        </p>
      </div>

      <div className="node-chat-suggestions">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#6b563f]">Suggested Questions</h4>
        <SuggestedQuestionChips node={node} disabled={limitReached || isSending} onSelect={onSend} />
      </div>

      <div className="node-chat-scroll">
        {error && !limitReached && (
          <div className="border-2 border-[#d87965] bg-[#fff0ea] p-3 text-sm text-[#9c342d]">
            {error}
          </div>
        )}

        <div className="node-chat-message-area">
          <NodeChatMessageList node={node} messages={chat.messages} isSending={isSending} />
        </div>

        {limitReached && (
          <div className="node-chat-limit-warning border-2 border-[#d87965] bg-[#fff0ea] p-3 text-sm text-[#9c342d]">
            <strong>Question limit reached.</strong>
            <p>You have used all available questions for this node.</p>
          </div>
        )}
      </div>

      <div className="node-chat-input-bar">
        <NodeChatInput disabled={limitReached} isSending={isSending} onSend={onSend} />
      </div>
    </section>
  );
}
