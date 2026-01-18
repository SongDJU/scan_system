import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { getDatabase, addLog } from './database';
import { addToQueue, recoverPendingFiles } from './file-processor';
import type { WatchFolder } from '@/types';

// 감시자 인스턴스들
const watchers: Map<number, FSWatcher> = new Map();

// 기존 파일 스캔 및 DB 등록 (처리하지 않고 목록만 등록)
export function scanExistingFiles(folder: WatchFolder, processNewFiles: boolean = false) {
  const watchPath = folder.path;
  
  if (!fs.existsSync(watchPath)) {
    console.error(`폴더가 존재하지 않습니다: ${watchPath}`);
    return { total: 0, registered: 0, skipped: 0 };
  }
  
  const db = getDatabase();
  const files = fs.readdirSync(watchPath);
  let registered = 0;
  let skipped = 0;
  
  for (const filename of files) {
    const ext = path.extname(filename).toLowerCase();
    if (ext !== '.pdf') continue;
    
    const filePath = path.join(watchPath, filename);
    const stat = fs.statSync(filePath);
    
    if (!stat.isFile()) continue;
    
    // 이미 DB에 있는지 확인
    const existing = db.prepare(`
      SELECT id, status FROM file_processes 
      WHERE folder_id = ? AND (original_filename = ? OR new_filename = ?)
    `).get(folder.id, filename, filename) as { id: number; status: string } | undefined;
    
    if (existing) {
      skipped++;
      continue;
    }
    
    // 파일명에 '_'가 있으면 이미 처리된 파일로 간주하여 completed 상태로 등록
    const hasUnderscore = filename.includes('_');
    
    if (hasUnderscore && !processNewFiles) {
      // 이미 처리된 것으로 보이는 파일 - completed 상태로 등록
      const nameParts = filename.replace('.pdf', '').split('_');
      const companyName = nameParts[0] || '알수없음';
      const contentSummary = nameParts.slice(1).join('_') || '문서';
      
      db.prepare(`
        INSERT INTO file_processes 
        (folder_id, original_path, original_filename, new_filename, company_name, content_summary, status, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP)
      `).run(filePath, filename, filename, companyName, contentSummary, folder.id);
      
      registered++;
    } else if (processNewFiles) {
      // 새 파일로 처리 - pending 상태로 등록하고 큐에 추가
      db.prepare(`
        INSERT INTO file_processes 
        (folder_id, original_path, original_filename, status)
        VALUES (?, ?, ?, 'pending')
      `).run(folder.id, filePath, filename);
      
      addToQueue(filePath, folder.id);
      registered++;
    } else {
      // 처리되지 않은 파일 - 기존 파일로 등록 (existing 상태)
      db.prepare(`
        INSERT INTO file_processes 
        (folder_id, original_path, original_filename, new_filename, status)
        VALUES (?, ?, ?, ?, 'existing')
      `).run(folder.id, filePath, filename, filename);
      
      registered++;
    }
  }
  
  const pdfCount = files.filter(f => f.toLowerCase().endsWith('.pdf')).length;
  console.log(`폴더 스캔 완료: ${folder.alias} - 총 ${pdfCount}개 PDF, ${registered}개 등록, ${skipped}개 건너뜀`);
  addLog(null, 'SCAN', `폴더 스캔: ${folder.alias} - ${registered}개 파일 등록`);
  
  return { total: pdfCount, registered, skipped };
}

// 감시 시작
export function startWatching(folder: WatchFolder, scanExisting: boolean = true) {
  if (watchers.has(folder.id)) {
    console.log(`이미 감시 중인 폴더: ${folder.alias}`);
    return;
  }
  
  const watchPath = folder.path;
  
  // 경로 존재 확인
  if (!fs.existsSync(watchPath)) {
    console.error(`폴더가 존재하지 않습니다: ${watchPath}`);
    addLog(null, 'WATCH_ERROR', `폴더를 찾을 수 없음: ${folder.alias}`, watchPath);
    return;
  }
  
  // 기존 파일 스캔 (처음 등록 시)
  if (scanExisting) {
    scanExistingFiles(folder, false);
  }
  
  console.log(`폴더 감시 시작: ${folder.alias} (${watchPath})`);
  
  const watcher = chokidar.watch(watchPath, {
    persistent: true,
    ignoreInitial: true, // 기존 파일은 위에서 스캔했으므로 무시
    depth: 0, // 하위 폴더 제외
    awaitWriteFinish: {
      stabilityThreshold: 2000, // 파일 쓰기 완료 대기 (2초)
      pollInterval: 100,
    },
    ignored: [
      /(^|[\/\\])\../, // 숨김 파일 제외
      /.*\.tmp$/i, // 임시 파일 제외
      /.*\.part$/i, // 부분 파일 제외
    ],
  });
  
  watcher.on('add', (filePath) => {
    // PDF 파일만 처리
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.pdf') {
      return;
    }
    
    const filename = path.basename(filePath);
    
    // 이미 DB에 있는지 확인
    const db = getDatabase();
    const existingProcess = db.prepare(`
      SELECT id FROM file_processes 
      WHERE folder_id = ? AND (original_filename = ? OR new_filename = ?)
    `).get(folder.id, filename, filename);
    
    if (existingProcess) {
      console.log(`이미 등록된 파일 건너뜀: ${filename}`);
      return;
    }
    
    console.log(`새 PDF 파일 감지: ${filename}`);
    addLog(null, 'FILE_DETECTED', `새 파일 감지: ${filename}`, filePath);
    
    // 큐에 추가
    addToQueue(filePath, folder.id);
  });
  
  watcher.on('error', (error: unknown) => {
    console.error(`감시 오류 (${folder.alias}):`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog(null, 'WATCH_ERROR', `감시 오류: ${folder.alias}`, errorMessage);
  });
  
  watcher.on('ready', () => {
    console.log(`폴더 감시 준비 완료: ${folder.alias}`);
    addLog(null, 'WATCH_READY', `폴더 감시 시작: ${folder.alias}`);
  });
  
  watchers.set(folder.id, watcher);
}

// 감시 중지
export function stopWatching(folderId: number) {
  const watcher = watchers.get(folderId);
  if (watcher) {
    watcher.close();
    watchers.delete(folderId);
    console.log(`폴더 감시 중지: ${folderId}`);
  }
}

// 모든 감시 중지
export function stopAllWatching() {
  for (const [folderId, watcher] of watchers) {
    watcher.close();
    console.log(`폴더 감시 중지: ${folderId}`);
  }
  watchers.clear();
}

// 모든 활성 폴더 감시 시작
export function startAllWatchers() {
  const db = getDatabase();
  
  const folders = db.prepare(`
    SELECT * FROM watch_folders WHERE is_active = 1
  `).all() as WatchFolder[];
  
  console.log(`활성 폴더 ${folders.length}개 감시 시작`);
  
  for (const folder of folders) {
    startWatching(folder);
  }
  
  // 미처리 파일 복구
  recoverPendingFiles();
}

// 로컬 테스트 폴더 설정
export function setupLocalTestFolder() {
  const localWatchEnabled = process.env.LOCAL_WATCH_ENABLED === 'true';
  const localWatchFolder = process.env.LOCAL_WATCH_FOLDER || './data/watch';
  
  if (!localWatchEnabled) {
    return;
  }
  
  const watchPath = path.resolve(process.cwd(), localWatchFolder);
  
  // 폴더 생성
  if (!fs.existsSync(watchPath)) {
    fs.mkdirSync(watchPath, { recursive: true });
    console.log(`로컬 테스트 폴더 생성: ${watchPath}`);
  }
  
  // DB에 폴더 등록 (없으면)
  const db = getDatabase();
  const existingFolder = db.prepare(`
    SELECT id FROM watch_folders WHERE path = ?
  `).get(watchPath);
  
  if (!existingFolder) {
    db.prepare(`
      INSERT INTO watch_folders (path, alias, folder_type, is_active)
      VALUES (?, ?, 'local', 1)
    `).run(watchPath, '로컬 테스트 폴더');
    
    console.log('로컬 테스트 폴더 DB 등록 완료');
  }
}

// 감시 상태 조회
export function getWatcherStatus() {
  const status: { folderId: number; isWatching: boolean }[] = [];
  
  const db = getDatabase();
  const folders = db.prepare('SELECT id FROM watch_folders').all() as { id: number }[];
  
  for (const folder of folders) {
    status.push({
      folderId: folder.id,
      isWatching: watchers.has(folder.id),
    });
  }
  
  return status;
}

// 초기화 함수 (서버 시작 시 호출)
export function initializeFileWatcher() {
  console.log('파일 감시 시스템 초기화...');
  
  // 로컬 테스트 폴더 설정
  setupLocalTestFolder();
  
  // 모든 활성 폴더 감시 시작
  startAllWatchers();
  
  addLog(null, 'SYSTEM', '파일 감시 시스템 시작');
}
