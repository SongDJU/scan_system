'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Search,
  RefreshCw,
  Download,
  Eye,
  Edit,
  RotateCcw,
  LogOut,
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  FolderOpen,
  FileArchive,
} from 'lucide-react';
import { formatDate, getStatusColor, getStatusText } from '@/lib/utils';
import type { UserSession, FileProcess, WatchFolder } from '@/types';

interface Stats {
  totalFiles: number;
  completedFiles: number;
  pendingFiles: number;
  processingFiles: number;
  failedFiles: number;
  existingFiles: number;
  todayProcessed: number;
  queueStatus: {
    isProcessing: boolean;
    queueLength: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [files, setFiles] = useState<(FileProcess & { folder_alias: string })[]>([]);
  const [folders, setFolders] = useState<WatchFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [editingFile, setEditingFile] = useState<number | null>(null);
  const [newFilename, setNewFilename] = useState('');

  // 사용자 정보 가져오기
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUser(data.user);
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // 데이터 가져오기
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, filesRes, foldersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch(`/api/files?status=${statusFilter}&folder_id=${folderFilter}&search=${searchTerm}&limit=50`),
        fetch('/api/folders'),
      ]);

      const [statsData, filesData, foldersData] = await Promise.all([
        statsRes.json(),
        filesRes.json(),
        foldersRes.json(),
      ]);

      if (statsData.success) setStats(statsData.data);
      if (filesData.success) setFiles(filesData.data.files);
      if (foldersData.success) setFolders(foldersData.data);
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, folderFilter, searchTerm]);

  useEffect(() => {
    if (user) {
      fetchData();
      // 5초마다 자동 새로고침
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  // 로그아웃
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // 파일명 수정
  const handleRename = async (fileId: number) => {
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_filename: newFilename }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingFile(null);
        setNewFilename('');
        fetchData();
      } else {
        alert(data.error);
      }
    } catch {
      alert('파일명 수정 중 오류가 발생했습니다.');
    }
  };

  // 재처리
  const handleReprocess = async (fileId: number) => {
    if (!confirm('이 파일을 재처리하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/files/${fileId}/reprocess`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error);
      }
    } catch {
      alert('재처리 요청 중 오류가 발생했습니다.');
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
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">PDF 자동 이름 변경 시스템</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.name} ({user.dept_code})
              {user.is_admin && <Badge variant="info" className="ml-2">관리자</Badge>}
            </span>
            {user.is_admin && (
              <Button variant="outline" size="sm" onClick={() => router.push('/admin')}>
                <Settings className="w-4 h-4 mr-1" />
                관리
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">전체 파일</p>
                    <p className="text-2xl font-bold">{stats.totalFiles}</p>
                  </div>
                  <FolderOpen className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">오늘 처리</p>
                    <p className="text-2xl font-bold text-green-600">{stats.todayProcessed}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">완료</p>
                    <p className="text-2xl font-bold text-green-600">{stats.completedFiles}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">대기 중</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pendingFiles}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">처리 중</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.processingFiles}</p>
                  </div>
                  <Loader2 className={`w-8 h-8 text-blue-400 ${stats.queueStatus.isProcessing ? 'animate-spin' : ''}`} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">실패</p>
                    <p className="text-2xl font-bold text-red-600">{stats.failedFiles}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">기존 파일</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.existingFiles}</p>
                  </div>
                  <FileArchive className="w-8 h-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 필터 및 검색 */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="파일명, 업체명으로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">전체 상태</option>
                <option value="completed">완료</option>
                <option value="pending">대기 중</option>
                <option value="processing">처리 중</option>
                <option value="failed">실패</option>
                <option value="existing">기존 파일</option>
              </select>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
              >
                <option value="">전체 폴더</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.alias}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-1" />
                새로고침
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 파일 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>파일 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상태</TableHead>
                  <TableHead>원본 파일명</TableHead>
                  <TableHead>변경된 파일명</TableHead>
                  <TableHead>업체명</TableHead>
                  <TableHead>폴더</TableHead>
                  <TableHead>처리일시</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      처리된 파일이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <Badge className={getStatusColor(file.status)}>
                          {getStatusText(file.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {file.original_filename}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {editingFile === file.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={newFilename}
                              onChange={(e) => setNewFilename(e.target.value)}
                              className="h-8 text-sm"
                              placeholder="새 파일명"
                            />
                            <Button size="sm" onClick={() => handleRename(file.id)}>저장</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingFile(null)}>취소</Button>
                          </div>
                        ) : (
                          <span className="font-medium truncate block">{file.new_filename || '-'}</span>
                        )}
                      </TableCell>
                      <TableCell>{file.company_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{file.folder_alias}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {file.processed_at ? formatDate(file.processed_at) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {(file.status === 'completed' || file.status === 'existing') && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="보기"
                                onClick={() => window.open(`/api/files/${file.id}/view`, '_blank')}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="다운로드"
                                onClick={() => window.open(`/api/files/${file.id}/download`, '_blank')}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="이름 수정"
                                onClick={() => {
                                  setEditingFile(file.id);
                                  setNewFilename(file.new_filename?.replace('.pdf', '') || '');
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {(file.status === 'failed' || file.status === 'existing') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={file.status === 'existing' ? 'AI 처리' : '재처리'}
                              onClick={() => handleReprocess(file.id)}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
