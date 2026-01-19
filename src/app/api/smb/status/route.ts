import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { testSMBConnection, getAllConnectionStatus } from '@/lib/smb-client';
import type { WatchFolder } from '@/types';

/**
 * SMB 연결 상태 확인 API
 * GET /api/smb/status
 */
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const db = getDatabase();
    
    // SMB 타입 폴더 조회
    const smbFolders = db.prepare(`
      SELECT * FROM watch_folders WHERE folder_type = 'smb' AND is_active = 1
    `).all() as WatchFolder[];
    
    const statuses = [];
    
    for (const folder of smbFolders) {
      if (folder.smb_host && folder.smb_share) {
        // 실제 연결 테스트
        const result = await testSMBConnection(
          folder.smb_host,
          folder.smb_share,
          folder.smb_username || '',
          folder.smb_password || ''
        );
        
        statuses.push({
          folderId: folder.id,
          alias: folder.alias,
          host: folder.smb_host,
          share: folder.smb_share,
          uncPath: `\\\\${folder.smb_host}\\${folder.smb_share}`,
          isConnected: result.success,
          error: result.error,
          sampleFiles: result.files?.slice(0, 3),
        });
      }
    }
    
    // 캐시된 연결 상태도 포함
    const cachedStatuses = getAllConnectionStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        folders: statuses,
        cachedConnections: cachedStatuses,
      },
    });
  } catch (error) {
    console.error('SMB status API error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `SMB 상태 확인 중 오류: ${errorMessage}` },
      { status: 500 }
    );
  }
}
