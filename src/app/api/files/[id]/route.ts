import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { encrypt, decrypt } from '@/utils/crypto';

// Item(파일 또는 폴더) 데이터 타입 정의
interface ItemRecord {
  id: string;
  type: 'file' | 'folder';
  name: string;
  parentId: string | null;
  walletAddress: string;
  uploadDate: string;
  fileExtension?: string;
  fileSize?: number;
  rootHash?: string;
  networkType?: string;
}

// 데이터 파일 경로
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'files.json');

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
    // 복호화 적용
    const decrypted = decrypt(data);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error reading file data:', error);
    return [];
  }
}

// 파일에 데이터 쓰기
function writeFileData(data: ItemRecord[]) {
  try {
    ensureDataDirectory();
    // 암호화 적용
    const encrypted = encrypt(JSON.stringify(data));
    fs.writeFileSync(DATA_FILE_PATH, encrypted);
  } catch (error) {
    console.error('Error writing file data:', error);
    throw error;
  }
}

// GET 요청 처리 - ID로 특정 아이템 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const allItems = readFileData();
    const item = allItems.find(i => 
      i.id === id && 
      i.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error(`Error in GET /api/files/[id]:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH 요청 처리 - 아이템 이름 변경 또는 이동
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, parentId, walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    if (!name && typeof parentId === 'undefined') {
      return NextResponse.json({ error: 'Name or parentId must be provided' }, { status: 400 });
    }

    const allItems = readFileData();
    const itemIndex = allItems.findIndex(i => 
      i.id === id && 
      i.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const originalItem = allItems[itemIndex];
    const newName = name || originalItem.name;
    const newParentId = typeof parentId !== 'undefined' ? parentId : originalItem.parentId;

    // 중복 체크
    const duplicateExists = allItems.some(i =>
      i.id !== id &&
      i.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
      i.parentId === newParentId &&
      i.name === newName &&
      (i.type === 'file' ? i.fileExtension === originalItem.fileExtension : true)
    );

    if (duplicateExists) {
      return NextResponse.json({ error: 'An item with the same name already exists in the destination folder' }, { status: 409 });
    }

    // 아이템 업데이트
    const updatedItem = { ...originalItem };
    if (name) {
      updatedItem.name = name;
    }
    if (typeof parentId !== 'undefined') {
      updatedItem.parentId = parentId;
    }
    
    allItems[itemIndex] = updatedItem;
    writeFileData(allItems);
    
    console.log(`Item ${id} updated:`, { name, parentId });
    return NextResponse.json({ success: true, item: updatedItem });

  } catch (error) {
    console.error('Error in PATCH /api/files/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 