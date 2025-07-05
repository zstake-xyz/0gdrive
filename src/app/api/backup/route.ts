import { NextRequest } from 'next/server';

// 메모리 기반 임시 저장소 (실제로는 데이터베이스 사용 권장)
const backupStorage = new Map<string, any>();

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, backupData } = await req.json();
    
    if (!walletAddress || !backupData) {
      return new Response(
        JSON.stringify({ error: 'Missing wallet address or backup data' }), 
        { status: 400 }
      );
    }
    
    // 백업 데이터 저장
    backupStorage.set(walletAddress, {
      data: backupData,
      timestamp: new Date().toISOString(),
      walletAddress
    });
    
    console.log(`[Backup API] Backup saved for wallet: ${walletAddress}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Backup saved successfully',
        timestamp: new Date().toISOString()
      }), 
      { status: 200 }
    );
  } catch (error) {
    console.error('[Backup API] Error saving backup:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save backup' }), 
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');
    
    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing wallet address' }), 
        { status: 400 }
      );
    }
    
    // 백업 데이터 조회
    const backup = backupStorage.get(walletAddress);
    
    if (!backup) {
      return new Response(
        JSON.stringify({ error: 'No backup found for this wallet' }), 
        { status: 404 }
      );
    }
    
    console.log(`[Backup API] Backup retrieved for wallet: ${walletAddress}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        backup: backup.data,
        timestamp: backup.timestamp
      }), 
      { status: 200 }
    );
  } catch (error) {
    console.error('[Backup API] Error retrieving backup:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to retrieve backup' }), 
      { status: 500 }
    );
  }
} 