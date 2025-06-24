import React, { useState } from 'react';
import { getExplorerUrl } from '@/lib/0g/network';
import { useNetwork } from '@/app/providers';

interface TransactionStatusProps {
  uploadStatus: string;
  txHash?: string;
  explorerUrl?: string;
  alreadyExists?: boolean;
}

/**
 * A component for displaying transaction status and hash information
 */
export function TransactionStatus({
  uploadStatus,
  txHash,
  alreadyExists
}: TransactionStatusProps) {
  const { networkType } = useNetwork();
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Function to copy text to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (err) {
      // Error handling for clipboard operations
    }
  };

  if (!uploadStatus && !txHash) {
    return null;
  }

  const explorerLink = txHash ? getExplorerUrl(txHash, networkType) : null;

  const isCompleted = uploadStatus.includes('complete');

  return (
    <div className="mt-4 text-sm">
      {uploadStatus && (
        <div className="p-4 bg-brand-secondary-light border border-brand-primary-light rounded-lg">
          <p className="font-semibold text-brand-primary">
            {uploadStatus}
          </p>
        </div>
      )}
      {txHash && (
        <div className="mt-2">
          <a
            href={explorerLink || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primary hover:text-brand-primary-dark underline truncate block"
          >
            View on Explorer: {txHash}
          </a>
        </div>
      )}
    </div>
  );
} 