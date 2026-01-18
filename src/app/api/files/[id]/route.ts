import { NextRequest, NextResponse } from 'next/server';
import { getSession, canAccessFolder } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { manualRename, reprocessFile } from '@/lib/file-processor';
import type { FileProcess } from '@/types';

// 파일 상세 조회
export async function GET(
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
    const file = db.prepare(`
      SELECT fp.*, wf.alias as folder_alias, wf.path as folder_path
      FROM file_processes fp
      LEFT JOIN watch_folders wf ON fp.folder_id = wf.id
      WHERE fp.id = ?
    `).get(fileId) as (FileProcess & { folder_alias: string; folder_path: string }) | undefined;
    
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
    
    // 로그 조회
    const logs = db.prepare(`
      SELECT * FROM process_logs 
      WHERE file_process_id = ? 
      ORDER BY created_at DESC
    `).all(fileId);
    
    return NextResponse.json({
      success: true,
      data: {
        file,
        logs,
      },
    });
  } catch (error) {
    console.error('File detail API error:', error);
    return NextResponse.json(
      { success: false, error: '파일 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 파일명 수정
export async function PATCH(
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
    const body = await request.json();
    
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
    
    if (body.new_filename) {
      // 수동 파일명 변경
      const updatedFile = manualRename(fileId, body.new_filename);
      return NextResponse.json({
        success: true,
        data: updatedFile,
      });
    }
    
    return NextResponse.json(
      { success: false, error: '변경할 내용이 없습니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('File update API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '파일 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
