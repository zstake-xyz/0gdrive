'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useIndexedDB } from '@/hooks/useIndexedDB';

export interface Item {
  id: string;
  type: 'file' | 'folder';
  name: string;
  parentId: string | null;
  walletAddress: string;
  uploadDate: string;
  fileExtension?: string;
  fileSize?: number;
  rootHash?: string;
  networkType?: string;
  sharedWith?: string[];
  sharedBy?: string;
}

export interface Breadcrumb {
  id: string | null;
  name: string;
}

interface FileListContextType {
  items: Item[];
  loading: boolean;
  error: string | null;
  breadcrumbs: Breadcrumb[];
  currentFolderId: string | null;
  navigateToFolder: (folderId: string | null) => Promise<void>;
  addFile: (meta: Item) => Promise<void>;
  addFolder: (name: string) => Promise<Item>;
  deleteItem: (itemId: string) => Promise<boolean>;
  updateItem: (itemId: string, { name, parentId }: { name?: string, parentId?: string | null }) => Promise<Item>;
  formatFileSize: (bytes?: number) => string;
  formatDate: (dateString: string) => string;
  refresh: (parentId?: string | null) => void;
}

const FileListContext = createContext<FileListContextType | undefined>(undefined);

export function FileListProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Home' }]);
  const { files: items, loading, error, addFile, updateFile, deleteFile, refresh } = useIndexedDB(address ?? '');

  const navigateToFolder = useCallback(async (folderId: string | null) => {
    if (folderId === currentFolderId) return;

    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'Home' }]);
    } else {
      // IndexedDB에서 폴더 정보 직접 조회
      const folder = items.find(i => i.id === folderId && i.type === 'folder');
      if (!folder) {
        setBreadcrumbs([{ id: null, name: 'Home' }]);
        setCurrentFolderId(null);
        return;
      }
      const newBreadcrumbs = [...breadcrumbs];
      const existingIndex = newBreadcrumbs.findIndex(b => b.id === folderId);
      if (existingIndex !== -1) {
        newBreadcrumbs.splice(existingIndex + 1);
      } else {
        newBreadcrumbs.push({ id: folder.id, name: folder.name });
      }
      setBreadcrumbs(newBreadcrumbs);
    }
    setCurrentFolderId(folderId);
    // 폴더 변경 시 해당 폴더의 파일들을 다시 로드
    await refresh(folderId);
  }, [currentFolderId, items, breadcrumbs, refresh]);

  const addFolder = useCallback(async (name: string) => {
    if (!address) throw new Error('Wallet not connected');
    const folder: Item = {
      id: crypto.randomUUID(),
      type: 'folder',
      name,
      parentId: currentFolderId,
      walletAddress: address,
      uploadDate: new Date().toISOString(),
      sharedWith: [],
    };
    await addFile(folder);
    // addFile 내부에서 이미 refresh를 호출하므로 중복 제거
    return folder;
  }, [address, currentFolderId, addFile]);
  
  const deleteItem = useCallback(async (itemId: string) => {
    if (!address) throw new Error('Wallet not connected');
    await deleteFile(itemId, currentFolderId);
    // deleteFile 내부에서 이미 refresh를 호출하므로 중복 제거
    return true;
  }, [address, currentFolderId, deleteFile]);
  
  const updateItem = useCallback(async (itemId: string, { name, parentId }: { name?: string, parentId?: string | null }) => {
    if (!address) throw new Error('Wallet not connected');
    const item = items.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found');
    
    const updated = { ...item, name: name ?? item.name, parentId: parentId ?? item.parentId };
    console.log('[FileListContext] Updating item:', { 
      itemId, 
      oldParentId: item.parentId, 
      newParentId: updated.parentId,
      name: updated.name,
      currentFolderId
    });
    
    await updateFile(updated);
    
    // parentId가 변경된 경우 (파일 이동)
    if (parentId !== undefined && parentId !== item.parentId) {
      console.log('[FileListContext] ParentId changed - file moved');
      
      // 현재 폴더가 이동 전 폴더인 경우 현재 폴더를 refresh
      if (currentFolderId === item.parentId) {
        console.log('[FileListContext] Current folder is the old parent, refreshing current folder');
        await refresh(currentFolderId);
      }
      
      // 파일이 폴더로 이동된 경우, 자동으로 해당 폴더로 이동
      if (parentId !== null) {
        console.log('[FileListContext] Auto-navigating to destination folder:', parentId);
        await navigateToFolder(parentId);
      } else {
        // 파일이 홈으로 이동된 경우, 홈으로 이동
        console.log('[FileListContext] Auto-navigating to home');
        await navigateToFolder(null);
      }
    }
    
    return updated;
  }, [address, items, updateFile, refresh, currentFolderId, navigateToFolder]);

  const formatFileSize = useCallback((bytes?: number): string => {
    if (!bytes) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }, []);
  
  useEffect(() => {
    if (address) {
      // useIndexedDB에서 이미 지갑 변경 시 자동으로 refresh하므로 중복 제거
      console.log('[FileListContext] 지갑 연결됨:', address);
    } else {
      setBreadcrumbs([{ id: null, name: 'Home' }]);
      setCurrentFolderId(null);
      console.log('[FileListContext] 지갑 연결 해제됨');
    }
  }, [address]);

  const value = {
    items, loading, error, breadcrumbs, currentFolderId, navigateToFolder,
    addFile, addFolder, deleteItem, updateItem, formatFileSize, formatDate, refresh
  };

  return <FileListContext.Provider value={value}>{children}</FileListContext.Provider>;
}

export function useFileListContext() {
  const context = useContext(FileListContext);
  if (context === undefined) {
    throw new Error('useFileListContext must be used within a FileListProvider');
  }
  return context;
} 