/**
 * Formats file size in bytes to a human-readable string
 * @param bytes File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncates a string (like a hash) for display purposes
 * @param str The string to truncate
 * @param startLen The number of characters to keep at the start
 * @param endLen The number of characters to keep at the end
 * @returns The truncated string
 */
export function truncateString(
  str: string,
  startLen: number = 6,
  endLen: number = 4
): string {
  if (str.length <= startLen + endLen) {
    return str;
  }
  return `${str.substring(0, startLen)}...${str.substring(str.length - endLen)}`;
} 