
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Wallet } from 'lucide-react';
import { PixelFrameChrome } from './PixelFrame';

interface NavbarProps {
  activePage: 'dashboard' | 'commons' | 'room' | 'loading';
  onNavigate: (page: 'dashboard' | 'commons') => void;
  isWalletConnected?: boolean;
}

export default function Navbar({ activePage, onNavigate, isWalletConnected = false }: NavbarProps) {
  const targetPage = activePage === 'dashboard' ? 'commons' : 'dashboard';
  const isDashboardTarget = targetPage === 'dashboard';
  const buttonTone = isDashboardTarget
    ? {
        fill: '#9ed4e8',
        highlight: 'rgba(255, 255, 255, 0.58)',
        text: '#17384b',
        shadow: 'rgba(38, 59, 72, 0.3)',
      }
    : {
        fill: '#8fbf7a',
        highlight: 'rgba(255, 255, 255, 0.5)',
        text: '#23351f',
        shadow: 'rgba(43, 80, 38, 0.32)',
      };
  const walletButtonTone = isWalletConnected
    ? {
        fill: '#fff8e6',
        highlight: 'rgba(255, 255, 255, 0.72)',
        text: '#503521',
        shadow: 'rgba(80, 53, 33, 0.22)',
      }
    : {
        fill: '#d87965',
        highlight: 'rgba(255, 255, 255, 0.52)',
        text: '#5f211c',
        shadow: 'rgba(95, 33, 28, 0.32)',
      };

  return (
    <nav className="fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between px-6 text-[#503521]">
      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ y: 1 }}
        onClick={() => onNavigate(targetPage)}
        className="pixel-frame flex items-center px-4 py-2 text-base font-bold transition-all hover:brightness-110 active:translate-y-1"
        style={{ color: buttonTone.text }}
      >
        <PixelFrameChrome
          round={2}
          fillColor={buttonTone.fill}
          innerHighlightColor={buttonTone.highlight}
          outerShadowColor={buttonTone.shadow}
        />
        <span className="relative z-10 flex items-center gap-2">
          {isDashboardTarget ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
          {isDashboardTarget ? 'Dashboard' : 'Commons'}
        </span>
      </motion.button>

      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ y: 1 }}
        className="pixel-frame flex items-center px-4 py-2 text-base font-bold transition-all hover:brightness-110 active:translate-y-1"
        style={{ color: walletButtonTone.text }}
        type="button"
        aria-pressed={isWalletConnected}
      >
        <PixelFrameChrome
          round={2}
          fillColor={walletButtonTone.fill}
          innerHighlightColor={walletButtonTone.highlight}
          outerShadowColor={walletButtonTone.shadow}
        />
        <span className="relative z-10 flex items-center gap-2">
          <Wallet size={18} />
          {isWalletConnected ? 'Wallet Connected' : 'Connect Wallet'}
        </span>
      </motion.button>
    </nav>
  );
}
