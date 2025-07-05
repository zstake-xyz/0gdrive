// IndexedDB 유틸리티 for 파일 메타데이터
export interface FileMeta {
  id: string;
  name: string;
  type: 'file' | 'folder';
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

// DB 연결 캐시
const dbCache = new Map<string, IDBDatabase>();
// DB 이름 캐시
const dbNameCache = new Map<string, string>();
// 작업 중인 작업 추적
const pendingOperations = new Map<string, Promise<any>>();

// 지갑 주소별로 DB를 분리하기 위한 함수
function getDBName(walletAddress: string): string {
  // 캐시된 DB 이름이 있으면 반환
  if (dbNameCache.has(walletAddress)) {
    return dbNameCache.get(walletAddress)!;
  }
  
  // 지갑 주소의 해시를 사용하여 안전한 DB 이름 생성
  const hash = walletAddress.toLowerCase().replace(/[^a-f0-9]/g, '');
  const dbName = `0gdrive_${hash}`;
  
  // 캐시에 저장
  dbNameCache.set(walletAddress, dbName);
  console.log('[IndexedDB] getDBName:', { walletAddress, hash, dbName });
  return dbName;
}

const DB_VERSION = 1;
const STORE_NAME = 'files';

function openDB(walletAddress: string): Promise<IDBDatabase> {
  const dbName = getDBName(walletAddress);
  
  // 캐시된 DB 연결이 있으면 반환
  if (dbCache.has(dbName)) {
    const cachedDb = dbCache.get(dbName);
    if (cachedDb) {
      try {
        // 간단한 테스트로 연결 상태 확인
        const testTransaction = cachedDb.transaction(STORE_NAME, 'readonly');
        if (testTransaction) {
          console.log('[IndexedDB] Using cached DB connection for wallet:', walletAddress);
          return Promise.resolve(cachedDb);
        }
      } catch (error) {
        // 연결이 닫혀있으면 캐시에서 제거
        console.log('[IndexedDB] Cached DB connection is closed, removing from cache');
        dbCache.delete(dbName);
      }
    }
  }
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('parentId', 'parentId', { unique: false });
        store.createIndex('walletAddress', 'walletAddress', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('uploadDate', 'uploadDate', { unique: false });
        console.log('[IndexedDB] Object store and indexes created for wallet:', walletAddress);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // DB 연결을 캐시에 저장
      dbCache.set(dbName, db);
      console.log('[IndexedDB] DB opened and cached for wallet:', walletAddress);
      resolve(db);
    };
    request.onerror = () => {
      console.error('[IndexedDB] DB open error for wallet:', walletAddress, request.error);
      reject(request.error);
    };
  });
}

// DB 연결 정리 함수
export function closeDB(walletAddress: string): void {
  const dbName = getDBName(walletAddress);
  const db = dbCache.get(dbName);
  if (db) {
    db.close();
    dbCache.delete(dbName);
    console.log('[IndexedDB] DB connection closed for wallet:', walletAddress);
  }
}

// 모든 DB 연결 정리
export function closeAllDBs(): void {
  dbCache.forEach((db, dbName) => {
    db.close();
    console.log('[IndexedDB] DB connection closed:', dbName);
  });
  dbCache.clear();
}

// 작업 중복 방지를 위한 헬퍼 함수
function getOperationKey(operation: string, walletAddress: string, ...args: any[]): string {
  return `${operation}_${walletAddress}_${args.join('_')}`;
}

// 중복 작업 방지 래퍼
async function withDeduplication<T>(
  operation: string,
  walletAddress: string,
  args: any[],
  operationFn: () => Promise<T>
): Promise<T> {
  const key = getOperationKey(operation, walletAddress, ...args);
  
  if (pendingOperations.has(key)) {
    console.log(`[IndexedDB] Operation ${operation} already in progress, waiting...`);
    return await pendingOperations.get(key)!;
  }
  
  const promise = operationFn();
  pendingOperations.set(key, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    pendingOperations.delete(key);
  }
}

// localStorage 키 생성 함수
function getLocalStorageKey(walletAddress: string, parentId: string | null): string {
  const hash = walletAddress.toLowerCase().replace(/[^a-f0-9]/g, '');
  const parentKey = parentId ? `_${parentId}` : '_root';
  return `0gdrive_data_${hash}${parentKey}`;
}

// localStorage에서 데이터 읽기
function getFromLocalStorage(walletAddress: string, parentId: string | null): FileMeta[] {
  try {
    const key = getLocalStorageKey(walletAddress, parentId);
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[IndexedDB] localStorage 읽기 오류:', error);
    return [];
  }
}

// localStorage에 데이터 저장
function saveToLocalStorage(walletAddress: string, parentId: string | null, data: FileMeta[]): void {
  try {
    const key = getLocalStorageKey(walletAddress, parentId);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('[IndexedDB] localStorage 저장 오류:', error);
  }
}

// localStorage에서 특정 지갑의 모든 데이터 삭제
function clearLocalStorageForWallet(walletAddress: string): void {
  try {
    const hash = walletAddress.toLowerCase().replace(/[^a-f0-9]/g, '');
    const prefix = `0gdrive_data_${hash}`;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('[IndexedDB] localStorage 정리 오류:', error);
  }
}

export async function addFileMeta(meta: FileMeta) {
  return withDeduplication('addFileMeta', meta.walletAddress, [meta.id], async () => {
    const db = await openDB(meta.walletAddress);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(meta);
      tx.oncomplete = () => {
        console.log('[IndexedDB] addFileMeta', meta);
        // localStorage 동기화
        const currentData = getFromLocalStorage(meta.walletAddress, meta.parentId);
        currentData.push(meta);
        saveToLocalStorage(meta.walletAddress, meta.parentId, currentData);
        resolve(true);
      };
      tx.onerror = () => {
        console.error('[IndexedDB] addFileMeta error', tx.error);
        reject(tx.error);
      };
    });
  });
}

export async function updateFileMeta(meta: FileMeta) {
  return withDeduplication('updateFileMeta', meta.walletAddress, [meta.id], async () => {
    const db = await openDB(meta.walletAddress);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      
      // 먼저 기존 데이터를 가져와서 이전 parentId를 확인
      const getReq = tx.objectStore(STORE_NAME).get(meta.id);
      getReq.onsuccess = () => {
        const oldMeta = getReq.result;
        const oldParentId = oldMeta ? oldMeta.parentId : null;
        
        // 새 데이터로 업데이트
        tx.objectStore(STORE_NAME).put(meta);
        
        tx.oncomplete = () => {
          console.log('[IndexedDB] updateFileMeta', { 
            id: meta.id, 
            name: meta.name, 
            oldParentId, 
            newParentId: meta.parentId 
          });
          
          // localStorage 동기화 - parentId가 변경된 경우
          if (oldParentId !== meta.parentId) {
            console.log('[IndexedDB] ParentId changed, updating localStorage');
            
            // 이전 폴더에서 제거
            if (oldParentId !== null) {
              const oldData = getFromLocalStorage(meta.walletAddress, oldParentId);
              const filteredOldData = oldData.filter(item => item.id !== meta.id);
              saveToLocalStorage(meta.walletAddress, oldParentId, filteredOldData);
              console.log('[IndexedDB] Removed from old parent:', oldParentId);
            }
            
            // 새 폴더에 추가
            const newData = getFromLocalStorage(meta.walletAddress, meta.parentId);
            const existingIndex = newData.findIndex(item => item.id === meta.id);
            if (existingIndex !== -1) {
              newData[existingIndex] = meta;
            } else {
              newData.push(meta);
            }
            saveToLocalStorage(meta.walletAddress, meta.parentId, newData);
            console.log('[IndexedDB] Added to new parent:', meta.parentId);
          } else {
            // parentId가 변경되지 않은 경우 기존 방식
            const currentData = getFromLocalStorage(meta.walletAddress, meta.parentId);
            const index = currentData.findIndex(item => item.id === meta.id);
            if (index !== -1) {
              currentData[index] = meta;
              saveToLocalStorage(meta.walletAddress, meta.parentId, currentData);
            }
          }
          
          resolve(true);
        };
        
        tx.onerror = () => {
          console.error('[IndexedDB] updateFileMeta error', tx.error);
          reject(tx.error);
        };
      };
      
      getReq.onerror = () => {
        console.error('[IndexedDB] updateFileMeta get error', getReq.error);
        reject(getReq.error);
      };
    });
  });
}

export async function deleteFileMeta(id: string, walletAddress: string) {
  return withDeduplication('deleteFileMeta', walletAddress, [id], async () => {
    const db = await openDB(walletAddress);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => {
        console.log('[IndexedDB] deleteFileMeta', id);
        // localStorage 동기화 - 모든 parentId에서 해당 아이템 삭제
        const allKeys = Object.keys(localStorage);
        const hash = walletAddress.toLowerCase().replace(/[^a-f0-9]/g, '');
        const prefix = `0gdrive_data_${hash}`;
        allKeys.forEach(key => {
          if (key.startsWith(prefix)) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '[]');
              const filteredData = data.filter((item: FileMeta) => item.id !== id);
              localStorage.setItem(key, JSON.stringify(filteredData));
            } catch (error) {
              console.error('[IndexedDB] localStorage 삭제 오류:', error);
            }
          }
        });
        resolve(true);
      };
      tx.onerror = () => {
        console.error('[IndexedDB] deleteFileMeta error', tx.error);
        reject(tx.error);
      };
    });
  });
}

export async function getFileMeta(id: string, walletAddress: string): Promise<FileMeta | undefined> {
  return withDeduplication('getFileMeta', walletAddress, [id], async () => {
    const db = await openDB(walletAddress);
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id);
      req.onsuccess = () => {
        console.log('[IndexedDB] getFileMeta', id, req.result);
        resolve(req.result);
      };
      req.onerror = () => {
        console.error('[IndexedDB] getFileMeta error', req.error);
        reject(req.error);
      };
    });
  });
}

export async function getAllFileMeta(walletAddress: string, parentId: string | null): Promise<FileMeta[]> {
  return withDeduplication('getAllFileMeta', walletAddress, [parentId], async () => {
    // 먼저 localStorage에서 데이터 확인
    const localStorageData = getFromLocalStorage(walletAddress, parentId);
    
    // IndexedDB에서도 데이터 가져오기
    const db = await openDB(walletAddress);
    return new Promise((resolve, reject) => {
      const store = db.transaction(STORE_NAME).objectStore(STORE_NAME);
      const index = store.index('walletAddress');
      const result: FileMeta[] = [];
      index.openCursor(IDBKeyRange.only(walletAddress)).onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          // parentId가 null인 경우와 string인 경우를 명확히 구분
          const itemParentId = cursor.value.parentId;
          if ((parentId === null && itemParentId === null) || 
              (parentId !== null && itemParentId === parentId)) {
            result.push(cursor.value);
          }
          cursor.continue();
        } else {
          // localStorage와 IndexedDB 데이터 병합
          const mergedData = [...localStorageData, ...result];
          const uniqueData = mergedData.filter((item, index, self) => 
            index === self.findIndex(t => t.id === item.id)
          );
          
          // 병합된 데이터를 localStorage에 저장
          saveToLocalStorage(walletAddress, parentId, uniqueData);
          
          console.log('[IndexedDB] getAllFileMeta', walletAddress, parentId, uniqueData);
          resolve(uniqueData);
        }
      };
    });
  });
} 