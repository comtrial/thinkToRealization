# ThinkToRealization v0.1 — Feature Specification

## 1. Product Overview

**ThinkToRealization**는 Claude CLI와 함께 프로젝트를 수행하는 개발자의 "사고 흐름"을 시각화하고 구조화하는 **로컬 웹 애플리케이션**입니다.

- **URL**: http://localhost:3000
- **단일 사용자**: 로컬 머신 전용 (인증 없음)
- **듀얼 서버**: Next.js (3000) + WebSocket (3001)

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────┐
│                    브라우저 (React)                      │
│   Dashboard (/)    │    Workspace (/project/[id])    │
│                    │    xterm.js (터미널 임베드)          │
│      HTTP/REST     │       WebSocket                  │
└────────┬───────────┴──────────┬───────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐   ┌────────────────────────┐
│ Next.js API (3000)│   │  WebSocket Server (3001)│
│                  │   │  PtyManager             │
│ /api/projects/*  │   │  CaptureManager         │
│ /api/stages/*    │   │    ├ ANSI stripping      │
│ /api/sessions/*  │   │    ├ 2s buffer flush     │
│ /api/decisions/* │   │    └ Async DB persist    │
│ /api/activities  │   │                          │
└────────┬─────────┘   └──────────┬──────────────┘
         │                          │
         ▼                          ▼
┌──────────────────────────────────────────────────────┐
│              Prisma ORM  →  SQLite (WAL mode)         │
│              (Supabase PostgreSQL 전환 대비)             │
└──────────────────────────────────────────────────────┘
```

---

## 3. Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | 프로젝트 목록, 최근 활동, 프로젝트 생성 |
| `/project/[id]` | Workspace | 파이프라인, 스테이지 패널, 터미널, 타임라인 |

---

## 4. Feature Details

### 4.1 Dashboard (`/`)

| Feature | Component | Description |
|---------|-----------|-------------|
| 프로젝트 목록 | `ProjectGrid` | 카드 형태로 전체 프로젝트 표시 (상태, 진행률, 현재 단계) |
| 프로젝트 카드 | `ProjectCard` | 이름, 설명, 진행 바, 현재 단계 배지, 최근 결정사항 |
| 프로젝트 생성 | `CreateProjectDialog` | 다이얼로그에서 이름/설명 입력 → 6단계 자동 생성 |
| 최근 활동 | `RecentActivityCard` | 가장 최근 업데이트된 프로젝트의 요약 카드 |
| 앱 헤더 | `AppHeader` | ThinkToRealization 로고, 네비게이션 |

### 4.2 Workspace (`/project/[id]`)

| Feature | Component | Description |
|---------|-----------|-------------|
| 파이프라인 바 | `PipelineBar` | 6단계 수평 진행 바 (클릭으로 단계 이동) |
| 스테이지 노드 | `StageNode` | 각 단계의 상태 표시 (waiting/active/completed) |
| 스테이지 패널 | `StagePanel` | 현재 단계 정보, 결정사항 목록, 이전/다음 내비게이션 |
| CLI 터미널 | `CLIPanel` | xterm.js 임베드 터미널 (라이브 세션) |
| 세션 히스토리 | `SessionHistory` | 과거 세션의 터미널 로그 읽기 전용 뷰어 |
| 단계 전환 모달 | `StageTransitionModal` | 요약 입력 후 다음 단계로 전환 |
| 핀(결정사항) | `PinToast` | Cmd+P로 결정사항 기록 → 토스트 확인 |
| 타임라인 바 | `TimelineBar` | 프로젝트 활동 이력 하단 표시 |
| 포커스 모드 | `Cmd+\` | 스테이지 패널 숨김 → 터미널 전체 화면 |
| 리사이저블 패널 | `ResizablePanelGroup` | 스테이지/터미널 패널 비율 조절 |

### 4.3 Terminal System

| Feature | Implementation | Description |
|---------|---------------|-------------|
| PTY 관리 | `PtyManager` | 세션별 node-pty 프로세스 생성/관리/30분 idle timeout |
| 출력 캡처 | `CaptureManager` | ANSI 스트리핑 + 2초 버퍼 플러시 + DB 비동기 저장 |
| WebSocket | `ws-server.ts` | 세션 연결, 입력/출력/리사이즈, 30초 heartbeat |
| 재연결 | `useTerminal` hook | 지수 백오프 (1s→30s), 최대 10회 재시도 |
| 연결 유지 | Ping/Pong | 25초 interval client ping |

---

## 5. Database ERD

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Project    │────<│    Stage      │────<│   Session    │
│─────────────│     │──────────────│     │──────────────│
│ id (cuid)   │     │ id (cuid)    │     │ id (cuid)    │
│ name        │     │ projectId FK │     │ stageId FK   │
│ description │     │ name         │     │ title        │
│ status      │     │ orderIndex   │     │ autoSummary  │
│ createdAt   │     │ status       │     │ createdAt    │
│ updatedAt   │     │ summary      │     │ updatedAt    │
└─────────────┘     │ createdAt    │     └──────┬───────┘
       │            │ updatedAt    │            │
       │            └──────┬───────┘            │
       │                   │                    │
       │            ┌──────┴───────┐     ┌──────┴───────┐
       │            │  Decision    │     │ TerminalLog  │
       │            │──────────────│     │──────────────│
       │            │ id (cuid)    │     │ id (cuid)    │
       │            │ stageId FK   │     │ sessionId FK │
       │            │ sessionId FK?│     │ role         │
       │            │ content      │     │ content      │
       │            │ context      │     │ rawLength    │
       │            │ createdAt    │     │ createdAt    │
       │            └──────────────┘     └──────────────┘
       │
       │     ┌──────────────┐
       └────<│  Activity    │
             │──────────────│
             │ id (cuid)    │
             │ projectId FK │
             │ stageId FK?  │
             │ activityType │
             │ description  │
             │ createdAt    │
             └──────────────┘
```

### Status Enums

| Model | Field | Values |
|-------|-------|--------|
| Project | status | `active`, `archived`, `completed` |
| Stage | status | `waiting`, `active`, `completed` |
| Activity | activityType | `project_created`, `stage_transition`, `session_created`, `decision_created`, `idea_addon` |
| TerminalLog | role | `user`, `assistant`, `system` |

### Default Stages (6)

| Order | Name |
|-------|------|
| 0 | 아이디어 발산 |
| 1 | 문제 정의 |
| 2 | 기능 구조화 |
| 3 | 기술 설계 |
| 4 | 구현 |
| 5 | 검증/회고 |

---

## 6. API Reference

### Response Format

```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { code: string, message: string } }
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `NOT_FOUND` | 404 | 리소스 없음 |
| `VALIDATION_ERROR` | 400 | 입력값 오류 |
| `CONFLICT` | 409 | 중복 (unique constraint) |
| `INVALID_STAGE_TRANSITION` | 400 | 잘못된 단계 전환 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

### Projects

#### `GET /api/projects`
프로젝트 목록 (진행률, 현재 단계 포함)

**Response**: `ProjectWithProgress[]`
```json
{
  "data": [{
    "id": "clxyz...",
    "name": "ThinkToRealization",
    "status": "active",
    "stages": [...],
    "currentStage": { "name": "아이디어 발산", "status": "active" },
    "progress": 0
  }]
}
```

#### `POST /api/projects`
프로젝트 생성 (6단계 + 초기 활동 원자적 생성)

**Body**: `{ name: string, description?: string }`
**Response**: `201` — Project with stages and activities

#### `GET /api/projects/[id]`
프로젝트 상세 (stages, decisions, activities 포함)

#### `PATCH /api/projects/[id]`
프로젝트 수정

**Body**: `{ name?: string, description?: string, status?: ProjectStatus }`

#### `DELETE /api/projects/[id]`
프로젝트 삭제 (cascade)

### Stages

#### `GET /api/projects/[id]/stages`
프로젝트의 단계 목록 (decisions, sessions 포함)

#### `PATCH /api/stages/[id]`
단계 수정

**Body**: `{ status?: StageStatus, summary?: string }`

#### `POST /api/stages/[id]/transition`
단계 전환 (트랜잭션, 낙관적 잠금)

**Body**:
```json
{
  "direction": "next" | "previous" | "jump",
  "summary": "단계 요약 (next일 때)",
  "targetStageId": "jump일 때 대상 단계 ID"
}
```

**Transaction**:
1. 현재 단계가 `active`인지 검증 (트랜잭션 내부 — 동시성 안전)
2. `next` → 현재: completed + summary, 대상: active
3. `previous`/`jump` → 현재: waiting, 대상: active
4. Activity 기록 (`stage_transition` 또는 `idea_addon`)
5. Project.updatedAt 갱신

### Sessions

#### `GET /api/stages/[id]/sessions`
단계별 세션 목록

#### `POST /api/stages/[id]/sessions`
새 세션 생성 (Activity 기록 포함)

**Body**: `{ title?: string }`

#### `GET /api/sessions/[id]`
세션 상세 (terminal_logs, decisions 포함)

#### `PATCH /api/sessions/[id]`
세션 수정

**Body**: `{ title?: string, autoSummary?: string }`

#### `DELETE /api/sessions/[id]`
세션 삭제

#### `GET /api/sessions/[id]/history`
터미널 로그 페이지네이션

**Query**: `?page=1&limit=50` (max 100)

**Response**:
```json
{
  "data": {
    "logs": [...],
    "pagination": { "page": 1, "limit": 50, "total": 120, "totalPages": 3 }
  }
}
```

### Decisions (Pin)

#### `POST /api/decisions`
결정사항 생성 (트랜잭션: Decision + Activity + Project.updatedAt)

**Body**: `{ stageId: string, sessionId?: string, content: string, context?: string }`

#### `PATCH /api/decisions/[id]`
결정사항 수정

**Body**: `{ content?: string, context?: string }`

#### `DELETE /api/decisions/[id]`
결정사항 삭제

### Activities

#### `GET /api/activities?projectId=xxx`
프로젝트 타임라인 (최신순)

---

## 7. WebSocket Protocol

**Endpoint**: `ws://localhost:3001/ws/terminal?sessionId=xxx`

### Client → Server

| type | fields | description |
|------|--------|-------------|
| `input` | `data: string` | 키보드 입력 |
| `resize` | `cols: number, rows: number` | 터미널 리사이즈 |
| `ping` | — | 연결 확인 (25초 interval) |

### Server → Client

| type | fields | description |
|------|--------|-------------|
| `output` | `data: string` | pty 출력 (raw ANSI) |
| `heartbeat` | — | 30초마다 |
| `pong` | — | ping 응답 |
| `error` | `message: string` | 에러 메시지 |
| `exit` | — | pty 프로세스 종료 |

### Reconnection

지수 백오프: 1s → 2s → 4s → 8s → ... 최대 30s, 최대 10회

---

## 8. Component Tree

```
RootLayout (html.dark, Geist fonts)
├── Dashboard (/)
│   ├── AppHeader
│   ├── RecentActivityCard
│   ├── CreateProjectDialog
│   │   └── Dialog (Radix)
│   └── ProjectGrid
│       └── ProjectCard (x N)
│           ├── Badge (status)
│           └── Progress bar
│
└── Workspace (/project/[id])
    ├── AppHeader (with back button, project name)
    ├── PipelineBar
    │   └── StageNode (x 6)
    ├── ResizablePanelGroup (horizontal)
    │   ├── StagePanel (left, 30%)
    │   │   ├── Stage info
    │   │   ├── Decision list
    │   │   └── Prev/Next navigation
    │   ├── ResizableHandle
    │   └── CLIPanel | SessionHistory (right, 70%)
    │       ├── CLIPanel (live session)
    │       │   └── xterm.js (useTerminal hook)
    │       └── SessionHistory (past session, read-only)
    ├── TimelineBar (bottom)
    │   └── Activity items
    ├── PinToast (overlay)
    └── StageTransitionModal (dialog)
```

---

## 9. State Management (Zustand)

| Store | Key State | Persist |
|-------|-----------|---------|
| `useProjectStore` | project, stages, activeStageId | No |
| `useSessionStore` | sessions, activeSessionId, liveSessionId | No |
| `useUIStore` | isFocusMode, isTimelineOpen, stagePanelSize | Yes (`devflow-ui`) |

---

## 10. Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+P` | 결정사항 핀 (Pin) | Workspace |
| `Cmd+\` | 포커스 모드 토글 | Workspace |
| `Cmd+Shift+N` | 새 세션 생성 | Workspace |
| `Cmd+Shift+→` | 다음 단계 전환 | Workspace |
| `Cmd+Shift+←` | 이전 단계로 이동 | Workspace |

---

## 11. Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js (App Router) | 14.2 |
| Language | TypeScript (strict) | 5.x |
| UI | React + Tailwind CSS | 18 / 3.4 |
| Components | Radix UI + shadcn/ui | Latest |
| State | Zustand | 5.x |
| DB | SQLite via Prisma ORM | 5.22 |
| Terminal | xterm.js + node-pty | 5.3 / 1.1 |
| WebSocket | ws | 8.19 |
| Icons | Lucide React | 0.575 |
| Process | concurrently | 9.x |
| Fonts | Geist (UI), JetBrains Mono (terminal) | — |
| E2E Test | Playwright | 1.58 |

---

## 12. File Structure

```
thinkToRealization/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (dark mode, fonts)
│   │   ├── page.tsx                      # Dashboard page
│   │   ├── globals.css                   # Tailwind + xterm CSS
│   │   ├── project/[id]/page.tsx         # Workspace page
│   │   └── api/                          # 11 API route files
│   │       ├── projects/route.ts         # GET, POST
│   │       ├── projects/[id]/route.ts    # GET, PATCH, DELETE
│   │       ├── projects/[id]/stages/route.ts  # GET
│   │       ├── stages/[id]/route.ts      # PATCH
│   │       ├── stages/[id]/transition/route.ts  # POST
│   │       ├── stages/[id]/sessions/route.ts    # GET, POST
│   │       ├── sessions/[id]/route.ts    # GET, PATCH, DELETE
│   │       ├── sessions/[id]/history/route.ts   # GET (paginated)
│   │       ├── decisions/route.ts        # POST
│   │       ├── decisions/[id]/route.ts   # PATCH, DELETE
│   │       └── activities/route.ts       # GET
│   ├── components/
│   │   ├── dashboard/                    # 4 components
│   │   ├── workspace/                    # 4 components
│   │   ├── terminal/                     # 2 components
│   │   ├── timeline/                     # 1 component
│   │   ├── shared/                       # 3 components
│   │   └── ui/                           # 9 shadcn components
│   ├── hooks/
│   │   ├── use-keyboard-shortcuts.ts     # 5 keyboard shortcuts
│   │   └── use-terminal.ts              # xterm.js + WebSocket hook
│   ├── stores/
│   │   ├── project-store.ts             # Project + stages state
│   │   ├── session-store.ts             # Session state
│   │   └── ui-store.ts                  # UI preferences (persisted)
│   ├── lib/
│   │   ├── prisma.ts                    # Prisma singleton + WAL pragmas
│   │   ├── prisma-error.ts             # Prisma error → API response mapper
│   │   ├── api-response.ts             # Server response helpers
│   │   ├── api-client.ts               # Client fetch wrapper
│   │   ├── terminal-history.ts          # Log rendering utility
│   │   ├── constants.ts                 # Enums, defaults, error codes
│   │   └── utils.ts                     # cn() utility
│   └── types/
│       └── index.ts                     # All TypeScript types
├── server/
│   ├── ws-server.ts                     # WebSocket server entry
│   ├── terminal/
│   │   ├── pty-manager.ts               # PTY lifecycle management
│   │   └── capture-manager.ts           # CLI output capture + DB persist
│   └── db/
│       ├── prisma.ts                    # WS server Prisma instance
│       └── capture-store.ts             # Capture data DB storage
├── prisma/
│   ├── schema.prisma                    # 6 models, indexes, cascade
│   ├── seed.ts                          # Seed data
│   └── migrations/                      # Migration files
├── docs/
│   ├── PRD.md                           # Product Requirements
│   ├── BACKEND_SPEC.md                  # Backend specification
│   ├── FRONTEND_SPEC.md                 # Frontend specification
│   └── FEATURE_SPEC.md                  # This document
└── package.json                         # Scripts, dependencies
```

---

## 13. User Flow Scenarios

### Scenario A: 새 프로젝트 시작
1. Dashboard에서 "새 프로젝트" 클릭
2. 이름/설명 입력 → 생성
3. 자동으로 6단계 생성, "아이디어 발산" 단계 active
4. 프로젝트 카드 클릭 → Workspace 진입

### Scenario B: 터미널 작업 + 결정 기록
1. Workspace에서 현재 단계의 활성 세션 확인
2. 터미널에서 Claude CLI 실행 (대화, 코딩)
3. 중요한 결정 → `Cmd+P` → 결정사항 입력 → 핀 저장
4. 스테이지 패널에서 결정사항 목록 확인

### Scenario C: 단계 전환
1. 현재 단계 작업 완료
2. `Cmd+Shift+→` 또는 "다음 단계" 버튼 클릭
3. StageTransitionModal에서 요약 입력
4. 현재 단계 → completed, 다음 단계 → active
5. 파이프라인 바 업데이트

### Scenario D: 과거 세션 리뷰
1. 스테이지 패널에서 이전 세션 선택
2. 읽기 전용 모드로 터미널 로그 조회
3. 페이지네이션으로 히스토리 탐색

---

## 14. Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | `lsof -ti:3000 \| xargs kill -9` |
| Port 3001 already in use | `lsof -ti:3001 \| xargs kill -9` |
| Prisma schema out of sync | `npx prisma migrate dev` then `npx prisma generate` |
| Terminal colors broken | Check `TERM=xterm-256color`, `COLORTERM=truecolor` in PtyManager |
| Korean input broken | Check `LANG=ko_KR.UTF-8` in PtyManager env |
| node-pty build failure | macOS: `xcode-select --install` |
| SQLite BUSY error | WAL mode + `busy_timeout=5000` (auto-configured in prisma.ts) |
| WebSocket reconnect loop | Check WS server is running on 3001, max 10 retries |
| DB not seeded | `npm run db:seed` |
| Build fails on `/_document` | App Router project — ignore Pages Router artifact |

---

## 15. NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `concurrently "next dev" "tsx watch server/ws-server.ts"` | 웹 + WS 서버 동시 실행 |
| `npm run dev:web` | `next dev` | Next.js만 실행 |
| `npm run dev:ws` | `tsx watch server/ws-server.ts` | WS 서버만 실행 |
| `npm run build` | `next build` | 프로덕션 빌드 |
| `npm run lint` | `next lint` | ESLint |
| `npm run db:seed` | `tsx prisma/seed.ts` | 시드 데이터 삽입 |
| `npm run db:migrate` | `npx prisma migrate dev` | 마이그레이션 실행 |
| `npm run db:studio` | `npx prisma studio` | Prisma Studio (DB GUI) |
