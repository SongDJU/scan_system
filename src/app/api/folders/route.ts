import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin, getAccessibleFolders } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import type { WatchFolder } from '@/types';

// 폴더 목록 조회
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }
    
    const db = getDatabase();
    
    if (isAdmin(session)) {
      // 관리자는 모든 폴더 조회
      const folders = db.prepare(`
        SELECT wf.*, 
          GROUP_CONCAT(fdm.dept_code) as dept_codes
        FROM watch_folders wf
        LEFT JOIN folder_dept_mappings fdm ON wf.id = fdm.folder_id
        GROUP BY wf.id
        ORDER BY wf.alias
      `).all();
      
      return NextResponse.json({
        success: true,
        data: folders,
      });
    } else {
      // 일반 사용자는 접근 가능한 폴더만
      const accessibleFolders = getAccessibleFolders(session);
      
      if (accessibleFolders.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
        });
      }
      
      const folders = db.prepare(`
        SELECT id, path, alias, folder_type, is_active, created_at
        FROM watch_folders 
        WHERE id IN (${accessibleFolders.join(',')}) AND is_active = 1
        ORDER BY alias
      `).all();
      
      return NextResponse.json({
        success: true,
        data: folders,
      });
    }
  } catch (error) {
    console.error('Folders API error:', error);
    return NextResponse.json(
      { success: false, error: '폴더 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 폴더 생성 (관리자만)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { path, alias, folder_type, smb_host, smb_share, smb_username, smb_password, dept_codes } = body;
    
    if (!path || !alias) {
      return NextResponse.json(
        { success: false, error: '경로와 이름은 필수입니다.' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    
    // 폴더 생성
    const result = db.prepare(`
      INSERT INTO watch_folders (path, alias, folder_type, smb_host, smb_share, smb_username, smb_password, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(path, alias, folder_type || 'local', smb_host || null, smb_share || null, smb_username || null, smb_password || null);
    
    const folderId = result.lastInsertRowid as number;
    
    // 부서 매핑 추가
    if (dept_codes && Array.isArray(dept_codes)) {
      const insertMapping = db.prepare(`
        INSERT INTO folder_dept_mappings (folder_id, dept_code) VALUES (?, ?)
      `);
      
      for (const deptCode of dept_codes) {
        insertMapping.run(folderId, deptCode);
      }
    }
    
    const folder = db.prepare('SELECT * FROM watch_folders WHERE id = ?').get(folderId);
    
    return NextResponse.json({
      success: true,
      data: folder,
      message: '폴더가 생성되었습니다.',
    });
  } catch (error) {
    console.error('Create folder API error:', error);
    return NextResponse.json(
      { success: false, error: '폴더 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
