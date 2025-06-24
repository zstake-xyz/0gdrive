'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWallet } from '@/hooks/useWallet';

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
  addFile: (name: string, fileExtension: string, fileSize: number, rootHash: string, networkType: string) => Promise<Item>;
  addFolder: (name: string) => Promise<Item>;
  deleteItem: (itemId: string) => Promise<boolean>;
  updateItem: (itemId: string, { name, parentId }: { name?: string, parentId?: string | null }) => Promise<Item>;
  formatFileSize: (bytes?: number) => string;
  formatDate: (dateString: string) => string;
  refresh: () => void;
}

const FileListContext = createContext<FileListContextType | undefined>(undefined);

export function FileListProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Home' }]);

  const fetchItems = useCallback(async (folderId: string | null) => {
    if (!address) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = `/api/files?walletAddress=${address}&parentId=${folderId || ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch items: ${response.statusText}`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, [address]);
  
  const refresh = useCallback(() => {
    fetchItems(currentFolderId);
  }, [fetchItems, currentFolderId]);

  const navigateToFolder = useCallback(async (folderId: string | null) => {
    if (folderId === currentFolderId) return;

    if (folderId === null) {
      setBreadcrumbs([{ id: null, name: 'Home' }]);
    } else {
      try {
        const response = await fetch(`/api/files/${folderId}?walletAddress=${address}`);
        if (!response.ok) throw new Error('Failed to fetch folder details');
        const { item } = await response.json();
        
        const newBreadcrumbs = [...breadcrumbs];
        const existingIndex = newBreadcrumbs.findIndex(b => b.id === folderId);

        if (existingIndex !== -1) {
          newBreadcrumbs.splice(existingIndex + 1);
        } else {
          newBreadcrumbs.push({ id: item.id, name: item.name });
        }
        setBreadcrumbs(newBreadcrumbs);
      } catch (err) {
        console.error("Navigation error:", err);
        setBreadcrumbs([{ id: null, name: 'Home' }]);
        setCurrentFolderId(null);
        return;
      }
    }
    setCurrentFolderId(folderId);
  }, [currentFolderId, address, breadcrumbs]);

  const addFile = useCallback(async (name: string, fileExtension: string, fileSize: number, rootHash: string, networkType: string) => {
    if (!address) throw new Error('Wallet not connected');
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address, type: 'file', name, parentId: currentFolderId, fileExtension, fileSize, rootHash, networkType }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add file');
    }
    const data = await response.json();
    refresh();
    return data.item;
  }, [address, currentFolderId, refresh]);
  
  const addFolder = useCallback(async (name: string) => {
    if (!address) throw new Error('Wallet not connected');
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address, type: 'folder', name, parentId: currentFolderId }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create folder');
    }
    const data = await response.json();
    refresh();
    return data.item;
  }, [address, currentFolderId, refresh]);
  
  const deleteItem = useCallback(async (itemId: string) => {
    if (!address) throw new Error('Wallet not connected');
    const response = await fetch(`/api/files?id=${itemId}&walletAddress=${address}`, { method: 'DELETE' });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete item');
    }
    refresh();
    return true;
  }, [address, refresh]);
  
  const updateItem = useCallback(async (itemId: string, { name, parentId }: { name?: string, parentId?: string | null }) => {
    if (!address) throw new Error('Wallet not connected');
    const response = await fetch(`/api/files/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address, name, parentId }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update item');
    }
    refresh();
    const data = await response.json();
    return data.item;
  }, [address, refresh]);

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
      fetchItems(currentFolderId);
    } else {
      setItems([]);
      setBreadcrumbs([{ id: null, name: 'Home' }]);
      setCurrentFolderId(null);
    }
  }, [address, currentFolderId, fetchItems]);

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