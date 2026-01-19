import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAccessibleFolders } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import type { FileProcess, FileFilter } from '@/types';

// 파일 목록 조회
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
    const filter: FileFilter = {
      status: searchParams.get('status') as FileFilter['status'] || undefined,
      folder_id: searchParams.get('folder_id') ? parseInt(searchParams.get('folder_id')!) : undefined,
      search: searchParams.get('search') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };
    
    const db = getDatabase();
    
    // 접근 가능한 폴더 목록
    const accessibleFolders = getAccessibleFolders(session);
    
    if (accessibleFolders.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          files: [],
          total: 0,
          page: filter.page,
          limit: filter.limit,
        },
      });
    }
    
    // 쿼리 빌드
    let whereClause = `WHERE folder_id IN (${accessibleFolders.join(',')})`;
    const params: (string | number)[] = [];
    
    if (filter.status) {
      whereClause += ' AND status = ?';
      params.push(filter.status);
    }
    
    if (filter.folder_id && accessibleFolders.includes(filter.folder_id)) {
      whereClause += ' AND folder_id = ?';
      params.push(filter.folder_id);
    }
    
    if (filter.search) {
      whereClause += ' AND (original_filename LIKE ? OR new_filename LIKE ? OR company_name LIKE ? OR content_summary LIKE ?)';
      const searchTerm = `%${filter.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (filter.date_from) {
      whereClause += ' AND created_at >= ?';
      params.push(filter.date_from);
    }
    
    if (filter.date_to) {
      whereClause += ' AND created_at <= ?';
      params.push(filter.date_to + ' 23:59:59');
    }
    
    // 전체 개수 조회
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM file_processes ${whereClause}
    `).get(...params) as { total: number };
    
    // 페이지네이션
    const offset = ((filter.page || 1) - 1) * (filter.limit || 20);
    
    // 파일 목록 조회 (수정일 최신순)
    const files = db.prepare(`
      SELECT fp.*, wf.alias as folder_alias
      FROM file_processes fp
      LEFT JOIN watch_folders wf ON fp.folder_id = wf.id
      ${whereClause}
      ORDER BY fp.updated_at DESC, fp.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, filter.limit || 20, offset) as (FileProcess & { folder_alias: string })[];
    
    return NextResponse.json({
      success: true,
      data: {
        files,
        total: countResult.total,
        page: filter.page || 1,
        limit: filter.limit || 20,
      },
    });
  } catch (error) {
    console.error('Files API error:', error);
    return NextResponse.json(
      { success: false, error: '파일 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
