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
    smb_host: '',
    smb_share: '',
    smb_username: '',
    smb_password: '',
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
      smb_host: '',
      smb_share: '',
      smb_username: '',
      smb_password: '',
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
      smb_host: folder.smb_host || '',
      smb_share: folder.smb_share || '',
      smb_username: folder.smb_username || '',
      smb_password: folder.smb_password || '',
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
                        placeholder="예: C:\scan\folder1 또는 //server/share"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">폴더 타입</label>
                      <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        value={folderForm.folder_type}
                        onChange={(e) => setFolderForm({ ...folderForm, folder_type: e.target.value })}
                      >
                        <option value="local">로컬</option>
                        <option value="smb">SMB/네트워크</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">접근 가능 부서 (콤마로 구분)</label>
                      <Input
                        value={folderForm.dept_codes}
                        onChange={(e) => setFolderForm({ ...folderForm, dept_codes: e.target.value })}
                        placeholder="예: DEV,HR,SALES"
                      />
                    </div>
                    {folderForm.folder_type === 'smb' && (
                      <>
                        <div>
                          <label className="text-sm text-gray-600">SMB 호스트</label>
                          <Input
                            value={folderForm.smb_host}
                            onChange={(e) => setFolderForm({ ...folderForm, smb_host: e.target.value })}
                            placeholder="예: 192.168.1.100"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">SMB 공유명</label>
                          <Input
                            value={folderForm.smb_share}
                            onChange={(e) => setFolderForm({ ...folderForm, smb_share: e.target.value })}
                            placeholder="예: scan_folder"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">사용자명</label>
                          <Input
                            value={folderForm.smb_username}
                            onChange={(e) => setFolderForm({ ...folderForm, smb_username: e.target.value })}
                            placeholder="SMB 사용자명"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">비밀번호</label>
                          <Input
                            type="password"
                            value={folderForm.smb_password}
                            onChange={(e) => setFolderForm({ ...folderForm, smb_password: e.target.value })}
                            placeholder="SMB 비밀번호"
                          />
                        </div>
                      </>
                    )}
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
                    <TableHead>타입</TableHead>
                    <TableHead>접근 부서</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folders.map((folder) => (
                    <TableRow key={folder.id}>
                      <TableCell className="font-medium">{folder.alias}</TableCell>
                      <TableCell className="font-mono text-sm">{folder.path}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {folder.folder_type === 'smb' ? 'SMB' : '로컬'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {folder.dept_codes ? folder.dept_codes.split(',').map((d) => (
                          <Badge key={d} variant="secondary" className="mr-1">{d}</Badge>
                        )) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={folder.is_active ? 'success' : 'error'}>
                          {folder.is_active ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => startEditFolder(folder)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFolder(folder.id)}>
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
