import { NextResponse } from 'next/server';
import { initializeServer } from '@/lib/init';

// 서버 초기화 엔드포인트
export async function GET() {
  try {
    initializeServer();
    return NextResponse.json({ success: true, message: '서버 초기화 완료' });
  } catch (error) {
    console.error('초기화 오류:', error);
    return NextResponse.json(
      { success: false, error: '서버 초기화 실패' },
      { status: 500 }
    );
  }
}
