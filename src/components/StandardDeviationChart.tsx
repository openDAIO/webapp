import { useEffect, useState, type ReactNode } from 'react';
import { AICharacter } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ASSET_PATHS } from '../assets/assetPaths';
import { PixelFrameChrome } from './PixelFrame';

interface StandardDeviationChartProps {
  characters: AICharacter[];
  visible: boolean;
  prominent?: boolean;
  stickyDomain?: boolean;
  averageBoxed?: boolean;
  averageDetail?: ReactNode;
  scoreboard?: boolean;
  displayRound?: number | 'final';
  analysisRoundLabel?: string;
  highlightUpdate?: boolean;
  compact?: boolean;
}

function getChartDomain(scores: number[]) {
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 100;
  const centerScore = (minScore + maxScore) / 2;
  const rawRange = Math.max(1, maxScore - minScore);
  const paddedRange = Math.max(6, rawRange * 1.12);
  let min = Math.max(0, centerScore - paddedRange / 2);
  let max = Math.min(100, centerScore + paddedRange / 2);

  if (min === 0) {
    max = Math.min(100, paddedRange);
  }

  if (max === 100) {
    min = Math.max(0, 100 - paddedRange);
  }

  return { min, max };
}

export default function StandardDeviationChart({
  characters,
  visible,
  prominent = false,
  stickyDomain = false,
  averageBoxed = false,
  averageDetail,
  scoreboard = false,
  displayRound,
  analysisRoundLabel,
  highlightUpdate = false,
  compact = false,
}: StandardDeviationChartProps) {
  const plottedScores = characters
    .map((character) => {
      if (typeof displayRound === 'number') {
        return character.scoreHistory.find((entry) => entry.round === displayRound)?.score;
      }
      return character.lastScore;
    })
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  const hasPlottedScores = plottedScores.length > 0;
  const hasScoreForDisplay = (character: AICharacter) => {
    if (typeof displayRound === 'number') {
      return typeof character.scoreHistory.find((entry) => entry.round === displayRound)?.score === 'number';
    }
    return typeof character.lastScore === 'number';
  };
  const scores = hasPlottedScores ? plottedScores : [0];
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const scoreFor = (character: AICharacter) => {
    if (typeof displayRound === 'number') {
      return character.scoreHistory.find((entry) => entry.round === displayRound)?.score ?? avg;
    }
    return character.lastScore ?? avg;
  };
  const targetDomain = getChartDomain(plottedScores);
  const [lockedDomain, setLockedDomain] = useState(targetDomain);

  useEffect(() => {
    if (!stickyDomain) {
      setLockedDomain(targetDomain);
      return;
    }

    setLockedDomain((current) => ({
      min: Math.min(current.min, targetDomain.min),
      max: Math.max(current.max, targetDomain.max),
    }));
  }, [stickyDomain, targetDomain.min, targetDomain.max]);

  const chartMin = stickyDomain ? lockedDomain.min : targetDomain.min;
  const chartMax = stickyDomain ? lockedDomain.max : targetDomain.max;
  const chartRange = Math.max(1, chartMax - chartMin);
  const positionFor = (score: number) => `${Math.min(100, Math.max(0, ((score - chartMin) / chartRange) * 100))}%`;
  const scoreGroups = [...characters]
    .filter(hasScoreForDisplay)
    .sort((a, b) => scoreFor(a) - scoreFor(b))
    .reduce<Array<{ score: number; members: AICharacter[] }>>((groups, character) => {
      const score = scoreFor(character);
      const existingGroup = groups.find((group) => group.score === score);

      if (existingGroup) {
        existingGroup.members.push(character);
        return groups;
      }

      return [...groups, { score, members: [character] }];
    }, []);
  const groupLayoutByCharacterId = new Map<string, { lane: number; offset: number }>();
  scoreGroups.forEach((group, groupIndex) => {
    const lane = groupIndex % 3;
    group.members.forEach((character, memberIndex) => {
      groupLayoutByCharacterId.set(character.id, {
        lane,
        offset: (memberIndex - (group.members.length - 1) / 2) * 24,
      });
    });
  });
  const labelTops = compact ? [0, 0, 0] : [0, 18, 36];
  const axisTop = prominent ? compact ? 30 : 58 : 0;
  const rangeLabelTop = axisTop + 20;
  const averageValueTop = compact ? axisTop + 28 : axisTop + (averageBoxed ? 48 : 31);
  const chartHeightClass = prominent
    ? averageBoxed
      ? 'mb-1 h-[170px]'
      : compact
        ? 'mb-0 h-[92px]'
        : scoreboard
        ? 'mb-1 h-[180px]'
        : 'mb-1 h-[136px]'
    : 'mb-4 h-8';
  const faceIconPath = (character: AICharacter) => `/assets/characters/reviewers/faces/${character.id}.png`;
  const fallbackPortraitPath = (character: AICharacter) =>
    ASSET_PATHS.characters.reviewers[character.id as keyof typeof ASSET_PATHS.characters.reviewers]?.portrait;
  const axisColor = scoreboard ? '#9ff8ff' : '#7b5835';
  const averageLineColor = scoreboard ? '#f1c46d' : '#263b48';
  const averageLineGap = scoreboard ? 0 : 5;
  const labelTextClass = scoreboard ? 'text-[#d9f7ff]' : 'text-[#263b48]';
  const mutedTextClass = scoreboard ? 'text-[#9eb6c3]' : 'text-[#2f5d7e]';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`relative w-full ${prominent ? 'px-2 py-0' : 'px-8 py-2'}`}
        >
          {!prominent && (
            <div className={`mb-3 text-[9px] font-bold uppercase tracking-tighter opacity-80 ${mutedTextClass}`}>
              Consensus Analysis
            </div>
          )}
          
          <div className={`relative ${chartHeightClass}`}>
            {/* X Axis */}
            <div
              className={`absolute left-0 right-0 h-[1px] rounded-full opacity-50 ${prominent ? '' : 'top-1/2 -translate-y-1/2'}`}
              style={{ ...(prominent ? { top: `${axisTop}px` } : undefined), backgroundColor: axisColor }}
            />
            
            {/* Average line */}
            {hasPlottedScores && (
              <motion.div
                className="absolute top-0 z-0 w-[3px] -translate-x-1/2 opacity-90"
                style={{
                  background: `repeating-linear-gradient(to bottom, ${averageLineColor} 0 5px, transparent 5px 9px)`,
                  height: prominent ? `${Math.max(0, averageValueTop - averageLineGap)}px` : '100%',
                }}
                initial={{ left: positionFor(avg) }}
                animate={{ left: positionFor(avg) }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              />
            )}

            {prominent && !compact && characters
              .filter(hasScoreForDisplay)
              .map((character) => {
              const layout = groupLayoutByCharacterId.get(character.id) ?? { lane: 0, offset: 0 };
              const score = scoreFor(character);
              const labelTop = labelTops[layout.lane];
              const connectorTop = labelTop + 18;

              return (
                <div key={`${character.id}-label`}>
                  <motion.div
                    initial={{ opacity: 0, y: -6, left: positionFor(score), top: labelTop, marginLeft: layout.offset }}
                    animate={{ opacity: 1, y: 0, left: positionFor(score), top: labelTop, marginLeft: layout.offset }}
                    transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                    className="absolute z-20 flex -translate-x-1/2 items-start justify-center"
                  >
                    <div className="flex w-[32px] flex-col items-center">
                      <img
                        src={faceIconPath(character)}
                        alt={character.name}
                        className={`h-5 w-5 object-contain ${scoreboard ? 'drop-shadow-[0_0_4px_rgba(159,248,255,0.6)]' : 'drop-shadow-[1px_1px_0_rgba(38,59,72,0.25)]'}`}
                        onError={(event) => {
                          const fallback = fallbackPortraitPath(character);
                          event.currentTarget.onerror = null;
                          if (fallback) {
                            event.currentTarget.src = fallback;
                          }
                        }}
                      />
                      <span className={`mt-0.5 w-[44px] truncate text-center text-[7px] uppercase leading-none tracking-wider ${labelTextClass}`}>
                        {character.name}
                      </span>
                    </div>
                  </motion.div>
                  <motion.span
                    className={`absolute z-0 w-px ${character.isOutlier ? 'bg-[#d87965]/70' : scoreboard ? 'bg-[#9ff8ff]/50' : 'bg-[#b8cbd5]'}`}
                    initial={{
                      left: positionFor(score),
                      top: `${connectorTop}px`,
                      height: `${Math.max(8, axisTop - connectorTop)}px`,
                      marginLeft: layout.offset,
                    }}
                    animate={{
                      left: positionFor(score),
                      top: `${connectorTop}px`,
                      height: `${Math.max(8, axisTop - connectorTop)}px`,
                      marginLeft: layout.offset,
                    }}
                    transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                    aria-hidden="true"
                  />
                </div>
              );
            })}

            {/* Character markers on graph */}
            {characters.filter(hasScoreForDisplay).map((char) => {
              const layout = groupLayoutByCharacterId.get(char.id) ?? { lane: 0, offset: 0 };
              return (
                <motion.div
                  key={char.id}
                  initial={{ scale: 0, left: positionFor(scoreFor(char)), marginLeft: prominent ? layout.offset : 0, x: '-50%', y: '-50%' }}
                  animate={{ scale: 1, left: positionFor(scoreFor(char)), marginLeft: prominent ? layout.offset : 0, x: '-50%', y: '-50%' }}
                  transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                  className={`absolute z-10 flex flex-col items-center ${prominent ? '' : 'top-1/2 -translate-y-1/2'}`}
                  style={prominent ? { top: `${axisTop}px` } : undefined}
                >
                   {prominent && compact && scoreboard ? (
                     <img
                       src={faceIconPath(char)}
                       alt={char.name}
                       className="h-5 w-5 object-contain drop-shadow-[0_0_4px_rgba(159,248,255,0.7)]"
                       onError={(event) => {
                         const fallback = fallbackPortraitPath(char);
                         event.currentTarget.onerror = null;
                         if (fallback) {
                           event.currentTarget.src = fallback;
                         }
                       }}
                     />
                   ) : (
                     <div className={`${prominent ? 'h-3 w-3 border-2' : 'h-2.5 w-2.5 border'} rounded-full ${scoreboard ? 'border-[#d9f7ff] shadow-[0_0_8px_rgba(159,248,255,0.45)]' : 'border-[#503521] shadow-sm'} ${char.isOutlier ? 'bg-red-500 animate-ping' : char.color}`} />
                   )}
                   <div className={`mt-0.5 whitespace-nowrap font-mono font-bold leading-none ${prominent ? 'sr-only' : 'text-[9px]'}`}>
                     {char.lastScore}
                   </div>
                </motion.div>
              );
            })}

            {prominent && hasPlottedScores && characters
              .filter(hasScoreForDisplay)
              .map((character) => {
                const layout = groupLayoutByCharacterId.get(character.id) ?? { lane: 0, offset: 0 };
                const score = scoreFor(character);

                return (
                  <motion.div
                    key={`${character.id}-score`}
                    initial={{ opacity: 0, left: positionFor(score), marginLeft: layout.offset, y: 4 }}
                    animate={{ opacity: 1, left: positionFor(score), marginLeft: layout.offset, y: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                    className={`absolute z-10 -translate-x-1/2 font-mono font-bold leading-none ${
                      compact ? 'text-[10px]' : 'text-xs'
                    } ${character.isOutlier ? 'text-red-400' : scoreboard ? 'text-[#9effc2]' : 'text-green-500'}`}
                    style={{ top: `${compact ? Math.max(2, axisTop - 18) : axisTop + 8}px` }}
                  >
                    {score}
                  </motion.div>
                );
              })}

            <div
              className={`absolute left-0 font-mono text-[6px] opacity-60 ${prominent ? '' : 'bottom-[-12px]'} ${scoreboard ? 'text-[#9eb6c3]' : ''}`}
              style={prominent ? { top: `${rangeLabelTop}px` } : undefined}
            >
              {chartMin.toFixed(1)}
            </div>
            <div
              className={`absolute right-0 font-mono text-[6px] opacity-60 ${prominent ? '' : 'bottom-[-12px]'} ${scoreboard ? 'text-[#9eb6c3]' : ''}`}
              style={prominent ? { top: `${rangeLabelTop}px` } : undefined}
            >
              {chartMax.toFixed(1)}
            </div>
            {prominent && hasPlottedScores && (
              <motion.div
                className={`absolute z-20 flex -translate-x-1/2 flex-col items-center gap-1 leading-none ${labelTextClass} ${
                  scoreboard
                    ? `scoreboard-consensus-box ${highlightUpdate ? 'scoreboard-consensus-box--updated' : ''} border-2 border-dashed border-[#f1c46d] bg-[#1b2b3a] ${compact ? 'px-2 py-1' : 'px-3 py-2'}`
                    : ''
                } ${
                  averageBoxed
                    ? 'isolate bg-transparent px-3 py-1.5'
                    : ''
                }`}
                style={{ top: `${averageValueTop}px` }}
                initial={{ left: positionFor(avg), opacity: 0, y: 5 }}
                animate={{ left: positionFor(avg), opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              >
                {averageBoxed && (
                  <PixelFrameChrome
                    round={2}
                    thickness={3}
                    color={scoreboard ? '#07111f' : '#7fa8bc'}
                    fillColor={scoreboard ? '#1b2b3a' : '#f8fcff'}
                    innerHighlightColor={scoreboard ? 'rgba(159, 248, 255, 0.18)' : 'rgba(255, 255, 255, 0.72)'}
                    outerShadowColor={scoreboard ? 'rgba(0, 0, 0, 0.34)' : 'rgba(54, 80, 94, 0.18)'}
                    outerShadowOffsetX={3}
                    outerShadowOffsetY={3}
                  />
                )}
                {analysisRoundLabel && (
                  <span className={`relative z-40 whitespace-nowrap font-mono font-bold uppercase tracking-widest text-[#9ff8ff] ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                    {analysisRoundLabel}
                  </span>
                )}
                <span
                  className={`relative z-40 whitespace-nowrap font-pixel font-bold uppercase tracking-widest ${compact ? 'text-[8px]' : 'text-[12px]'} ${
                    scoreboard ? 'text-[#ffd98a]' : mutedTextClass
                  }`}
                >
                  Consensus Analysis
                </span>
                <span className={`relative z-40 font-mono font-bold ${compact ? 'text-lg' : 'text-3xl'}`}>{avg.toFixed(1)}</span>
                {averageDetail && <span className="relative z-40">{averageDetail}</span>}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
