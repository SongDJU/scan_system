# PDF 자동 이름 변경 시스템

OCR과 AI를 활용하여 스캔된 PDF 파일의 이름을 자동으로 변경하는 시스템입니다.

## 주요 기능

- **자동 OCR 처리**: Google Vision API를 사용하여 PDF 문서의 텍스트 추출
- **AI 문서 분석**: Google Gemini 2.5 Flash 모델로 업체명과 내용 자동 분석
- **파일명 자동 변경**: `{업체명}_{내용요약}.pdf` 형식으로 자동 변경
- **실시간 폴더 감시**: 새 파일 감지 시 즉시 처리
- **SSO 연동**: Amaranth10 그룹웨어 SSO 로그인 지원
- **부서별 권한 관리**: 부서코드 기반 폴더 접근 권한 설정
- **웹 대시보드**: 실시간 처리 현황, 로그 조회, 파일 관리

## 기술 스택

- **Frontend**: Next.js 16, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite (better-sqlite3)
- **OCR**: Google Cloud Vision API
- **AI**: Google Gemini 2.5 Flash
- **파일 감시**: Chokidar

## 설치 방법

### 1. 요구사항

- Node.js 18.x 이상
- Google Cloud 서비스 계정 (Vision API 활성화)
- Google Gemini API 키

### 2. 설치

```bash
# 저장소 클론
git clone https://github.com/SongDJU/scan_system.git
cd scan_system

# 의존성 설치
npm install

# 환경설정 파일 생성
cp .env.example .env.local
```

### 3. 환경 설정 (.env.local)

```env
# Google Cloud Vision API (서비스 계정 JSON 파일 경로)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# Google Gemini API 키
GEMINI_API_KEY=your-gemini-api-key

# JWT Secret (인증용 - 반드시 변경하세요)
JWT_SECRET=your-super-secret-jwt-key

# 초기 관리자 계정
ADMIN_EMP_CODE=admin
ADMIN_PASSWORD=your-admin-password

# 로컬 감시 폴더 설정
LOCAL_WATCH_ENABLED=true
LOCAL_WATCH_FOLDER=./data/watch

# 파일 처리 설정
BACKUP_FOLDER=./data/backup
FAILED_FOLDER=./data/failed
ORIGINAL_FOLDER=./data/original

# 파일명 최대 길이
MAX_FILENAME_LENGTH=50

# SSO 설정 (Amaranth10)
SSO_ENABLED=true
SSO_PARAM_EMP_CODE=emp_code
SSO_PARAM_DEPT_CODE=dept_code
SSO_PARAM_COMPANY_CODE=company_code
```

### 4. Google 서비스 계정 설정

1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트 생성
2. Cloud Vision API 활성화
3. 서비스 계정 생성 및 JSON 키 다운로드
4. `google-credentials.json` 파일을 프로젝트 루트에 저장

### 5. 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 빌드 및 실행
npm run build
npm start
```

## 사용 방법

### 로그인

- **관리자 로그인**: 설정한 사원코드/비밀번호로 로그인
- **SSO 로그인**: Amaranth10에서 연결된 메뉴 클릭 시 자동 로그인

### SSO 연동 설정 (Amaranth10)

Amaranth10 > 시스템설정 > 권한관리 > 메뉴설정에서:

```
URL: http://your-server:3000/api/auth/sso
방식: GET
파라미터: emp_code, dept_code, company_code
암호화: 미사용
```

### 관리자 기능

1. **폴더 관리**: 감시할 폴더 추가/수정/삭제
2. **부서 매핑**: 각 폴더에 접근 가능한 부서 설정
3. **사용자 관리**: 사용자 추가 및 관리자 권한 부여

## 폴더 구조

```
scan_system/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API 라우트
│   │   ├── admin/        # 관리자 페이지
│   │   ├── dashboard/    # 대시보드
│   │   └── login/        # 로그인 페이지
│   ├── components/       # React 컴포넌트
│   ├── lib/              # 유틸리티 라이브러리
│   └── types/            # TypeScript 타입
├── data/                 # 데이터 폴더
│   ├── watch/            # 감시 폴더
│   ├── backup/           # 원본 백업
│   ├── failed/           # 실패 파일
│   └── original/         # 원본 보관
├── .env.example          # 환경설정 예시
└── README.md
```

## API 엔드포인트

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/auth/login` | POST | 로컬 로그인 |
| `/api/auth/sso` | GET | SSO 로그인 |
| `/api/auth/logout` | POST | 로그아웃 |
| `/api/auth/me` | GET | 현재 사용자 정보 |
| `/api/files` | GET | 파일 목록 조회 |
| `/api/files/[id]` | GET/PATCH | 파일 상세/수정 |
| `/api/files/[id]/download` | GET | 파일 다운로드 |
| `/api/files/[id]/view` | GET | PDF 뷰어 |
| `/api/files/[id]/reprocess` | POST | 재처리 |
| `/api/folders` | GET/POST | 폴더 목록/생성 |
| `/api/folders/[id]` | GET/PATCH/DELETE | 폴더 관리 |
| `/api/admin/users` | GET/POST | 사용자 관리 |
| `/api/admin/stats` | GET | 대시보드 통계 |
| `/api/logs` | GET | 로그 조회 |

## 라이선스

MIT License
