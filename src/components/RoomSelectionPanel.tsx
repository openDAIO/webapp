import { FlaskConical, Gavel, LineChart, Vote, X } from 'lucide-react';
import { motion } from 'motion/react';
import { PixelFrameChrome } from './PixelFrame';
import type { ActiveReviewRoomId } from '../constants/reviewRoomScenes';

export type ReviewRoomId = ActiveReviewRoomId | 'investment' | 'dao';
export type { ActiveReviewRoomId };

export const REVIEW_ROOMS: Record<ReviewRoomId, { title: string; description: string; accent: string; accentColor: string; available: boolean }> = {
  paper: {
    title: 'Paper Review',
    description: 'Research claims, methodology, citations, and reproducibility.',
    accent: 'bg-[#83add0]',
    accentColor: '#83add0',
    available: true,
  },
  judgment: {
    title: 'Judgment Review',
    description: 'Case files, evidence quality, and decision consistency.',
    accent: 'bg-[#d99d68]',
    accentColor: '#d99d68',
    available: true,
  },
  investment: {
    title: 'Investment Proposal Review',
    description: 'Market logic, risk, traction, and token economics. (Coming soon)',
    accent: 'bg-[#e5b45f]',
    accentColor: '#e5b45f',
    available: false,
  },
  dao: {
    title: 'DAO Governance Review',
    description: 'Governance proposals, treasury motions, voter alignment, and execution risk. (Coming soon)',
    accent: 'bg-[#c6b5dc]',
    accentColor: '#c6b5dc',
    available: false,
  },
};

const roomIcons = {
  paper: FlaskConical,
  judgment: Gavel,
  investment: LineChart,
  dao: Vote,
};

interface RoomSelectionPanelProps {
  onSelect: (roomId: ActiveReviewRoomId) => void;
  onClose: () => void;
  activeRoomId?: ActiveReviewRoomId | null;
  isEvaluationInProgress?: boolean;
}

export default function RoomSelectionPanel({
  onSelect,
  onClose,
  activeRoomId = null,
  isEvaluationInProgress = false,
}: RoomSelectionPanelProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#4f6f52]/35 p-4 backdrop-blur-sm">
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        className="pixel-box warm-panel w-full max-w-4xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-select-title"
      >
        <PixelFrameChrome round={2} />
        <div className="mb-5 flex items-start justify-between gap-4 border-b-2 border-[#d7b98f] pb-3">
          <div>
            <h2 id="room-select-title" className="text-2xl font-bold text-[#503521]">
              Choose a Review Room
            </h2>
            <p className="text-sm text-[#6b563f]">Pick a category to prepare the evaluation crew.</p>
          </div>
          <button
            className="pixel-frame flex h-8 w-8 items-center justify-center text-[#5f211c] transition-transform hover:-translate-y-0.5 hover:brightness-105"
            onClick={onClose}
            aria-label="Close room selection"
          >
            <PixelFrameChrome
              round={2}
              thickness={4}
              color="#9c342d"
              fillColor="#d87965"
              innerHighlightColor="rgba(255, 255, 255, 0.24)"
              outerShadowColor="rgba(95, 33, 28, 0.22)"
              outerShadowOffsetX={2}
              outerShadowOffsetY={2}
            />
            <X className="relative z-40" size={18} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {(Object.keys(REVIEW_ROOMS) as ReviewRoomId[]).map((roomId) => {
            const Icon = roomIcons[roomId];
            const room = REVIEW_ROOMS[roomId];
            const isAvailable = room.available;
            const isActiveRoom = isEvaluationInProgress && activeRoomId === roomId;
            const isLockedByActiveEvaluation = isEvaluationInProgress && isAvailable && activeRoomId !== roomId;
            const canSelect = isAvailable && !isLockedByActiveEvaluation;

            return (
              <button
                key={roomId}
                onClick={() => {
                  if (canSelect) onSelect(roomId as ActiveReviewRoomId);
                }}
                disabled={!canSelect}
                aria-disabled={!canSelect}
                className={`pixel-frame group overflow-visible ${room.accent} p-4 text-left shadow-[4px_4px_0_rgba(80,53,33,0.25)] transition-transform focus:outline-none focus:ring-4 focus:ring-[#83add0] ${
                  canSelect
                    ? 'hover:-translate-y-1'
                    : 'cursor-not-allowed opacity-55 grayscale'
                }`}
              >
                <PixelFrameChrome round={2} fillColor={room.accentColor} />
                <div className={`mb-4 flex h-12 w-12 items-center justify-center border-2 border-[#5f4328] ${room.accent}`}>
                  <Icon size={24} aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#503521]">{room.title}</h3>
                <p className="text-sm leading-snug text-[#6b563f]">{room.description}</p>
                {isActiveRoom && (
                  <div className="pointer-events-none absolute left-1/2 top-[72%] z-40 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-[#2f5d7e] bg-[#edf5f8]/90 px-3 py-2 text-center text-lg font-bold uppercase tracking-widest text-[#2f5d7e] shadow-[3px_3px_0_rgba(38,59,72,0.18)]">
                    In Progress
                  </div>
                )}
                {!isAvailable && (
                  <div className="pointer-events-none absolute left-1/2 top-[72%] z-40 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-4 border-[#7b5835] bg-[#fff8e6]/85 px-4 py-2 text-center text-xl font-bold uppercase tracking-widest text-[#7b5835] shadow-[3px_3px_0_rgba(80,53,33,0.22)]">
                    Coming Soon
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
