import { useCallback, useMemo } from 'react';
import { useAccount, useBalance, useChainId, useDisconnect } from 'wagmi';
import { formatUnits } from 'viem';
import { useAppKit } from '@reown/appkit/react';
import { HAS_WALLET_CONNECT_PROJECT_ID } from './config';

export interface WalletState {
  isConnected: boolean;
  isConnecting: boolean;
  isReady: boolean;
  address: `0x${string}` | undefined;
  shortAddress: string | undefined;
  chainId: number | undefined;
  balance: number;
  balanceSymbol: string;
  balanceFormatted: string;
  isBalanceLoading: boolean;
  open: () => void;
  openAccount: () => void;
  disconnect: () => void;
}

function shortenAddress(address?: string) {
  if (!address) return undefined;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function useWallet(): WalletState {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });

  const handleOpen = useCallback(() => {
    if (!HAS_WALLET_CONNECT_PROJECT_ID) {
      console.warn('[OpenDAIO] WalletConnect Project ID is missing. Cannot open wallet modal.');
      return;
    }
    void open();
  }, [open]);

  const handleOpenAccount = useCallback(() => {
    if (!HAS_WALLET_CONNECT_PROJECT_ID) return;
    void open({ view: 'Account' });
  }, [open]);

  return useMemo(() => {
    const formattedBalance = balanceData ? formatUnits(balanceData.value, balanceData.decimals) : '0';
    const numericBalance = Number(formattedBalance);
    const symbol = balanceData?.symbol ?? 'POL';
    const formatted = balanceData
      ? `${numericBalance.toFixed(4)} ${symbol}`
      : `0.0000 ${symbol}`;

    return {
      isConnected: Boolean(isConnected && address),
      isConnecting: Boolean(isConnecting || isReconnecting),
      isReady: HAS_WALLET_CONNECT_PROJECT_ID,
      address,
      shortAddress: shortenAddress(address),
      chainId,
      balance: Number.isFinite(numericBalance) ? numericBalance : 0,
      balanceSymbol: symbol,
      balanceFormatted: formatted,
      isBalanceLoading,
      open: handleOpen,
      openAccount: handleOpenAccount,
      disconnect: () => disconnect(),
    };
  }, [
    address,
    balanceData,
    chainId,
    disconnect,
    handleOpen,
    handleOpenAccount,
    isBalanceLoading,
    isConnected,
    isConnecting,
    isReconnecting,
  ]);
}
