import { NextRequest, NextResponse } from 'next/server';
import { ssoLogin } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { SSOParams } from '@/types';

// SSO 로그인 (GET 방식 - Amaranth10)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // SSO 파라미터 매핑 (환경변수에서 파라미터명 가져오기)
    const empCodeParam = process.env.SSO_PARAM_EMP_CODE || 'emp_code';
    const deptCodeParam = process.env.SSO_PARAM_DEPT_CODE || 'dept_code';
    const companyCodeParam = process.env.SSO_PARAM_COMPANY_CODE || 'company_code';
    
    const ssoParams: SSOParams = {
      emp_code: searchParams.get(empCodeParam) || undefined,
      dept_code: searchParams.get(deptCodeParam) || undefined,
      company_code: searchParams.get(companyCodeParam) || undefined,
    };
    
    if (!ssoParams.emp_code) {
      // SSO 파라미터 없으면 로그인 페이지로 리다이렉트
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    const result = ssoLogin(ssoParams);
    
    if (!result.success) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(result.error || 'SSO 로그인 실패')}`, request.url));
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
    
    // 대시보드로 리다이렉트
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('SSO Login error:', error);
    return NextResponse.redirect(new URL('/login?error=SSO 처리 중 오류가 발생했습니다.', request.url));
  }
}
