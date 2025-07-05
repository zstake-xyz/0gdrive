import React, { useState } from 'react';
import { useShare } from '@/hooks/useShare';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  sharedWith?: string[];
  onShareUpdate: () => void;
  rootHash?: string; // root hash 추가
}

export function ShareModal({ isOpen, onClose, itemId, itemName, sharedWith = [], onShareUpdate, rootHash }: ShareModalProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const { shareFile, unshareFile, loading } = useShare();

  // 공유 URL 생성
  const generateShareUrl = () => {
    if (!rootHash) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://0gdrive.xyz';
    return `${baseUrl}/share/${rootHash}`;
  };

  // 클립보드에 복사
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('클립보드 복사에 실패했습니다.');
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!walletAddress.trim()) {
      setError('지갑 주소를 입력해주세요.');
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim())) {
      setError('올바른 지갑 주소 형식을 입력해주세요.');
      return;
    }

    try {
      await shareFile(itemId, walletAddress.trim());
      setWalletAddress('');
      onShareUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '공유 설정에 실패했습니다.');
    }
  };

  const handleUnshare = async (targetAddress: string) => {
    try {
      await unshareFile(itemId, targetAddress);
      onShareUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '공유 해제에 실패했습니다.');
    }
  };

  const shareUrl = generateShareUrl();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Share File</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">File: {itemName}</p>
        </div>

        {/* 공유 URL 섹션 */}
        {rootHash && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Public Share Link</h3>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-md bg-white text-blue-900"
              />
              <button
                onClick={() => copyToClipboard(shareUrl)}
                className="px-3 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
              >
                {copySuccess ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-blue-700 mt-2">
              Anyone with this link can download the file directly.
            </p>
          </div>
        )}

        <form onSubmit={handleShare} className="mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wallet Address (Private Share)
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !walletAddress.trim()}
            className="w-full bg-pink-500 text-white py-2 px-4 rounded-md hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Share'}
          </button>
        </form>

        {sharedWith.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Shared Wallets</h3>
            <div className="space-y-2">
              {sharedWith.map((address, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600 font-mono">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                  <button
                    onClick={() => handleUnshare(address)}
                    disabled={loading}
                    className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                  >
                    Unshare
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 