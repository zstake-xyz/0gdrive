import React, { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useFileList, Item, Breadcrumb } from '@/hooks/useFileList';
import { useDownload } from '@/hooks/useDownload';
import { useWallet } from '@/hooks/useWallet';
import { ShareModal } from './ShareModal';
import { BackupButtons } from './BackupButtons';

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

// 메모이제이션된 로고 컴포넌트
const MemoizedLogo = React.memo(() => {
  return (
    <img
      src="/logo.png"
      alt="Drive Logo"
      width={32}
      height={32}
      className="mr-3 select-none pointer-events-none"
      draggable={false}
      style={{ userSelect: 'none' }}
    />
  );
});

MemoizedLogo.displayName = 'MemoizedLogo';

export function FileList({ className = '', onUploadClick }: FileListProps) {
  const { 
    items, loading, error, deleteItem, updateItem, addFolder,
    formatFileSize, formatDate, navigateToFolder, breadcrumbs, currentFolderId, refresh
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [copyMessage, setCopyMessage] = useState('');

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
      e.dataTransfer.setData('text/plain', item.name); // 드래그 시 파일명 표시
      console.log('[FileList] Started dragging file:', item.name);
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
        console.log('[FileList] Moving file:', draggedItem.name, 'to folder:', targetItem.name);
        console.log('[FileList] Current folder ID:', currentFolderId);
        console.log('[FileList] Target folder ID:', targetItem.id);
        console.log('[FileList] Dragged item parent ID:', draggedItem.parentId);
        
        // 드래그된 아이템을 먼저 저장
        const itemToMove = draggedItem;
        setDraggedItem(null);
        
        await updateItem(itemToMove.id, { parentId: targetItem.id });
        console.log('[FileList] File moved successfully');
        
      } catch (err) {
        console.error('[FileList] Failed to move file:', err);
        alert(`Failed to move file: ${err instanceof Error ? err.message : String(err)}`);
        setDraggedItem(null);
      }
    } else {
      setDraggedItem(null);
    }
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
        console.log('[FileList] Moving file:', draggedItem.name, 'to home');
        console.log('[FileList] Current folder ID:', currentFolderId);
        console.log('[FileList] Dragged item parent ID:', draggedItem.parentId);
        
        // 드래그된 아이템을 먼저 저장
        const itemToMove = draggedItem;
        setDraggedItem(null);
        
        await updateItem(itemToMove.id, { parentId: null });
        console.log('[FileList] File moved to home successfully');
        
      } catch (err) {
        console.error('[FileList] Failed to move file to home:', err);
        alert(`Failed to move file: ${err instanceof Error ? err.message : String(err)}`);
        setDraggedItem(null);
      }
    } else {
      setDraggedItem(null);
    }
  };

  // 공유 버튼 클릭 시 rootHash와 파일명으로 링크 생성 및 복사
  const handleShare = async (item: Item) => {
    if (!item.rootHash) {
      setCopyMessage('No shareable link available.');
      setTimeout(() => setCopyMessage(''), 2000);
      return;
    }
    // 파일명과 확장자를 URL에 포함 (중복 방지)
    let fileName = item.name;
    if (
      item.fileExtension &&
      !item.name.toLowerCase().endsWith('.' + item.fileExtension.toLowerCase())
    ) {
      fileName = `${item.name}.${item.fileExtension}`;
    }
    const url = `https://0gdrive.xyz/share/${item.rootHash}?name=${encodeURIComponent(fileName)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Download link copied to clipboard!');
    } catch (e) {
      setCopyMessage('Failed to copy to clipboard.');
    }
    setTimeout(() => setCopyMessage(''), 2000);
  };

  const Breadcrumbs = () => (
    <nav className="flex items-center text-xs sm:text-sm text-brand-text-secondary gap-2">
      <button
        className={`w-7 h-7 flex items-center justify-center rounded-full border border-brand-border mr-1 ${breadcrumbs.length <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-background'}`}
        onClick={() => breadcrumbs.length > 1 && navigateToFolder(breadcrumbs[breadcrumbs.length - 2].id)}
        disabled={breadcrumbs.length <= 1}
        aria-label="Back"
      >
        {'<'}
      </button>
      <button
        className={`w-7 h-7 flex items-center justify-center rounded-full border border-brand-border mr-2 ${breadcrumbs.length <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-background'}`}
        onClick={() => {}}
        disabled={breadcrumbs.length <= 1}
        aria-label="Forward"
      >
        {'>'}
      </button>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.id || 'home'}>
          <button onClick={() => navigateToFolder(crumb.id)} className="hover:text-brand-primary">
            {crumb.name}
          </button>
          {index < breadcrumbs.length - 1 && <span className="mx-1">/</span>}
        </React.Fragment>
      ))}
    </nav>
  );

  const Header = () => (
    <div className="p-4 border-b border-brand-border flex justify-between items-center">
      <div className="flex items-center">
        <MemoizedLogo />
        <h1 className="text-xl font-bold text-brand-text">Drive</h1>
      </div>
      <div className="flex items-center space-x-2">
        <BackupButtons />
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
    <div className={`bg-brand-surface rounded-lg shadow-sm border border-brand-border w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12 ${className}`}>
      <Header />
      
      <div className="p-4 border-b border-brand-border">
          <Breadcrumbs/>
      </div>

      {isCreatingFolder && (
        <div className="p-4 bg-brand-background border-b border-brand-border">
          <form onSubmit={handleCreateFolder} className="flex flex-col sm:flex-row items-stretch gap-2">
            <span className="text-2xl sm:mr-3">📁</span>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={cancelCreateFolder}
              placeholder="Folder Name"
              className="flex-1 p-2 border border-brand-border rounded-md focus:ring-brand-primary focus:border-brand-primary min-w-0"
              autoFocus
            />
            <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-md text-sm font-semibold w-full sm:w-auto">Create</button>
            <button type="button" onClick={cancelCreateFolder} className="px-4 py-2 bg-brand-surface text-brand-text-secondary border border-brand-border rounded-md text-sm w-full sm:w-auto">Cancel</button>
          </form>
        </div>
      )}
      
      <div className="min-h-[200px]">
        {loading ? renderLoading() : error ? renderError() : items.length === 0 && !isCreatingFolder ? renderEmptyState() : (
          <table className="w-full font-sans">
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead className="bg-brand-background text-[0.7rem] font-sans">
              <tr>
                <th className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 text-left font-medium text-brand-text-secondary uppercase tracking-wider text-[0.7rem] font-sans">Name</th>
                <th className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 text-right font-medium text-brand-text-secondary uppercase tracking-wider text-[0.7rem] font-sans">Size</th>
                <th className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 text-left font-medium text-brand-text-secondary uppercase tracking-wider text-[0.7rem] font-sans">Date</th>
                <th className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 text-right font-medium text-brand-text-secondary uppercase tracking-wider text-[0.7rem] font-sans">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-[0.7rem] font-sans">
              {items.map(item => (
                <tr
                  key={item.id}
                  draggable={item.type === 'file'}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={(e) => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item)}
                  onDragEnd={handleDragEnd}
                  className={`
                    transition-colors duration-200
                    ${item.type === 'file' ? 'cursor-grab active:cursor-grabbing' : ''} 
                    hover:bg-brand-background 
                    ${dragOverTarget === item.id ? 'bg-brand-secondary-light border-2 border-brand-primary' : ''}
                    ${draggedItem?.id === item.id ? 'opacity-50' : ''}
                  `}
                  onDoubleClick={() => item.type === 'folder' && navigateToFolder(item.id)}
                >
                  <td className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 min-w-0 max-w-0">
                    <div className="flex items-center min-w-0">
                      <span className={`text-xl sm:text-2xl mr-1 sm:mr-2 md:mr-3 shrink-0 transition-all duration-200 ${
                        dragOverTarget === item.id && item.type === 'folder' ? 'scale-110 text-brand-primary' : ''
                      }`}>
                        {getIcon(item)}
                      </span>
                      {editingItem?.id === item.id ? (
                        <form onSubmit={handleRename}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={handleRename}
                            className="p-1 border border-brand-border rounded-md focus:ring-brand-primary focus:border-brand-primary w-full min-w-0 text-xs sm:text-sm"
                            autoFocus
                          />
                        </form>
                      ) : (
                        <>
                          <h4 className={`text-xs sm:text-sm font-medium text-brand-text truncate min-w-0 transition-colors duration-200 ${
                            dragOverTarget === item.id && item.type === 'folder' ? 'text-brand-primary font-semibold' : ''
                          }`} title={item.name}>
                            {item.name}
                            {item.type === 'file' && item.fileExtension && !item.name.toLowerCase().endsWith('.' + item.fileExtension.toLowerCase()) && `.${item.fileExtension}`}
                          </h4>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 text-right">
                    {item.type === 'file' ? formatFileSize(item.fileSize) : ''}
                  </td>
                  <td className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 text-xs sm:text-sm text-brand-text-secondary whitespace-nowrap">{formatDate(item.uploadDate)}</td>
                  <td className="px-1 sm:px-2 md:px-3 lg:px-4 py-3 text-right">
                    <div className="flex flex-row items-center justify-end gap-1 sm:gap-2">
                      <button onClick={() => startEditing(item)} className="p-1 text-brand-text-secondary hover:text-brand-primary rounded-full">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={() => handleShare(item)}
                        className="p-1 text-pink-500 hover:bg-pink-500 hover:text-white bg-transparent rounded-full transition-colors"
                        title="다운로드 링크 복사"
                      >
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
                      </button>
                      {item.type === 'file' && (
                        <button
                          onClick={() => handleDownload(item)}
                          disabled={downloadLoading}
                          className="p-1 text-brand-text-secondary hover:text-brand-primary rounded-full disabled:opacity-50"
                          title={item.rootHash ? `Download using root hash: ${item.rootHash}` : 'No root hash available'}
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      )}
                      <button onClick={() => handleDelete(item)} disabled={deletingItemId === item.id} className="p-1 text-brand-text-secondary hover:text-red-500 rounded-full disabled:opacity-50">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

      {copyMessage && (
        <div className="p-2 text-center text-green-700 bg-green-50 border border-green-200 rounded mb-2 text-sm">
          {copyMessage}
        </div>
      )}
    </div>
  );
} 