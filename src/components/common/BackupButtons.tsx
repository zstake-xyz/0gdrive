import React, { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useBackup } from '@/hooks/useBackup';

export function BackupButtons() {
  const { isConnected } = useWallet();
  const { exportBackup, importBackup, loading, error, status } = useBackup();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'export' | 'import'>('export');

  const handleExport = async () => {
    setModalType('export');
    setShowModal(true);
    
    const result = await exportBackup();
    if (result) {
      // 성공 시 3초 후 모달 닫기
      setTimeout(() => setShowModal(false), 3000);
    }
  };

  const handleImport = async () => {
    setModalType('import');
    setShowModal(true);
    
    const result = await importBackup();
    if (result) {
      // 성공 시 3초 후 모달 닫기
      setTimeout(() => setShowModal(false), 3000);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 border border-brand-border text-xs font-medium rounded-md text-brand-text-secondary bg-brand-surface hover:bg-brand-background disabled:opacity-50"
          title="Export IndexedDB data to 0G Storage"
        >
          <span className="mr-1">📤</span> Export
        </button>
        
        <button
          onClick={handleImport}
          disabled={loading}
          className="inline-flex items-center px-3 py-1.5 border border-brand-border text-xs font-medium rounded-md text-brand-text-secondary bg-brand-surface hover:bg-brand-background disabled:opacity-50"
          title="Import backup data from 0G Storage"
        >
          <span className="mr-1">📥</span> Import
        </button>
      </div>

      {/* 백업/복원 상태 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {modalType === 'export' ? 'Export Backup' : 'Import Backup'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <span className="ml-3 text-gray-600">{status}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-red-800">Error</h4>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && status && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-green-800">Success</h4>
                    <p className="text-sm text-green-700 mt-1">{status}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 