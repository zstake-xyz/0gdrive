import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { useFileList, Item, Breadcrumb } from '@/hooks/useFileList';
import { useDownload } from '@/hooks/useDownload';
import { useWallet } from '@/hooks/useWallet';

interface FileListProps {
  className?: string;
  onUploadClick: () => void;
}

// 아이콘 매핑
const getIcon = (item: Item) => {
  if (item.type === 'folder') return '📁';
  const ext = item.fileExtension?.toLowerCase() || '';
  const iconMap: { [key: string]: string } = {
    pdf: '📄', doc: '📝', docx: '📝', txt: '📄',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
    mp4: '🎥', avi: '🎥', mov: '🎥',
    mp3: '🎵', wav: '🎵',
    zip: '📦', rar: '📦', exe: '⚙️',
    default: '📄'
  };
  return iconMap[ext] || iconMap.default;
};

export function FileList({ className = '', onUploadClick }: FileListProps) {
  const { 
    items, loading, error, deleteItem, updateItem, addFolder,
    formatFileSize, formatDate, navigateToFolder, breadcrumbs, currentFolderId
  } = useFileList();
  
  const { downloadFile, loading: downloadLoading } = useDownload();
  const { isConnected } = useWallet();

  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [dragOverHome, setDragOverHome] = useState(false);

  const handleDelete = async (item: Item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"? This will also delete all its contents.`)) return;
    setDeletingItemId(item.id);
    try {
      await deleteItem(item.id);
    } catch (err) {
      alert(`Failed to delete item: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleDownload = async (item: Item) => {
    if (item.type !== 'file' || !item.rootHash) return;
    try {
      const fileName = `${item.name}.${item.fileExtension}`;
      await downloadFile(item.rootHash, fileName);
    } catch (err) {
      alert(`Failed to download file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  const startEditing = (item: Item) => {
    setEditingItem(item);
    setEditingName(item.name);
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditingName('');
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingName.trim() || editingName.trim() === editingItem.name) {
      cancelEditing();
      return;
    }
    try {
      await updateItem(editingItem.id, { name: editingName.trim() });
    } catch (err) {
      alert(`Failed to rename: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      cancelEditing();
    }
  };

  const startCreatingFolder = () => {
    cancelEditing();
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const cancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  };
  
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      cancelCreateFolder();
      return;
    }
    try {
      await addFolder(newFolderName.trim());
    } catch (err) {
      alert(`Failed to create folder: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      cancelCreateFolder();
    }
  };
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: Item) => {
    if (item.type === 'file') {
      setDraggedItem(item);
      e.dataTransfer.effectAllowed = 'move';
    } else {
      e.preventDefault();
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetItem: Item) => {
    e.preventDefault();
    if (draggedItem && targetItem.type === 'folder' && targetItem.id !== draggedItem.id) {
        setDragOverTarget(targetItem.id);
    }
  };

  const handleDragLeave = () => {
      setDragOverTarget(null);
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetItem: Item) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (draggedItem && targetItem.type === 'folder' && draggedItem.id !== targetItem.id) {
      try {
        await updateItem(draggedItem.id, { parentId: targetItem.id });
      } catch (err) {
        alert(`Failed to move file: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    setDraggedItem(null);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
    setDragOverHome(false);
  };

  const handleDragOverHome = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedItem) {
      setDragOverHome(true);
    }
  };

  const handleDragLeaveHome = () => {
    setDragOverHome(false);
  };

  const handleDropOnHome = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOverHome(false);
    if (draggedItem && currentFolderId !== null) {
      try {
        await updateItem(draggedItem.id, { parentId: null });
      } catch (err) {
        alert(`Failed to move file: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  const Breadcrumbs = () => (
    <nav className="flex items-center text-sm text-brand-text-secondary">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.id || 'home'}>
          <button onClick={() => navigateToFolder(crumb.id)} className="hover:text-brand-primary">
            {crumb.name}
          </button>
          {index < breadcrumbs.length - 1 && <span className="mx-2">/</span>}
        </React.Fragment>
      ))}
    </nav>
  );

  const Header = () => (
    <div className="p-4 border-b border-brand-border flex justify-between items-center">
      <div className="flex items-center">
        <Image src="/logo.png" alt="Drive Logo" width={32} height={32} className="mr-3" />
        <h1 className="text-xl font-bold text-brand-text">Drive</h1>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={startCreatingFolder}
          disabled={!isConnected || isCreatingFolder}
          className="inline-flex items-center px-3 py-1.5 border border-brand-border text-xs font-medium rounded-md text-brand-text-secondary bg-brand-surface hover:bg-brand-background disabled:opacity-50"
        >
          <span className="mr-1">📁+</span> New Folder
        </button>
        <button
          onClick={onUploadClick}
          disabled={!isConnected}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-primary-dark disabled:opacity-50"
        >
          <span className="mr-1">📤</span> Upload Files
        </button>
      </div>
    </div>
  );

  const renderEmptyState = () => (
     <div className="p-6 text-center text-brand-text-secondary">
      {isConnected ? 'This folder is empty.' : 'Please connect your wallet to view your files.'}
    </div>
  )

  const renderLoading = () => (
    <div className="p-6 text-center text-brand-text-secondary">Loading...</div>
  )

  const renderError = () => (
    <div className="p-6 text-center text-red-500">Error: {error}</div>
  )

  return (
    <div className={`bg-brand-surface rounded-lg shadow-sm border border-brand-border ${className}`}>
      <Header />
      
      <div className="p-4 border-b border-brand-border">
          <Breadcrumbs/>
      </div>

      {isCreatingFolder && (
        <div className="p-4 bg-brand-background border-b border-brand-border">
          <form onSubmit={handleCreateFolder} className="flex items-center">
            <span className="text-2xl mr-3">📁</span>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={cancelCreateFolder}
              placeholder="Folder Name"
              className="flex-grow p-2 border border-brand-border rounded-md focus:ring-brand-primary focus:border-brand-primary"
              autoFocus
            />
            <button type="submit" className="ml-2 px-4 py-2 bg-brand-primary text-white rounded-md text-sm font-semibold">Create</button>
            <button type="button" onClick={cancelCreateFolder} className="ml-2 px-4 py-2 bg-brand-surface text-brand-text-secondary border border-brand-border rounded-md text-sm">Cancel</button>
          </form>
        </div>
      )}
      
      <div className="divide-y divide-brand-border min-h-[200px]">
        {loading ? renderLoading() : error ? renderError() : items.length === 0 && !isCreatingFolder ? renderEmptyState() : items.map(item => (
          <div
            key={item.id}
            draggable={item.type === 'file'}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item)}
            onDragEnd={handleDragEnd}
            className={`p-4 flex items-center justify-between transition-colors ${item.type === 'file' ? 'cursor-grab' : ''} hover:bg-brand-background ${dragOverTarget === item.id ? 'bg-brand-secondary-light' : ''}`}
            onDoubleClick={() => item.type === 'folder' && navigateToFolder(item.id)}
          >
            <div className="flex-1 min-w-0 flex items-center">
              <span className="text-2xl mr-4">{getIcon(item)}</span>
              <div className="flex-1 min-w-0">
                {editingItem?.id === item.id ? (
                  <form onSubmit={handleRename}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleRename}
                      className="p-1 border border-brand-border rounded-md focus:ring-brand-primary focus:border-brand-primary"
                      autoFocus
                    />
                  </form>
                ) : (
                  <h4 className="text-sm font-medium text-brand-text truncate" title={item.name}>
                    {item.name}{item.type === 'file' && `.${item.fileExtension}`}
                  </h4>
                )}
                <div className="flex items-center mt-1 text-xs text-brand-text-secondary space-x-2">
                  <span>{formatDate(item.uploadDate)}</span>
                  {item.type === 'file' && <>
                    <span>•</span>
                    <span>{formatFileSize(item.fileSize)}</span>
                  </>}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button onClick={() => startEditing(item)} className="p-2 text-brand-text-secondary hover:text-brand-primary rounded-full">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
              </button>
              {item.type === 'file' && (
                <button
                  onClick={() => handleDownload(item)}
                  disabled={downloadLoading}
                  className="p-2 text-brand-text-secondary hover:text-brand-primary rounded-full disabled:opacity-50"
                >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
              )}
              <button onClick={() => handleDelete(item)} disabled={deletingItemId === item.id} className="p-2 text-brand-text-secondary hover:text-red-500 rounded-full disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
        
      </div>

      {draggedItem && currentFolderId !== null && (
        <div
          onDragOver={handleDragOverHome}
          onDragLeave={handleDragLeaveHome}
          onDrop={handleDropOnHome}
          className={`
            p-4 text-center border-t-2 border-dashed transition-colors
            ${dragOverHome ? 'border-brand-primary bg-brand-secondary-light' : 'border-transparent'}
          `}
        >
          <div className="flex flex-col items-center justify-center text-brand-text-secondary">
            <span className="text-3xl mb-1">🏠</span>
            <p className="text-sm font-medium">Move to Home</p>
          </div>
        </div>
      )}
    </div>
  );
} 