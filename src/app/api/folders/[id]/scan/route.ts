import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { rescanFolder } from '@/lib/file-watcher';

/**
 * 폴더 재스캔 API
 * POST /api/folders/[id]/scan
 */
export async function POST(
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
    const folderId = parseInt(id, 10);
    
    if (isNaN(folderId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 폴더 ID입니다.' },
        { status: 400 }
      );
    }
    
    console.log(`폴더 재스캔 요청: ${folderId}`);
    
    const result = await rescanFolder(folderId);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `스캔 완료: ${result.result?.registered}개 파일 등록`,
      data: result.result,
    });
  } catch (error) {
    console.error('Folder scan API error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `폴더 스캔 중 오류: ${errorMessage}` },
      { status: 500 }
    );
  }
}
