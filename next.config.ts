import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 등 네이티브 모듈 지원
  serverExternalPackages: ['better-sqlite3', '@google-cloud/vision'],
  
  // Turbopack 설정 (빈 설정으로 경고 해제)
  turbopack: {},
};

export default nextConfig;
