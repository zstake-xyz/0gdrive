import { useState, useCallback } from 'react';
import { useNetwork } from '@/app/providers';
import { downloadByRootHash, downloadByRootHashAPI, downloadBlobAsFile } from '@/lib/0g/downloader';
import { getNetworkConfig } from '@/lib/0g/network';
import { useWallet } from '@/hooks/useWallet';

/**
 * Custom hook for handling file downloads from 0G Storage
 * Manages the download process, status, and error handling
 */
export function useDownload() {
  const { networkType } = useNetwork();
  const { address } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');

  // Download a file by root hash with retry logic
  const downloadFile = useCallback(async (rootHash: string, fileName?: string) => {
    if (!rootHash) {
      setError('Root hash is required');
      return false;
    }
    
    setLoading(true);
    setError('');
    setDownloadStatus('Connecting to storage...');
    
    console.log('[useDownload] Starting download with root hash:', rootHash);
    console.log('[useDownload] File name:', fileName);
    
    try {
      // 1. Get current network
      const network = getNetworkConfig(networkType);
      console.log(`[useDownload] Using network:`, networkType);
      console.log(`[useDownload] Storage RPC:`, network.storageRpc);
      
      // 2. Download blob from storage using the direct API method
      setDownloadStatus('Downloading file...');
      let fileData, downloadErr;
      
      // Use the API-based download method
      [fileData, downloadErr] = await downloadByRootHashAPI(rootHash, network.storageRpc);
      
      // If API download fails, throw the error immediately
      if (downloadErr) {
        console.log(`[useDownload] API download failed: ${downloadErr.message}`);
        throw downloadErr;
      }
      
      // If we got here but fileData is null, it's an unexpected error
      if (!fileData) {
        console.log('[useDownload] Download error: fileData is null but no error was thrown');
        throw new Error('File data is null or empty');
      }
      
      // Add additional validation to ensure fileData is an ArrayBuffer
      if (!(fileData instanceof ArrayBuffer)) {
        console.log('[useDownload] Download error: fileData is not an ArrayBuffer');
        throw new Error(`Invalid file data type: ${typeof fileData}`);
      }
      
      if (fileData.byteLength === 0) {
        console.log('[useDownload] Download error: fileData is empty (zero length)');
        throw new Error('Downloaded file is empty');
      }
      
      console.log(`[useDownload] Successfully downloaded ${fileData.byteLength} bytes`);
      
      // 3. Start download
      setDownloadStatus('Starting download...');
      const defaultFileName = `download-${rootHash.substring(0, 8)}.bin`;
      
      try {
        downloadBlobAsFile(fileData, fileName || defaultFileName);
        console.log('[useDownload] File download initiated successfully');
      } catch (blobError) {
        console.log('[useDownload] Error in downloadBlobAsFile:', blobError);
        throw new Error(`Failed to create downloadable file: ${blobError instanceof Error ? blobError.message : String(blobError)}`);
      }
      
      setDownloadStatus('Download complete!');
      
      // 다운로드 완료 후 3초 뒤에 상태 리셋
      setTimeout(() => {
        setLoading(false);
        setDownloadStatus('');
      }, 3000);
      
      return true;
    } catch (error) {
      console.error(`[useDownload] Download failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 사용자 친화적인 에러 메시지로 변환
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
        userFriendlyMessage = '파일이 너무 크거나 서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.';
      } else if (errorMessage.includes('File not found')) {
        userFriendlyMessage = '파일을 찾을 수 없습니다. Root Hash를 확인해주세요.';
      } else if (errorMessage.includes('network')) {
        userFriendlyMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
      } else if (errorMessage.includes('External server is experiencing issues')) {
        userFriendlyMessage = '외부 서버에 문제가 있습니다. 잠시 후 다시 시도해주세요.';
      }
      
      setError(userFriendlyMessage);
      setDownloadStatus('');
      
      // 에러 발생 후 5초 뒤에 상태 리셋
      setTimeout(() => {
        setLoading(false);
        setError('');
      }, 5000);
      
      return false;
    }
  }, [networkType]);

  return {
    loading,
    error,
    downloadStatus,
    downloadFile
  };
} 