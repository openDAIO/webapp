import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';
import { PixelFrameChrome } from './PixelFrame';

interface NodeChatInputProps {
  disabled?: boolean;
  isSending?: boolean;
  onSend: (message: string) => void;
}

export default function NodeChatInput({ disabled, isSending, onSend }: NodeChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled || isSending) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={disabled || isSending}
        placeholder={disabled ? 'Question limit reached.' : 'Type your question...'}
        className="min-w-0 flex-1 border-4 border-[#d7b98f] bg-white px-3 py-2 text-sm text-[#503521] outline-none transition-colors focus:border-[#83add0] disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!input.trim() || disabled || isSending}
        className="node-chat-send-button relative isolate flex items-center gap-2 border-0 bg-transparent px-4 py-2 text-sm font-bold text-[#503521] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-55"
      >
        <PixelFrameChrome
          round={2}
          thickness={3}
          color="#7b5835"
          fillColor={disabled || isSending ? '#d8c8a7' : '#e5b45f'}
          innerHighlightColor="rgba(255, 255, 255, 0.34)"
          outerShadowColor="rgba(80, 53, 33, 0.2)"
          outerShadowOffsetX={3}
          outerShadowOffsetY={3}
        />
        <span className="relative z-40 flex items-center gap-2">
          <Send size={16} />
          Send
        </span>
      </button>
    </form>
  );
}
