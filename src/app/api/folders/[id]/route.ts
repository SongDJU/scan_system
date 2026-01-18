import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { startWatching, stopWatching } from '@/lib/file-watcher';
import type { WatchFolder } from '@/types';

// 폴더 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    const folderId = parseInt(id);
    
    const db = getDatabase();
    const folder = db.prepare(`
      SELECT * FROM watch_folders WHERE id = ?
    `).get(folderId) as WatchFolder | undefined;
    
    if (!folder) {
      return NextResponse.json(
        { success: false, error: '폴더를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 부서 매핑 조회
    const mappings = db.prepare(`
      SELECT dept_code FROM folder_dept_mappings WHERE folder_id = ?
    `).all(folderId) as { dept_code: string }[];
    
    return NextResponse.json({
      success: true,
      data: {
        ...folder,
        dept_codes: mappings.map(m => m.dept_code),
      },
    });
  } catch (error) {
    console.error('Folder detail API error:', error);
    return NextResponse.json(
      { success: false, error: '폴더 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 폴더 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    const folderId = parseInt(id);
    const body = await request.json();
    
    const db = getDatabase();
    const folder = db.prepare('SELECT * FROM watch_folders WHERE id = ?').get(folderId) as WatchFolder | undefined;
    
    if (!folder) {
      return NextResponse.json(
        { success: false, error: '폴더를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 폴더 정보 업데이트
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (body.path !== undefined) {
      updates.push('path = ?');
      values.push(body.path);
    }
    if (body.alias !== undefined) {
      updates.push('alias = ?');
      values.push(body.alias);
    }
    if (body.folder_type !== undefined) {
      updates.push('folder_type = ?');
      values.push(body.folder_type);
    }
    if (body.smb_host !== undefined) {
      updates.push('smb_host = ?');
      values.push(body.smb_host);
    }
    if (body.smb_share !== undefined) {
      updates.push('smb_share = ?');
      values.push(body.smb_share);
    }
    if (body.smb_username !== undefined) {
      updates.push('smb_username = ?');
      values.push(body.smb_username);
    }
    if (body.smb_password !== undefined) {
      updates.push('smb_password = ?');
      values.push(body.smb_password);
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active ? 1 : 0);
      
      // 감시 시작/중지
      if (body.is_active) {
        const updatedFolder = { ...folder, ...body } as WatchFolder;
        startWatching(updatedFolder);
      } else {
        stopWatching(folderId);
      }
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(folderId);
      
      db.prepare(`
        UPDATE watch_folders SET ${updates.join(', ')} WHERE id = ?
      `).run(...values);
    }
    
    // 부서 매핑 업데이트
    if (body.dept_codes !== undefined && Array.isArray(body.dept_codes)) {
      // 기존 매핑 삭제
      db.prepare('DELETE FROM folder_dept_mappings WHERE folder_id = ?').run(folderId);
      
      // 새 매핑 추가
      const insertMapping = db.prepare(`
        INSERT INTO folder_dept_mappings (folder_id, dept_code) VALUES (?, ?)
      `);
      
      for (const deptCode of body.dept_codes) {
        insertMapping.run(folderId, deptCode);
      }
    }
    
    const updatedFolder = db.prepare('SELECT * FROM watch_folders WHERE id = ?').get(folderId);
    
    return NextResponse.json({
      success: true,
      data: updatedFolder,
      message: '폴더가 수정되었습니다.',
    });
  } catch (error) {
    console.error('Update folder API error:', error);
    return NextResponse.json(
      { success: false, error: '폴더 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 폴더 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    const folderId = parseInt(id);
    
    const db = getDatabase();
    
    // 감시 중지
    stopWatching(folderId);
    
    // 폴더 삭제 (cascade로 매핑도 삭제됨)
    db.prepare('DELETE FROM watch_folders WHERE id = ?').run(folderId);
    
    return NextResponse.json({
      success: true,
      message: '폴더가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Delete folder API error:', error);
    return NextResponse.json(
      { success: false, error: '폴더 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
