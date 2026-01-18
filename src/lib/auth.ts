import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getDatabase } from './database';
import type { User, UserSession, SSOParams } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const TOKEN_EXPIRY = '24h';

// JWT 토큰 생성
export function generateToken(user: UserSession): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// JWT 토큰 검증
export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

// 쿠키에서 세션 가져오기
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) return null;
  
  return verifyToken(token);
}

// 로컬 로그인 (관리자용)
export function localLogin(empCode: string, password: string): { success: boolean; token?: string; user?: UserSession; error?: string } {
  const db = getDatabase();
  
  const user = db.prepare(`
    SELECT id, emp_code, dept_code, company_code, name, password_hash, is_admin
    FROM users WHERE emp_code = ?
  `).get(empCode) as (User & { password_hash: string }) | undefined;
  
  if (!user) {
    return { success: false, error: '사용자를 찾을 수 없습니다.' };
  }
  
  if (!user.password_hash) {
    return { success: false, error: '비밀번호가 설정되지 않은 계정입니다. SSO로 로그인해주세요.' };
  }
  
  const isValidPassword = bcrypt.compareSync(password, user.password_hash);
  if (!isValidPassword) {
    return { success: false, error: '비밀번호가 일치하지 않습니다.' };
  }
  
  const session: UserSession = {
    id: user.id,
    emp_code: user.emp_code,
    dept_code: user.dept_code,
    company_code: user.company_code,
    name: user.name,
    is_admin: !!user.is_admin,
  };
  
  const token = generateToken(session);
  return { success: true, token, user: session };
}

// SSO 로그인 (Amaranth10)
export function ssoLogin(params: SSOParams): { success: boolean; token?: string; user?: UserSession; error?: string } {
  const db = getDatabase();
  
  const empCode = params.emp_code;
  const deptCode = params.dept_code || '';
  const companyCode = params.company_code || '';
  
  if (!empCode) {
    return { success: false, error: 'SSO 파라미터가 올바르지 않습니다. (emp_code 필수)' };
  }
  
  // 기존 사용자 조회
  let user = db.prepare(`
    SELECT id, emp_code, dept_code, company_code, name, is_admin
    FROM users WHERE emp_code = ?
  `).get(empCode) as User | undefined;
  
  if (user) {
    // 기존 사용자 - 부서코드/회사코드 업데이트
    db.prepare(`
      UPDATE users SET dept_code = ?, company_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE emp_code = ?
    `).run(deptCode, companyCode, empCode);
    
    user.dept_code = deptCode;
    user.company_code = companyCode;
  } else {
    // 새 사용자 생성
    const result = db.prepare(`
      INSERT INTO users (emp_code, dept_code, company_code, name, is_admin)
      VALUES (?, ?, ?, ?, 0)
    `).run(empCode, deptCode, companyCode, empCode);
    
    user = {
      id: result.lastInsertRowid as number,
      emp_code: empCode,
      dept_code: deptCode,
      company_code: companyCode,
      name: empCode,
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  
  const session: UserSession = {
    id: user.id,
    emp_code: user.emp_code,
    dept_code: user.dept_code,
    company_code: user.company_code,
    name: user.name,
    is_admin: !!user.is_admin,
  };
  
  const token = generateToken(session);
  return { success: true, token, user: session };
}

// 사용자가 폴더에 접근 가능한지 확인
export function canAccessFolder(session: UserSession, folderId: number): boolean {
  if (session.is_admin) return true;
  
  const db = getDatabase();
  const mapping = db.prepare(`
    SELECT id FROM folder_dept_mappings 
    WHERE folder_id = ? AND dept_code = ?
  `).get(folderId, session.dept_code);
  
  return !!mapping;
}

// 사용자가 접근 가능한 폴더 목록 가져오기
export function getAccessibleFolders(session: UserSession): number[] {
  const db = getDatabase();
  
  if (session.is_admin) {
    const folders = db.prepare('SELECT id FROM watch_folders WHERE is_active = 1').all() as { id: number }[];
    return folders.map(f => f.id);
  }
  
  const mappings = db.prepare(`
    SELECT DISTINCT folder_id FROM folder_dept_mappings WHERE dept_code = ?
  `).all(session.dept_code) as { folder_id: number }[];
  
  return mappings.map(m => m.folder_id);
}

// 관리자 권한 확인
export function isAdmin(session: UserSession | null): boolean {
  return !!session?.is_admin;
}

// 사용자를 관리자로 지정
export function setUserAsAdmin(empCode: string, isAdmin: boolean): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE emp_code = ?
  `).run(isAdmin ? 1 : 0, empCode);
  
  return result.changes > 0;
}
