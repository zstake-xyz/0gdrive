import { useFileListContext } from '@/context/FileListContext';

export function useFileList() {
  return useFileListContext();
}

export type { Item, Breadcrumb } from '@/context/FileListContext'; 