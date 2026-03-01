# v2 백엔드 아키텍처 설계서

**작성일:** 2026-03-01
**기반 문서:** v2 UXUI 설계서 + DevFlow v2 기획안
**도출 방법:** 백엔드 아키텍트 2인 심층 토론 → 설계 확정
---
## 0. 백엔드 아키텍트 팀 구성
- **🏗️ Architect A (시스템 아키텍트 — 이하 SysArch):** Electron + Next.js 데스크톱 앱의 프로세스 아키텍처 전문가. IPC 통신, PTY 관리, 이벤트 시스템, 프로세스 격리에 집중. "프론트엔드가 건드리면 안 되는 것"과 "백엔드가 보장해야 하는 계약"을 명확히 구분하는 역할.
- **🗄️ Architect B (데이터 아키텍트 — 이하 DataArch):** SQLite + Prisma + 로컬 파일시스템 기반의 데이터 레이어 전문가. 스키마 설계, 쿼리 최적화, 데이터 무결성, 마이그레이션 전략에 집중. "데이터가 어디에, 어떤 형태로, 왜 저장되는가"를 설계하는 역할.
---
## 1. 아키텍트 토론 기록
### 1.1 "Next.js 데스크톱 앱의 프로세스 모델은?"
**SysArch:** "DevFlow v2는 Electron 앱 안에서 Next.js가 돌아가는 구조다. 여기서 핵심적으로 이해해야 할 건, Electron의 Main Process와 Renderer Process 분리다. PTY(터미널), 파일 시스템 감시, SQLite 접근은 전부 Main Process에서만 가능하다. Renderer(React)는 IPC를 통해 Main에 요청하는 구조."

**DataArch:** "그런데 Next.js App Router의 Server Components와 API Routes는 어디서 돌아가나? Electron 안에서는 Next.js의 서버 사이드가 사실상 Main Process 또는 별도 로컬 서버로 동작한다."

**SysArch:** "맞다. 구조를 명확히 하자. 우리는 Next.js를 SSR로 돌리지 않는다. Electron Main Process가 로컬 HTTP 서버를 띄우고, Renderer가 그 서버와 통신한다. API Routes가 곧 백엔드다. PTY나 fs 같은 Node.js API는 API Route 핸들러 또는 Main Process IPC 핸들러에서 호출한다."

> **합의:** Electron Main Process = PTY 관리 + fs.watch + SQLite. Next.js API Routes = REST 엔드포인트 (CRUD). WebSocket 서버 = 실시간 이벤트 브로드캐스트. Renderer = React + xyflow.
---
### 1.2 "Layer 0 세션 이벤트 버스를 어떻게 구현하나?"
**SysArch:** "기획안의 Layer 0이 가장 중요한 백엔드 컴포넌트다. 이벤트 4개: SESSION_START, FILE_CHANGED, SESSION_END, SESSION_RESUME. 이 이벤트들은 Main Process에서 발생하고, Renderer로 푸시되어야 한다."

**DataArch:** "이벤트가 발생하면 두 가지가 동시에 일어나야 한다: (1) DB에 기록, (2) Renderer에 실시간 알림. DB 기록이 실패해도 UI는 업데이트되어야 하나?"

**SysArch:** "아니다. DB 기록이 곧 진실의 원천(source of truth)이다. 이벤트 발생 → DB에 먼저 기록 → 성공 시 Renderer에 브로드캐스트. DB 기록 실패 시 Renderer에 에러 알림. 이건 비관적 업데이트(pessimistic update) 패턴이다."

**DataArch:** "로컬 SQLite니까 DB 쓰기 실패는 거의 없을 거다. 하지만 원칙은 맞다. 이벤트 흐름은: PTY 이벤트 감지 → EventBus.emit() → DB 기록 → WebSocket 브로드캐스트."

> **합의:** 이벤트 흐름 = PTY/fs 이벤트 → EventBus (Node.js EventEmitter) → DB Write (Prisma) → WebSocket Push. 비관적 업데이트. DB가 source of truth.
---
### 1.3 "PTY 매니저를 어떻게 설계하나?"
**SysArch:** "PTY 매니저는 DevFlow 백엔드의 심장이다. 핵심 제약조건: (1) 노드당 활성 세션 최대 1개, (2) 사이드패널을 닫아도 PTY는 백그라운드 실행, (3) 앱 종료 시 모든 PTY를 paused로 기록, (4) claude --resume 지원."

**DataArch:** "PTY 인스턴스와 DB 세션 레코드의 생명주기를 동기화해야 한다. PTY spawn → sessions 테이블에 INSERT (status: active). PTY exit → sessions 테이블 UPDATE (status: completed). 앱 강제 종료 시? beforeunload에서 모든 active 세션을 paused로 UPDATE."

**SysArch:** "PTY 매니저의 인터페이스를 정의하자."

> **합의:** PTYManager는 싱글턴. Map<nodeId, PTYInstance>로 활성 PTY 추적. spawn/kill/resize/write/getOutput 메서드 제공. React 컴포넌트 라이프사이클과 완전 분리 (Zustand가 아닌 Main Process 메모리에서 관리).
---
### 1.4 "파일 변경 감지는 어떤 범위까지?"
**SysArch:** "chokidar로 프로젝트 디렉토리를 감시한다. 문제는 범위다. node_modules, .git, build 출력물은 제외해야 한다. 그리고 감지된 변경을 어떤 세션에 귀속시키나?"

**DataArch:** "현재 활성 세션이 있는 노드의 프로젝트 디렉토리만 감시하면 된다. 세션이 시작되면 watcher 시작, 세션이 종료되면 watcher 중지. 감지된 파일은 session_files 테이블에 INSERT."

**SysArch:** "한 가지 더. Claude CLI가 동시에 여러 파일을 변경할 수 있다. debounce를 걸어서 300ms 내의 연속 변경을 하나의 배치로 묶어야 한다. 그렇지 않으면 session_files에 수백 개의 레코드가 쌓인다."

> **합의:** FileWatcher = 세션별 인스턴스. 세션 시작 시 생성, 종료 시 파괴. 무시 패턴: node_modules, .git, dist, build, .next. debounce 300ms. 변경 배치를 session_files에 bulk insert.
---
### 1.5 "API 설계 — REST vs tRPC?"
**DataArch:** "Next.js App Router에서 API를 어떻게 노출하나? 옵션은 3가지: (1) Route Handlers (REST), (2) Server Actions, (3) tRPC."

**SysArch:** "Server Actions는 form 기반이라 우리 케이스와 안 맞다. tRPC는 타입 안전성이 좋지만 추가 의존성이다. Route Handlers가 가장 단순하고, Electron IPC와도 잘 맞는다."

**DataArch:** "동의한다. 다만 API 응답 타입은 Zod로 검증하자. tRPC 없이도 Zod + TypeScript로 타입 안전성을 확보할 수 있다."

> **합의:** Next.js Route Handlers (REST). Zod로 요청/응답 스키마 검증. 엔드포인트 네이밍은 RESTful 규칙. 실시간 데이터는 WebSocket.
---
## 2. 프로세스 아키텍처
### 2.1 전체 프로세스 다이어그램
```
┌─────────────────────────────────────────────────────────────┐
│  Electron Main Process                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    PTY Manager                         │  │
│  │  Map<nodeId, { pty, sessionId, status }>               │  │
│  │  • spawn(nodeId, cmd) → PTY                            │  │
│  │  • kill(nodeId) → void                                 │  │
│  │  • write(nodeId, data) → void                          │  │
│  │  • resize(nodeId, cols, rows) → void                   │  │
│  │  • getActivePTY(nodeId) → PTY | null                   │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │ events                                │
│  ┌───────────────────▼───────────────────────────────────┐  │
│  │              Session Event Bus                         │  │
│  │  EventEmitter: SESSION_START | SESSION_END |            │  │
│  │                FILE_CHANGED | SESSION_RESUME            │  │
│  └──────┬──────────────────────────────┬─────────────────┘  │
│         │ DB write                     │ broadcast           │
│  ┌──────▼──────────┐          ┌────────▼────────────────┐   │
│  │  Prisma Client   │          │  WebSocket Server       │   │
│  │  (SQLite)        │          │  (ws on localhost)      │   │
│  │  • nodes         │          │  • push events to       │   │
│  │  • edges         │          │    renderer             │   │
│  │  • sessions      │          │  • node state changes   │   │
│  │  • decisions     │          │  • file count updates   │   │
│  │  • session_files │          │  • session lifecycle    │   │
│  │  • node_state_log│          └─────────────────────────┘   │
│  └──────────────────┘                                        │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              File Watcher Manager                      │  │
│  │  Map<sessionId, chokidar.FSWatcher>                    │  │
│  │  • startWatching(sessionId, projectDir) → watcher      │  │
│  │  • stopWatching(sessionId) → void                      │  │
│  │  • getChanges(sessionId) → FileChange[]                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Next.js Local Server                      │  │
│  │  localhost:3000 (또는 dynamic port)                     │  │
│  │  • API Route Handlers (/api/*)                         │  │
│  │  • Static file serving                                 │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Electron Renderer Process (Chromium)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js App (React)                                   │  │
│  │  • xyflow Canvas                                       │  │
│  │  • Side Panel (Overview + Terminal)                     │  │
│  │  • Dashboard                                           │  │
│  │  • Zustand (UI state)                                  │  │
│  │  • WebSocket Client (실시간 이벤트 수신)                 │  │
│  │  • xterm.js (PTY 출력 렌더링)                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 IPC 통신 채널 정의
**Main → Renderer (Push):** WebSocket
**Renderer → Main (Request/Response):** Electron IPC (contextBridge) 또는 HTTP API

| 방향 | 채널 | 용도 | 프로토콜 |
|------|------|------|----------|
| Renderer → Main | `pty:spawn` | 새 PTY 세션 시작 | IPC invoke |
| Renderer → Main | `pty:write` | PTY에 입력 전송 | IPC send (fire-and-forget) |
| Renderer → Main | `pty:resize` | 터미널 크기 변경 | IPC send |
| Renderer → Main | `pty:kill` | PTY 세션 종료 | IPC invoke |
| Main → Renderer | `pty:data` | PTY 출력 데이터 스트림 | WebSocket |
| Main → Renderer | `event:session-start` | 세션 시작 알림 | WebSocket |
| Main → Renderer | `event:session-end` | 세션 종료 알림 | WebSocket |
| Main → Renderer | `event:file-changed` | 파일 변경 알림 | WebSocket |
| Main → Renderer | `event:node-state-changed` | 노드 상태 변경 알림 | WebSocket |
| Renderer → Main | HTTP GET/POST/PUT/DELETE | CRUD 작업 | REST API |

---
## 3. 데이터 아키텍처
### 3.1 데이터 저장소 전략

| 데이터 종류 | 저장소 | 근거 |
|------------|--------|------|
| 노드/엣지/세션 메타데이터 | SQLite (Prisma) | 관계형 데이터, 쿼리 필요 |
| 캔버스 상태 (노드 위치, 줌) | SQLite nodes 테이블 (canvas_x, canvas_y) | 노드 메타와 통합 관리 |
| 세션 대화 로그 | 로컬 md 파일 | Claude CLI 네이티브 포맷, 대용량, 토큰 비용 0 |
| 결정사항 텍스트 | SQLite decisions 테이블 | 검색/필터 필요 |
| 변경 파일 목록 | SQLite session_files 테이블 | 세션별 집계 쿼리 필요 |
| 상태 변경 이력 | SQLite node_state_log 테이블 | 감사 추적(audit trail) |
| 프로젝트 누적 맥락 | 로컬 md 파일 (_context.md) | Claude CLI가 직접 읽기 |
| 앱 설정 | SQLite 또는 electron-store | 단순 key-value |

### 3.2 Prisma 스키마 (확정)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./devflow.db"
}

// ─── 프로젝트 ─────────────────────────
model Project {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String?
  projectDir  String   // 프로젝트 루트 디렉토리 경로
    isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 캔버스 뷰포트 (프론트엔드 설계서 수정 #3)
  canvasViewportX    Float @default(0)
  canvasViewportY    Float @default(0)
  canvasViewportZoom  Float @default(1.0)

  nodes Node[]
}

// ─── 노드 ─────────────────────────────
model Node {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])

  // 타입 & 콘텐츠
  type        String   // idea, decision, task, issue, milestone, note
  title       String
  description String?
  status      String   @default("backlog") // backlog, todo, in_progress, done, archived
  priority    String   @default("none")    // none, low, medium, high, urgent

  // 캔버스 위치
  canvasX     Float    @default(0)
  canvasY     Float    @default(0)
  canvasW     Float    @default(280)
  canvasH     Float    @default(140)

  // 프레임(그룹) 귀속
  parentNodeId String?  // Group Node의 id (null이면 루트)
  parentNode   Node?    @relation("NodeChildren", fields: [parentNodeId], references: [id])
  childNodes   Node[]   @relation("NodeChildren")

  // 타임스탬프
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 관계
  sessions     Session[]
  decisions    Decision[]
  outEdges     Edge[]         @relation("EdgeFrom")
  inEdges      Edge[]         @relation("EdgeTo")
  stateLogs    NodeStateLog[]
}

// ─── 엣지 ─────────────────────────────
model Edge {
  id         String   @id @default(cuid())
  fromNodeId String
  toNodeId   String
  fromNode   Node     @relation("EdgeFrom", fields: [fromNodeId], references: [id])
  toNode     Node     @relation("EdgeTo", fields: [toNodeId], references: [id])

  type       String   @default("sequence") // sequence, dependency, related, regression, branch
  label      String?

  createdAt  DateTime @default(now())
}

// ─── 세션 ─────────────────────────────
model Session {
  id              String    @id @default(cuid())
  nodeId          String
  node            Node      @relation(fields: [nodeId], references: [id])

  claudeSessionId String?   // claude --resume 에 사용되는 Claude CLI의 세션 ID
  title           String?
  status          String    @default("active") // active, paused, completed

  fileChangeCount Int       @default(0)
  resumeCount     Int       @default(0)

  // 로그 파일 경로 (md 파일)
  logFilePath     String?   // devflow-vault/sessions/2026-03-01-xxx.md

  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  durationSeconds Int       @default(0) // 누적 활성 시간

  // 관계
  files     SessionFile[]
  decisions Decision[]
}

// ─── 세션별 변경 파일 ──────────────────
model SessionFile {
  id         String   @id @default(cuid())
  sessionId  String
  session    Session  @relation(fields: [sessionId], references: [id])

  filePath   String
  changeType String   // created, modified, deleted
  detectedAt DateTime @default(now())

  @@index([sessionId])
}

// ─── 결정사항 ─────────────────────────
model Decision {
  id              String   @id @default(cuid())
  nodeId          String
  node            Node     @relation(fields: [nodeId], references: [id])
  sessionId       String?
  session         Session? @relation(fields: [sessionId], references: [id])

  content         String   // 결정사항 텍스트
  promotedToNodeId String? // 노드 승격된 경우 새 노드 ID

  createdAt       DateTime @default(now())

  @@index([nodeId])
}

// ─── 상태 변경 이력 ───────────────────
model NodeStateLog {
  id              String   @id @default(cuid())
  nodeId          String
  node            Node     @relation(fields: [nodeId], references: [id])

  fromStatus      String?
  toStatus        String
  triggerType     String   // session_start, session_end_done, session_end_continue, user_manual, reopen
  triggerSessionId String?

  createdAt       DateTime @default(now())

  @@index([nodeId])
}
```

### 3.3 스키마 설계 노트
**DataArch의 설계 결정:**
- `Node.parentNodeId`: 프레임(Group Node) 구현을 위한 자기참조. null이면 캔버스 루트 레벨
- `Session.claudeSessionId`: Claude CLI의 자체 세션 ID. `claude --resume` 시 이 값 사용. DevFlow의 Session.id와는 별개
- `Session.logFilePath`: 세션 대화 로그는 DB가 아닌 md 파일에 저장. DB에는 파일 경로만 기록. 이유: 대화 로그는 수십KB~수MB로 커질 수 있고, 검색보다는 열람 위주
- `NodeStateLog.triggerType`: 모든 상태 변경의 원인을 추적. Track A(session_start, session_end_done 등)와 Track B(user_manual)를 구분
- `Decision.promotedToNodeId`: 결정사항에서 노드 승격 시 추적. null이면 아직 승격되지 않은 결정
---
## 4. API 엔드포인트 설계
### 4.1 엔드포인트 목록
#### 4.1.1 Projects

| Method | Path | 설명 | 요청 Body | 응답 |
|--------|------|------|----------|------|
| GET | `/api/projects` | 프로젝트 목록 | - | Project[] |
| POST | `/api/projects` | 프로젝트 생성 | `{title, slug, projectDir}` | Project |
| GET | `/api/projects/:id` | 프로젝트 상세 | - | Project + 노드 통계 |
| PUT | `/api/projects/:id` | 프로젝트 수정 | `{title?, description?}` | Project |
| DELETE | `/api/projects/:id` | 프로젝트 삭제 (soft) | - | `{success: true}` |

#### 4.1.2 Nodes

| Method | Path | 설명 | 요청 Body | 응답 |
|--------|------|------|----------|------|
| GET | `/api/projects/:pid/nodes` | 프로젝트의 전체 노드 | `?status=` (선택) | Node[] (세션/결정 카운트 포함) |
| POST | `/api/projects/:pid/nodes` | 노드 생성 | `{type, title, canvasX, canvasY, parentNodeId?}` | Node |
| GET | `/api/nodes/:id` | 노드 상세 | - | Node + sessions + decisions + edges |
| PUT | `/api/nodes/:id` | 노드 수정 | `{title?, description?, status?, priority?, canvasX?, canvasY?}` | Node |
| PUT | `/api/nodes/:id/status` | 노드 상태 변경 (Track B) | `{status, triggerType: 'user_manual'}` | Node + NodeStateLog |
| PUT | `/api/nodes/:id/position` | 노드 위치 변경 (캔버스 드래그) | `{canvasX, canvasY}` | `{success: true}` |
| PUT | `/api/nodes/positions` | 노드 위치 벌크 업데이트 | `{nodes: [{id, canvasX, canvasY}]}` | `{success: true}` |
| DELETE | `/api/nodes/:id` | 노드 아카이브 (soft delete) | - | Node (status: archived) |

#### 4.1.3 Edges

| Method | Path | 설명 | 요청 Body | 응답 |
|--------|------|------|----------|------|
| GET | `/api/projects/:pid/edges` | 프로젝트의 전체 엣지 | - | Edge[] |
| POST | `/api/edges` | 엣지 생성 | `{fromNodeId, toNodeId, type}` | Edge |
| PUT | `/api/edges/:id` | 엣지 수정 (타입 변경) | `{type?, label?}` | Edge |
| DELETE | `/api/edges/:id` | 엣지 삭제 | - | `{success: true}` |

#### 4.1.4 Sessions

| Method | Path | 설명 | 요청 Body | 응답 |
|--------|------|------|----------|------|
| GET | `/api/nodes/:nid/sessions` | 노드의 세션 목록 | - | Session[] (결정 카운트, 파일 카운트 포함) |
| POST | `/api/nodes/:nid/sessions` | 새 세션 시작 요청 | `{title?}` | Session (PTY spawn 트리거) |
| GET | `/api/sessions/:id` | 세션 상세 | - | Session + files + decisions |
| PUT | `/api/sessions/:id/end` | 세션 종료 (완료/이어서) | `{completed: boolean}` | Session + Node (상태 변경됨) |
| POST | `/api/sessions/:id/resume` | 세션 이어가기 | - | Session (PTY resume 트리거) |
| GET | `/api/sessions/:id/log` | 세션 대화 로그 | - | `{raw: string, messages: SessionMessage[]}` |

#### 4.1.5 Decisions

| Method | Path | 설명 | 요청 Body | 응답 |
|--------|------|------|----------|------|
| GET | `/api/nodes/:nid/decisions` | 노드의 결정사항 목록 | - | Decision[] |
| POST | `/api/decisions` | 결정사항 추가 (⭐) | `{nodeId, sessionId?, content}` | Decision |
| DELETE | `/api/decisions/:id` | 결정사항 해제 (⭐ 토글 off) | - | `{success: true}` |
| POST | `/api/decisions/:id/promote` | 노드 승격 | `{nodeType, title}` | `{decision: Decision, newNode: Node, newEdge: Edge}` |

#### 4.1.6 Dashboard

| Method | Path | 설명 | 응답 |
|--------|------|------|------|
| GET | `/api/projects/:pid/dashboard` | 대시보드 데이터 | `{inProgress: Node[], todo: Node[], recentDone: Node[]}` |

#### 4.1.7 Canvas State

| Method | Path | 설명 | 요청/응답 |
|--------|------|------|----------|
| GET | `/api/projects/:pid/canvas` | 캔버스 전체 상태 로드 | `{nodes: Node[], edges: Edge[], viewport: {x,y,zoom}}` |
| PUT | `/api/projects/:pid/canvas/viewport` | 뷰포트 저장 | `{x, y, zoom}` |

### 4.2 API 응답 패턴
**성공 응답:**
```json
{
  "data": { ... },
  "meta": { "timestamp": "2026-03-01T00:00:00Z" }
}
```

**에러 응답:**
```json
{
  "error": {
    "code": "NODE_NOT_FOUND",
    "message": "Node with id 'xxx' not found",
    "status": 404
  }
}
```

**에러 코드 목록:**

| 코드 | HTTP | 설명 |
|------|------|------|
| VALIDATION_ERROR | 400 | Zod 스키마 검증 실패 |
| NODE_NOT_FOUND | 404 | 노드 없음 |
| SESSION_NOT_FOUND | 404 | 세션 없음 |
| SESSION_ALREADY_ACTIVE | 409 | 해당 노드에 이미 활성 세션 존재 |
| PTY_SPAWN_FAILED | 500 | PTY 프로세스 생성 실패 |
| DB_WRITE_FAILED | 500 | SQLite 쓰기 실패 |

---
## 5. 핵심 백엔드 모듈 상세 설계
### 5.1 PTYManager
```typescript
// src/backend/pty/PTYManager.ts

interface PTYInstance {
  pty: IPty;               // node-pty 인스턴스
  sessionId: string;       // DB Session.id
  nodeId: string;
  status: 'active' | 'paused';
  startedAt: Date;
  outputBuffer: string[];  // 최근 출력 버퍼 (스크롤백)
}

class PTYManager {
  private instances: Map<string, PTYInstance> = new Map(); // key: nodeId
  private eventBus: SessionEventBus;

  // 새 세션 시작
  async spawn(nodeId: string, options: {
    sessionId: string;
    claudeSessionId?: string;  // resume일 경우
    projectDir: string;
    cols: number;
    rows: number;
  }): Promise<PTYInstance>

  // 세션 종료
  async kill(nodeId: string): Promise<void>

  // PTY에 입력 전송
  write(nodeId: string, data: string): void

  // 터미널 리사이즈
  resize(nodeId: string, cols: number, rows: number): void

  // 활성 PTY 조회
  getActive(nodeId: string): PTYInstance | null

  // 전체 활성 세션 목록
  getAllActive(): PTYInstance[]

  // 앱 종료 시 전체 정리
  async gracefulShutdown(): Promise<void>
}
```

**spawn 내부 흐름:**
1. 이미 해당 nodeId에 활성 PTY가 있는지 확인 → 있으면 SESSION_ALREADY_ACTIVE 에러
2. node-pty.spawn() 호출 (cmd: claude 또는 claude --resume)
3. pty.onData() → WebSocket으로 `pty:data` 이벤트 브로드캐스트
4. pty.onExit() → eventBus.emit('SESSION_END') 트리거
5. instances Map에 등록
6. eventBus.emit('SESSION_START') 트리거

**gracefulShutdown 흐름:**
1. 모든 활성 PTY에 SIGTERM 전송
2. 1초 대기 후 남은 프로세스에 SIGKILL
3. 모든 active 세션을 DB에서 paused로 UPDATE
4. 타이머 기반 durationSeconds 업데이트

### 5.2 SessionEventBus
```typescript
// src/backend/events/SessionEventBus.ts

type EventType =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'SESSION_RESUME'
  | 'FILE_CHANGED';

interface SessionEvent {
  type: EventType;
  nodeId: string;
  sessionId: string;
  timestamp: Date;
  payload: Record<string, any>;
}

class SessionEventBus extends EventEmitter {
  private prisma: PrismaClient;
  private wsServer: WebSocketServer;

  // 이벤트 수신 및 처리
  async handleEvent(event: SessionEvent): Promise<void> {
    // 1. DB에 기록 (source of truth)
    await this.persistEvent(event);

    // 2. 상태 머신 전이 실행
    await this.executeStateTransition(event);

    // 3. WebSocket으로 Renderer에 브로드캐스트
    this.broadcast(event);
  }

  // 상태 머신 전이 로직 (Track A)
  private async executeStateTransition(event: SessionEvent): Promise<void> {
    switch (event.type) {
      case 'SESSION_START':
      case 'SESSION_RESUME':
        // 노드 상태 → in_progress (멱등)
        await this.transitionNodeStatus(
          event.nodeId,
          'in_progress',
          event.type === 'SESSION_RESUME' ? 'reopen' : 'session_start',
          event.sessionId
        );
        break;

      case 'SESSION_END':
        // 종료 프롬프트 필요 신호만 전송 (상태 변경은 사용자 응답 후)
        this.broadcast({
          ...event,
          payload: { ...event.payload, needsCompletionPrompt: true }
        });
        break;

      case 'FILE_CHANGED':
        // 카운터만 업데이트, 상태 변경 없음
        await this.prisma.session.update({
          where: { id: event.sessionId },
          data: { fileChangeCount: { increment: event.payload.count } }
        });
        break;
    }
  }

  // 상태 전이 + 로그 기록
  private async transitionNodeStatus(
    nodeId: string,
    toStatus: string,
    triggerType: string,
    triggerSessionId?: string
  ): Promise<void> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node || node.status === toStatus) return; // 멱등

    await this.prisma.$transaction([
      this.prisma.node.update({
        where: { id: nodeId },
        data: { status: toStatus, updatedAt: new Date() }
      }),
      this.prisma.nodeStateLog.create({
        data: {
          nodeId,
          fromStatus: node.status,
          toStatus,
          triggerType,
          triggerSessionId
        }
      })
    ]);

    // 상태 변경 브로드캐스트
    this.broadcast({
      type: 'NODE_STATE_CHANGED' as any,
      nodeId,
      sessionId: triggerSessionId || '',
      timestamp: new Date(),
      payload: { fromStatus: node.status, toStatus, triggerType }
    });
  }
}
```

### 5.3 FileWatcherManager
```typescript
// src/backend/watcher/FileWatcherManager.ts

interface FileChange {
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  detectedAt: Date;
}

class FileWatcherManager {
  private watchers: Map<string, FSWatcher> = new Map(); // key: sessionId
  private changeBuffers: Map<string, FileChange[]> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventBus: SessionEventBus;

  private static IGNORE_PATTERNS = [
    'node_modules/**', '.git/**', 'dist/**', 'build/**',
    '.next/**', '*.log', '.DS_Store', 'devflow-vault/**'
  ];

  private static DEBOUNCE_MS = 300;

  async startWatching(sessionId: string, nodeId: string, projectDir: string): Promise<void> {
    if (this.watchers.has(sessionId)) return;

    const watcher = chokidar.watch(projectDir, {
      ignored: FileWatcherManager.IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 }
    });

    const handleChange = (changeType: string, filePath: string) => {
      const relativePath = path.relative(projectDir, filePath);
      const change: FileChange = {
        filePath: relativePath,
        changeType: changeType as any,
        detectedAt: new Date()
      };

      // 버퍼에 추가
      const buffer = this.changeBuffers.get(sessionId) || [];
      buffer.push(change);
      this.changeBuffers.set(sessionId, buffer);

      // debounce: 300ms 후 flush
      const existingTimer = this.debounceTimers.get(sessionId);
      if (existingTimer) clearTimeout(existingTimer);

      this.debounceTimers.set(sessionId, setTimeout(() => {
        this.flushChanges(sessionId, nodeId);
      }, FileWatcherManager.DEBOUNCE_MS));
    };

    watcher
      .on('add', (path) => handleChange('created', path))
      .on('change', (path) => handleChange('modified', path))
      .on('unlink', (path) => handleChange('deleted', path));

    this.watchers.set(sessionId, watcher);
  }

  private async flushChanges(sessionId: string, nodeId: string): Promise<void> {
    const changes = this.changeBuffers.get(sessionId) || [];
    if (changes.length === 0) return;

    // DB에 bulk insert
    await prisma.sessionFile.createMany({
      data: changes.map(c => ({
        sessionId,
        filePath: c.filePath,
        changeType: c.changeType,
        detectedAt: c.detectedAt
      }))
    });

    // 이벤트 버스로 알림
    this.eventBus.handleEvent({
      type: 'FILE_CHANGED',
      nodeId,
      sessionId,
      timestamp: new Date(),
      payload: { count: changes.length, files: changes.map(c => c.filePath) }
    });

    // 버퍼 초기화
    this.changeBuffers.set(sessionId, []);
  }

  async stopWatching(sessionId: string): Promise<void> {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(sessionId);
      this.changeBuffers.delete(sessionId);
      const timer = this.debounceTimers.get(sessionId);
      if (timer) clearTimeout(timer);
      this.debounceTimers.delete(sessionId);
    }
  }
}
```

### 5.4 NodeStateMachine
```typescript
// src/backend/state/NodeStateMachine.ts

// 상태 전이 규칙 (기획안 Section 5 그대로 코드화)
const STATE_TRANSITIONS: Record<string, Record<string, {
  to: string;
  trigger: 'track_a' | 'track_b';
}>> = {
  backlog: {
    session_start:  { to: 'in_progress', trigger: 'track_a' },
    user_manual:    { to: '*',           trigger: 'track_b' }, // 어떤 상태든 가능
  },
  todo: {
    session_start:  { to: 'in_progress', trigger: 'track_a' },
    user_manual:    { to: '*',           trigger: 'track_b' },
  },
  in_progress: {
    session_end_done:     { to: 'done',        trigger: 'track_a' },
    session_end_continue: { to: 'in_progress', trigger: 'track_a' }, // 상태 유지
    user_manual:          { to: '*',           trigger: 'track_b' },
  },
  done: {
    reopen:        { to: 'in_progress', trigger: 'track_a' }, // 세션 재시작 시
    user_manual:   { to: '*',           trigger: 'track_b' },
  },
  archived: {
    user_manual:   { to: '*',           trigger: 'track_b' },
  }
};

class NodeStateMachine {
  // 전이 가능 여부 확인
  canTransition(currentStatus: string, triggerType: string): boolean;

  // 전이 실행 (DB 업데이트 + 로그 기록)
  async transition(
    nodeId: string,
    triggerType: string,
    triggerSessionId?: string
  ): Promise<{ fromStatus: string; toStatus: string }>;

  // Track B: 사용자 수동 변경 (항상 우선)
  async manualTransition(
    nodeId: string,
    targetStatus: string
  ): Promise<{ fromStatus: string; toStatus: string }>;
}
```

**핵심 규칙:**
- `user_manual` (Track B)은 어떤 상태에서든 어떤 상태로든 전이 가능
- Track A는 정해진 규칙만 따름
- 모든 전이는 `node_state_log`에 기록
- 멱등성: 동일 상태로의 전이는 무시 (로그도 남기지 않음)
---
## 6. WebSocket 프로토콜
### 6.1 메시지 포맷
```typescript
// 서버 → 클라이언트
interface WSMessage {
  type: string;
  payload: Record<string, any>;
  timestamp: string; // ISO 8601
}
```

### 6.2 이벤트 타입

| type | payload | 설명 |
|------|---------|------|
| `pty:data` | `{nodeId, data: string}` | PTY 출력 데이터 (xterm.js로 전달) |
| `session:started` | `{nodeId, sessionId, claudeSessionId}` | 세션 시작됨 |
| `session:ended` | `{nodeId, sessionId, needsPrompt: boolean}` | 세션 종료됨 (프롬프트 필요) |
| `session:resumed` | `{nodeId, sessionId}` | 세션 재개됨 |
| `node:stateChanged` | `{nodeId, from, to, triggerType}` | 노드 상태 변경됨 |
| `node:fileCountUpdated` | `{nodeId, sessionId, count, files}` | 파일 변경 카운터 업데이트 |
| `error` | `{code, message}` | 에러 알림 |

### 6.3 Renderer → Main (WebSocket 요청)

| type | payload | 설명 |
|------|---------|------|
| `pty:input` | `{nodeId, data: string}` | PTY에 키 입력 전송 |
| `pty:resize` | `{nodeId, cols, rows}` | 터미널 리사이즈 |

---
## 7. 디렉토리 구조
```
devflow-v2/
├── electron/
│   ├── main.ts                      # Electron 메인 진입점
│   ├── preload.ts                   # contextBridge 설정
│   └── ipc/
│       ├── handlers.ts              # IPC 핸들러 등록
│       └── channels.ts              # 채널명 상수
├── src/
│   ├── backend/                     # === 백엔드 레이어 ===
│   │   ├── pty/
│   │   │   ├── PTYManager.ts
│   │   │   └── PTYManager.test.ts
│   │   ├── events/
│   │   │   ├── SessionEventBus.ts
│   │   │   └── SessionEventBus.test.ts
│   │   ├── watcher/
│   │   │   ├── FileWatcherManager.ts
│   │   │   └── FileWatcherManager.test.ts
│   │   ├── state/
│   │   │   ├── NodeStateMachine.ts
│   │   │   └── transitions.ts       # 상태 전이 규칙 상수
│   │   ├── ws/
│   │   │   └── WebSocketServer.ts
│   │   └── db/
│   │       ├── prisma.ts            # Prisma 클라이언트 싱글턴
│   │       └── seed.ts              # 시드 데이터
│   ├── app/                         # === Next.js App Router ===
│   │   ├── api/
│   │   │   ├── projects/
│   │   │   │   ├── route.ts         # GET (목록), POST (생성)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts     # GET, PUT, DELETE
│   │   │   │       ├── nodes/
│   │   │   │       │   └── route.ts
│   │   │   │       ├── edges/
│   │   │   │       │   └── route.ts
│   │   │   │       ├── dashboard/
│   │   │   │       │   └── route.ts
│   │   │   │       └── canvas/
│   │   │   │           └── route.ts
│   │   │   ├── nodes/
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── status/
│   │   │   │       │   └── route.ts
│   │   │   │       ├── sessions/
│   │   │   │       │   └── route.ts
│   │   │   │       └── decisions/
│   │   │   │           └── route.ts
│   │   │   ├── sessions/
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       ├── end/
│   │   │   │       │   └── route.ts
│   │   │   │       ├── resume/
│   │   │   │       │   └── route.ts
│   │   │   │       └── log/
│   │   │   │           └── route.ts
│   │   │   ├── edges/
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   └── decisions/
│   │   │       └── [id]/
│   │   │           ├── route.ts
│   │   │           └── promote/
│   │   │               └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/                         # === 공유 유틸 ===
│   │   ├── schemas/                 # Zod 스키마
│   │   │   ├── node.ts
│   │   │   ├── edge.ts
│   │   │   ├── session.ts
│   │   │   └── decision.ts
│   │   ├── types/                   # TypeScript 타입
│   │   │   ├── events.ts
│   │   │   ├── api.ts
│   │   │   └── ws.ts
│   │   └── constants/
│   │       ├── nodeTypes.ts
│   │       ├── edgeTypes.ts
│   │       └── statusTransitions.ts
│   └── hooks/                       # 프론트 훅 (참조용)
│       ├── useWebSocket.ts
│       └── usePTY.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── devflow-vault/                   # 로컬 md 저장소
│   └── (프로젝트별 폴더)
├── package.json
├── tsconfig.json
└── electron-builder.yml
```
---
## 8. 핵심 비즈니스 로직 흐름
### 8.1 세션 시작 전체 흐름
```
Renderer                API Route              PTYManager          EventBus          DB
  │                        │                      │                   │               │
  │ POST /api/nodes/:nid/sessions                  │                   │               │
  │───────────────────────>│                       │                   │               │
  │                        │ 1. 활성 세션 체크      │                   │               │
  │                        │──────────────────────────────────────────>│ SELECT        │
  │                        │<─────────────────────────────────────────│ (없으면 OK)   │
  │                        │                       │                   │               │
  │                        │ 2. Session INSERT     │                   │               │
  │                        │──────────────────────────────────────────>│ INSERT        │
  │                        │<─────────────────────────────────────────│ session       │
  │                        │                       │                   │               │
  │                        │ 3. PTY spawn 요청     │                   │               │
  │                        │──────────────────────>│                   │               │
  │                        │                       │ spawn claude      │               │
  │                        │                       │ pty.onData →──────│──── WS push   │
  │                        │                       │ pty.onExit →──────│──── handler   │
  │                        │                       │                   │               │
  │                        │                       │ 4. emit SESSION_START              │
  │                        │                       │──────────────────>│               │
  │                        │                       │                   │ 5. Node →     │
  │                        │                       │                   │ in_progress   │
  │                        │                       │                   │──────────────>│ UPDATE
  │                        │                       │                   │ 6. state_log  │
  │                        │                       │                   │──────────────>│ INSERT
  │                        │                       │                   │               │
  │<═══════════════════════════════════════════════════════════════════│ WS: session:started
  │<═══════════════════════════════════════════════════════════════════│ WS: node:stateChanged
  │                        │                       │                   │               │
  │ 200 OK {session}       │                       │                   │               │
  │<───────────────────────│                       │                   │               │
```

### 8.2 세션 종료 전체 흐름
```
Renderer              PTY                   EventBus            DB              Renderer
  │                    │                       │                 │                 │
  │ (사용자 exit 또는 패널 닫기)                 │                 │                 │
  │                    │ onExit()              │                 │                 │
  │                    │──────────────────────>│                 │                 │
  │                    │                       │ emit SESSION_END│                 │
  │                    │                       │────────────────>│ UPDATE session │
  │                    │                       │                 │ status=completed│
  │                    │                       │                 │ endedAt=now     │
  │                    │                       │                 │                 │
  │<═══════════════════════════════════════════│ WS: session:ended                │
  │                    │                       │ {needsPrompt:true}               │
  │                    │                       │                 │                 │
  │ 사용자 선택:        │                       │                 │                 │
  │ [작업 완료] ───────────── PUT /api/sessions/:id/end {completed:true}           │
  │                    │                       │                 │ Node→done      │
  │                    │                       │                 │ state_log INSERT│
  │<═══════════════════════════════════════════│ WS: node:stateChanged            │
  │                    │                       │                 │                 │
  │ OR                 │                       │                 │                 │
  │ [나중에 이어서] ───────── PUT /api/sessions/:id/end {completed:false}          │
  │                    │                       │                 │ (상태 유지)     │
  │                    │                       │                 │                 │
  │ OR                 │                       │                 │                 │
  │ (3초 후 무시) ─────────── (아무것도 안 함, 기본=미완료, 상태 유지)              │
```

### 8.3 결정사항 기록 + 노드 승격 흐름
```
Renderer                          API                          DB
  │                                │                            │
  │ (⭐ 클릭)                      │                            │
  │ POST /api/decisions            │                            │
  │ {nodeId, sessionId, content}   │                            │
  │───────────────────────────────>│                            │
  │                                │ INSERT decision            │
  │                                │───────────────────────────>│
  │ 201 {decision}                 │                            │
  │<───────────────────────────────│                            │
  │                                │                            │
  │ (↗ 노드로 분리 클릭)           │                            │
  │ POST /api/decisions/:id/promote│                            │
  │ {nodeType: 'task', title: ...} │                            │
  │───────────────────────────────>│                            │
  │                                │ BEGIN TRANSACTION          │
  │                                │ 1. INSERT new Node         │
  │                                │ 2. INSERT new Edge         │
  │                                │    (원본노드→새노드, sequence)│
  │                                │ 3. UPDATE decision         │
  │                                │    promotedToNodeId = new  │
  │                                │ COMMIT                     │
  │                                │───────────────────────────>│
  │ 201 {decision, newNode, newEdge}│                           │
  │<───────────────────────────────│                            │
  │                                │                            │
  │ (캔버스에 새 노드 렌더링)       │                            │
```
---
## 9. 성능 고려사항
### 9.1 SQLite 최적화
**DataArch 권고:**
- **WAL 모드 활성화:** `PRAGMA journal_mode=WAL;` — 읽기/쓰기 동시성 개선
- **인덱스 전략:** 이미 스키마에 `@@index` 적용. 추가로 nodes의 `(projectId, status)` 복합 인덱스 고려
- **노드 위치 벌크 업데이트:** 캔버스 드래그 시 30+개 노드 위치가 동시에 변경될 수 있음. 개별 UPDATE 대신 raw SQL로 CASE WHEN 벌크 업데이트
- **커넥션 풀:** SQLite는 싱글 커넥션이지만, Prisma가 내부적으로 관리. `connection_limit=1` 설정

### 9.2 PTY 출력 스트리밍
**SysArch 권고:**
- PTY 출력은 초당 수천 줄이 될 수 있음 (예: npm install 로그)
- WebSocket으로 매 바이트를 전송하면 Renderer가 과부하
- **배치 전송:** 16ms (60fps) 간격으로 출력 버퍼를 모아서 전송
- **스크롤백 제한:** outputBuffer는 최근 10,000줄만 유지

### 9.3 파일 변경 감지 최적화
- chokidar의 `awaitWriteFinish` 옵션으로 불완전한 쓰기 감지 방지
- debounce 300ms로 연속 변경 배치 처리
- 대형 프로젝트 (10,000+ 파일)에서는 watcher 메모리 사용 주의. `depth` 옵션으로 감시 깊이 제한 (기본 5)
---
## 10. 에러 핸들링 전략
### 10.1 계층별 에러 처리

| 계층 | 에러 유형 | 처리 방법 |
|------|----------|----------|
| PTY | spawn 실패 | 사용자에게 에러 토스트 + 로그. Claude CLI 설치 확인 안내 |
| PTY | 비정상 종료 (SIGKILL) | 세션을 paused로 기록 + 사용자에게 알림 |
| DB | 쓰기 실패 | 재시도 1회 → 실패 시 에러 토스트. 이벤트는 드롭 (로컬 DB라 거의 발생 안 함) |
| fs.watch | 권한 에러 | 해당 디렉토리 감시 중단 + 경고 토스트 |
| API | Zod 검증 실패 | 400 + 구체적 필드별 에러 메시지 |
| WebSocket | 연결 끊김 | 자동 재연결 (exponential backoff: 1s, 2s, 4s, max 30s) |

### 10.2 앱 비정상 종료 복구
1. 앱 시작 시 `sessions` 테이블에서 `status = 'active'`인 레코드 검색
2. 해당 세션들을 `paused`로 일괄 UPDATE
3. 대시보드에 "이전에 중단된 세션이 있습니다" 배너 표시
4. 사용자가 해당 노드를 클릭하면 `[이어서 대화]` 버튼으로 resume 가능
---
## 11. 테스트 전략
### 11.1 단위 테스트

| 모듈 | 테스트 범위 | 프레임워크 |
|------|------------|-----------|
| NodeStateMachine | 모든 상태 전이 조합 (유효/무효) | Vitest |
| SessionEventBus | 이벤트 → DB 기록 → 브로드캐스트 흐름 | Vitest + Prisma mock |
| FileWatcherManager | debounce, ignore 패턴, bulk insert | Vitest |
| API Route Handlers | 요청 검증, 응답 형식, 에러 케이스 | Vitest + supertest |

### 11.2 통합 테스트

| 시나리오 | 검증 항목 |
|---------|----------|
| 세션 시작→작업→종료 | PTY spawn → 상태 변경 → 프롬프트 → Done/Continue |
| 결정사항 ⭐→노드 승격 | Decision INSERT → Node INSERT → Edge INSERT (트랜잭션) |
| 앱 종료→재시작 | active 세션 → paused, 재시작 시 복구 알림 |
| 파일 변경 감지 | 파일 생성/수정/삭제 → debounce → session_files INSERT → 카운터 업데이트 |

---
## 12. 구현 순서 (백엔드 관점)
### Phase B-1: 데이터 레이어 (3일)
1. Prisma 스키마 작성 + 마이그레이션
2. Prisma 클라이언트 싱글턴
3. Zod 스키마 정의
4. CRUD API Routes (nodes, edges, projects)

### Phase B-2: 세션 코어 (4일)
1. PTYManager 구현 (spawn, kill, write, resize)
2. SessionEventBus 구현
3. NodeStateMachine 구현 (상태 전이 로직)
4. 세션 API Routes (start, end, resume)

### Phase B-3: 실시간 레이어 (3일)
1. WebSocket 서버 설정
2. PTY 출력 스트리밍 (배치 전송)
3. 이벤트 브로드캐스트 (상태 변경, 파일 카운터)

### Phase B-4: 파일 감시 + 결정사항 (2일)
1. FileWatcherManager 구현
2. Decision API Routes + 노드 승격 트랜잭션

### Phase B-5: 복구 + 폴리시 (2일)
1. 앱 시작 시 세션 복구 로직
2. gracefulShutdown
3. 에러 핸들링 통합
---
## 13. 프론트엔드에 대한 백엔드 계약 (API Contract)
> **이 섹션은 프론트엔드 개발자가 백엔드를 블랙박스로 취급할 수 있게 하는 계약서입니다.**

### 13.1 프론트엔드가 알아야 할 것
1. **REST API**로 CRUD 수행. 모든 응답은 `{data, meta}` 또는 `{error}` 형태
2. **WebSocket**으로 실시간 이벤트 수신. 연결 주소: `ws://localhost:{port}/ws`
3. **PTY 입출력**은 WebSocket 채널로 전달. xterm.js → `pty:input` 전송, `pty:data` 수신
4. **노드 위치 변경**은 debounce 후 `PUT /api/nodes/positions` 벌크 업데이트
5. **세션 종료 프롬프트**는 `session:ended` 이벤트의 `needsPrompt: true` 플래그로 트리거

### 13.2 프론트엔드가 몰라도 되는 것
1. PTY 프로세스 관리 (spawn, kill, 시그널)
2. 파일 변경 감지 로직 (chokidar, debounce)
3. 상태 전이 규칙의 내부 구현 (API만 호출하면 됨)
4. DB 스키마 세부사항 (API 응답 타입만 사용)
5. Electron Main/Renderer 프로세스 분리 (추상화됨)

### 13.3 프론트엔드 ↔ 백엔드 타입 공유
`src/lib/types/` 디렉토리에 공유 타입 정의. 프론트/백 모두 이 타입을 import.

```typescript
// src/lib/types/api.ts
export interface NodeResponse {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  canvasX: number;
  canvasY: number;
  sessionCount: number;      // computed
  decisionCount: number;     // computed
  fileChangeCount: number;   // computed
    hasActiveSession: boolean; // computed
  lastSessionAt: string | null;    // computed: 마지막 세션 시작 시간
  lastSessionTitle: string | null; // computed: 마지막 세션 제목
  createdAt: string;
  updatedAt: string;
}

export interface DashboardResponse {
  inProgress: NodeResponse[];
  todo: NodeResponse[];
  recentDone: NodeResponse[];
}

export interface CanvasResponse {
  nodes: NodeResponse[];
  edges: EdgeResponse[];
  viewport: { x: number; y: number; zoom: number };
}

// 프론트엔드 설계서 수정 #1: 구조화된 세션 메시지
export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  index: number;
  highlightId: string | null; // Decision.id (⭐ 마킹된 경우)
}

export interface SessionLogResponse {
  raw: string;                    // 원본 md 파일 내용
  messages: SessionMessage[];     // 파싱된 구조화 메시지 배열
}
```
---
> **이 백엔드 아키텍처 설계서는 UXUI/PRD의 모든 기능 요구사항(FR-01~FR-07)과 비기능 요구사항을 구현 가능한 수준으로 분해한 것입니다. SysArch가 프로세스 격리와 이벤트 흐름을, DataArch가 데이터 모델과 쿼리 최적화를 설계했으며, 프론트엔드 팀이 백엔드를 블랙박스로 취급할 수 있도록 명확한 API Contract를 정의했습니다.**
