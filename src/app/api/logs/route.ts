import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessibleFolders } from '@/lib/auth';
import { getDatabase } from '@/lib/database';

// 로그 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const fileProcessId = searchParams.get('file_process_id');
    const action = searchParams.get('action');
    
    const db = getDatabase();
    const accessibleFolders = getAccessibleFolders(session);
    
    let whereClause = '';
    const params: (string | number)[] = [];
    
    if (fileProcessId) {
      whereClause = 'WHERE pl.file_process_id = ?';
      params.push(parseInt(fileProcessId));
    } else if (accessibleFolders.length > 0) {
      // 접근 가능한 폴더의 파일 로그만 표시 (또는 시스템 로그)
      whereClause = `WHERE (fp.folder_id IN (${accessibleFolders.join(',')}) OR pl.file_process_id IS NULL)`;
    }
    
    if (action) {
      whereClause += whereClause ? ' AND pl.action = ?' : 'WHERE pl.action = ?';
      params.push(action);
    }
    
    // 전체 개수
    const countResult = db.prepare(`
      SELECT COUNT(*) as total 
      FROM process_logs pl
      LEFT JOIN file_processes fp ON pl.file_process_id = fp.id
      ${whereClause}
    `).get(...params) as { total: number };
    
    // 로그 목록
    const offset = (page - 1) * limit;
    const logs = db.prepare(`
      SELECT pl.*, fp.original_filename, fp.new_filename
      FROM process_logs pl
      LEFT JOIN file_processes fp ON pl.file_process_id = fp.id
      ${whereClause}
      ORDER BY pl.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    return NextResponse.json({
      success: true,
      data: {
        logs,
        total: countResult.total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('Logs API error:', error);
    return NextResponse.json(
      { success: false, error: '로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
