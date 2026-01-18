import { NextRequest, NextResponse } from 'next/server';
import { localLogin } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emp_code, password } = body;
    
    if (!emp_code || !password) {
      return NextResponse.json(
        { success: false, error: '사원코드와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }
    
    const result = localLogin(emp_code, password);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
      );
    }
    
    // 쿠키 설정
    const cookieStore = await cookies();
    cookieStore.set('auth_token', result.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/',
    });
    
    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
