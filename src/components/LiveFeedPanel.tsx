import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ActivityMessage from './ActivityMessage';
import { PixelFrameChrome } from './PixelFrame';

const DEFAULT_EVENTS = [
  'Brief Bea was slashed in Paper Review Lab.',
  'Evaluation finished in Judgment Room.',
  'Moat Miles started reviewing.',
  'Round 1 has started in Investment Room.',
  'Method Max raised a credibility challenge.',
  'Reward pool redistributed to eligible reviewers.',
];

export default function LiveFeedPanel({ events = DEFAULT_EVENTS }: { events?: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % events.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [events.length]);

  const visibleEvents = useMemo(() => {
    return [0, 1, 2].map((offset) => events[(activeIndex + offset) % events.length]);
  }, [activeIndex, events]);

  return (
    <aside className="pixel-box warm-panel w-80 max-w-[calc(100vw-2rem)]">
      <PixelFrameChrome round={2} />
      <div className="mb-3 flex items-center justify-between border-b-2 border-[#d7b98f] pb-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#5f4328]">Live Feed</h2>
        <span className="h-2 w-2 animate-pulse bg-[#6fb36a]" aria-label="Live" />
      </div>

      <div className="space-y-2 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {visibleEvents.map((event, index) => (
            <motion.div
              key={`${event}-${activeIndex}-${index}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: index === 0 ? 1 : 0.72, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
            >
              <ActivityMessage tone={event.includes('slashed') ? 'bad' : event.includes('finished') ? 'good' : 'info'}>
                {event}
              </ActivityMessage>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </aside>
  );
}
