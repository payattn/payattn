'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

interface WalletButtonProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
}

export function WalletButton({ onConnect, onDisconnect }: WalletButtonProps) {
  const { publicKey, wallet, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  // Handle wallet connection changes
  useEffect(() => {
    if (connected && publicKey) {
      onConnect?.(publicKey.toBase58());
    } else if (!connected) {
      onDisconnect?.();
    }
  }, [connected, publicKey, onConnect, onDisconnect]);

  const handleClick = () => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Button onClick={handleClick} variant={connected ? 'outline' : 'default'}>
      {connected && publicKey ? (
        <span className="flex items-center gap-2">
          {wallet?.adapter.icon && (
            <img
              src={wallet.adapter.icon}
              alt={wallet.adapter.name}
              className="w-5 h-5"
            />
          )}
          {formatAddress(publicKey.toBase58())}
        </span>
      ) : (
        'Connect Wallet'
      )}
    </Button>
  );
}
