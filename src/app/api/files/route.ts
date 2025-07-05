import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Item(파일 또는 폴더) 데이터 타입 정의
interface ItemRecord {
  id: string;
  type: 'file' | 'folder';
  name: string;
  parentId: string | null; // null이면 최상위
  walletAddress: string;
  uploadDate: string;

  // 파일 전용 속성
  fileExtension?: string;
  fileSize?: number;
  rootHash?: string;
  networkType?: string;

  // 공유 기능 속성
  sharedWith?: string[]; // 공유된 지갑 주소 목록
  sharedBy?: string; // 공유해준 지갑 주소
}

// 데이터 파일 경로
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'files.json');

// Validation constants
const MAX_FILE_SIZE = 5120 * 1024 * 1024; // 5GB (5120MB)
const ALLOWED_EXTENSIONS = [
  // 문서
  'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf',
  // 이미지
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif',
  // 비디오
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v',
  // 오디오
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
  // 압축
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  // 코드/개발
  'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml',
  // 기타
  'log', 'md', 'sql', 'sh', 'bat', 'ps1', 'py', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs'
];
const MAX_NAME_LENGTH = 255;

// Input validation functions
function validateWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateFileName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && !/[<>:"/\\|?*]/.test(name);
}

function validateFileExtension(extension: string): boolean {
  return ALLOWED_EXTENSIONS.includes(extension.toLowerCase());
}

function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

// 데이터 디렉토리 생성
function ensureDataDirectory() {
  const dataDir = path.dirname(DATA_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 파일에서 데이터 읽기
function readFileData(): ItemRecord[] {
  try {
    ensureDataDirectory();
    if (!fs.existsSync(DATA_FILE_PATH)) {
      return [];
    }
    const data = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading file data:', error);
    return [];
  }
}

// 파일에 데이터 쓰기
function writeFileData(data: ItemRecord[]) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing file data:', error);
    throw error;
  }
}

// GET 요청 처리 - 특정 폴더의 아이템 리스트 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');
    const parentId = searchParams.get('parentId') || null;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    if (!validateWalletAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const allItems = readFileData();
    const userItems = allItems.filter(item =>
      (item.walletAddress.toLowerCase() === walletAddress.toLowerCase() ||
       (item.sharedWith && item.sharedWith.includes(walletAddress.toLowerCase()))) &&
      item.parentId === parentId
    );

    // 폴더를 파일보다 먼저, 그 다음 이름순으로 정렬
    userItems.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ items: userItems });
  } catch (error) {
    console.error('Error in GET /api/files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST 요청 처리 - 새 파일 또는 폴더 정보 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, type, name, parentId = null, ...fileProps } = body;

    // Input validation
    if (!walletAddress || !type || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!validateWalletAddress(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    if (!validateFileName(name)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    if (type !== 'file' && type !== 'folder') {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 });
    }

    const allItems = readFileData();
    
    let newItem: ItemRecord;
    const commonProps = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      walletAddress: walletAddress.toLowerCase(),
      name,
      parentId,
      uploadDate: new Date().toISOString(),
    };

    if (type === 'folder') {
      newItem = {
        ...commonProps,
        type: 'folder',
      };
    } else if (type === 'file') {
      const { fileExtension, fileSize, rootHash, networkType } = fileProps;
      if (!fileExtension || !fileSize || !rootHash || !networkType) {
        return NextResponse.json({ error: 'Missing file-specific fields' }, { status: 400 });
      }

      console.log('Validating file extension:', fileExtension);
      if (!validateFileExtension(fileExtension)) {
        console.log('File extension not allowed:', fileExtension);
        return NextResponse.json({ error: 'File extension not allowed' }, { status: 400 });
      }
      console.log('File extension validated successfully:', fileExtension);

      if (!validateFileSize(fileSize)) {
        return NextResponse.json({ error: 'File size exceeds limit' }, { status: 400 });
      }

      newItem = {
        ...commonProps,
        type: 'file',
        fileExtension,
        fileSize,
        rootHash,
        networkType,
      };
    } else {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 });
    }

    // 중복 체크 (같은 폴더 내에 같은 이름의 아이템이 있는지)
    const existingItem = allItems.find(item =>
      item.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
      item.parentId === parentId &&
      item.name === name &&
      (item.type === 'file' ? item.fileExtension === newItem.fileExtension : true)
    );

    if (existingItem) {
      const itemType = type === 'file' ? 'File' : 'Folder';
      return NextResponse.json({ error: `${itemType} with this name already exists in this folder` }, { status: 409 });
    }

    allItems.push(newItem);
    writeFileData(allItems);

    return NextResponse.json({ success: true, item: newItem });

  } catch (error) {
    console.error('Error in POST /api/files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH 요청 처리 - 파일 공유 설정
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId, walletAddress, action, targetWalletAddress } = body;

    if (!itemId || !walletAddress || !action || !targetWalletAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!validateWalletAddress(walletAddress) || !validateWalletAddress(targetWalletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const allItems = readFileData();
    const itemIndex = allItems.findIndex(item => 
      item.id === itemId && 
      item.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Item not found or access denied' }, { status: 404 });
    }

    const item = allItems[itemIndex];

    if (action === 'share') {
      // 공유 설정
      if (!item.sharedWith) {
        item.sharedWith = [];
      }
      if (!item.sharedWith.includes(targetWalletAddress.toLowerCase())) {
        item.sharedWith.push(targetWalletAddress.toLowerCase());
      }
    } else if (action === 'unshare') {
      // 공유 해제
      if (item.sharedWith) {
        item.sharedWith = item.sharedWith.filter(addr => addr !== targetWalletAddress.toLowerCase());
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    writeFileData(allItems);
    return NextResponse.json({ success: true, item });

  } catch (error) {
    console.error('Error in PATCH /api/files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE 요청 처리 - 파일 또는 폴더 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');
    const walletAddress = searchParams.get('walletAddress');

    if (!itemId || !walletAddress) {
      return NextResponse.json({ error: 'Item ID and wallet address are required' }, { status: 400 });
    }

    let allItems = readFileData();
    const itemToDelete = allItems.find(item => item.id === itemId && item.walletAddress.toLowerCase() === walletAddress.toLowerCase());

    if (!itemToDelete) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const itemsToDelete = [itemToDelete.id];
    if (itemToDelete.type === 'folder') {
      // 폴더인 경우, 모든 하위 아이템을 재귀적으로 찾아서 삭제 목록에 추가
      const findChildren = (folderId: string) => {
        const children = allItems.filter(item => item.parentId === folderId);
        for (const child of children) {
          itemsToDelete.push(child.id);
          if (child.type === 'folder') {
            findChildren(child.id);
          }
        }
      };
      findChildren(itemToDelete.id);
    }

    const newItems = allItems.filter(item => !itemsToDelete.includes(item.id));
    writeFileData(newItems);

    console.log(`Deleted ${itemsToDelete.length} item(s)`);

    return NextResponse.json({ success: true, message: 'Item(s) deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 