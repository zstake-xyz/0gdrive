import { useState } from 'react';
import { useWallet } from './useWallet';

export const useShare = () => {
  const [loading, setLoading] = useState(false);
  const { address } = useWallet();

  const shareFile = async (itemId: string, targetWalletAddress: string) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const response = await fetch('/api/files', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          walletAddress: address,
          action: 'share',
          targetWalletAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to share file');
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  const unshareFile = async (itemId: string, targetWalletAddress: string) => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    try {
      const response = await fetch('/api/files', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          walletAddress: address,
          action: 'unshare',
          targetWalletAddress,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unshare file');
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  return {
    shareFile,
    unshareFile,
    loading,
  };
}; 