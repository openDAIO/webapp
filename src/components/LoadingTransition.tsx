import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ASSET_PATHS } from '../assets/assetPaths';
import type { AICharacter } from '../types';
import { PixelFrameChrome } from './PixelFrame';
import { ActiveReviewRoomId, REVIEW_ROOMS } from './RoomSelectionPanel';

const LOADING_COPY: Record<ActiveReviewRoomId, string[]> = {
  paper: [
    'Summoning the professors to the lab...',
    'The PhDs are putting on their shoes...',
    'Brewing coffee for the research team...',
  ],
  judgment: [
    'The judges are taking their seats...',
    'Opening the case files...',
    'Polishing the evidence board...',
  ],
};

interface LoadingTransitionProps {
  roomId: ActiveReviewRoomId;
  reviewers: AICharacter[];
  onComplete: () => void;
}

const REVIEWER_LOAD_COUNT = 5;
const FIRST_REVIEWER_DELAY_MS = 360;
const REVIEWER_ARRIVAL_INTERVAL_MS = 620;
const COMPLETE_AFTER_FINAL_REVIEWER_MS = 520;

export default function LoadingTransition({ roomId, reviewers, onComplete }: LoadingTransitionProps) {
  const [copyIndex, setCopyIndex] = useState(0);
  const [loadedReviewerCount, setLoadedReviewerCount] = useState(0);
  const lines = useMemo(() => LOADING_COPY[roomId], [roomId]);
  const loadingReviewers = useMemo(() => reviewers.slice(0, REVIEWER_LOAD_COUNT), [reviewers]);
  const targetReviewerCount = loadingReviewers.length || REVIEWER_LOAD_COUNT;

  useEffect(() => {
    const copyTimer = window.setInterval(() => {
      setCopyIndex((index) => (index + 1) % lines.length);
    }, 900);

    return () => {
      window.clearInterval(copyTimer);
    };
  }, [lines.length, onComplete]);

  useEffect(() => {
    setLoadedReviewerCount(0);

    const reviewerTimers = Array.from({ length: targetReviewerCount }, (_, index) => (
      window.setTimeout(
        () => setLoadedReviewerCount(index + 1),
        FIRST_REVIEWER_DELAY_MS + (index * REVIEWER_ARRIVAL_INTERVAL_MS),
      )
    ));
    const completeTimer = window.setTimeout(
      onComplete,
      FIRST_REVIEWER_DELAY_MS +
        ((targetReviewerCount - 1) * REVIEWER_ARRIVAL_INTERVAL_MS) +
        COMPLETE_AFTER_FINAL_REVIEWER_MS,
    );

    return () => {
      reviewerTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(completeTimer);
    };
  }, [onComplete, roomId, targetReviewerCount]);

  const progressPercent = Math.min(100, (loadedReviewerCount / targetReviewerCount) * 100);

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#dff0c8] bg-cover bg-center p-6"
      style={{ backgroundImage: `url(${ASSET_PATHS.backgrounds.reviewRooms[roomId]})` }}
    >
      <div className="absolute inset-0 bg-[#2b241c]/35" />
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pixel-box warm-panel relative z-10 w-full max-w-xl text-center"
      >
        <PixelFrameChrome round={2} />
        <div className="mx-auto mb-6 flex min-h-28 w-full max-w-md items-end justify-center">
          <div className="flex min-h-24 items-end justify-center gap-3" role="list" aria-label="Review nodes entering room">
            {loadingReviewers.slice(0, loadedReviewerCount).map((reviewer) => {
              const reviewerAssets = ASSET_PATHS.characters.reviewers[reviewer.id];
              const spriteUrl = reviewerAssets?.think ?? reviewerAssets?.idle;

              return (
                <motion.div
                  key={reviewer.id}
                  layout
                  className="flex w-16 items-end justify-center"
                  role="listitem"
                  initial={{ opacity: 0, y: 12, scale: 0.82 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  {spriteUrl && (
                    <img
                      src={spriteUrl}
                      alt={reviewer.name}
                      className="pixelated max-h-24 max-w-full object-contain drop-shadow-[2px_3px_0_rgba(80,53,33,0.22)]"
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
        <p className="mb-2 text-sm uppercase tracking-widest text-[#6b563f]">Entering</p>
        <h1 className="mb-5 text-3xl font-bold text-[#503521]">{REVIEW_ROOMS[roomId].title}</h1>
        <motion.p
          key={copyIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-8 text-lg text-[#5f4328]"
        >
          {lines[copyIndex]}
        </motion.p>
        <p className="mt-2 text-sm text-[#6b563f]">{loadedReviewerCount}/{targetReviewerCount} review nodes connected</p>
        <div className="mx-auto mt-5 h-3 w-56 border-2 border-[#7b5835] bg-[#fff8e6]">
          <motion.div
            className="h-full bg-[#83add0]"
            initial={false}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          />
        </div>
      </motion.section>
    </main>
  );
}
