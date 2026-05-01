
import { useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { AICharacter } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';
import { PixelFrameChrome } from './PixelFrame';

interface DialoguePanelProps {
  character: AICharacter | null;
  onClose: () => void;
  onReply: (message: string) => void;
}

export default function DialoguePanel({ character, onClose, onReply }: DialoguePanelProps) {
  const [input, setInput] = useState('');

  if (!character) return null;

  const handleSend = () => {
    if (!input.trim()) return;
    onReply(input);
    setInput('');
  };

  const portraitUrl = ASSET_PATHS.characters.reviewers[character.id as keyof typeof ASSET_PATHS.characters.reviewers]?.portrait;

  return (
    <div className="pixel-box bg-[#0a0a1a] border-white/20 w-full h-full flex items-center relative gap-6 p-4">
      <PixelFrameChrome color="rgba(255, 255, 255, 0.2)" fillColor="#0a0a1a" innerHighlightColor="rgba(255, 255, 255, 0.08)" round={2} />
      {/* Portrait Area */}
      <div className="flex-shrink-0 w-24 h-24 bg-black/40 border-2 border-white/10 rounded-sm overflow-hidden flex items-center justify-center relative group">
        <div className={`absolute inset-0 ${character.color} opacity-20`} />
        {portraitUrl ? (
          <img 
            src={portraitUrl} 
            alt={character.name} 
            className="w-full h-full object-contain pixelated z-10"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="text-white/20 font-bold text-xs uppercase z-10">Portrait</div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-widest text-game-border px-1">
          Direct Inquiry: {character.name}
        </div>
        
        <div className="flex gap-2">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask ${character.name}...`}
            className="flex-1 bg-black border-2 border-white/10 px-4 py-2 text-sm focus:border-game-border outline-none transition-colors text-white"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim()}
            className="pixel-box bg-game-accent px-6 flex items-center justify-center hover:bg-game-border hover:bg-opacity-80 transition-colors disabled:opacity-50 text-white"
          >
            <PixelFrameChrome fillColor="#8fbf7a" round={2} />
            <Send size={18} />
          </button>
        </div>
        
        <div className="text-[9px] opacity-30 px-1 italic">
          * Neural link operational. Prioritizing response latency.
        </div>
      </div>

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-2 right-2 hover:scale-110 transition-transform text-red-500 z-10 p-1"
        title="Close Dialogue"
      >
        <X size={20} />
      </button>
    </div>
  );
}
