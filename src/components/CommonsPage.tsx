import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { DoorOpen } from 'lucide-react';
import { ASSET_PATHS, REVIEWER_CHARACTERS } from '../assets/assetPaths';
import LiveFeedPanel from './LiveFeedPanel';
import { PixelFrameChrome } from './PixelFrame';
import RoomSelectionPanel, { ActiveReviewRoomId } from './RoomSelectionPanel';

const labels = ['Evaluating...', 'Reviewing...', 'In Discussion...'];

const commonsSafePositions = [
  [36, 27], [48, 25], [60, 31], [69, 39],
  [28, 43], [41, 40], [57, 44], [72, 50],
  [24, 58], [37, 55], [63, 57], [76, 63],
  [31, 73], [46, 70], [56, 77], [69, 73],
  [24, 70], [40, 84], [53, 91], [63, 88],
] as const;

function getCommonsPosition(index: number, total: number) {
  if (index < commonsSafePositions.length) {
    const [x, y] = commonsSafePositions[index];
    return { x, y };
  }

  const angle = ((index * 137.508) % 360) * (Math.PI / 180);
  const ring = 0.74 + Math.sqrt((index + 0.5) / Math.max(1, total)) * 0.34;

  return {
    x: 50 + Math.cos(angle) * ring * 22,
    y: 56 + Math.sin(angle) * ring * 32,
  };
}

interface CommonsPageProps {
  onRoomSelected: (roomId: ActiveReviewRoomId) => void;
  activeRoomId?: ActiveReviewRoomId | null;
  isEvaluationInProgress?: boolean;
  openRoomSelectionSignal?: number;
}

export default function CommonsPage({
  onRoomSelected,
  activeRoomId = null,
  isEvaluationInProgress = false,
  openRoomSelectionSignal = 0,
}: CommonsPageProps) {
  const [isSelectingRoom, setIsSelectingRoom] = useState(false);
  const previousOpenRoomSelectionSignal = useRef(openRoomSelectionSignal);
  const nodes = useMemo(() => {
    return REVIEWER_CHARACTERS.map((character, index) => ({
      ...character,
      ...getCommonsPosition(index, REVIEWER_CHARACTERS.length),
      delay: (index % 5) * 0.25,
      bubbleLabel: index % 5 === 0 ? labels[index % labels.length] : null,
    }));
  }, []);

  useEffect(() => {
    if (openRoomSelectionSignal > previousOpenRoomSelectionSignal.current) {
      setIsSelectingRoom(true);
    }
    previousOpenRoomSelectionSignal.current = openRoomSelectionSignal;
  }, [openRoomSelectionSignal]);

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#dff0c8] bg-cover bg-center text-[#503521]"
      style={{ backgroundImage: `url(${ASSET_PATHS.backgrounds.commons.villageSquare})` }}
    >
      <div className="absolute inset-0 bg-[#fff8e6]/10" />

      <section className="absolute left-6 top-20 z-20 max-w-xl">
        <p className="pixel-text-shadow text-sm uppercase tracking-widest text-white">Shared reviewer village</p>
        <h1 className="pixel-text-shadow text-5xl font-bold leading-none text-white">Commons</h1>
        <p className="pixel-text-shadow mt-3 max-w-md text-lg leading-snug text-white">
          Nodes gather, compare signals, and head into review rooms when a new evaluation begins.
        </p>
      </section>

      <div className="absolute right-5 top-20 z-30">
        <LiveFeedPanel />
      </div>

      <div className="absolute inset-0 z-10 pt-4">
        {nodes.map((node) => (
          <button
            key={node.id}
            className="absolute flex min-h-32 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-end focus:outline-none focus:ring-4 focus:ring-[#83add0]"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            aria-label={`${node.label} in Commons`}
          >
            {node.bubbleLabel && (
              <motion.span
                className="mb-1 border-2 border-[#7b5835] bg-[#fff8e6] px-2 py-0.5 text-[11px] shadow-[2px_2px_0_rgba(80,53,33,0.18)]"
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ repeat: Infinity, duration: 5, delay: node.delay }}
              >
                {node.bubbleLabel}
              </motion.span>
            )}
            <span
              className="commons-idle-step flex h-20 w-20 items-end justify-center"
              style={{ animationDelay: `${node.delay * 0.2}s` }}
            >
              <img
                src={node.assets.idle}
                alt={node.label}
                className="max-h-full max-w-full object-contain pixelated drop-shadow-[2px_3px_0_rgba(80,53,33,0.22)]"
                referrerPolicy="no-referrer"
              />
            </span>
            <span className="character-name-label">{node.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setIsSelectingRoom(true)}
        className="pixel-frame fixed bottom-7 right-7 z-40 flex items-center gap-3 px-7 py-4 text-2xl font-bold text-[#3f2818] shadow-[8px_8px_0_rgba(60,38,24,0.35)] transition-all hover:brightness-110 active:translate-y-1 active:shadow-[3px_3px_0_rgba(60,38,24,0.35)]"
      >
        <PixelFrameChrome round={3} fillColor="#f6c343" />
        <DoorOpen size={30} />
        Start Evaluation
      </button>

      <AnimatePresence>
        {isSelectingRoom && (
          <RoomSelectionPanel
            onClose={() => setIsSelectingRoom(false)}
            onSelect={(roomId) => {
              setIsSelectingRoom(false);
              onRoomSelected(roomId);
            }}
            activeRoomId={activeRoomId}
            isEvaluationInProgress={isEvaluationInProgress}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
