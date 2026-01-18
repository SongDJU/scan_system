import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DATABASE_PATH || './data/database.sqlite';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = path.resolve(process.cwd(), DB_PATH);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database: Database.Database) {
  // 사용자 테이블
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_code TEXT UNIQUE NOT NULL,
      dept_code TEXT NOT NULL,
      company_code TEXT DEFAULT '',
      name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 감시 폴더 테이블
  database.exec(`
    CREATE TABLE IF NOT EXISTS watch_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      alias TEXT NOT NULL,
      folder_type TEXT DEFAULT 'local',
      smb_host TEXT,
      smb_share TEXT,
      smb_username TEXT,
      smb_password TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 폴더-부서 매핑 테이블
  database.exec(`
    CREATE TABLE IF NOT EXISTS folder_dept_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL,
      dept_code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES watch_folders(id) ON DELETE CASCADE,
      UNIQUE(folder_id, dept_code)
    )
  `);

  // 파일 처리 테이블
  database.exec(`
    CREATE TABLE IF NOT EXISTS file_processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL,
      original_path TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      new_filename TEXT,
      company_name TEXT,
      content_summary TEXT,
      ocr_text TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES watch_folders(id)
    )
  `);

  // 처리 로그 테이블
  database.exec(`
    CREATE TABLE IF NOT EXISTS process_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_process_id INTEGER,
      action TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_process_id) REFERENCES file_processes(id) ON DELETE CASCADE
    )
  `);

  // 처리 상태 (재시작 복구용)
  database.exec(`
    CREATE TABLE IF NOT EXISTS processing_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      last_processed_file_id INTEGER,
      last_scan_time DATETIME,
      is_processing INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 인덱스 생성
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_file_processes_status ON file_processes(status);
    CREATE INDEX IF NOT EXISTS idx_file_processes_folder_id ON file_processes(folder_id);
    CREATE INDEX IF NOT EXISTS idx_file_processes_created_at ON file_processes(created_at);
    CREATE INDEX IF NOT EXISTS idx_process_logs_file_process_id ON process_logs(file_process_id);
    CREATE INDEX IF NOT EXISTS idx_folder_dept_mappings_dept_code ON folder_dept_mappings(dept_code);
  `);

  // 초기 관리자 계정 생성
  const adminEmpCode = process.env.ADMIN_EMP_CODE || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123!';
  
  const existingAdmin = database.prepare('SELECT id FROM users WHERE emp_code = ?').get(adminEmpCode);
  
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    database.prepare(`
      INSERT INTO users (emp_code, dept_code, company_code, name, password_hash, is_admin)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(adminEmpCode, 'ADMIN', 'SYSTEM', '시스템관리자', hashedPassword, 1);
    console.log('초기 관리자 계정 생성됨:', adminEmpCode);
  }

  // 초기 처리 상태 레코드 생성
  const existingState = database.prepare('SELECT id FROM processing_state LIMIT 1').get();
  if (!existingState) {
    database.prepare('INSERT INTO processing_state (last_processed_file_id, is_processing) VALUES (0, 0)').run();
  }
}

// 유틸리티 함수들
export function addLog(fileProcessId: number | null, action: string, message: string, details?: string) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO process_logs (file_process_id, action, message, details)
    VALUES (?, ?, ?, ?)
  `).run(fileProcessId, action, message, details || null);
}

export function updateProcessingState(lastFileId: number, isProcessing: boolean) {
  const db = getDatabase();
  db.prepare(`
    UPDATE processing_state 
    SET last_processed_file_id = ?, 
        last_scan_time = CURRENT_TIMESTAMP,
        is_processing = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(lastFileId, isProcessing ? 1 : 0);
}

export function getLastProcessingState() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM processing_state WHERE id = 1').get() as {
    last_processed_file_id: number;
    last_scan_time: string;
    is_processing: number;
  } | undefined;
}

export default getDatabase;
