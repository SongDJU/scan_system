/**
 * SMB/CIFS 클라이언트 모듈
 * Windows 네트워크 공유 폴더 연결을 위한 유틸리티
 */

import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// SMB 연결 상태 캐시
interface SMBConnection {
  host: string;
  share: string;
  username: string;
  mountPath: string;
  isConnected: boolean;
  lastChecked: Date;
  error?: string;
}

const connectionCache: Map<string, SMBConnection> = new Map();

/**
 * SMB URL 파싱
 * 예: https://nas.easychem.co.kr:17777/ -> { host: 'nas.easychem.co.kr', port: 17777 }
 * 예: \\\\nas.easychem.co.kr\\FAX3 -> { host: 'nas.easychem.co.kr', share: 'FAX3' }
 */
export function parseSMBUrl(url: string): { host: string; port?: number; share?: string; isWebUI?: boolean } {
  // HTTPS/HTTP URL (Synology 웹 인터페이스)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
      isWebUI: true,
    };
  }
  
  // UNC 경로 (\\\\server\\share)
  const uncMatch = url.match(/^\\\\([^\\]+)\\(.+)$/);
  if (uncMatch) {
    return {
      host: uncMatch[1],
      share: uncMatch[2].split('\\')[0],
    };
  }
  
  // SMB URL (smb://server/share)
  const smbMatch = url.match(/^smb:\/\/([^\/]+)\/(.+)$/);
  if (smbMatch) {
    return {
      host: smbMatch[1],
      share: smbMatch[2].split('/')[0],
    };
  }
  
  // 단순 호스트명
  return { host: url };
}

/**
 * Windows에서 네트워크 드라이브 연결 상태 확인
 */
export async function checkWindowsNetworkDrive(driveLetter: string): Promise<boolean> {
  try {
    // Windows에서 드라이브 연결 확인
    const { stdout } = await execAsync(`net use ${driveLetter}: 2>&1`, { 
      timeout: 5000,
      windowsHide: true 
    });
    return stdout.includes('OK') || stdout.includes('연결됨') || !stdout.includes('error');
  } catch {
    return false;
  }
}

/**
 * Windows 네트워크 드라이브 연결
 */
export async function connectWindowsNetworkDrive(
  driveLetter: string,
  uncPath: string,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 기존 연결 해제 (에러 무시)
    try {
      await execAsync(`net use ${driveLetter}: /delete /y 2>&1`, { timeout: 5000 });
    } catch {
      // 연결이 없으면 에러가 발생하지만 무시
    }
    
    // 새 연결
    const command = `net use ${driveLetter}: "${uncPath}" /user:${username} "${password}" /persistent:yes`;
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    
    if (stderr && stderr.includes('error')) {
      return { success: false, error: stderr };
    }
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * SMB 경로를 Windows UNC 경로로 변환
 */
export function toUNCPath(host: string, share: string, subPath?: string): string {
  let uncPath = `\\\\${host}\\${share}`;
  if (subPath) {
    uncPath += `\\${subPath.replace(/\//g, '\\')}`;
  }
  return uncPath;
}

/**
 * SMB 연결 테스트 (Windows 네트워크 공유)
 */
export async function testSMBConnection(
  host: string,
  share: string,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; files?: string[] }> {
  const cacheKey = `${host}/${share}`;
  
  try {
    // Windows UNC 경로 생성
    const uncPath = toUNCPath(host, share);
    
    // Windows에서 net use 명령으로 연결 테스트
    if (process.platform === 'win32') {
      // 먼저 기존 연결 해제 시도
      try {
        execSync(`net use "${uncPath}" /delete /y 2>&1`, { timeout: 5000, stdio: 'pipe' });
      } catch {
        // 무시
      }
      
      // 연결 시도
      const command = `net use "${uncPath}" /user:${username} "${password}"`;
      try {
        execSync(command, { timeout: 30000, stdio: 'pipe' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        connectionCache.set(cacheKey, {
          host,
          share,
          username,
          mountPath: uncPath,
          isConnected: false,
          lastChecked: new Date(),
          error: `연결 실패: ${errorMsg}`,
        });
        return { success: false, error: `연결 실패: ${errorMsg}` };
      }
      
      // 연결 성공 - 파일 목록 확인
      try {
        const files = fs.readdirSync(uncPath);
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        
        connectionCache.set(cacheKey, {
          host,
          share,
          username,
          mountPath: uncPath,
          isConnected: true,
          lastChecked: new Date(),
        });
        
        return { 
          success: true, 
          files: pdfFiles.slice(0, 10) // 처음 10개만 반환
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { success: false, error: `폴더 읽기 실패: ${errorMsg}` };
      }
    } else {
      // Linux/Mac - 마운트 필요
      return { 
        success: false, 
        error: '이 시스템에서는 SMB 폴더를 먼저 마운트해야 합니다. 로컬 경로를 직접 입력해주세요.' 
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    connectionCache.set(cacheKey, {
      host,
      share,
      username,
      mountPath: '',
      isConnected: false,
      lastChecked: new Date(),
      error: errorMessage,
    });
    
    return { success: false, error: errorMessage };
  }
}

/**
 * SMB 폴더에서 파일 목록 가져오기
 */
export async function listSMBFiles(
  host: string,
  share: string,
  username: string,
  password: string,
  subPath?: string
): Promise<{ success: boolean; files?: { name: string; size: number; isDirectory: boolean; modifiedAt: Date }[]; error?: string }> {
  try {
    // 먼저 연결 확인
    const connectionResult = await testSMBConnection(host, share, username, password);
    if (!connectionResult.success) {
      return { success: false, error: connectionResult.error };
    }
    
    const uncPath = toUNCPath(host, share, subPath);
    
    if (!fs.existsSync(uncPath)) {
      return { success: false, error: `경로를 찾을 수 없습니다: ${uncPath}` };
    }
    
    const entries = fs.readdirSync(uncPath, { withFileTypes: true });
    const files = entries.map(entry => {
      const fullPath = path.join(uncPath, entry.name);
      let stats = { size: 0, mtime: new Date() };
      try {
        stats = fs.statSync(fullPath);
      } catch {
        // 권한 문제 등으로 stat 실패 시 기본값 사용
      }
      
      return {
        name: entry.name,
        size: stats.size,
        isDirectory: entry.isDirectory(),
        modifiedAt: stats.mtime,
      };
    });
    
    return { success: true, files };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * SMB 폴더에서 파일 읽기
 */
export async function readSMBFile(
  host: string,
  share: string,
  username: string,
  password: string,
  filePath: string
): Promise<{ success: boolean; data?: Buffer; error?: string }> {
  try {
    // 연결 확인
    const connectionResult = await testSMBConnection(host, share, username, password);
    if (!connectionResult.success) {
      return { success: false, error: connectionResult.error };
    }
    
    const uncPath = toUNCPath(host, share, filePath);
    
    if (!fs.existsSync(uncPath)) {
      return { success: false, error: `파일을 찾을 수 없습니다: ${uncPath}` };
    }
    
    const data = fs.readFileSync(uncPath);
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * SMB 폴더로 파일 쓰기
 */
export async function writeSMBFile(
  host: string,
  share: string,
  username: string,
  password: string,
  filePath: string,
  data: Buffer
): Promise<{ success: boolean; error?: string }> {
  try {
    // 연결 확인
    const connectionResult = await testSMBConnection(host, share, username, password);
    if (!connectionResult.success) {
      return { success: false, error: connectionResult.error };
    }
    
    const uncPath = toUNCPath(host, share, filePath);
    
    // 디렉토리가 없으면 생성
    const dir = path.dirname(uncPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(uncPath, data);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * SMB 파일 이름 변경
 */
export async function renameSMBFile(
  host: string,
  share: string,
  username: string,
  password: string,
  oldPath: string,
  newPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 연결 확인
    const connectionResult = await testSMBConnection(host, share, username, password);
    if (!connectionResult.success) {
      return { success: false, error: connectionResult.error };
    }
    
    const oldUncPath = toUNCPath(host, share, oldPath);
    const newUncPath = toUNCPath(host, share, newPath);
    
    if (!fs.existsSync(oldUncPath)) {
      return { success: false, error: `원본 파일을 찾을 수 없습니다: ${oldUncPath}` };
    }
    
    fs.renameSync(oldUncPath, newUncPath);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 연결 상태 캐시 조회
 */
export function getConnectionStatus(host: string, share: string): SMBConnection | undefined {
  return connectionCache.get(`${host}/${share}`);
}

/**
 * 모든 연결 상태 조회
 */
export function getAllConnectionStatus(): SMBConnection[] {
  return Array.from(connectionCache.values());
}

/**
 * 연결 상태 캐시 초기화
 */
export function clearConnectionCache() {
  connectionCache.clear();
}

/**
 * SMB 폴더의 실제 접근 가능한 경로 반환
 * Windows에서는 UNC 경로, 이미 마운트된 경우 마운트 경로 반환
 */
export function getSMBAccessPath(host: string, share: string, subPath?: string): string {
  return toUNCPath(host, share, subPath);
}

/**
 * 폴더 정보에서 SMB 연결 정보 추출
 */
export function extractSMBInfo(folder: { 
  smb_host?: string; 
  smb_share?: string; 
  smb_username?: string; 
  smb_password?: string;
  path?: string;
}): { host: string; share: string; username: string; password: string } | null {
  if (!folder.smb_host || !folder.smb_share) {
    return null;
  }
  
  return {
    host: folder.smb_host,
    share: folder.smb_share,
    username: folder.smb_username || '',
    password: folder.smb_password || '',
  };
}
