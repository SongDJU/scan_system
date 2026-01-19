'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Users,
  FolderOpen,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ArrowLeft,
  Shield,
  Loader2,
  Search,
} from 'lucide-react';
import type { UserSession, User, WatchFolder } from '@/types';

type Tab = 'folders' | 'users';

interface FolderWithDepts extends WatchFolder {
  dept_codes?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('folders');
  
  // 폴더 관련 상태
  const [folders, setFolders] = useState<FolderWithDepts[]>([]);
  const [editingFolder, setEditingFolder] = useState<number | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderForm, setFolderForm] = useState({
    path: '',
    alias: '',
    folder_type: 'local',
    dept_codes: '',
  });

  // 사용자 관련 상태
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newUser, setNewUser] = useState(false);
  const [userForm, setUserForm] = useState({
    emp_code: '',
    name: '',
    dept_code: '',
    company_code: '',
    email: '',
    password: '',
    is_admin: false,
  });

  // 폴더 스캔 관련
  const [scanningFolder, setScanningFolder] = useState<number | null>(null);

  // 사용자 인증 확인
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user.is_admin) {
          setUser(data.user);
        } else {
          router.push('/dashboard');
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  // 데이터 로드
  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchUsers();
    }
  }, [user]);

  const fetchFolders = async () => {
    const res = await fetch('/api/folders');
    const data = await res.json();
    if (data.success) setFolders(data.data);
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    if (data.success) setUsers(data.data);
  };

  // 폴더 스캔
  const scanFolder = async (folderId: number) => {
    setScanningFolder(folderId);
    try {
      const res = await fetch(`/api/folders/${folderId}/scan`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        alert(`스캔 완료: ${data.data.total}개 PDF 중 ${data.data.registered}개 등록됨`);
      } else {
        alert(`스캔 실패: ${data.error}`);
      }
    } catch (error) {
      alert('스캔 중 오류가 발생했습니다.');
    } finally {
      setScanningFolder(null);
    }
  };

  // 폴더 저장
  const saveFolder = async () => {
    const url = editingFolder ? `/api/folders/${editingFolder}` : '/api/folders';
    const method = editingFolder ? 'PATCH' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...folderForm,
        dept_codes: folderForm.dept_codes.split(',').map(s => s.trim()).filter(Boolean),
      }),
    });
    
    const data = await res.json();
    if (data.success) {
      fetchFolders();
      setEditingFolder(null);
      setNewFolder(false);
      resetFolderForm();
    } else {
      alert(data.error);
    }
  };

  // 폴더 삭제
  const deleteFolder = async (id: number) => {
    if (!confirm('이 폴더를 삭제하시겠습니까?')) return;
    
    const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchFolders();
    } else {
      alert(data.error);
    }
  };

  // 사용자 저장
  const saveUser = async () => {
    const url = editingUser ? `/api/admin/users/${editingUser}` : '/api/admin/users';
    const method = editingUser ? 'PATCH' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    });
    
    const data = await res.json();
    if (data.success) {
      fetchUsers();
      setEditingUser(null);
      setNewUser(false);
      resetUserForm();
    } else {
      alert(data.error);
    }
  };

  // 사용자 삭제
  const deleteUser = async (empCode: string) => {
    if (!confirm('이 사용자를 삭제하시겠습니까?')) return;
    
    const res = await fetch(`/api/admin/users/${empCode}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchUsers();
    } else {
      alert(data.error);
    }
  };

  const resetFolderForm = () => {
    setFolderForm({
      path: '',
      alias: '',
      folder_type: 'local',
      dept_codes: '',
    });
  };

  const resetUserForm = () => {
    setUserForm({
      emp_code: '',
      name: '',
      dept_code: '',
      company_code: '',
      email: '',
      password: '',
      is_admin: false,
    });
  };

  const startEditFolder = (folder: FolderWithDepts) => {
    setEditingFolder(folder.id);
    setFolderForm({
      path: folder.path,
      alias: folder.alias,
      folder_type: folder.folder_type,
      dept_codes: folder.dept_codes || '',
    });
  };

  const startEditUser = (u: User) => {
    setEditingUser(u.emp_code);
    setUserForm({
      emp_code: u.emp_code,
      name: u.name,
      dept_code: u.dept_code,
      company_code: u.company_code,
      email: u.email || '',
      password: '',
      is_admin: u.is_admin,
    });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">관리자 설정</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'folders' ? 'default' : 'outline'}
            onClick={() => setActiveTab('folders')}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            폴더 관리
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            onClick={() => setActiveTab('users')}
          >
            <Users className="w-4 h-4 mr-2" />
            사용자 관리
          </Button>
        </div>

        {/* 폴더 관리 */}
        {activeTab === 'folders' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>감시 폴더 목록</CardTitle>
              <Button onClick={() => { setNewFolder(true); resetFolderForm(); }}>
                <Plus className="w-4 h-4 mr-2" />
                폴더 추가
              </Button>
            </CardHeader>
            <CardContent>
              {/* 안내문구 */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <p>💡 <strong>경로 입력 예시:</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>로컬 폴더: <code className="bg-blue-100 px-1 rounded">C:\scan\folder</code></li>
                  <li>네트워크 드라이브: <code className="bg-blue-100 px-1 rounded">Z:\</code> 또는 <code className="bg-blue-100 px-1 rounded">\\서버\공유폴더</code></li>
                </ul>
              </div>

              {(newFolder || editingFolder) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                  <h3 className="font-medium">{newFolder ? '새 폴더 추가' : '폴더 수정'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">폴더 이름 (별칭)</label>
                      <Input
                        value={folderForm.alias}
                        onChange={(e) => setFolderForm({ ...folderForm, alias: e.target.value })}
                        placeholder="예: 경영혁신팀 폴더"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">경로</label>
                      <Input
                        value={folderForm.path}
                        onChange={(e) => setFolderForm({ ...folderForm, path: e.target.value })}
                        placeholder="예: Z:\ 또는 C:\scan\folder"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm text-gray-600">접근 가능 부서 (콤마로 구분)</label>
                      <Input
                        value={folderForm.dept_codes}
                        onChange={(e) => setFolderForm({ ...folderForm, dept_codes: e.target.value })}
                        placeholder="예: DEV,HR,SALES (비워두면 모든 부서 접근 가능)"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveFolder}>
                      <Save className="w-4 h-4 mr-2" />
                      저장
                    </Button>
                    <Button variant="outline" onClick={() => { setNewFolder(false); setEditingFolder(null); }}>
                      <X className="w-4 h-4 mr-2" />
                      취소
                    </Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>경로</TableHead>
                    <TableHead>접근 부서</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folders.map((folder) => (
                    <TableRow key={folder.id}>
                      <TableCell className="font-medium">{folder.alias}</TableCell>
                      <TableCell className="font-mono text-sm max-w-xs truncate">{folder.path}</TableCell>
                      <TableCell>
                        {folder.dept_codes ? folder.dept_codes.split(',').map((d) => (
                          <Badge key={d} variant="secondary" className="mr-1">{d}</Badge>
                        )) : <span className="text-gray-400">전체</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={folder.is_active ? 'success' : 'error'}>
                          {folder.is_active ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => scanFolder(folder.id)}
                          disabled={scanningFolder === folder.id}
                          title="폴더 스캔"
                        >
                          {scanningFolder === folder.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => startEditFolder(folder)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFolder(folder.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {folders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        등록된 폴더가 없습니다. 폴더를 추가해주세요.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* 사용자 관리 */}
        {activeTab === 'users' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>사용자 목록</CardTitle>
              <Button onClick={() => { setNewUser(true); resetUserForm(); }}>
                <Plus className="w-4 h-4 mr-2" />
                사용자 추가
              </Button>
            </CardHeader>
            <CardContent>
              {(newUser || editingUser) && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
                  <h3 className="font-medium">{newUser ? '새 사용자 추가' : '사용자 수정'}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">사원코드</label>
                      <Input
                        value={userForm.emp_code}
                        onChange={(e) => setUserForm({ ...userForm, emp_code: e.target.value })}
                        disabled={!!editingUser}
                        placeholder="사원코드"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">이름</label>
                      <Input
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        placeholder="이름"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">부서코드</label>
                      <Input
                        value={userForm.dept_code}
                        onChange={(e) => setUserForm({ ...userForm, dept_code: e.target.value })}
                        placeholder="예: DEV"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">회사코드</label>
                      <Input
                        value={userForm.company_code}
                        onChange={(e) => setUserForm({ ...userForm, company_code: e.target.value })}
                        placeholder="회사코드"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">이메일</label>
                      <Input
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        placeholder="이메일"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">비밀번호 {editingUser && '(변경 시에만 입력)'}</label>
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        placeholder="비밀번호"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_admin"
                        checked={userForm.is_admin}
                        onChange={(e) => setUserForm({ ...userForm, is_admin: e.target.checked })}
                      />
                      <label htmlFor="is_admin" className="text-sm text-gray-600">관리자 권한 부여</label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveUser}>
                      <Save className="w-4 h-4 mr-2" />
                      저장
                    </Button>
                    <Button variant="outline" onClick={() => { setNewUser(false); setEditingUser(null); }}>
                      <X className="w-4 h-4 mr-2" />
                      취소
                    </Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>사원코드</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>부서코드</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>권한</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono">{u.emp_code}</TableCell>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{u.dept_code}</Badge>
                      </TableCell>
                      <TableCell>{u.email || '-'}</TableCell>
                      <TableCell>
                        {u.is_admin && (
                          <Badge variant="info" className="flex items-center gap-1 w-fit">
                            <Shield className="w-3 h-3" />
                            관리자
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => startEditUser(u)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteUser(u.emp_code)}
                          disabled={u.emp_code === user.emp_code}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
