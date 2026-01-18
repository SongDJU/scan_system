import { NextRequest, NextResponse } from 'next/server';
import { getSession, canAccessFolder } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import type { FileProcess, WatchFolder } from '@/types';

// 파일 뷰어용 (브라우저에서 직접 표시)
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
    
    const folder = db.prepare('SELECT * FROM watch_folders WHERE id = ?').get(file.folder_id) as WatchFolder | undefined;
    
    if (!folder) {
      return NextResponse.json(
        { success: false, error: '폴더 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 파일 경로 결정
    const filename = file.new_filename || file.original_filename;
    const filePath = path.join(folder.path, filename);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 파일 읽기
    const fileBuffer = fs.readFileSync(filePath);
    
    // 응답 헤더 설정 (인라인 표시)
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
    headers.set('Content-Length', fileBuffer.length.toString());
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('View API error:', error);
    return NextResponse.json(
      { success: false, error: '파일 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
