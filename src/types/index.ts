// 사용자 관련 타입
export interface User {
  id: number;
  emp_code: string;
  dept_code: string;
  company_code: string;
  name: string;
  email?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: number;
  emp_code: string;
  dept_code: string;
  company_code: string;
  name: string;
  is_admin: boolean;
}

// 폴더 관련 타입
export interface WatchFolder {
  id: number;
  path: string;
  alias: string;
  folder_type: 'smb' | 'local';
  smb_host?: string;
  smb_share?: string;
  smb_username?: string;
  smb_password?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderDeptMapping {
  id: number;
  folder_id: number;
  dept_code: string;
  created_at: string;
}

// 파일 처리 관련 타입
export type ProcessStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface FileProcess {
  id: number;
  folder_id: number;
  original_path: string;
  original_filename: string;
  new_filename?: string;
  company_name?: string;
  content_summary?: string;
  ocr_text?: string;
  status: ProcessStatus;
  error_message?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessLog {
  id: number;
  file_process_id: number;
  action: string;
  message: string;
  details?: string;
  created_at: string;
}

// API 응답 타입
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 대시보드 통계 타입
export interface DashboardStats {
  totalFiles: number;
  processedToday: number;
  pendingFiles: number;
  failedFiles: number;
  recentLogs: ProcessLog[];
}

// 검색/필터 타입
export interface FileFilter {
  status?: ProcessStatus;
  folder_id?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// SSO 관련 타입
export interface SSOParams {
  emp_code?: string;
  dept_code?: string;
  company_code?: string;
  login_id?: string;
  email?: string;
}

// 처리 큐 타입
export interface QueueItem {
  id: string;
  filePath: string;
  folderId: number;
  priority: number;
  addedAt: Date;
}
