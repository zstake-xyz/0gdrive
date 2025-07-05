import { Indexer } from '@0glabs/0g-ts-sdk';

/**
 * Downloads a file from 0G storage by root hash using direct API call
 * This is an alternative to using the SDK which may have compatibility issues
 * 
 * @param rootHash The root hash of the file to download
 * @param storageRpc The storage RPC URL to connect to
 * @returns A promise that resolves to the file data (ArrayBuffer) and any error
 */
export async function downloadByRootHashAPI(
  rootHash: string, 
  storageRpc: string
): Promise<[ArrayBuffer | null, Error | null]> {
  try {
    console.log(`API Download by root hash: ${rootHash} from ${storageRpc}`);
    
    if (!rootHash) {
      console.log('Root hash is empty or invalid');
      return [null, new Error('Root hash is required')];
    }
    
    // 먼저 프록시를 통해 시도
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(`${storageRpc}/file?root=${rootHash}`)}`;
    console.log(`Attempting proxy download from: ${proxyUrl}`);
    
    try {
      const proxyResponse = await fetch(proxyUrl);
      
      if (proxyResponse.ok) {
        // 프록시 성공 시 스트림 방식으로 처리
        if (proxyResponse.body && window.ReadableStream) {
          const reader = proxyResponse.body.getReader();
          const chunks = [];
          let receivedLength = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
          }
          let chunksAll = new Uint8Array(receivedLength);
          let position = 0;
          for (let chunk of chunks) {
            chunksAll.set(chunk, position);
            position += chunk.length;
          }
          const fileData = chunksAll.buffer;
          if (fileData && fileData.byteLength > 0) {
            console.log(`Proxy download successful, received ${fileData.byteLength} bytes`);
            return [fileData, null];
          }
        }
        
        // fallback: arrayBuffer 방식
        const fileData = await proxyResponse.arrayBuffer();
        if (fileData && fileData.byteLength > 0) {
          console.log(`Proxy download successful, received ${fileData.byteLength} bytes`);
          return [fileData, null];
        }
      } else {
        console.log(`Proxy failed with status ${proxyResponse.status}, trying direct connection...`);
      }
    } catch (proxyError) {
      console.log(`Proxy error: ${proxyError}, trying direct connection...`);
    }
    
    // 프록시 실패 시 직접 연결 시도 (CORS 우회)
    console.log(`Attempting direct download from: ${storageRpc}/file?root=${rootHash}`);
    
    // 브라우저에서 직접 외부 서버에 연결할 수 없으므로, 
    // 다른 방법으로 시도: 프록시 없이 직접 fetch
    const directUrl = `${storageRpc}/file?root=${rootHash}`;
    
    // CORS 문제를 우회하기 위해 다른 접근 방법 시도
    // 1. JSONP 방식으로 시도 (서버가 지원하는 경우)
    try {
      const jsonpResponse = await fetch(directUrl, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': '*/*',
          'User-Agent': '0G-Storage-Web/1.0'
        }
      });
      
      if (jsonpResponse.ok) {
        const fileData = await jsonpResponse.arrayBuffer();
        if (fileData && fileData.byteLength > 0) {
          console.log(`Direct download successful, received ${fileData.byteLength} bytes`);
          return [fileData, null];
        }
      }
    } catch (directError) {
      console.log(`Direct connection failed: ${directError}`);
    }
    
    // 2. 마지막 방법: 프록시를 다시 시도하되 더 긴 타임아웃으로
    console.log(`Retrying proxy with longer timeout...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10분 타임아웃
    
    try {
      const retryResponse = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'Accept': '*/*',
          'User-Agent': '0G-Storage-Web/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (retryResponse.ok) {
        const fileData = await retryResponse.arrayBuffer();
        if (fileData && fileData.byteLength > 0) {
          console.log(`Retry download successful, received ${fileData.byteLength} bytes`);
          return [fileData, null];
        }
      } else {
        // JSON 에러 응답인지 확인
        const contentType = retryResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await retryResponse.json();
            console.log('Retry returned JSON error:', errorData);
            
            if (errorData.error === 'External server error') {
              if (errorData.status === 504) {
                return [null, new Error('서버 타임아웃 - 파일이 너무 크거나 서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.')];
              }
              return [null, new Error(errorData.message || `파일을 찾을 수 없거나 서버 오류 (${errorData.status})`)];
            } else {
              if (errorData.isTimeout) {
                return [null, new Error('요청 타임아웃 - 파일이 너무 크거나 서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.')];
              }
              return [null, new Error(`프록시 오류: ${errorData.error} - ${errorData.details || ''}`)];
            }
          } catch (jsonError) {
            return [null, new Error(`다운로드 실패 (상태 ${retryResponse.status}): 잘못된 오류 응답`)];
          }
        } else {
          const errorText = await retryResponse.text();
          console.log(`Retry error text: ${errorText}`);
          
          if (retryResponse.status === 504) {
            return [null, new Error('서버 타임아웃 - 파일이 너무 크거나 서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.')];
          }
          return [null, new Error(`다운로드 실패 (상태 ${retryResponse.status}): ${errorText}`)];
        }
      }
    } catch (retryError) {
      clearTimeout(timeoutId);
      console.log(`Retry failed: ${retryError}`);
      
      if (retryError instanceof Error && retryError.name === 'AbortError') {
        return [null, new Error('다운로드 타임아웃 - 파일이 너무 크거나 서버가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.')];
      }
    }
    
    // 모든 방법 실패
    return [null, new Error('파일을 다운로드할 수 없습니다. 파일이 존재하지 않거나 서버에 문제가 있을 수 있습니다.')];
    
  } catch (error) {
    console.error('API Download error:', error);
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Downloads a file from 0G storage by root hash
 * @param rootHash The root hash of the file to download
 * @param storageRpc The storage RPC URL to connect to
 * @param filePath Optional file path. If not provided, rootHash will be used as the path
 * @returns A promise that resolves to the file data (ArrayBuffer) and any error
 * 
 * Note: The indexer.download function takes 3 parameters:
 * 1. rootHash: The root hash of the file to download
 * 2. path: The file path (can be the same as rootHash)
 * 3. skipVerify: Whether to skip verification (default: false)
 */
export async function downloadByRootHash(
  rootHash: string, 
  storageRpc: string,
  filePath?: string
): Promise<[ArrayBuffer | null, Error | null]> {
  try {
    console.log(`Downloading by root hash: ${rootHash} from ${storageRpc} with path: ${filePath || 'using rootHash as path'}`);
    
    if (!rootHash) {
      console.log('Root hash is empty or invalid');
      return [null, new Error('Root hash is required')];
    }
    
    const indexer = new Indexer(storageRpc);
    console.log(`Indexer:`, indexer);
    // Log the parameters being passed to indexer.download
    console.log(`Calling indexer.download with rootHash: ${rootHash}, filePath: ${filePath || rootHash}`);
    
    // Use the provided file path, or fall back to using the root hash as the path
    const path = filePath || rootHash;
    let fileData;
    
    try {
      // The second parameter is the file path, not a user address
      // The third parameter is skipVerify (we'll set it to false for now)
      console.log(`Downloading file from ${storageRpc} with path: ${path}`);
      console.log(`Downloading file from ${storageRpc} with rootHash: ${rootHash}`);
      fileData = await indexer.download(rootHash, path, false);
    } catch (downloadError) {
      console.log('Error from indexer.download:', downloadError);
      return [null, new Error(`Download failed: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`)];
    }
    
    // Log the result of indexer.download
    console.log(`indexer.download result type:`, fileData ? typeof fileData : 'null');
    
    if (!fileData) {
      console.log('fileData is null or undefined');
      return [null, new Error('File data is null or undefined')];
    }
    
    if (!(fileData instanceof ArrayBuffer)) {
      console.log('fileData is not an ArrayBuffer:', typeof fileData);
      return [null, new Error(`Invalid file data type: ${typeof fileData}`)];
    }
    
    console.log(`Returning fileData of length ${fileData.byteLength}`);
    return [fileData, null];
  } catch (error) {
    console.log('Error in downloadByRootHash:', error);
    return [null, error instanceof Error ? error : new Error(String(error))];
  }
}

/**
 * Creates a downloadable file from raw file data
 * @param fileData The file data as ArrayBuffer
 * @param fileName The file name
 */
export function downloadBlobAsFile(fileData: ArrayBuffer, fileName: string): void {
  try {
    // Additional validation to prevent "Cannot read properties of null (reading 'length')" error
    if (!fileData) {
      console.log('downloadBlobAsFile: fileData is null or undefined');
      throw new Error('File data is null or undefined');
    }
    
    if (!(fileData instanceof ArrayBuffer)) {
      console.log('downloadBlobAsFile: fileData is not an ArrayBuffer:', typeof fileData);
      throw new Error(`Invalid file data type: ${typeof fileData}`);
    }
    
    // Check if the ArrayBuffer has data
    if (fileData.byteLength === 0) {
      console.log('downloadBlobAsFile: fileData is empty (zero length)');
      throw new Error('File data is empty');
    }
    
    // Create a text decoder to check if the file looks like JSON
    const decoder = new TextDecoder('utf-8');
    const firstChars = decoder.decode(fileData.slice(0, Math.min(100, fileData.byteLength)));
    
    // Simple check to detect if this might be a JSON error response
    if (firstChars.trim().startsWith('{') && 
        (firstChars.includes('"code"') || firstChars.includes('"message"'))) {
      console.log('downloadBlobAsFile: Data appears to be a JSON error response:', firstChars);
      throw new Error('Received an error response instead of a file');
    }
    
    // Create a blob from the array buffer
    const byteArray = new Uint8Array(fileData);
    const blob = new Blob([byteArray]);
    const url = URL.createObjectURL(blob);
    
    // Create a link element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `download-${Date.now()}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.log('Error creating downloadable file:', error);
    throw error;
  }
} 