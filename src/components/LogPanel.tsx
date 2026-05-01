
import { LogEntry } from '../types';
import { PixelFrameChrome } from './PixelFrame';

interface LogPanelProps {
  logs: LogEntry[];
}

export default function LogPanel({ logs }: LogPanelProps) {
  return (
    <div className="pixel-box warm-panel w-full h-full flex flex-col pointer-events-none">
      <PixelFrameChrome round={2} />
      <div className="text-xs font-bold text-[#503521] mb-2 uppercase border-b-2 border-[#d7b98f] pb-1">
        Event Log
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {logs.map((log) => (
          <div key={log.id} className="text-[10px] leading-tight text-[#5f4328]">
            <span className="text-[#2f5d7e] opacity-80">[{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>{' '}
            {log.message}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-[10px] text-[#8c745b] italic">Waiting for activity...</div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #7b5835; }
      `}</style>
    </div>
  );
}
