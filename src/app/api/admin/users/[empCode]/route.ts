import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin, setUserAsAdmin } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import bcrypt from 'bcryptjs';

// 사용자 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ empCode: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const { empCode } = await params;
    
    const db = getDatabase();
    const user = db.prepare(`
      SELECT id, emp_code, dept_code, company_code, name, email, is_admin, created_at, updated_at
      FROM users WHERE emp_code = ?
    `).get(empCode);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('User detail API error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 사용자 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ empCode: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const { empCode } = await params;
    const body = await request.json();
    
    const db = getDatabase();
    
    // 사용자 존재 확인
    const user = db.prepare('SELECT id FROM users WHERE emp_code = ?').get(empCode);
    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 업데이트 쿼리 구성
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (body.dept_code !== undefined) {
      updates.push('dept_code = ?');
      values.push(body.dept_code);
    }
    if (body.company_code !== undefined) {
      updates.push('company_code = ?');
      values.push(body.company_code);
    }
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.email !== undefined) {
      updates.push('email = ?');
      values.push(body.email);
    }
    if (body.password !== undefined && body.password) {
      updates.push('password_hash = ?');
      values.push(bcrypt.hashSync(body.password, 10));
    }
    if (body.is_admin !== undefined) {
      updates.push('is_admin = ?');
      values.push(body.is_admin ? 1 : 0);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(empCode);
      
      db.prepare(`
        UPDATE users SET ${updates.join(', ')} WHERE emp_code = ?
      `).run(...values);
    }
    
    const updatedUser = db.prepare(`
      SELECT id, emp_code, dept_code, company_code, name, email, is_admin, created_at, updated_at
      FROM users WHERE emp_code = ?
    `).get(empCode);
    
    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: '사용자가 수정되었습니다.',
    });
  } catch (error) {
    console.error('Update user API error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 사용자 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ empCode: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    
    const { empCode } = await params;
    
    // 자기 자신은 삭제 불가
    if (session.emp_code === empCode) {
      return NextResponse.json(
        { success: false, error: '자기 자신은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE emp_code = ?').run(empCode);
    
    return NextResponse.json({
      success: true,
      message: '사용자가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Delete user API error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
