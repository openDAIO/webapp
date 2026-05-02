import { useState, type CSSProperties } from 'react';
import { BadgeCheck, CircleDashed } from 'lucide-react';
import { motion } from 'motion/react';
import type { AICharacter } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';

interface NodeBottleProps {
  node: AICharacter;
  isComplete: boolean;
  index: number;
}

function nodePositionStyle(node: AICharacter, index: number): CSSProperties {
  return {
    left: `calc(${node.idlePosition.x}% + ${node.idlePosition.offsetX || 0}px)`,
    top: `calc(${node.idlePosition.y}% + ${node.idlePosition.offsetY || 0}px)`,
    '--node-selection-delay': `${index * 0.13}s`,
  } as CSSProperties;
}

export default function NodeBottle({ node, isComplete, index }: NodeBottleProps) {
  const [imageError, setImageError] = useState(false);
  const reviewerAssets = ASSET_PATHS.characters.reviewers[node.id];
  const spriteUrl = !isComplete
    ? reviewerAssets?.think ?? node.sprite
    : node.sprite ?? reviewerAssets?.idle;
  const selectionState = !isComplete ? 'selecting' : node.selected ? 'selected' : 'standby';
  const label = selectionState === 'selected' ? 'SELECTED' : selectionState === 'standby' ? 'STANDBY' : 'SCANNING';

  return (
    <motion.div
      className={`node-bottle node-bottle--${selectionState} pointer-events-none absolute z-[84] flex flex-col items-center`}
      style={nodePositionStyle(node, index)}
      role="listitem"
      aria-label={`${node.name}: ${label}`}
      initial={{ opacity: 0, scale: 0.88, x: '-50%', y: '-46%' }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
      transition={{ type: 'spring', damping: 20, stiffness: 260, delay: index * 0.04 }}
    >
      <span className="node-bottle__aura" aria-hidden="true" />
      <div className="node-bottle__sprite-wrap">
        {spriteUrl && !imageError ? (
          <img
            src={spriteUrl}
            alt=""
            aria-hidden="true"
            className="node-bottle__sprite pixelated"
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={`node-bottle__fallback ${node.color}`} aria-hidden="true" />
        )}
      </div>
      <div className="character-name-label node-bottle__name">{node.name}</div>
      <div className="node-bottle__badge">
        {selectionState === 'selected' ? <BadgeCheck size={12} /> : <CircleDashed size={12} />}
        <span>{label}</span>
      </div>
    </motion.div>
  );
}
