import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { testSMBConnection, listSMBFiles, parseSMBUrl } from '@/lib/smb-client';

/**
 * SMB 연결 테스트 API
 * POST /api/smb/test
 */
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
    const { host, share, username, password, url } = body;
    
    // URL이 제공된 경우 파싱
    let targetHost = host;
    let targetShare = share;
    
    if (url) {
      const parsed = parseSMBUrl(url);
      
      if (parsed.isWebUI) {
        return NextResponse.json({
          success: false,
          error: `주의: 제공된 URL(${url})은 NAS 웹 인터페이스입니다.\n\nSMB 연결을 위해서는 다음과 같이 입력해주세요:\n- 호스트: ${parsed.host}\n- 공유폴더: FAX3 (폴더명)\n\n또는 Windows 탐색기에서 \\\\${parsed.host}\\FAX3 형식으로 접근 가능한지 먼저 확인해주세요.`,
          hint: {
            host: parsed.host,
            suggestedPath: `\\\\${parsed.host}\\FAX3`,
          },
        });
      }
      
      targetHost = parsed.host;
      targetShare = parsed.share || share;
    }
    
    if (!targetHost || !targetShare) {
      return NextResponse.json(
        { success: false, error: '호스트와 공유폴더명이 필요합니다.' },
        { status: 400 }
      );
    }
    
    console.log(`SMB 연결 테스트: ${targetHost}/${targetShare} (user: ${username})`);
    
    // 연결 테스트
    const connectionResult = await testSMBConnection(
      targetHost,
      targetShare,
      username || '',
      password || ''
    );
    
    if (!connectionResult.success) {
      return NextResponse.json({
        success: false,
        error: connectionResult.error,
        details: {
          host: targetHost,
          share: targetShare,
          uncPath: `\\\\${targetHost}\\${targetShare}`,
        },
      });
    }
    
    // 파일 목록 가져오기
    const fileListResult = await listSMBFiles(
      targetHost,
      targetShare,
      username || '',
      password || ''
    );
    
    let fileInfo = {
      totalFiles: 0,
      pdfFiles: 0,
      sampleFiles: [] as string[],
    };
    
    if (fileListResult.success && fileListResult.files) {
      const allFiles = fileListResult.files.filter(f => !f.isDirectory);
      const pdfFiles = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      
      fileInfo = {
        totalFiles: allFiles.length,
        pdfFiles: pdfFiles.length,
        sampleFiles: pdfFiles.slice(0, 5).map(f => f.name),
      };
    }
    
    return NextResponse.json({
      success: true,
      message: 'SMB 연결 성공!',
      data: {
        host: targetHost,
        share: targetShare,
        uncPath: `\\\\${targetHost}\\${targetShare}`,
        ...fileInfo,
      },
    });
  } catch (error) {
    console.error('SMB test API error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `SMB 연결 테스트 중 오류: ${errorMessage}` },
      { status: 500 }
    );
  }
}
