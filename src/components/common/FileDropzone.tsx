import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileDropzoneProps {
  onFileDrop: (file: File) => void;
  disabled?: boolean;
}

export function FileDropzone({ onFileDrop, disabled }: FileDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      onFileDrop(acceptedFiles[0]);
    }
  }, [onFileDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: disabled
  });

  return (
    <div
      {...getRootProps()}
      className={`
        p-10 border-2 border-dashed rounded-xl text-center cursor-pointer 
        transition-colors duration-300 ease-in-out
        ${isDragActive 
          ? 'border-brand-primary bg-brand-secondary-light' 
          : 'border-brand-border hover:border-brand-primary-light hover:bg-brand-background'}
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-brand-text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mb-4 text-brand-primary-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {isDragActive ? (
          <p className="text-lg font-semibold text-brand-primary">Drop the file here...</p>
        ) : (
          <>
            <p className="text-lg font-semibold">Drag & drop a file here, or click to select</p>
            <p className="text-sm mt-1">Select a single file to upload to 0G Storage.</p>
          </>
        )}
      </div>
    </div>
  );
}