import { type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import {
  APPKIT_NETWORKS,
  DEFAULT_CHAIN,
  HAS_WALLET_CONNECT_PROJECT_ID,
  WALLET_CONNECT_PROJECT_ID,
  wagmiAdapter,
  wagmiConfig,
} from './config';

const queryClient = new QueryClient();

if (typeof window !== 'undefined' && HAS_WALLET_CONNECT_PROJECT_ID) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: APPKIT_NETWORKS,
    defaultNetwork: DEFAULT_CHAIN,
    projectId: WALLET_CONNECT_PROJECT_ID,
    metadata: {
      name: 'OpenDAIO',
      description: 'AI reviewer consensus platform — Open + DAO + AI',
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.ico`],
    },
    themeMode: 'light',
    features: {
      analytics: false,
      email: false,
      socials: false,
      onramp: false,
    },
    enableNetworkSwitch: true,
  });
}

interface Web3ProviderProps {
  children: ReactNode;
}

export default function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
