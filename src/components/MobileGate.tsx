import { Monitor } from 'lucide-react';
import { PixelFrameChrome } from './PixelFrame';

export default function MobileGate() {
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Desktop required"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#1b2b3a] px-6 text-center text-[#f3e6c8] lg:hidden"
    >
      <div className="pixel-box warm-panel relative w-full max-w-[20rem] p-6 text-[#503521]">
        <PixelFrameChrome round={2} />
        <div className="relative z-30 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center border-2 border-[#503521] bg-[#fff8e6]">
            <Monitor size={32} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold uppercase tracking-widest">
            Desktop Required
          </h2>
          <p className="text-sm leading-snug">
            openDAIO is built for a wider canvas.
            <br />
            Please open this page on a desktop browser
            <br />
            (screen width 1024px or larger).
          </p>
          <p className="text-[10px] uppercase tracking-widest text-[#8c745b]">
            데스크톱 브라우저에서 이용해 주세요
          </p>
        </div>
      </div>
    </div>
  );
}
