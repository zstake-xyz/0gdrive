/**
 * Downloads a blob as a file
 * @param data The data to download (ArrayBuffer)
 * @param fileName The name of the file to download
 */
export function downloadBlobAsFile(data: ArrayBuffer, fileName: string): void {
  try {
    // Create a blob from the array buffer
    const blob = new Blob([data]);
    
    // Create a URL for the blob
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    
    // Append to the document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    window.URL.revokeObjectURL(url);
    
    console.log(`[downloadBlobAsFile] File download initiated: ${fileName}`);
  } catch (error) {
    console.error('[downloadBlobAsFile] Error creating download:', error);
    throw new Error(`Failed to create download: ${error instanceof Error ? error.message : String(error)}`);
  }
} 