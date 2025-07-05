import { useState, useCallback } from 'react';
import { useNetwork } from '@/app/providers';
import { getProvider, getSigner } from '@/lib/0g/fees';
import { submitTransaction, uploadToStorage } from '@/lib/0g/uploader';
import { getNetworkConfig, getExplorerUrl } from '@/lib/0g/network';
import { Blob } from '@0glabs/0g-ts-sdk';
import { Contract } from 'ethers';
import { useFileList } from './useFileList';
import { addFileMeta } from '@/utils/indexeddb';
import { useFileListContext } from '@/context/FileListContext';
import { useWallet } from '@/hooks/useWallet';

/**
 * Custom hook for handling file uploads to 0G Storage
 * Manages the upload process, transaction status, and error handling
 */
export function useUpload() {
  const { networkType } = useNetwork();
  const { currentFolderId } = useFileListContext();
  const { address: walletAddress } = useWallet();
  const { addFile } = useFileList();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [txHash, setTxHash] = useState('');
  const [rootHash, setRootHash] = useState('');
  const [alreadyExists, setAlreadyExists] = useState(false);

  // Upload a file to 0G Storage
  const uploadFile = useCallback(async (
    blob: Blob | null, 
    submission: any | null, 
    flowContract: Contract | null, 
    storageFee: bigint,
    originalFile?: File, // 원본 파일 정보 추가
    preCalculatedRootHash?: string // 미리 계산된 Root Hash 추가
  ) => {
    if (!blob) {
      setError('Missing required upload data');
      return null;
    }
    
    setLoading(true);
    setError('');
    setUploadStatus('Preparing file...');
    setTxHash('');
    setRootHash('');
    setAlreadyExists(false);
    
    try {
      console.log('[useUpload] Starting upload process...');
      console.log('[useUpload] Blob size:', blob.size);
      console.log('[useUpload] Storage fee:', storageFee.toString());
      console.log('[useUpload] Pre-calculated root hash:', preCalculatedRootHash);
      
      // 1. Get provider and signer
      console.log('[useUpload] Step 1: Getting provider and signer...');
      const [provider, providerErr] = await getProvider();
      if (!provider) {
        throw new Error(`Provider error: ${providerErr?.message}`);
      }
      console.log('[useUpload] Provider obtained successfully');
      
      const [signer, signerErr] = await getSigner(provider);
      if (!signer) {
        throw new Error(`Signer error: ${signerErr?.message}`);
      }
      console.log('[useUpload] Signer obtained successfully');
      
      // 2. Get network configuration
      console.log('[useUpload] Step 2: Getting network configuration...');
      const network = getNetworkConfig(networkType);
      
      // 3. Upload file to storage directly (skip transaction)
      console.log('[useUpload] Step 3: Starting direct file upload to storage...');
      setUploadStatus('Uploading file to storage...');
      console.log(`[useUpload] Attempting upload with networkType: ${networkType}`);
      console.log(`[useUpload] Using storageRpc: ${network.storageRpc}`);
      console.log(`[useUpload] Using l1Rpc: ${network.l1Rpc}`);
      
      const [uploadResult, uploadErr] = await uploadToStorage(
        blob, 
        network.storageRpc,
        network.l1Rpc,
        signer
      );
      
      console.log('[useUpload] Upload result:', { uploadResult, uploadErr: uploadErr?.message });
      
      if (!uploadResult.success) {
        // 더 자세한 에러 메시지 제공
        let errorMessage = uploadErr?.message || 'Upload failed';
        
        // 특정 에러 타입에 대한 사용자 친화적 메시지
        if (errorMessage.includes('Failed to submit transaction')) {
          errorMessage = '업로드 중 네트워크 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (errorMessage.includes('insufficient funds')) {
          errorMessage = '지갑에 충분한 잔액이 없습니다.';
        } else if (errorMessage.includes('user rejected')) {
          errorMessage = '사용자가 거래를 취소했습니다.';
        } else if (errorMessage.includes('network')) {
          errorMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
        }
        
        throw new Error(errorMessage);
      }
      
      // Store root hash and already exists flag
      if (uploadResult.rootHash) {
        // preCalculatedRootHash를 우선 사용, 없으면 uploadResult.rootHash 사용
        const finalRootHash = preCalculatedRootHash || uploadResult.rootHash;
        setRootHash(finalRootHash);
        setAlreadyExists(uploadResult.alreadyExists);
        
        // 파일 리스트 추가는 UploadModal에서 처리하므로 여기서는 제거
        // 중복 등록 방지를 위해 useUpload에서는 파일 추가하지 않음
        
        if (uploadResult.alreadyExists) {
          console.log('[useUpload] File already exists in storage, upload successful with root hash:', finalRootHash);
          setUploadStatus('File already exists in storage - upload successful!');
        } else {
          console.log('[useUpload] Upload completed successfully with root hash:', finalRootHash);
          setUploadStatus('Upload complete!');
        }
      } else {
        console.log('[useUpload] Upload completed successfully but no root hash returned');
        setUploadStatus('Upload complete!');
      }
      
      console.log('[useUpload] Upload completed successfully!');
      // preCalculatedRootHash를 우선 반환
      return preCalculatedRootHash || uploadResult.rootHash || 'upload-success';
    } catch (error) {
      console.error('[useUpload] Error during upload:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      setUploadStatus('');
      return null;
    } finally {
      setLoading(false);
    }
  }, [networkType, addFile, currentFolderId, walletAddress]);

  // Reset upload state
  const resetUploadState = useCallback(() => {
    setLoading(false);
    setError('');
    setUploadStatus('');
    setTxHash('');
    setRootHash('');
    setAlreadyExists(false);
  }, []);

  // Get explorer URL for transaction
  const getTransactionExplorerUrl = useCallback((hash: string) => {
    return getExplorerUrl(hash, networkType);
  }, [networkType]);

  return {
    loading,
    error,
    uploadStatus,
    txHash,
    rootHash,
    alreadyExists,
    uploadFile,
    resetUploadState,
    getExplorerUrl: getTransactionExplorerUrl
  };
} 