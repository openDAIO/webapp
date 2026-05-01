
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PixelFrameChrome } from './PixelFrame';
import type { ConfirmedReviewBounty } from './ReviewBountyGateOverlay';

interface SubmissionPanelProps {
  onSubmit: (title: string, link: string) => void;
  onNext: () => void;
  disabled: boolean;
  showNext: boolean;
  isSubmitting: boolean;
  reviewBounty: ConfirmedReviewBounty;
}

export default function SubmissionPanel({ onSubmit, onNext, disabled, showNext, isSubmitting, reviewBounty }: SubmissionPanelProps) {
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');

  const handleManualSubmit = () => {
    if (!title) return;
    onSubmit(title, link);
    setTitle('');
    setLink('');
  };

  return (
    <div className="pixel-box warm-panel w-full flex items-center justify-between gap-6 relative overflow-visible h-full">
      <PixelFrameChrome round={2} />
      <div className="flex-1 flex flex-col gap-3">
        <div className="text-sm font-bold text-[#2f6f35]">
          Review Bounty: {reviewBounty.amount.toFixed(2)} {reviewBounty.asset}
        </div>

        <div className="text-xs font-bold text-[#503521] uppercase">Submit New Paper</div>
        <input
          type="text"
          placeholder="Paper Title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled || isSubmitting}
          className="bg-white border-4 border-[#d7b98f] px-3 py-1 text-sm text-[#503521] focus:border-[#83add0] outline-none transition-colors disabled:opacity-50"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Link / File Path (Optional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={disabled || isSubmitting}
            className="flex-1 bg-white border-4 border-[#d7b98f] px-3 py-1 text-sm text-[#503521] focus:border-[#83add0] outline-none transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleManualSubmit}
            disabled={disabled || isSubmitting || !title}
            className={`pixel-button py-1 text-sm whitespace-nowrap ${disabled || isSubmitting || !title ? 'opacity-50 grayscale' : 'hover:scale-105'}`}
          >
            Submit Paper
          </button>
        </div>
      </div>

      {/* Submission Visual Area (Always Present) */}
      <div className="flex-shrink-0 w-64 h-full flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          {showNext ? (
            <motion.div 
              key="next"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full h-full flex items-center justify-center"
            >
              <button
                onClick={onNext}
                className="pixel-button bg-[#8fbf7a] border-[#5f4328] w-full py-4 text-sm font-bold animate-pulse hover:bg-[#a6cf89] transition-colors shadow-lg text-[#23351f]"
              >
                Proceed to Next Review
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="slot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col items-center justify-center gap-2"
            >
              <div className="relative flex h-24 w-32 items-end justify-center border-4 border-[#7b5835] bg-[#d99d68] shadow-[4px_4px_0_rgba(80,53,33,0.22)]" aria-label="Submission counter">
                <div className="absolute top-3 h-8 w-20 border-2 border-[#5f4328] bg-[#83add0]" />
                <div className="h-8 w-full border-t-4 border-[#7b5835] bg-[#e5b45f]" />
                {isSubmitting && <div className="absolute bottom-7 h-3 w-16 animate-pulse bg-white" />}
              </div>
              {!isSubmitting && <span className="text-[10px] text-[#6b563f] uppercase font-bold tracking-widest">Awaiting Input</span>}
              {isSubmitting && <span className="text-[10px] text-[#2f5d7e] uppercase font-bold tracking-widest animate-pulse">Processing...</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
