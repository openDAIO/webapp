import { ASSET_PATHS } from '../assets/assetPaths';

interface BrandLockupProps {
  className?: string;
}

export default function BrandLockup({ className = '' }: BrandLockupProps) {
  return (
    <div className={`brand-lockup ${className}`}>
      <img
        src={ASSET_PATHS.ui.logo.mark}
        alt=""
        className="brand-lockup__mark"
        aria-hidden="true"
      />
      <img
        src={ASSET_PATHS.ui.logo.wordmark}
        alt="openDAIO"
        className="brand-lockup__wordmark"
      />
    </div>
  );
}
