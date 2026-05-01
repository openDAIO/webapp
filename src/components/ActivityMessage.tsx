import { ReactNode } from 'react';

interface ActivityMessageProps {
  tone?: 'neutral' | 'good' | 'bad' | 'info';
  children: ReactNode;
}

const toneClass = {
  neutral: 'border-[#d7b98f] bg-[#fff8e6] text-[#503521]',
  good: 'border-[#8ab66b] bg-[#f4ffd9] text-[#2f6f35]',
  bad: 'border-[#d87965] bg-[#fff0ea] text-[#9c342d]',
  info: 'border-[#82a8c7] bg-[#eef8ff] text-[#2f5d7e]',
};

export default function ActivityMessage({ tone = 'neutral', children }: ActivityMessageProps) {
  return (
    <div className={`border-2 px-3 py-2 text-[13px] leading-snug shadow-[2px_2px_0_rgba(80,53,33,0.18)] ${toneClass[tone]}`}>
      {children}
    </div>
  );
}
