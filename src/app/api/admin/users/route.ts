import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin, setUserAsAdmin } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import bcrypt from 'bcryptjs';

// 사용자 목록 조회 (관리자만)
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const db = getDatabase();
    const users = db.prepare(`
      SELECT id, emp_code, dept_code, company_code, name, email, is_admin, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    
    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 사용자 생성 (관리자만)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { emp_code, dept_code, company_code, name, email, password, is_admin: userIsAdmin } = body;
    
    if (!emp_code || !name) {
      return NextResponse.json(
        { success: false, error: '사원코드와 이름은 필수입니다.' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    
    // 중복 체크
    const existing = db.prepare('SELECT id FROM users WHERE emp_code = ?').get(emp_code);
    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 존재하는 사원코드입니다.' },
        { status: 400 }
      );
    }
    
    // 비밀번호 해시
    const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
    
    const result = db.prepare(`
      INSERT INTO users (emp_code, dept_code, company_code, name, email, password_hash, is_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      emp_code,
      dept_code || '',
      company_code || '',
      name,
      email || null,
      passwordHash,
      userIsAdmin ? 1 : 0
    );
    
    const user = db.prepare(`
      SELECT id, emp_code, dept_code, company_code, name, email, is_admin, created_at
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid);
    
    return NextResponse.json({
      success: true,
      data: user,
      message: '사용자가 생성되었습니다.',
    });
  } catch (error) {
    console.error('Create user API error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
