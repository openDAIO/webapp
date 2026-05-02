
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Loader2, Wallet } from 'lucide-react';
import BrandLockup from './BrandLockup';
import { PixelFrameChrome } from './PixelFrame';
import { useWallet } from '../services/wallet/useWallet';

interface NavbarProps {
  activePage: 'dashboard' | 'commons' | 'room' | 'loading';
  onNavigate: (page: 'dashboard' | 'commons') => void;
}

export default function Navbar({ activePage, onNavigate }: NavbarProps) {
  const wallet = useWallet();
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
  const walletButtonTone = wallet.isConnected
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

  const walletLabel = !wallet.isReady
    ? 'WalletConnect Disabled'
    : wallet.isConnecting
      ? 'Connecting…'
      : wallet.isConnected && wallet.shortAddress
        ? wallet.shortAddress
        : 'Connect Wallet';

  const walletAriaLabel = wallet.isConnected
    ? 'Open wallet account'
    : wallet.isReady
      ? 'Connect wallet via WalletConnect'
      : 'WalletConnect is not configured';

  return (
    <nav className="app-navbar fixed left-0 top-0 z-50 flex h-16 w-full items-center justify-between px-6 text-[#503521]">
      <BrandLockup className="navbar-brand-lockup" />

      <div className="app-navbar__actions flex items-center gap-3">
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ y: 1 }}
          onClick={() => onNavigate(targetPage)}
          className="pixel-frame nav-route-button flex items-center justify-center px-4 py-2 text-base font-bold transition-all hover:brightness-110 active:translate-y-1"
          style={{ color: buttonTone.text }}
        >
          <PixelFrameChrome
            round={2}
            fillColor={buttonTone.fill}
            innerHighlightColor={buttonTone.highlight}
            outerShadowColor={buttonTone.shadow}
          />
          <span className="relative z-10 flex min-w-0 items-center gap-2">
            {isDashboardTarget ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            <span className="nav-route-button__label">{isDashboardTarget ? 'Dashboard' : 'Commons'}</span>
          </span>
        </motion.button>

        <motion.button
          whileHover={wallet.isReady ? { y: -1 } : undefined}
          whileTap={wallet.isReady ? { y: 1 } : undefined}
          onClick={() => {
            if (!wallet.isReady) return;
            if (wallet.isConnected) wallet.openAccount();
            else wallet.open();
          }}
          disabled={!wallet.isReady || wallet.isConnecting}
          className="pixel-frame nav-wallet-button flex items-center justify-center px-4 py-2 text-base font-bold transition-all hover:brightness-110 active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ color: walletButtonTone.text }}
          type="button"
          aria-pressed={wallet.isConnected}
          aria-label={walletAriaLabel}
          title={walletAriaLabel}
        >
          <PixelFrameChrome
            round={2}
            fillColor={walletButtonTone.fill}
            innerHighlightColor={walletButtonTone.highlight}
            outerShadowColor={walletButtonTone.shadow}
          />
          <span className="relative z-10 flex min-w-0 items-center gap-2">
            {wallet.isConnecting ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <Wallet size={18} className="shrink-0" />}
            <span className="nav-wallet-button__label truncate">{walletLabel}</span>
          </span>
        </motion.button>
      </div>
    </nav>
  );
}
