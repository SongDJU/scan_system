import { initializeFileWatcher } from './file-watcher';
import { getDatabase } from './database';

let initialized = false;

export function initializeServer() {
  if (initialized) {
    return;
  }
  
  console.log('서버 초기화 시작...');
  
  try {
    // 데이터베이스 초기화
    getDatabase();
    console.log('데이터베이스 초기화 완료');
    
    // 파일 감시 시스템 시작
    initializeFileWatcher();
    console.log('파일 감시 시스템 초기화 완료');
    
    initialized = true;
    console.log('서버 초기화 완료');
  } catch (error) {
    console.error('서버 초기화 오류:', error);
    throw error;
  }
}

// 개발 모드에서 HMR로 인한 중복 초기화 방지
if (typeof global !== 'undefined') {
  const globalWithInit = global as typeof global & { __serverInitialized?: boolean };
  if (!globalWithInit.__serverInitialized) {
    globalWithInit.__serverInitialized = true;
    // 비동기로 초기화 (서버 시작 지연 방지)
    setTimeout(() => {
      try {
        initializeServer();
      } catch (error) {
        console.error('서버 초기화 실패:', error);
      }
    }, 1000);
  }
}
