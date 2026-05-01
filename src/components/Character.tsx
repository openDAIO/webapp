import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AICharacter } from '../types';
import { ASSET_PATHS } from '../assets/assetPaths';

interface CharacterProps {
  data: AICharacter;
  onClick?: () => void;
  isSelected?: boolean;
  showTalkingBubble?: boolean;
  showThoughtCloud?: boolean;
}

export default function Character({ data, onClick, isSelected, showTalkingBubble = false, showThoughtCloud = false }: CharacterProps) {
  const [imgError, setImgError] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);
  const [talkingBubbleError, setTalkingBubbleError] = useState(false);
  const [thoughtCloudError, setThoughtCloudError] = useState(false);
  const [thoughtCloudCycle, setThoughtCloudCycle] = useState(0);
  const [isAtTarget, setIsAtTarget] = useState(true);
  const previousTargetKeyRef = useRef<string | null>(null);
  const hasInitializedTargetRef = useRef(false);
  
  const reviewerAssets = ASSET_PATHS.characters.reviewers[data.id as keyof typeof ASSET_PATHS.characters.reviewers];

  const getDesiredSpriteUrl = () => {
    if (!reviewerAssets) return null;
    
    if (data.isOutlier || data.status === 'SLASHED') return reviewerAssets.penalty;
    
    if (data.status === 'REWARDED') return reviewerAssets.reward;

    if (data.status === 'THINKING' || data.status === 'MOVING' || data.status === 'RETURNING' || data.status === 'DISCUSSING') {
      return reviewerAssets.think;
    }
    
    return reviewerAssets.idle;
  };

  const desiredSpriteUrl = getDesiredSpriteUrl();
  const spriteUrl = usedFallback ? reviewerAssets?.idle : desiredSpriteUrl;
  const isResultStateSprite = Boolean(
    spriteUrl &&
      reviewerAssets &&
      spriteUrl !== reviewerAssets.idle &&
      (data.status === 'REWARDED' || data.status === 'SLASHED' || data.isOutlier),
  );

  useEffect(() => {
    setImgError(false);
    setUsedFallback(false);
  }, [data.id, desiredSpriteUrl]);

  useEffect(() => {
    if (showTalkingBubble) setTalkingBubbleError(false);
    if (showThoughtCloud) setThoughtCloudError(false);
  }, [showTalkingBubble, showThoughtCloud]);

  const targetKey = `${data.position.x}:${data.position.y}:${data.position.offsetX || 0}:${data.position.offsetY || 0}`;

  useEffect(() => {
    const isMovingState = ['MOVING', 'RETURNING', 'DISCUSSING'].includes(data.status);
    const targetChanged = hasInitializedTargetRef.current && previousTargetKeyRef.current !== targetKey;
    previousTargetKeyRef.current = targetKey;
    hasInitializedTargetRef.current = true;

    if (targetChanged || isMovingState) {
      setIsAtTarget(false);
      return;
    }

    setIsAtTarget((current) => current);
  }, [targetKey, data.status]);

  const handleMovementComplete = () => {
    setIsAtTarget(true);
  };

  const isTalking = showTalkingBubble && data.status === 'DISCUSSING';
  const isThinking = showThoughtCloud && data.status === 'THINKING' && isAtTarget;
  const shouldShowTalkingBubble = isTalking && !talkingBubbleError;
  const shouldShowThoughtCloud = isThinking && !thoughtCloudError;

  useEffect(() => {
    if (!shouldShowThoughtCloud) return undefined;

    setThoughtCloudCycle((cycle) => cycle + 1);
    const interval = window.setInterval(() => {
      setThoughtCloudCycle((cycle) => cycle + 1);
    }, 1400);

    return () => window.clearInterval(interval);
  }, [shouldShowThoughtCloud]);

  const handleImgError = () => {
    if (spriteUrl === reviewerAssets?.idle || usedFallback) {
      setImgError(true);
    } else {
      setUsedFallback(true);
    }
  };

  // State and identity-aware movement logic for the ai-01..ai-05 lab crew.
  
  const isReturning = data.status === 'RETURNING';

  // For all characters: 
  // Going (isReturning=false) -> Move Vertical then Horizontal (moveHV=false)
  // Returning (isReturning=true) -> Move Horizontal then Vertical (moveHV=true)
  const moveHV = isReturning;

  // Use calc() to combine responsive percentages with fixed pixel offsets from the room
  const targetX = `calc(${data.position.x}% + ${data.position.offsetX || 0}px)`;
  const targetY = `calc(${data.position.y}% + ${data.position.offsetY || 0}px)`;

  const movementSequence = moveHV ? {
    // Horizontal then Vertical
    left: [null, targetX, targetX],
    top: [null, null, targetY],
  } : {
    // Vertical then Horizontal
    top: [null, targetY, targetY],
    left: [null, null, targetX],
  };

  return (
    <motion.div
      className={`pointer-events-auto absolute z-20 flex cursor-pointer flex-col items-center justify-center p-2 transition-transform ${isSelected ? 'scale-110' : 'hover:scale-105'}`}
      initial={false}
      animate={{
        ...movementSequence,
        x: '-50%',
        y: '-50%',
      }}
      transition={{
        duration: 1.5 / data.speed, // Slightly slower for more impact
        times: [0, 0.5, 1],
        ease: "easeInOut"
      }}
      onClick={onClick}
      onAnimationComplete={handleMovementComplete}
    >
      <div className={`relative ${spriteUrl && !imgError ? 'w-16 h-16' : 'w-12 h-12 flex items-center justify-center'}`}>
        <motion.div
          className="h-full w-full"
          animate={isTalking ? { y: [0, -4, 0, 4, 0] } : { y: 0 }}
          transition={isTalking ? { repeat: Infinity, duration: 1, ease: 'easeInOut' } : undefined}
        >
          {spriteUrl && !imgError ? (
            <img
              key={spriteUrl} // Ensure re-render when switching to fallback
              src={spriteUrl}
              alt={data.name}
              className={`reviewer-sprite-img h-full w-full object-contain pixelated ${isResultStateSprite ? 'reviewer-sprite-img--result-gif' : ''}`}
              onError={handleImgError}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`w-8 h-8 rounded-full ${data.color} animate-pulse shadow-lg`} />
          )}
        </motion.div>

        {(isTalking || isThinking) && (
          <motion.div 
            className="absolute -top-9 left-1/2 z-20 -translate-x-1/2 text-xs"
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            {shouldShowTalkingBubble ? (
              <img
                src={ASSET_PATHS.effects.talkingBubble}
                alt="대화중"
                className="h-9 w-20 object-contain pixelated drop-shadow-[2px_2px_0_rgba(80,53,33,0.18)]"
                onError={() => setTalkingBubbleError(true)}
              />
            ) : isTalking ? (
              <span className="block whitespace-nowrap rounded-sm border-2 border-[#7b5835] bg-white px-2 py-0.5 text-[#503521] shadow-sm">
                대화중
              </span>
            ) : null}
            {shouldShowThoughtCloud ? (
              <img
                key={thoughtCloudCycle}
                src={`${ASSET_PATHS.effects.thoughtCloud}?cycle=${thoughtCloudCycle}`}
                alt="연구중"
                className="h-10 w-16 object-contain pixelated drop-shadow-[2px_2px_0_rgba(80,53,33,0.16)]"
                onError={() => setThoughtCloudError(true)}
              />
            ) : isThinking ? (
              <span className="block whitespace-nowrap rounded-sm border-2 border-[#7b5835] bg-white px-2 py-0.5 text-[#503521] shadow-sm">
                연구중
              </span>
            ) : null}
          </motion.div>
        )}
        
      </div>
      <div className="character-name-label">
        {data.name}
      </div>
      {isSelected && (
        <div className="absolute inset-0 border-2 border-yellow-400 -m-1 pointer-events-none animate-pulse" />
      )}
    </motion.div>
  );
}
