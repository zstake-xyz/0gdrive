import React, { useState } from 'react';
import { FileList } from '@/components/common/FileList';
import { UploadModal } from './UploadModal';
import { FileListProvider } from '@/context/FileListContext';

/**
 * A component that allows users to upload files to 0G Storage
 * and displays the list of uploaded files.
 */
export function UploadCard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <FileListProvider>
      <div className="max-w-4xl 2.5xl:max-w-[2048px] 3xl:max-w-[2560px] mx-auto px-2 sm:px-4 md:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <UploadModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
        />
        <FileList onUploadClick={handleOpenModal} />
      </div>
    </FileListProvider>
  );
}

/**
 * Export a container component that ensures remounting when network changes
 */
export default function UploadCardContainer() {
  return <UploadCard />;
} 