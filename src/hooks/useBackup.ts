import { useState, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useNetwork } from '@/app/providers';
import { getProvider, getSigner } from '@/lib/0g/fees';
import { uploadToStorage } from '@/lib/0g/uploader';
import { getNetworkConfig } from '@/lib/0g/network';
import { Blob as OGBlob } from '@0glabs/0g-ts-sdk';
import { getAllFileMeta, addFileMeta, deleteFileMeta } from '@/utils/indexeddb';
import { useFileListContext } from '@/context/FileListContext';

export function useBackup() {
  const { address: walletAddress } = useWallet();
  const { networkType } = useNetwork();
  const { refresh } = useFileListContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // IndexedDB 데이터를 백업하고 0G Storage에 업로드
  const exportBackup = useCallback(async () => {
    if (!walletAddress) {
      setError('Wallet not connected.');
      return null;
    }

    setLoading(true);
    setError('');
    setStatus('Preparing backup data...');

    try {
      // 1. IndexedDB에서 모든 파일 메타데이터 가져오기
      console.log('[useBackup] Exporting backup data...');
      const allFiles = await getAllFileMeta(walletAddress, null);
      
      if (allFiles.length === 0) {
        setError('No files to backup.');
        return null;
      }

      // 2. 백업 데이터 생성
      const backupData = {
        walletAddress,
        networkType,
        files: allFiles,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      setStatus('Uploading backup to 0G Storage...');

      // 3. 백업 데이터를 JSON으로 변환하고 Blob 생성
      const jsonString = JSON.stringify(backupData, null, 2);
      const browserBlob = new Blob([jsonString], { type: 'application/json' });
      
      // 브라우저 Blob을 File 객체로 변환하여 0G SDK Blob 생성
      const file = new File([browserBlob], 'backup.json', { type: 'application/json' });
      const blob = new OGBlob(file);
      
      // 4. 0G Storage에 업로드
      const network = getNetworkConfig(networkType);
      const [provider, providerErr] = await getProvider();
      if (!provider) {
        throw new Error(`Provider error: ${providerErr?.message}`);
      }

      const [signer, signerErr] = await getSigner(provider);
      if (!signer) {
        throw new Error(`Signer error: ${signerErr?.message}`);
      }

      const [uploadResult, uploadErr] = await uploadToStorage(
        blob,
        network.storageRpc,
        network.l1Rpc,
        signer
      );

      if (!uploadResult.success) {
        throw new Error(uploadErr?.message || 'Backup upload failed');
      }

      // 5. 백엔드에 백업 정보 저장
      setStatus('Saving backup information...');
      const backupInfo = {
        walletAddress,
        rootHash: uploadResult.rootHash,
        fileName: `backup-${walletAddress.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.json`,
        fileCount: allFiles.length,
        exportDate: new Date().toISOString()
      };

      const backupResponse = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          backupData: backupInfo
        })
      });

      if (!backupResponse.ok) {
        throw new Error('Failed to save backup information');
      }

      setStatus('Backup completed!');
      console.log('[useBackup] Backup exported successfully:', backupInfo);
      
      return backupInfo;
    } catch (error) {
      console.error('[useBackup] Export error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, networkType, refresh]);

  // 백업 데이터를 가져와서 IndexedDB에 복원
  const importBackup = useCallback(async () => {
    if (!walletAddress) {
      setError('Wallet not connected.');
      return false;
    }

    setLoading(true);
    setError('');
    setStatus('Retrieving backup data...');

    try {
      // 1. 백엔드에서 백업 정보 가져오기
      const backupResponse = await fetch(`/api/backup?walletAddress=${walletAddress}`);
      
      if (!backupResponse.ok) {
        if (backupResponse.status === 404) {
          throw new Error('No backup data found for this wallet.');
        }
        throw new Error('Failed to retrieve backup data');
      }

      const backupInfo = await backupResponse.json();
      console.log('[useBackup] Backup info retrieved:', backupInfo);

      setStatus('Downloading backup file...');

      // 2. 0G Storage에서 백업 파일 다운로드
      const network = getNetworkConfig(networkType);
      const downloadUrl = `/api/proxy?url=${encodeURIComponent(`${network.storageRpc}/file?root=${backupInfo.backup.rootHash}`)}`;
      
      const downloadResponse = await fetch(downloadUrl);
      
      if (!downloadResponse.ok) {
        throw new Error('Failed to download backup file');
      }

      const backupFileData = await downloadResponse.arrayBuffer();
      const backupText = new TextDecoder().decode(backupFileData);
      const backupData = JSON.parse(backupText);

      // 백업 데이터 구조 검증
      if (!backupData || !backupData.files || !Array.isArray(backupData.files)) {
        throw new Error('Invalid backup data format');
      }

      setStatus('Restoring IndexedDB...');

      // 3. 기존 데이터 삭제 (선택사항)
      const existingFiles = await getAllFileMeta(walletAddress, null);
      for (const file of existingFiles) {
        await deleteFileMeta(file.id, walletAddress);
      }

      // 4. 백업 데이터를 IndexedDB에 복원
      for (const file of backupData.files) {
        // ID를 새로 생성하여 중복 방지
        const newFile = {
          ...file,
          id: crypto.randomUUID(),
          importDate: new Date().toISOString()
        };
        await addFileMeta(newFile);
      }

      setStatus('Restore completed!');
      console.log('[useBackup] Backup imported successfully');

      // 5. 파일 리스트 갱신
      await refresh();

      return true;
    } catch (error) {
      console.error('[useBackup] Import error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, networkType, refresh]);

  return {
    exportBackup,
    importBackup,
    loading,
    error,
    status
  };
} 