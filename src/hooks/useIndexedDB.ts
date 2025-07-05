import { useEffect, useState, useCallback, useRef } from 'react';
import * as idb from '@/utils/indexeddb';
import type { FileMeta } from '@/utils/indexeddb';

export function useIndexedDB(walletAddress: string) {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastWalletAddress = useRef<string>('');
  const isInitialized = useRef(false);

  const refresh = useCallback(async (parentId: string | null = null) => {
    if (!walletAddress) return;
    
    setLoading(true);
    try {
      const data = await idb.getAllFileMeta(walletAddress, parentId);
      setFiles(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress && walletAddress !== lastWalletAddress.current) {
      // 이전 지갑의 DB 연결 정리
      if (lastWalletAddress.current) {
        idb.closeDB(lastWalletAddress.current);
      }
      
      lastWalletAddress.current = walletAddress;
      isInitialized.current = false;
      refresh(null);
      console.log('[useIndexedDB] DB 초기화 - 새로운 지갑:', walletAddress);
    }
  }, [walletAddress]);

  // 컴포넌트 언마운트 시 DB 연결 정리
  useEffect(() => {
    return () => {
      if (lastWalletAddress.current) {
        idb.closeDB(lastWalletAddress.current);
      }
    };
  }, []);

  const addFile = useCallback(async (meta: FileMeta) => {
    await idb.addFileMeta(meta);
    await refresh(meta.parentId ?? null);
    console.log('[useIndexedDB] add', meta);
  }, [refresh]);

  const updateFile = useCallback(async (meta: FileMeta) => {
    console.log('[useIndexedDB] updateFile called:', { 
      id: meta.id, 
      name: meta.name, 
      parentId: meta.parentId 
    });
    
    // 기존 파일 정보를 먼저 가져와서 이전 parentId 확인
    const existingFile = files.find(f => f.id === meta.id);
    const oldParentId = existingFile ? existingFile.parentId : null;
    
    await idb.updateFileMeta(meta);
    
    // parentId가 변경된 경우, 현재 파일 목록을 직접 업데이트
    if (oldParentId !== meta.parentId) {
      console.log('[useIndexedDB] ParentId changed, updating local state');
      
      // 현재 파일 목록에서 해당 파일을 제거하고 새 parentId로 추가
      setFiles(prevFiles => {
        const filteredFiles = prevFiles.filter(f => f.id !== meta.id);
        return [...filteredFiles, meta];
      });
      
      console.log('[useIndexedDB] Local state updated for:', meta.name);
    } else {
      // parentId가 변경되지 않은 경우 기존 방식
      await refresh(meta.parentId ?? null);
    }
    
    console.log('[useIndexedDB] update completed for:', meta.name);
  }, [refresh, files]);

  const deleteFile = useCallback(async (id: string, parentId: string | null) => {
    await idb.deleteFileMeta(id, walletAddress);
    await refresh(parentId);
    console.log('[useIndexedDB] remove', id);
  }, [walletAddress, refresh]);

  return {
    files,
    loading,
    error,
    refresh,
    addFile,
    updateFile,
    deleteFile,
  };
} 