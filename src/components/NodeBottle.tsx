import { useState, type CSSProperties } from 'react';
import { BadgeCheck, CircleDashed } from 'lucide-react';
import { motion } from 'motion/react';
import type { AICharacter } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';

interface NodeBottleProps {
  node: AICharacter;
  isComplete: boolean;
  index: number;
  decorateOnly?: boolean;
  onClick?: (nodeId: string) => void;
}

function nodePositionStyle(node: AICharacter, index: number): CSSProperties {
  return {
    left: `calc(${node.idlePosition.x}% + ${node.idlePosition.offsetX || 0}px)`,
    top: `calc(${node.idlePosition.y}% + ${node.idlePosition.offsetY || 0}px)`,
    '--node-selection-delay': `${index * 0.13}s`,
  } as CSSProperties;
}

export default function NodeBottle({ node, isComplete, index, decorateOnly = false, onClick }: NodeBottleProps) {
  const [imageError, setImageError] = useState(false);
  const reviewerAssets = ASSET_PATHS.characters.reviewers[node.id];
  const spriteUrl = !isComplete
    ? reviewerAssets?.think ?? node.sprite
    : node.sprite ?? reviewerAssets?.idle;
  const selectionState = !isComplete ? 'selecting' : node.selected ? 'selected' : 'standby';
  const label = selectionState === 'selected' ? 'SELECTED' : selectionState === 'standby' ? 'STANDBY' : 'SCANNING';
  const isClickable = isComplete && node.selected && Boolean(onClick);

  return (
    <motion.button
      type="button"
      disabled={!isClickable}
      onClick={() => onClick?.(node.id)}
      data-reviewer-detail-trigger={isClickable ? 'true' : undefined}
      className={`node-bottle node-bottle--${selectionState} ${decorateOnly ? 'node-bottle--decorative' : ''} absolute z-[84] flex flex-col items-center border-0 bg-transparent p-0 ${
        isClickable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
      }`}
      style={nodePositionStyle(node, index)}
      role="listitem"
      aria-label={`${node.name}: ${label}`}
      initial={{ opacity: 0, scale: 0.88, x: '-50%', y: '-46%' }}
      animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
      transition={{ type: 'spring', damping: 20, stiffness: 260, delay: index * 0.04 }}
    >
      <span className="node-bottle__aura" aria-hidden="true" />
      {!decorateOnly && (
        <>
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
        </>
      )}
      <div className="node-bottle__badge">
        {selectionState === 'selected' ? <BadgeCheck size={12} /> : <CircleDashed size={12} />}
        <span>{label}</span>
      </div>
    </motion.button>
  );
}
