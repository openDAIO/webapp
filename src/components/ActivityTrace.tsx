import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export interface ActivityTraceItem {
  title: string;
  body: ReactNode;
  meta?: string;
}

interface ActivityTraceProps {
  title: string;
  subtitle?: string;
  elapsedSeconds: number;
  items: ActivityTraceItem[];
  activeIndex?: number;
  closeLabel: string;
  onClose: () => void;
}

export function useElapsedActivity(resetKey: string | number) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    setElapsedSeconds(0);

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resetKey]);

  return elapsedSeconds;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

export default function ActivityTrace({
  title,
  subtitle,
  elapsedSeconds,
  items,
  activeIndex = items.length - 1,
  closeLabel,
  onClose,
}: ActivityTraceProps) {
  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-[#d7e1e7] bg-[#fbfdff]/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-[22px] font-semibold leading-none text-[#202528]">Activity</span>
            <span className="text-[22px] leading-none text-[#8a9298]">· {formatElapsed(elapsedSeconds)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 items-center justify-center text-[#202528] transition-colors hover:text-[#5d7684]"
          >
            <X size={30} strokeWidth={2} />
          </button>
        </div>
      </header>

      <section className="pt-7">
        <p className="mb-2 text-[20px] font-semibold leading-tight text-[#656d72]">{title}</p>
        {subtitle && <p className="text-sm leading-relaxed text-[#7a8389]">{subtitle}</p>}
      </section>

      <ol className="mt-7">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.title}-${index}`} className="grid grid-cols-[22px_minmax(0,1fr)] gap-4">
              <div className="flex flex-col items-center pt-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    isActive ? 'bg-[#2d5f76] shadow-[0_0_0_4px_rgba(45,95,118,0.12)]' : 'bg-[#60686d]'
                  }`}
                />
                {!isLast && <span className="mt-2 min-h-[72px] w-px flex-1 bg-[#d2dbe0]" />}
              </div>
              <div className={`${isLast ? 'pb-1' : 'pb-7'}`}>
                <h3 className="text-[19px] font-semibold leading-snug text-[#111517]">{item.title}</h3>
                <div className="mt-2 text-[17px] leading-relaxed text-[#5f666a]">{item.body}</div>
                {item.meta && (
                  <p className="mt-2 text-[12px] font-semibold uppercase tracking-wider text-[#879098]">
                    {item.meta}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
