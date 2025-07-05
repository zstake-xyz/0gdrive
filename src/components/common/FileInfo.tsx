import React, { useState } from 'react';
import { formatFileSize, truncateString } from '@/utils/format';

interface FileInfoProps {
  fileInfo: {
    name: string;
    size: number;
    type?: string;
  };
  rootHash?: string | null;
  onClear: () => void;
}

/**
 * A component for displaying file information and root hash
 */
export function FileInfo({ fileInfo, rootHash, onClear }: FileInfoProps) {
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

  return (
    <div className="p-4 border border-brand-border bg-brand-background rounded-lg text-[0.7rem] font-sans">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-brand-text truncate min-w-0 text-[0.7rem] font-sans" title={fileInfo.name}>
            {fileInfo.name}
          </p>
          <p className="text-brand-text-secondary text-[0.7rem] font-sans">
            {formatFileSize(fileInfo.size)}
          </p>
        </div>
        <button
          onClick={onClear}
          className="ml-2 p-1 text-brand-text-secondary hover:text-brand-primary rounded-full"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {rootHash && (
        <div className="mt-3 pt-3 border-t border-brand-border">
          <p className="text-brand-text-secondary text-[0.7rem] font-sans">Pre-calculated Root Hash:</p>
          <p className="text-brand-text-secondary break-all text-[0.7rem] font-sans">{rootHash}</p>
        </div>
      )}
    </div>
  );
} 