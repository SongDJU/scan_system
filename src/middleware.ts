import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 서버 초기화 상태 체크 (클라이언트 측에서 호출)
let serverInitialized = false;

export function middleware(request: NextRequest) {
  // 서버 시작 시 초기화 API 호출 (한 번만)
  if (!serverInitialized && request.nextUrl.pathname !== '/api/init') {
    serverInitialized = true;
    // 백그라운드에서 초기화
    fetch(new URL('/api/init', request.url)).catch(() => {});
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
