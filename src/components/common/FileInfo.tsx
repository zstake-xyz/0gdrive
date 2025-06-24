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
    <div className="p-4 border border-brand-border bg-brand-background rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <div className="text-3xl mr-4">📄</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-text truncate" title={fileInfo.name}>
              {fileInfo.name}
            </p>
            <p className="text-xs text-brand-text-secondary">
              {formatFileSize(fileInfo.size)}
            </p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="p-2 text-brand-text-secondary hover:text-red-500 rounded-full transition-colors"
          title="Clear file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      {rootHash && (
        <div className="mt-3 pt-3 border-t border-brand-border">
          <p className="text-xs text-brand-text-secondary">Pre-calculated Root Hash:</p>
          <p className="text-xs text-brand-text-secondary break-all">{rootHash}</p>
        </div>
      )}
    </div>
  );
} 