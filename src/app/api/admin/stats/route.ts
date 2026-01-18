import { NextResponse } from 'next/server';
import { getSession, isAdmin, getAccessibleFolders } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { getQueueStatus } from '@/lib/file-processor';

// 대시보드 통계 조회
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
    const accessibleFolders = getAccessibleFolders(session);
    
    let folderCondition = '';
    if (!isAdmin(session) && accessibleFolders.length > 0) {
      folderCondition = `AND folder_id IN (${accessibleFolders.join(',')})`;
    } else if (!isAdmin(session)) {
      // 접근 가능한 폴더가 없는 경우
      return NextResponse.json({
        success: true,
        data: {
          totalFiles: 0,
          completedFiles: 0,
          pendingFiles: 0,
          processingFiles: 0,
          failedFiles: 0,
          todayProcessed: 0,
          queueStatus: getQueueStatus(),
          recentFiles: [],
          recentLogs: [],
        },
      });
    }
    
    // 전체 파일 수
    const totalFiles = db.prepare(`
      SELECT COUNT(*) as count FROM file_processes WHERE 1=1 ${folderCondition}
    `).get() as { count: number };
    
    // 상태별 파일 수
    const completedFiles = db.prepare(`
      SELECT COUNT(*) as count FROM file_processes WHERE status = 'completed' ${folderCondition}
    `).get() as { count: number };
    
    const pendingFiles = db.prepare(`
      SELECT COUNT(*) as count FROM file_processes WHERE status = 'pending' ${folderCondition}
    `).get() as { count: number };
    
    const processingFiles = db.prepare(`
      SELECT COUNT(*) as count FROM file_processes WHERE status = 'processing' ${folderCondition}
    `).get() as { count: number };
    
    const failedFiles = db.prepare(`
      SELECT COUNT(*) as count FROM file_processes WHERE status = 'failed' ${folderCondition}
    `).get() as { count: number };
    
    // 오늘 처리된 파일 수
    const todayProcessed = db.prepare(`
      SELECT COUNT(*) as count FROM file_processes 
      WHERE status = 'completed' 
      AND DATE(processed_at) = DATE('now') 
      ${folderCondition}
    `).get() as { count: number };
    
    // 최근 파일 목록
    const recentFiles = db.prepare(`
      SELECT fp.*, wf.alias as folder_alias
      FROM file_processes fp
      LEFT JOIN watch_folders wf ON fp.folder_id = wf.id
      WHERE 1=1 ${folderCondition}
      ORDER BY fp.created_at DESC
      LIMIT 10
    `).all();
    
    // 최근 로그
    let logCondition = '';
    if (!isAdmin(session) && accessibleFolders.length > 0) {
      logCondition = `AND (fp.folder_id IN (${accessibleFolders.join(',')}) OR pl.file_process_id IS NULL)`;
    }
    
    const recentLogs = db.prepare(`
      SELECT pl.*, fp.original_filename
      FROM process_logs pl
      LEFT JOIN file_processes fp ON pl.file_process_id = fp.id
      WHERE 1=1 ${logCondition}
      ORDER BY pl.created_at DESC
      LIMIT 20
    `).all();
    
    // 처리 큐 상태
    const queueStatus = getQueueStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        totalFiles: totalFiles.count,
        completedFiles: completedFiles.count,
        pendingFiles: pendingFiles.count,
        processingFiles: processingFiles.count,
        failedFiles: failedFiles.count,
        todayProcessed: todayProcessed.count,
        queueStatus,
        recentFiles,
        recentLogs,
      },
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { success: false, error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
