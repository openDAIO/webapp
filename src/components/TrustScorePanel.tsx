
import { AICharacter } from '../types';
import { motion } from 'motion/react';
import { PixelFrameChrome } from './PixelFrame';
import { ASSET_PATHS } from '../assets/assetPaths';

interface TrustScorePanelProps {
  characters: AICharacter[];
}

export default function TrustScorePanel({ characters }: TrustScorePanelProps) {
  // Sort by trust score descending
  const sorted = [...characters].sort((a, b) => b.trustScore - a.trustScore);

  return (
    <div className="pixel-box warm-panel w-full">
      <PixelFrameChrome round={2} />
      <div className="text-xs font-bold text-[#503521] mb-3 uppercase border-b-2 border-[#d7b98f] pb-1">
        Node Trust
      </div>
      <div className="space-y-3">
        {sorted.map((char) => (
          <div key={char.id} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-2">
            <img
              src={`/assets/characters/reviewers/faces/${char.id}.png`}
              alt=""
              aria-hidden="true"
              className="h-7 w-7 object-contain [image-rendering:pixelated]"
              onError={(event) => {
                const fallbackAvatar = ASSET_PATHS.characters.reviewers[char.id]?.portrait ?? ASSET_PATHS.characters.reviewers[char.id]?.idle;
                if (!fallbackAvatar || event.currentTarget.src.endsWith(fallbackAvatar)) return;
                event.currentTarget.src = fallbackAvatar;
              }}
            />
            <div className="min-w-0 flex flex-col gap-1">
              <div className="flex items-end justify-between gap-2">
                <span className="max-w-[120px] truncate text-[10px]">{char.name}</span>
                <span className="text-[10px] font-bold text-[#2f5d7e]">{char.trustScore}</span>
              </div>
              <div className="relative h-2 overflow-hidden border border-[#d7b98f] bg-[#ead9b1]">
                <motion.div
                  className={`h-full ${char.trustScore > 70 ? 'bg-green-500' : char.trustScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${char.trustScore}%` }}
                  transition={{ type: 'spring', damping: 20 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
