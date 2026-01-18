import { NextRequest, NextResponse } from 'next/server';
import { getSession, canAccessFolder } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { reprocessFile } from '@/lib/file-processor';
import type { FileProcess } from '@/types';

// 파일 재처리
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    
    const { id } = await params;
    const fileId = parseInt(id);
    
    const db = getDatabase();
    const file = db.prepare('SELECT * FROM file_processes WHERE id = ?').get(fileId) as FileProcess | undefined;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 접근 권한 확인
    if (!canAccessFolder(session, file.folder_id)) {
      return NextResponse.json(
        { success: false, error: '이 파일에 접근할 권한이 없습니다.' },
        { status: 403 }
      );
    }
    
    // 재처리 실행
    const updatedFile = await reprocessFile(fileId);
    
    return NextResponse.json({
      success: true,
      data: updatedFile,
      message: '재처리가 시작되었습니다.',
    });
  } catch (error) {
    console.error('Reprocess API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '재처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
