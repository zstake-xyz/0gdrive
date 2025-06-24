import { useState, useCallback } from 'react';
import { useNetwork } from '@/app/providers';
import { getProvider, getSigner } from '@/lib/0g/fees';
import { submitTransaction, uploadToStorage } from '@/lib/0g/uploader';
import { getNetworkConfig, getExplorerUrl } from '@/lib/0g/network';
import { Blob } from '@0glabs/0g-ts-sdk';
import { Contract } from 'ethers';
import { useFileList } from './useFileList';

/**
 * Custom hook for handling file uploads to 0G Storage
 * Manages the upload process, transaction status, and error handling
 */
export function useUpload() {
  const { networkType } = useNetwork();
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
        throw new Error(`Upload error: ${uploadErr?.message || 'Upload failed'}`);
      }
      
      // Store root hash and already exists flag
      if (uploadResult.rootHash) {
        setRootHash(uploadResult.rootHash);
        setAlreadyExists(uploadResult.alreadyExists);
        
        // 파일 리스트에 추가 (원본 파일 정보가 있는 경우에만)
        if (originalFile && !uploadResult.alreadyExists) {
          try {
            const name = originalFile.name.substring(0, originalFile.name.lastIndexOf('.'));
            const fileExtension = originalFile.name.substring(originalFile.name.lastIndexOf('.') + 1);
            
            // 미리 계산된 Root Hash가 있으면 사용, 없으면 업로드 결과의 Root Hash 사용
            const finalRootHash = preCalculatedRootHash || uploadResult.rootHash;
            
            await addFile(
              name,
              fileExtension,
              originalFile.size,
              finalRootHash,
              networkType
            );
            
            console.log('[useUpload] File added to list successfully with root hash:', finalRootHash);
          } catch (addFileError) {
            console.warn('[useUpload] Failed to add file to list:', addFileError);
            // 파일 리스트 추가 실패는 업로드 성공을 막지 않음
          }
        }
        
        if (uploadResult.alreadyExists) {
          console.log('[useUpload] File already exists in storage, upload successful with root hash:', uploadResult.rootHash);
          setUploadStatus('File already exists in storage - upload successful!');
        } else {
          console.log('[useUpload] Upload completed successfully with root hash:', uploadResult.rootHash);
          setUploadStatus('Upload complete!');
        }
      } else {
        console.log('[useUpload] Upload completed successfully but no root hash returned');
      setUploadStatus('Upload complete!');
      }
      
      console.log('[useUpload] Upload completed successfully!');
      return uploadResult.rootHash || 'upload-success';
    } catch (error) {
      console.error('[useUpload] Error during upload:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      setUploadStatus('');
      return null;
    } finally {
      setLoading(false);
    }
  }, [networkType, addFile]);

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