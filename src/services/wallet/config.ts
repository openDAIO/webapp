import { http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import type { AppKitNetwork } from '@reown/appkit/networks';

const rawProjectId = (process.env.WALLET_CONNECT_PROJECT_ID ?? '').trim();

if (!rawProjectId) {
  console.warn(
    '[OpenDAIO] WALLET_CONNECT_PROJECT_ID is not set. WalletConnect will be disabled until you add it to .env.',
  );
}

export const WALLET_CONNECT_PROJECT_ID = rawProjectId;
export const HAS_WALLET_CONNECT_PROJECT_ID = rawProjectId.length > 0;

export const DEFAULT_CHAIN = sepolia;
export const APPKIT_NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [sepolia];

export const wagmiAdapter = new WagmiAdapter({
  networks: APPKIT_NETWORKS,
  projectId: rawProjectId || 'opendaio-missing-project-id',
  transports: {
    [sepolia.id]: http(),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
