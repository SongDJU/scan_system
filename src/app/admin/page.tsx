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
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Search,
  HardDrive,
} from 'lucide-react';
import type { UserSession, User, WatchFolder } from '@/types';

type Tab = 'folders' | 'users' | 'smb';

interface FolderWithDepts extends WatchFolder {
  dept_codes?: string;
}

interface SMBTestResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: {
    host: string;
    share: string;
    uncPath: string;
    totalFiles: number;
    pdfFiles: number;
    sampleFiles: string[];
  };
  hint?: {
    host: string;
    suggestedPath: string;
  };
}

interface SMBStatus {
  folderId: number;
  alias: string;
  host: string;
  share: string;
  uncPath: string;
  isConnected: boolean;
  error?: string;
  sampleFiles?: string[];
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

  // SMB 테스트 관련 상태
  const [smbTestForm, setSmbTestForm] = useState({
    host: '',
    share: '',
    username: '',
    password: '',
    url: '',
  });
  const [smbTestResult, setSmbTestResult] = useState<SMBTestResult | null>(null);
  const [smbTesting, setSmbTesting] = useState(false);
  const [smbStatuses, setSmbStatuses] = useState<SMBStatus[]>([]);
  const [smbStatusLoading, setSmbStatusLoading] = useState(false);

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

  // SMB 상태 확인
  const fetchSMBStatus = async () => {
    setSmbStatusLoading(true);
    try {
      const res = await fetch('/api/smb/status');
      const data = await res.json();
      if (data.success) {
        setSmbStatuses(data.data.folders);
      }
    } catch (error) {
      console.error('SMB status fetch error:', error);
    } finally {
      setSmbStatusLoading(false);
    }
  };

  // SMB 연결 테스트
  const testSMBConnection = async () => {
    setSmbTesting(true);
    setSmbTestResult(null);
    
    try {
      const res = await fetch('/api/smb/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smbTestForm),
      });
      
      const data = await res.json();
      setSmbTestResult(data);
    } catch (error) {
      setSmbTestResult({
        success: false,
        error: '연결 테스트 중 오류가 발생했습니다.',
      });
    } finally {
      setSmbTesting(false);
    }
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

  // SMB 테스트 결과로 폴더 폼 채우기
  const applyTestResultToForm = () => {
    if (smbTestResult?.success && smbTestResult.data) {
      setFolderForm({
        ...folderForm,
        folder_type: 'smb',
        smb_host: smbTestResult.data.host,
        smb_share: smbTestResult.data.share,
        smb_username: smbTestForm.username,
        smb_password: smbTestForm.password,
        path: smbTestResult.data.uncPath,
      });
      setNewFolder(true);
      setActiveTab('folders');
    }
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
          <Button
            variant={activeTab === 'smb' ? 'default' : 'outline'}
            onClick={() => { setActiveTab('smb'); fetchSMBStatus(); }}
          >
            <HardDrive className="w-4 h-4 mr-2" />
            SMB 연결
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
                        placeholder="예: C:\scan\folder1 또는 \\server\share"
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
                            placeholder="예: nas.easychem.co.kr"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-600">SMB 공유명</label>
                          <Input
                            value={folderForm.smb_share}
                            onChange={(e) => setFolderForm({ ...folderForm, smb_share: e.target.value })}
                            placeholder="예: FAX3"
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
                      <TableCell className="font-mono text-sm max-w-xs truncate">{folder.path}</TableCell>
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
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
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

        {/* SMB 연결 관리 */}
        {activeTab === 'smb' && (
          <div className="space-y-6">
            {/* SMB 연결 테스트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="w-5 h-5" />
                  SMB/NAS 연결 테스트
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-2">💡 SMB 연결 가이드</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Synology NAS의 경우 웹 인터페이스 URL(예: https://nas.easychem.co.kr:17777)이 아닌 <strong>SMB 호스트명</strong>을 입력하세요.</li>
                    <li>Windows 탐색기에서 <code className="bg-blue-100 px-1 rounded">\\nas.easychem.co.kr\FAX3</code> 형식으로 접근 가능한지 먼저 확인하세요.</li>
                    <li>호스트: <code className="bg-blue-100 px-1 rounded">nas.easychem.co.kr</code>, 공유폴더: <code className="bg-blue-100 px-1 rounded">FAX3</code></li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">호스트 (NAS IP 또는 도메인)</label>
                    <Input
                      value={smbTestForm.host}
                      onChange={(e) => setSmbTestForm({ ...smbTestForm, host: e.target.value })}
                      placeholder="예: nas.easychem.co.kr"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">공유 폴더명</label>
                    <Input
                      value={smbTestForm.share}
                      onChange={(e) => setSmbTestForm({ ...smbTestForm, share: e.target.value })}
                      placeholder="예: FAX3"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">사용자명</label>
                    <Input
                      value={smbTestForm.username}
                      onChange={(e) => setSmbTestForm({ ...smbTestForm, username: e.target.value })}
                      placeholder="예: fax"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">비밀번호</label>
                    <Input
                      type="password"
                      value={smbTestForm.password}
                      onChange={(e) => setSmbTestForm({ ...smbTestForm, password: e.target.value })}
                      placeholder="비밀번호"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={testSMBConnection} disabled={smbTesting}>
                    {smbTesting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4 mr-2" />
                    )}
                    연결 테스트
                  </Button>
                </div>

                {/* 테스트 결과 */}
                {smbTestResult && (
                  <div className={`p-4 rounded-lg ${smbTestResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-start gap-2">
                      {smbTestResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium ${smbTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {smbTestResult.success ? smbTestResult.message : '연결 실패'}
                        </p>
                        {smbTestResult.error && (
                          <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{smbTestResult.error}</p>
                        )}
                        {smbTestResult.success && smbTestResult.data && (
                          <div className="mt-2 text-sm text-green-700">
                            <p>UNC 경로: <code className="bg-green-100 px-1 rounded">{smbTestResult.data.uncPath}</code></p>
                            <p>총 파일 수: {smbTestResult.data.totalFiles}개</p>
                            <p>PDF 파일 수: {smbTestResult.data.pdfFiles}개</p>
                            {smbTestResult.data.sampleFiles.length > 0 && (
                              <div className="mt-2">
                                <p className="font-medium">샘플 PDF 파일:</p>
                                <ul className="list-disc list-inside">
                                  {smbTestResult.data.sampleFiles.map((f, i) => (
                                    <li key={i}>{f}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <Button 
                              size="sm" 
                              className="mt-3"
                              onClick={applyTestResultToForm}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              이 설정으로 폴더 추가
                            </Button>
                          </div>
                        )}
                        {smbTestResult.hint && (
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>추천 경로: <code className="bg-yellow-100 px-1 rounded">{smbTestResult.hint.suggestedPath}</code></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SMB 폴더 연결 상태 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  등록된 SMB 폴더 연결 상태
                </CardTitle>
                <Button variant="outline" onClick={fetchSMBStatus} disabled={smbStatusLoading}>
                  {smbStatusLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                {smbStatuses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    등록된 SMB 폴더가 없습니다.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>폴더 이름</TableHead>
                        <TableHead>UNC 경로</TableHead>
                        <TableHead>연결 상태</TableHead>
                        <TableHead>샘플 파일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {smbStatuses.map((status) => (
                        <TableRow key={status.folderId}>
                          <TableCell className="font-medium">{status.alias}</TableCell>
                          <TableCell className="font-mono text-sm">{status.uncPath}</TableCell>
                          <TableCell>
                            {status.isConnected ? (
                              <Badge variant="success" className="flex items-center gap-1 w-fit">
                                <Wifi className="w-3 h-3" />
                                연결됨
                              </Badge>
                            ) : (
                              <div>
                                <Badge variant="error" className="flex items-center gap-1 w-fit">
                                  <WifiOff className="w-3 h-3" />
                                  연결 실패
                                </Badge>
                                {status.error && (
                                  <p className="text-xs text-red-600 mt-1">{status.error}</p>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {status.sampleFiles && status.sampleFiles.length > 0 ? (
                              <ul className="text-sm text-gray-600">
                                {status.sampleFiles.map((f, i) => (
                                  <li key={i}>{f}</li>
                                ))}
                              </ul>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
