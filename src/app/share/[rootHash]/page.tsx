'use client';

import { Providers } from '@/app/providers';
import { useEffect, useState, useRef } from 'react';
import { useNetwork } from '@/app/providers';
import { useDownload } from '@/hooks/useDownload';
import { getNetworkConfig } from '@/lib/0g/network';
import { useSearchParams } from 'next/navigation';

interface SharePageProps {
  params: {
    rootHash: string;
  };
}

function ActualSharePage({ params }: SharePageProps) {
  const { rootHash } = params;
  const searchParams = useSearchParams();
  const { networkType } = useNetwork();
  const [status, setStatus] = useState<'loading' | 'downloading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);

  // 다운로드가 이미 시작되었는지 추적하는 ref
  const downloadStartedRef = useRef(false);

  // useDownload 훅 사용
  const { downloadFile, loading: downloadLoading, error: downloadError, downloadStatus } = useDownload();

  useEffect(() => {
    const downloadFileFromShare = async () => {
      // 이미 다운로드가 시작되었으면 중복 실행 방지
      if (downloadStartedRef.current) {
        return;
      }

      if (!rootHash) {
        setError('Root hash is required');
        setStatus('error');
        return;
      }

      // 다운로드 시작 표시
      downloadStartedRef.current = true;

      try {
        setStatus('downloading');
        console.log('[SharePage] Starting download for root hash:', rootHash);

        // URL에서 파일명 파라미터 가져오기
        const nameParam = searchParams?.get('name');
        const defaultFileName = `shared-file-${rootHash.substring(0, 8)}.bin`;
        const finalFileName = nameParam ? decodeURIComponent(nameParam) : defaultFileName;
        setFileName(finalFileName);

        // useDownload 훅을 사용하여 다운로드
        const success = await downloadFile(rootHash, finalFileName);
        
        if (success) {
          setStatus('success');
          console.log('[SharePage] File download initiated successfully');
        } else {
          setStatus('error');
          setError(downloadError || 'Download failed');
        }

      } catch (error) {
        console.error('[SharePage] Error during download:', error);
        setError(error instanceof Error ? error.message : 'Download failed');
        setStatus('error');
      }
    };

    downloadFileFromShare();
  }, [rootHash, networkType, searchParams]); // downloadFile과 downloadError 제거

  // 다운로드 상태에 따른 메시지 표시
  useEffect(() => {
    if (downloadStatus) {
      console.log('[SharePage] Download status:', downloadStatus);
    }
  }, [downloadStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            {status === 'loading' && (
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {status === 'downloading' && (
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {status === 'success' && (
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'error' && (
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {status === 'loading' && 'Preparing Download...'}
            {status === 'downloading' && 'Downloading File...'}
            {status === 'success' && 'Download Complete!'}
            {status === 'error' && 'Download Failed'}
          </h1>
          
          <p className="text-gray-600">
            {status === 'loading' && 'Please wait while we prepare your file for download.'}
            {status === 'downloading' && 'Your file is being downloaded automatically.'}
            {status === 'success' && 'The file has been downloaded to your device.'}
            {status === 'error' && 'There was an error downloading the file.'}
          </p>
        </div>

        {status === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>File:</strong> {fileName}
            </p>
            <p className="text-xs text-green-700 mt-1">
              The download should start automatically. If it doesn't, check your browser's download settings.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>Error:</strong> {error}
            </p>
            <p className="text-xs text-red-700 mt-1">
              Please check the root hash or try again later.
            </p>
          </div>
        )}

        {downloadStatus && status === 'downloading' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Status:</strong> {downloadStatus}
            </p>
          </div>
        )}

        <div className="text-[10px] text-gray-500">
          <p>Root Hash: {rootHash}</p>
        </div>
        
        {/* Logo와 DRIVE 텍스트 */}
        <div className="mt-8 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Drive Logo"
            width={24}
            height={24}
            className="mr-2"
          />
          <span className="text-lg font-bold text-gray-700">DRIVE</span>
        </div>
      </div>
    </div>
  );
}

export default function SharePage({ params }: SharePageProps) {
  return (
    <Providers>
      <ActualSharePage params={params} />
    </Providers>
  );
} 