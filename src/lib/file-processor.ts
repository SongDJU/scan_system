import fs from 'fs';
import path from 'path';
import { getDatabase, addLog, updateProcessingState } from './database';
import { extractText } from './vision';
import { analyzeDocument, generateUniqueFilename } from './gemini';
import type { FileProcess, ProcessStatus } from '@/types';

const BACKUP_FOLDER = process.env.BACKUP_FOLDER || './data/backup';
const FAILED_FOLDER = process.env.FAILED_FOLDER || './data/failed';
const ORIGINAL_FOLDER = process.env.ORIGINAL_FOLDER || './data/original';

// 처리 큐
interface QueueItem {
  id: string;
  filePath: string;
  folderId: number;
  addedAt: Date;
}

let processingQueue: QueueItem[] = [];
let isProcessing = false;

// 큐에 파일 추가
export function addToQueue(filePath: string, folderId: number): string {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 중복 체크
  const exists = processingQueue.some(item => item.filePath === filePath);
  if (exists) {
    console.log('이미 큐에 있는 파일:', filePath);
    return '';
  }
  
  processingQueue.push({
    id,
    filePath,
    folderId,
    addedAt: new Date(),
  });
  
  console.log(`큐에 파일 추가: ${filePath} (총 ${processingQueue.length}개)`);
  
  // 처리 시작
  processQueue();
  
  return id;
}

// 큐 처리
async function processQueue() {
  if (isProcessing || processingQueue.length === 0) {
    return;
  }
  
  isProcessing = true;
  updateProcessingState(0, true);
  
  while (processingQueue.length > 0) {
    const item = processingQueue.shift()!;
    
    try {
      await processFile(item.filePath, item.folderId);
    } catch (error) {
      console.error('파일 처리 오류:', error);
    }
  }
  
  isProcessing = false;
  updateProcessingState(0, false);
}

// 단일 파일 처리
export async function processFile(filePath: string, folderId: number): Promise<FileProcess> {
  const db = getDatabase();
  const filename = path.basename(filePath);
  
  console.log(`파일 처리 시작: ${filename}`);
  
  // 파일 존재 확인
  if (!fs.existsSync(filePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
  }
  
  // DB에 처리 레코드 생성
  const result = db.prepare(`
    INSERT INTO file_processes (folder_id, original_path, original_filename, status)
    VALUES (?, ?, ?, 'processing')
  `).run(folderId, filePath, filename);
  
  const fileProcessId = result.lastInsertRowid as number;
  
  addLog(fileProcessId, 'START', `파일 처리 시작: ${filename}`);
  
  try {
    // 1. 원본 백업
    await backupOriginalFile(filePath, fileProcessId);
    
    // 2. OCR 수행
    addLog(fileProcessId, 'OCR', 'OCR 처리 중...');
    const ocrText = await extractText(filePath);
    
    if (!ocrText || ocrText.trim().length === 0) {
      throw new Error('OCR 결과가 비어있습니다. 스캔 품질을 확인해주세요.');
    }
    
    addLog(fileProcessId, 'OCR', `OCR 완료 (${ocrText.length}자 추출)`);
    
    // 3. Gemini로 문서 분석
    addLog(fileProcessId, 'ANALYZE', '문서 분석 중...');
    const analysis = await analyzeDocument(ocrText);
    
    addLog(fileProcessId, 'ANALYZE', `분석 완료: ${analysis.companyName} - ${analysis.contentSummary} (신뢰도: ${analysis.confidence}%)`);
    
    // 4. 새 파일명 생성 (중복 처리)
    const directory = path.dirname(filePath);
    const existingFiles = fs.readdirSync(directory);
    const newFilename = generateUniqueFilename(analysis.suggestedFilename, existingFiles);
    const newFilePath = path.join(directory, newFilename);
    
    // 5. 파일 이름 변경
    fs.renameSync(filePath, newFilePath);
    
    addLog(fileProcessId, 'RENAME', `파일명 변경: ${filename} → ${newFilename}`);
    
    // 6. DB 업데이트
    db.prepare(`
      UPDATE file_processes 
      SET new_filename = ?, company_name = ?, content_summary = ?, ocr_text = ?,
          status = 'completed', processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newFilename, analysis.companyName, analysis.contentSummary, ocrText.substring(0, 10000), fileProcessId);
    
    updateProcessingState(fileProcessId, false);
    
    addLog(fileProcessId, 'COMPLETE', '처리 완료');
    
    return db.prepare('SELECT * FROM file_processes WHERE id = ?').get(fileProcessId) as FileProcess;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`파일 처리 실패: ${filename}`, error);
    
    addLog(fileProcessId, 'ERROR', `처리 실패: ${errorMessage}`);
    
    // 실패한 파일 이동
    await moveToFailedFolder(filePath, fileProcessId);
    
    // DB 업데이트
    db.prepare(`
      UPDATE file_processes 
      SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(errorMessage, fileProcessId);
    
    throw error;
  }
}

// 원본 파일 백업
async function backupOriginalFile(filePath: string, fileProcessId: number) {
  const backupDir = path.resolve(process.cwd(), ORIGINAL_FOLDER);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const filename = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `${timestamp}_${filename}`;
  const backupPath = path.join(backupDir, backupFilename);
  
  fs.copyFileSync(filePath, backupPath);
  
  addLog(fileProcessId, 'BACKUP', `원본 백업 완료: ${backupFilename}`);
}

// 실패한 파일 이동
async function moveToFailedFolder(filePath: string, fileProcessId: number) {
  if (!fs.existsSync(filePath)) return;
  
  const failedDir = path.resolve(process.cwd(), FAILED_FOLDER);
  
  if (!fs.existsSync(failedDir)) {
    fs.mkdirSync(failedDir, { recursive: true });
  }
  
  const filename = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const failedFilename = `${timestamp}_${filename}`;
  const failedPath = path.join(failedDir, failedFilename);
  
  try {
    fs.copyFileSync(filePath, failedPath);
    addLog(fileProcessId, 'MOVE_FAILED', `실패 폴더로 이동: ${failedFilename}`);
  } catch (error) {
    console.error('실패 폴더 이동 오류:', error);
  }
}

// 수동 재처리 또는 기존 파일 처리
export async function reprocessFile(fileProcessId: number): Promise<FileProcess> {
  const db = getDatabase();
  
  const fileProcess = db.prepare('SELECT * FROM file_processes WHERE id = ?').get(fileProcessId) as FileProcess | undefined;
  
  if (!fileProcess) {
    throw new Error('파일 처리 기록을 찾을 수 없습니다.');
  }
  
  const folder = db.prepare('SELECT * FROM watch_folders WHERE id = ?').get(fileProcess.folder_id) as { path: string } | undefined;
  
  if (!folder) {
    throw new Error('폴더 정보를 찾을 수 없습니다.');
  }
  
  let filePath: string;
  
  // 기존 파일(existing)인 경우 - 현재 위치에서 바로 처리
  if (fileProcess.status === 'existing') {
    const currentFilename = fileProcess.new_filename || fileProcess.original_filename;
    filePath = path.join(folder.path, currentFilename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${currentFilename}`);
    }
    
    // 상태 초기화 (기존 파일 처리용)
    db.prepare(`
      UPDATE file_processes 
      SET status = 'pending', error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fileProcessId);
    
    addLog(fileProcessId, 'PROCESS_EXISTING', '기존 파일 AI 처리 시작');
  } else {
    // 실패한 파일 재처리 - 원본 백업에서 복원
    const originalDir = path.resolve(process.cwd(), ORIGINAL_FOLDER);
    
    if (!fs.existsSync(originalDir)) {
      throw new Error('원본 백업 폴더가 없습니다.');
    }
    
    const files = fs.readdirSync(originalDir);
    const matchingFile = files.find(f => f.includes(fileProcess.original_filename));
    
    if (!matchingFile) {
      // 원본 백업이 없으면 현재 파일에서 시도
      const currentFilename = fileProcess.new_filename || fileProcess.original_filename;
      filePath = path.join(folder.path, currentFilename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('원본 백업 파일을 찾을 수 없습니다.');
      }
    } else {
      const backupPath = path.join(originalDir, matchingFile);
      filePath = path.join(folder.path, fileProcess.original_filename);
      fs.copyFileSync(backupPath, filePath);
    }
    
    // 상태 초기화
    db.prepare(`
      UPDATE file_processes 
      SET status = 'pending', error_message = NULL, new_filename = NULL,
          company_name = NULL, content_summary = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fileProcessId);
    
    addLog(fileProcessId, 'REPROCESS', '재처리 시작');
  }
  
  // 기존 레코드 삭제 후 새로 처리
  db.prepare('DELETE FROM file_processes WHERE id = ?').run(fileProcessId);
  
  // 큐에 추가
  addToQueue(filePath, fileProcess.folder_id);
  
  return {
    ...fileProcess,
    status: 'pending',
  };
}

// 파일명 수동 변경
export function manualRename(fileProcessId: number, newFilename: string): FileProcess {
  const db = getDatabase();
  
  const fileProcess = db.prepare('SELECT * FROM file_processes WHERE id = ?').get(fileProcessId) as FileProcess | undefined;
  
  if (!fileProcess) {
    throw new Error('파일 처리 기록을 찾을 수 없습니다.');
  }
  
  const folder = db.prepare('SELECT * FROM watch_folders WHERE id = ?').get(fileProcess.folder_id) as { path: string } | undefined;
  
  if (!folder) {
    throw new Error('폴더 정보를 찾을 수 없습니다.');
  }
  
  const currentFilename = fileProcess.new_filename || fileProcess.original_filename;
  const currentPath = path.join(folder.path, currentFilename);
  
  if (!fs.existsSync(currentPath)) {
    throw new Error('현재 파일을 찾을 수 없습니다.');
  }
  
  // 확장자 확인
  if (!newFilename.toLowerCase().endsWith('.pdf')) {
    newFilename += '.pdf';
  }
  
  const newPath = path.join(folder.path, newFilename);
  
  // 파일명 변경
  fs.renameSync(currentPath, newPath);
  
  // DB 업데이트
  db.prepare(`
    UPDATE file_processes 
    SET new_filename = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newFilename, fileProcessId);
  
  addLog(fileProcessId, 'MANUAL_RENAME', `수동 파일명 변경: ${currentFilename} → ${newFilename}`);
  
  return db.prepare('SELECT * FROM file_processes WHERE id = ?').get(fileProcessId) as FileProcess;
}

// 현재 큐 상태 조회
export function getQueueStatus() {
  return {
    isProcessing,
    queueLength: processingQueue.length,
    items: processingQueue.map(item => ({
      id: item.id,
      filename: path.basename(item.filePath),
      addedAt: item.addedAt,
    })),
  };
}

// 미처리 파일 복구 (서버 재시작 시)
export async function recoverPendingFiles() {
  const db = getDatabase();
  
  // processing 상태로 남아있는 파일들을 pending으로 변경
  db.prepare(`
    UPDATE file_processes 
    SET status = 'pending', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'processing'
  `).run();
  
  // pending 상태의 파일들을 큐에 추가
  const pendingFiles = db.prepare(`
    SELECT fp.*, wf.path as folder_path
    FROM file_processes fp
    JOIN watch_folders wf ON fp.folder_id = wf.id
    WHERE fp.status = 'pending'
    ORDER BY fp.created_at ASC
  `).all() as (FileProcess & { folder_path: string })[];
  
  console.log(`복구할 미처리 파일: ${pendingFiles.length}개`);
  
  for (const file of pendingFiles) {
    const filePath = path.join(file.folder_path, file.original_filename);
    if (fs.existsSync(filePath)) {
      addToQueue(filePath, file.folder_id);
    } else {
      // 파일이 없으면 skipped로 변경
      db.prepare(`
        UPDATE file_processes 
        SET status = 'skipped', error_message = '파일을 찾을 수 없음', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(file.id);
    }
  }
  
  addLog(null, 'RECOVERY', `서버 재시작 - ${pendingFiles.length}개 파일 복구 시도`);
}
