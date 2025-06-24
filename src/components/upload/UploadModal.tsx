import { useState, useEffect, useCallback } from 'react';
import { useNetwork } from '@/app/providers';
import { useWallet } from '@/hooks/useWallet';
import { useFees } from '@/hooks/useFees';
import { useUpload } from '@/hooks/useUpload';
import { FileDropzone } from '@/components/common/FileDropzone';
import { FileInfo } from '@/components/common/FileInfo';
import { FeeDisplay } from '@/components/common/FeeDisplay';
import { TransactionStatus } from '@/components/common/TransactionStatus';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FileInfoState {
  name: string;
  size: number;
  blob?: any;
  originalFile?: File;
}

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { isConnected } = useWallet();
  const [fileInfo, setFileInfo] = useState<FileInfoState | null>(null);
  const { feeInfo, error: feeError, rootHash: feeRootHash, submission, flowContract, calculateFeesForFile, blob } = useFees();
  const { loading: uploadLoading, error: uploadError, uploadStatus, txHash, rootHash, alreadyExists, uploadFile, resetUploadState } = useUpload();

  const handleFileDrop = (file: File) => {
    if (rootHash) {
      resetUploadState();
    }
    setFileInfo({ name: file.name, size: file.size, originalFile: file });
    calculateFeesForFile(file, isConnected);
  };

  const handleClearFile = () => {
    setFileInfo(null);
    resetUploadState();
  };

  const handleUpload = async () => {
    if (!blob || !feeInfo || !fileInfo?.originalFile) return;
    await uploadFile(blob, submission, flowContract, feeInfo.rawTotalFee, fileInfo.originalFile, feeRootHash);
  };

  useEffect(() => {
    if (!isOpen) {
      setFileInfo(null);
      resetUploadState();
    }
  }, [isOpen, resetUploadState]);

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-brand-surface rounded-xl shadow-2xl w-full max-w-lg transform transition-all max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-brand-border flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold text-brand-text">Upload File</h2>
          <button onClick={onClose} className="text-brand-text-secondary hover:text-brand-text">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto">
          {!fileInfo && <FileDropzone onFileDrop={handleFileDrop} disabled={uploadLoading} />}
          {fileInfo && <FileInfo fileInfo={fileInfo} rootHash={feeRootHash} onClear={handleClearFile} />}
          
          {fileInfo && rootHash && (
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files && files.length > 0) handleFileDrop(files[0]);
                };
                input.click();
              }}
              className="mt-4 w-full py-2 px-4 rounded-lg font-medium text-brand-primary border border-brand-primary-light hover:bg-brand-secondary-light flex items-center justify-center transition-colors"
            >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
              Upload Another File
            </button>
          )}

          {fileInfo && !rootHash && <FeeDisplay feeInfo={feeInfo} error={feeError} onRetry={() => fileInfo.originalFile && calculateFeesForFile(fileInfo.originalFile, isConnected)} size={fileInfo.size} />}
          
          <TransactionStatus uploadStatus={uploadStatus} txHash={txHash} explorerUrl={""} alreadyExists={alreadyExists} />
           
          {rootHash && (
             <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
               <div className="flex items-center justify-between">
                 <div>
                   <p className="text-sm font-semibold text-green-800">File Uploaded Successfully!</p>
                   <p className="text-xs text-green-700 mt-1 break-all">Root Hash: {feeRootHash || rootHash}</p>
                 </div>
                 <button onClick={() => navigator.clipboard.writeText(feeRootHash || rootHash)} className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors" title="Copy root hash">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                      <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
                    </svg>
                 </button>
               </div>
             </div>
           )}

          {uploadError && !uploadStatus && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{uploadError}</p>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-brand-border flex-shrink-0">
          {fileInfo && !rootHash && (
            <button onClick={handleUpload} disabled={!isConnected || feeInfo.isLoading || uploadLoading} className="w-full py-3 px-4 rounded-lg font-semibold text-white flex items-center justify-center transition-colors disabled:opacity-50 bg-brand-primary hover:bg-brand-primary-dark disabled:bg-brand-primary-light">
              {uploadLoading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {uploadLoading ? 'Uploading...' : 'Upload Now'}
            </button>
          )}
           {(!fileInfo || rootHash) && (
             <button onClick={onClose} className="w-full py-3 px-4 rounded-lg font-semibold text-brand-text-secondary bg-brand-background hover:bg-border transition-colors">
              Close
            </button>
           )}
        </div>
      </div>
    </div>
  );
} 