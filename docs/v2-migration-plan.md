# DevFlow v2 마이그레이션 계획서

> v1 (Stage-based Pipeline) → v2 (Node-based Canvas DAG)
> 작성일: 2026-03-01

---

## 1. 현재 상태 요약 (v1 As-Is)

### 1.1 아키텍처
| 항목 | v1 현재 |
|------|---------|
| **Framework** | Next.js 14 (App Router, TypeScript strict) |
| **UI** | shadcn/ui + Tailwind CSS (dark mode only) |
| **State** | Zustand v4 (persist middleware) |
| **DB** | SQLite via Prisma ORM |
| **Terminal** | xterm.js v5 + node-pty (WebSocket) |
| **WebSocket** | ws v8 (port 3001) |
| **Font** | JetBrains Mono (terminal), Geist (UI) |
| **서버 구조** | Dual Server — Next.js (3000) + WS (3001) |

### 1.2 데이터 모델 (Prisma, 6 models)
```
Project ──< Stage ──< Session ──< TerminalLog
                  └──< Decision (optional sessionId)
Project ──< Activity (optional stageId)
```
- 모든 ID: `cuid()` 사용
- Cascade delete 적용
- SQLite 기반 (Supabase 전환 대비 설계)

### 1.3 API 엔드포인트 (11개)
| 도메인 | 엔드포인트 | 메서드 |
|--------|-----------|--------|
| Projects | `/api/projects` | GET, POST |
| Projects | `/api/projects/:id` | GET, PATCH, DELETE |
| Stages | `/api/projects/:id/stages` | GET |
| Stages | `/api/stages/:id` | PATCH |
| Stages | `/api/stages/:id/sessions` | POST |
| Stages | `/api/stages/:id/transition` | POST |
| Sessions | `/api/sessions/:id` | GET, PATCH, DELETE |
| Sessions | `/api/sessions/:id/history` | GET |
| Decisions | `/api/decisions` | POST |
| Decisions | `/api/decisions/:id` | PATCH, DELETE |
| Activities | `/api/activities` | GET |

### 1.4 컴포넌트 (v1)
- **Dashboard**: create-project-dialog, project-card, project-grid, recent-activity-card
- **Workspace**: pipeline-bar, stage-node, stage-panel, stage-transition-modal
- **Terminal**: cli-panel, mobile-input-bar, session-history
- **Timeline**: timeline-bar
- **Shared**: app-header, pin-toast, return-banner
- **UI (shadcn)**: badge, button, card, dialog, input, resizable, scroll-area, separator, textarea, tooltip

### 1.5 Zustand Stores (3개)
| Store | 역할 |
|-------|------|
| `projectStore` | 프로젝트/스테이지 상태 |
| `sessionStore` | 세션/터미널 로그 |
| `uiStore` | UI 상태 (사이드바, 모달 등) |

---

## 2. Gap 분석

### 2.1 Prisma Schema Gap

| v1 Model | v2 Model | 변경 사항 |
|----------|----------|-----------|
| `Project` | `Project` | 필드 추가: `title`(name→), `slug`, `projectDir`, `isActive`, `canvasViewportX/Y/Zoom` |
| `Stage` | **삭제** → `Node` | 완전 대체. orderIndex 기반 선형 → canvas 좌표 기반 DAG |
| — | `Node` (신규) | `type`, `priority`, `canvasX/Y/W/H`, `parentNodeId` (self-ref), `status` 확장 |
| — | `Edge` (신규) | `fromNodeId`, `toNodeId`, `type`, `label` — DAG 관계 표현 |
| `Session` | `Session` | 부모 변경: `stageId` → `nodeId`. 필드 추가: `claudeSessionId`, `status`, `fileChangeCount`, `resumeCount`, `logFilePath`, `durationSeconds` |
| `TerminalLog` | **삭제** | `logFilePath` (파일 기반 로그)로 대체 |
| — | `SessionFile` (신규) | `filePath`, `changeType`, `detectedAt` — chokidar 파일 감시 결과 |
| `Decision` | `Decision` | 부모 변경: `stageId` → `nodeId`. 필드 추가: `promotedToNodeId` |
| `Activity` | **삭제** → `NodeStateLog` | 범용 Activity → Node 상태 전이 전용 로그로 특화 |
| — | `NodeStateLog` (신규) | `fromStatus`, `toStatus`, `triggerType`, `triggerSessionId` |

**마이그레이션 전략**: v1 데이터를 v2 스키마로 변환하는 migration script 작성. Stage → Node 1:1 매핑, Stage.orderIndex 기반으로 canvasX 자동 계산.

### 2.2 API Gap

| 카테고리 | v1 (11개) | v2 (28개) | Gap |
|----------|-----------|-----------|-----|
| Projects | 5 | 5 | PATCH → PUT, slug 지원 추가 |
| Stages→Nodes | 3 | 7 | 완전 재작성. position/status 전용 엔드포인트 추가 |
| Edges | 0 | 4 | **완전 신규** — DAG 관계 CRUD |
| Sessions | 4 | 5 | stageId → nodeId. resume, log 엔드포인트 추가 |
| Decisions | 3 | 4 | promote 엔드포인트 추가 |
| Activities→Dashboard | 1 | 1 | GET /api/activities → GET /api/projects/:pid/dashboard |
| Canvas | 0 | 2 | **완전 신규** — canvas/viewport 전용 |
| **합계** | **11** | **28** | **+17 신규, 11 수정/대체** |

### 2.3 Components Gap

| 영역 | v1 | v2 | 변경 수준 |
|------|-----|-----|----------|
| Layout | app-header | AppShell, Header, Sidebar, SidebarItem, ProjectSelector | **대폭 확장** — sidebar + project selector 추가 |
| Dashboard | 4 components | Dashboard, DashboardSection, DashboardCard | **리팩토링** — 구조 단순화 |
| Workspace→Canvas | pipeline-bar, stage-node, stage-panel, transition-modal | Canvas, CanvasControls, BaseNode (Dual-DOM), NodeLevel1/2, NodeHandle, NodeTypeSelector, 5 edge types, Frame | **완전 재작성** — xyflow 기반 |
| Terminal→Panel | cli-panel, mobile-input-bar, session-history | SidePanel, PanelHeader, 3 tabs, DecisionItem, SessionCard, SessionLogViewer, TerminalSection, TerminalView, TerminalToolbar, SessionEndPrompt | **대폭 확장** — 3-mode side panel |
| Timeline | timeline-bar | **삭제** (canvas로 대체) | 삭제 |
| Command | — | CommandPalette | **완전 신규** |
| Shared | pin-toast, return-banner | Badge, StatusDropdown, NodeTypeIcon, Toast, ContextMenu | **대폭 확장** |
| Providers | — | WebSocketProvider, ProjectProvider | **완전 신규** |

### 2.4 Dependencies Gap

#### 추가할 패키지
| 패키지 | 용도 |
|--------|------|
| `@xyflow/react` | 캔버스 (노드/엣지 렌더링) |
| `@radix-ui/react-dropdown-menu` | 드롭다운 메뉴 |
| `@radix-ui/react-tabs` | 패널 탭 |
| `@radix-ui/react-popover` | 팝오버 |
| `@radix-ui/react-context-menu` | 우클릭 컨텍스트 메뉴 |
| `cmdk` | 커맨드 팔레트 (Cmd+K) |
| `zod` | API 요청 검증 |
| `dagre` | 노드 자동 레이아웃 |
| `chokidar` | 파일 변경 감시 |
| **Inter font** | UI 폰트 (Geist 대체) |

#### 제거할 패키지
| 패키지 | 이유 |
|--------|------|
| `class-variance-authority` | Radix 직접 사용으로 불필요 |
| `react-markdown`, `remark-gfm` | 커스텀 세션 로그 뷰어 사용 |
| `dotenv` | Next.js 내장 env 처리 |

#### 유지할 패키지
next, react, react-dom, @prisma/client, prisma, zustand, ws, xterm 관련(@xterm/addon-fit, @xterm/addon-webgl), node-pty, lucide-react, date-fns, tailwindcss, tailwindcss-animate, react-resizable-panels, strip-ansi, clsx, tailwind-merge, concurrently, tsx, @playwright/test, typescript, eslint

### 2.5 Store Gap

| v1 Store | v2 Store | 변경 |
|----------|----------|------|
| `projectStore` | `NodeStore` | Stage 중심 → Node 중심으로 재작성 |
| `sessionStore` | `SessionStore` | nodeId 기반으로 전환, file tracking 추가 |
| `uiStore` | `UIStore` | side panel 3-mode, command palette 상태 추가 |
| — | `CanvasStore` (신규) | viewport, zoom, selection, xyflow 인스턴스 |

### 2.6 핵심 아키텍처 Gap (10가지)

| # | v1 | v2 | 영향도 |
|---|-----|-----|--------|
| 1 | Stage-based pipeline (선형) | Node-based canvas (DAG) | **Critical** — 전체 UI/데이터 구조 변경 |
| 2 | Dark-only theme | Warm Light theme (terminal만 dark) | **High** — 전체 CSS 토큰 재정의 |
| 3 | shadcn/ui | Radix UI Primitives 직접 사용 | **Medium** — 컴포넌트 스타일링 변경 |
| 4 | Linear pipeline | xyflow canvas + semantic zoom | **Critical** — 새 라이브러리 학습 필요 |
| 5 | Simple session list | Side Panel 3-mode (closed/peek/full) | **High** — UX 패러다임 변경 |
| 6 | No file watching | chokidar FileWatcherManager | **Medium** — 서버 사이드 신규 기능 |
| 7 | No state machine | NodeStateMachine (Track A/B) | **High** — 상태 전이 로직 전면 도입 |
| 8 | No event bus | SessionEventBus | **Medium** — 이벤트 기반 아키텍처 |
| 9 | Simple PTY spawn | PTYManager with graceful shutdown | **Medium** — 안정성 개선 |
| 10 | Raw terminal logs (DB) | Structured SessionMessage[] + logFile | **High** — 로그 저장 방식 전환 |

---

## 3. Phase별 실행 계획

### Phase 0: 마이그레이션 준비
> 예상: 1일

| 작업 | 세부 내용 |
|------|-----------|
| v2 브랜치 생성 | `git checkout -b v2-migration` |
| 디렉토리 구조 정리 | `docs/v2-specs/`에 v2 명세 정리 |
| 의존성 설치 | 추가 패키지 설치, 제거 패키지 삭제 |
| 폰트 전환 | Geist → Inter |
| Tailwind 테마 토큰 | Warm Light 테마 CSS 변수 정의 |
| Prisma v2 스키마 작성 | 7 models 정의, migration 생성 |
| v1→v2 데이터 마이그레이션 스크립트 | Stage→Node 변환, Activity→NodeStateLog 변환 |

---

### Backend Phases (B-1 ~ B-5)

#### Phase B-1: Core Data Layer
> Prisma 스키마 + 기본 CRUD API

| 작업 | 세부 내용 |
|------|-----------|
| Prisma 스키마 확정 | Project, Node, Edge, Session, SessionFile, Decision, NodeStateLog |
| DB migration | `npx prisma migrate dev --name v2-schema` |
| zod 스키마 정의 | 모든 API 요청/응답 타입에 대한 validation schema |
| Project API 재작성 | GET/POST `/api/projects`, GET/PUT/DELETE `/api/projects/:id` |
| Node CRUD API | 7개 엔드포인트 (list, create, get, update, status, position, batch-position, delete) |
| Edge CRUD API | 4개 엔드포인트 (list, create, update, delete) |
| API 응답 형식 표준화 | `{ data, error, meta }` 유지하면서 zod 검증 추가 |

#### Phase B-2: Session & Terminal Backend
> 세션 관리 + PTY 관리자

| 작업 | 세부 내용 |
|------|-----------|
| Session API 재작성 | nodeId 기반, 5개 엔드포인트 (list, create, get, end, resume) |
| PTYManager 구현 | graceful shutdown, 프로세스 풀 관리 |
| SessionMessage 구조화 | raw log → structured `SessionMessage[]` |
| logFilePath 기반 저장 | TerminalLog 테이블 대신 파일 시스템 로그 |
| Session log API | GET `/api/sessions/:id/log` — 파일에서 로그 스트리밍 |
| WebSocket 프로토콜 개선 | SessionEventBus 연동 |

#### Phase B-3: Node State Machine
> 상태 전이 로직 + 이벤트 버스

| 작업 | 세부 내용 |
|------|-----------|
| NodeStateMachine 구현 | Track A (manual), Track B (session-driven) 상태 전이 |
| NodeStateLog 자동 기록 | 모든 상태 변경 시 로그 생성 |
| SessionEventBus 구현 | 세션 이벤트 → 상태 전이 트리거 |
| Status transition validation | 유효하지 않은 전이 방지 |

#### Phase B-4: File Watching & Dashboard
> chokidar + 대시보드 API

| 작업 | 세부 내용 |
|------|-----------|
| FileWatcherManager 구현 | chokidar 기반, projectDir 감시 |
| SessionFile 자동 기록 | 파일 변경 감지 → SessionFile 레코드 생성 |
| Decision API 확장 | promote 엔드포인트 (Decision → Node 승격) |
| Dashboard API | GET `/api/projects/:pid/dashboard` — 집계 데이터 |

#### Phase B-5: Canvas Backend
> 캔버스 뷰포트 + 자동 레이아웃

| 작업 | 세부 내용 |
|------|-----------|
| Canvas API | GET `/api/projects/:pid/canvas`, PUT `/api/projects/:pid/canvas/viewport` |
| dagre 자동 레이아웃 | 신규 프로젝트 또는 요청 시 노드 자동 배치 |
| Viewport 상태 저장 | canvasViewportX/Y/Zoom 프로젝트 레벨 persist |

---

### Frontend Phases (F-1 ~ F-6)

#### Phase F-1: Layout & Theme Foundation
> AppShell + Warm Light 테마

| 작업 | 세부 내용 |
|------|-----------|
| AppShell 구현 | Header + Sidebar + Main content 레이아웃 |
| Header 컴포넌트 | 프로젝트 정보, 네비게이션 |
| Sidebar + SidebarItem | 프로젝트/노드 트리 네비게이션 |
| ProjectSelector | 프로젝트 전환 드롭다운 |
| Warm Light 테마 적용 | CSS 변수 전환, 컴포넌트 스타일 업데이트 |
| Radix UI 전환 | shadcn/ui 래퍼 제거, Radix primitives 직접 사용 |
| UIStore 재작성 | side panel 3-mode, command palette 상태 |

#### Phase F-2: Dashboard Rebuild
> 대시보드 UI 리팩토링

| 작업 | 세부 내용 |
|------|-----------|
| Dashboard 컴포넌트 | 새 레이아웃 구조 |
| DashboardSection + Card | 섹션별 카드 레이아웃 |
| Dashboard API 연동 | 집계 데이터 표시 |

#### Phase F-3: Canvas Core
> xyflow 캔버스 기본 구현

| 작업 | 세부 내용 |
|------|-----------|
| Canvas 컴포넌트 | @xyflow/react 기반 캔버스 |
| CanvasControls | 줌, 핏, 미니맵 |
| BaseNode (Dual-DOM) | DOM + SVG 듀얼 렌더링 |
| NodeLevel1 / NodeLevel2 | Semantic zoom 레벨별 노드 렌더링 |
| NodeHandle | 연결점 |
| NodeTypeSelector | 노드 타입 선택 UI |
| 5가지 Edge 타입 | 다양한 연결선 스타일 |
| Frame 컴포넌트 | 노드 그룹핑 프레임 |
| CanvasStore 구현 | viewport, zoom, selection 상태 |
| NodeStore 구현 | 노드 CRUD + 상태 관리 |

#### Phase F-4: Side Panel
> 3-mode 사이드 패널

| 작업 | 세부 내용 |
|------|-----------|
| SidePanel 컴포넌트 | closed / peek / full 3-mode |
| PanelHeader | 노드 정보 + 모드 전환 |
| Overview 탭 | 노드 상세 정보 (설명, 상태, 우선순위) |
| Sessions 탭 | 세션 목록 + SessionCard |
| Files 탭 | SessionFile 목록 (변경 파일) |
| DecisionItem | 의사결정 표시 + promote 버튼 |
| SessionLogViewer | 구조화된 세션 로그 뷰어 |

#### Phase F-5: Terminal Integration
> 터미널 UI + 세션 관리

| 작업 | 세부 내용 |
|------|-----------|
| TerminalSection | 터미널 영역 레이아웃 |
| TerminalView | xterm.js 렌더링 (dark theme 유지) |
| TerminalToolbar | 세션 제어 버튼 |
| SessionEndPrompt | 세션 종료 시 요약/결정 프롬프트 |
| SessionStore 재작성 | nodeId 기반, resume 지원 |
| WebSocketProvider | WS 연결 관리 Provider |

#### Phase F-6: Command Palette & Polish
> Cmd+K + 공유 컴포넌트

| 작업 | 세부 내용 |
|------|-----------|
| CommandPalette | cmdk 기반 글로벌 검색/액션 |
| Badge 컴포넌트 | 상태별 배지 |
| StatusDropdown | 노드 상태 변경 드롭다운 |
| NodeTypeIcon | 노드 타입별 아이콘 |
| Toast | 알림 토스트 |
| ContextMenu | 우클릭 컨텍스트 메뉴 |
| ProjectProvider | 프로젝트 컨텍스트 Provider |

---

### Phase INT: Integration & Testing
> 통합 테스트 + E2E

| 작업 | 세부 내용 |
|------|-----------|
| Backend ↔ Frontend 통합 | 모든 API 연동 검증 |
| WebSocket 통합 | 실시간 업데이트 전체 흐름 |
| E2E 테스트 작성 | Playwright — 프로젝트 생성 → 노드 추가 → 세션 실행 → 결정 기록 |
| 성능 테스트 | 대량 노드 (50+) 캔버스 렌더링 성능 |
| v1→v2 데이터 마이그레이션 검증 | 기존 데이터 정상 전환 확인 |
| v1 코드 정리 | 사용하지 않는 v1 컴포넌트/API/스토어 제거 |

---

## 4. 실행 순서 및 의존성

```
Phase 0 (준비)
  │
  ├── B-1 (Core Data) ──→ B-2 (Session/PTY) ──→ B-3 (State Machine) ──→ B-4 (FileWatch/Dashboard) ──→ B-5 (Canvas Backend)
  │                                                                                                        │
  └── F-1 (Layout/Theme) ──→ F-2 (Dashboard) ──────────────────────────────────────────────────────────────→│
                              │                                                                             │
                              └──→ F-3 (Canvas) ──→ F-4 (Side Panel) ──→ F-5 (Terminal) ──→ F-6 (Polish) ──→│
                                                                                                            │
                                                                                                            ▼
                                                                                                      Phase INT (통합)
```

**병렬 실행 가능**:
- B-1과 F-1은 동시 시작 가능 (B-1은 데이터, F-1은 레이아웃)
- B-2~B-5는 순차 (데이터 의존성)
- F-2는 F-1 완료 후 시작, B-1의 API 필요
- F-3은 F-1 + B-1 완료 후 시작
- F-4, F-5는 F-3 + B-2 완료 후 시작

---

## 5. 리스크 및 주의사항

### 5.1 High Risk

| 리스크 | 설명 | 대응 방안 |
|--------|------|-----------|
| **xyflow 학습 곡선** | Dual-DOM 렌더링, semantic zoom은 xyflow 고급 기능 | 공식 문서 + 예제 프로젝트로 선행 학습. F-3 시작 전 PoC 구현 |
| **Stage→Node 데이터 마이그레이션** | 선형 Stage를 DAG Node로 변환 시 관계 정보 손실 가능 | Stage.orderIndex 기반으로 x좌표 자동 계산, 단방향 Edge 자동 생성 |
| **shadcn→Radix 전환 공수** | 모든 UI 컴포넌트 스타일링 재작성 필요 | 우선 기존 shadcn 컴포넌트 유지하면서 점진적 전환 고려 |
| **TerminalLog → File 전환** | DB 기반 로그 조회 → 파일 기반으로 전환 시 검색/필터링 복잡도 증가 | 메타데이터는 Session 테이블에 유지, 본문만 파일로 분리 |

### 5.2 Medium Risk

| 리스크 | 설명 | 대응 방안 |
|--------|------|-----------|
| **chokidar 안정성** | 대규모 프로젝트에서 파일 감시 성능 이슈 가능 | ignore 패턴 최적화 (node_modules, .git 등), debounce 적용 |
| **NodeStateMachine 복잡도** | Track A/B 이중 상태 전이 로직 | 상태 전이 다이어그램 먼저 확정, 단위 테스트 우선 작성 |
| **WebSocket 프로토콜 변경** | v1 프로토콜과 호환 불가 | v2 전용 프로토콜 설계, 깔끔하게 전환 (호환성 유지 불필요) |
| **Warm Light 테마** | 터미널 영역만 dark 유지 → 경계 처리 필요 | CSS 변수 스코핑으로 터미널 영역 격리 |

### 5.3 Low Risk

| 리스크 | 설명 | 대응 방안 |
|--------|------|-----------|
| **cmdk 통합** | 비교적 단순한 라이브러리 | F-6에서 마지막 단계로 구현 |
| **dagre 레이아웃** | 표준적인 사용 패턴 | 공식 예제 참고 |
| **Inter 폰트 전환** | 단순 교체 | next/font로 간단 적용 |

### 5.4 주의사항

1. **SQLite 유지**: v2에서도 SQLite + Prisma 유지. Supabase 전환은 v3 이후 고려
2. **cuid() ID 유지**: 기존 ID 체계 유지하여 마이그레이션 단순화
3. **WebSocket 포트**: 3001 유지 (변경 불필요)
4. **Node.js v22**: 모든 작업 전 `source ~/.nvm/nvm.sh && nvm use 22` 필수
5. **v1 브랜치 보존**: main 브랜치에 v1 코드 보존, v2-migration 브랜치에서 작업
6. **점진적 전환**: 가능하면 v1 기능을 유지하면서 v2 기능 추가 (big bang 방지)
7. **테스트 우선**: 각 Phase 완료 시 해당 영역 테스트 작성 후 다음 Phase 진행

---

## 6. 파일 구조 변경 계획

### v2 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx                    # AppShell (신규)
│   ├── page.tsx                      # Dashboard
│   ├── project/[id]/
│   │   └── page.tsx                  # Canvas view
│   └── api/
│       ├── projects/                 # 재작성
│       ├── nodes/                    # 신규
│       ├── edges/                    # 신규
│       ├── sessions/                 # 재작성
│       └── decisions/                # 확장
├── components/
│   ├── layout/                       # AppShell, Header, Sidebar, ProjectSelector
│   ├── dashboard/                    # Dashboard, DashboardSection, DashboardCard
│   ├── canvas/                       # Canvas, BaseNode, NodeLevel1/2, Edges, Frame
│   ├── panel/                        # SidePanel, tabs, SessionLogViewer
│   │   └── terminal/                 # TerminalSection, TerminalView, TerminalToolbar
│   ├── command/                      # CommandPalette
│   ├── shared/                       # Badge, StatusDropdown, Toast, ContextMenu
│   ├── providers/                    # WebSocketProvider, ProjectProvider
│   └── ui/                           # Radix primitives (shadcn 대체)
├── stores/
│   ├── ui-store.ts                   # UIStore
│   ├── canvas-store.ts               # CanvasStore (신규)
│   ├── node-store.ts                 # NodeStore (projectStore 대체)
│   └── session-store.ts              # SessionStore (재작성)
├── lib/
│   ├── state-machine/                # NodeStateMachine (신규)
│   ├── event-bus/                    # SessionEventBus (신규)
│   ├── pty/                          # PTYManager (개선)
│   ├── file-watcher/                 # FileWatcherManager (신규)
│   └── validation/                   # zod schemas (신규)
├── types/                            # v2 타입 정의
└── server/
    └── ws-server.ts                  # WebSocket 서버 (개선)
```

---

## 7. 삭제 대상 (v1 코드)

| 카테고리 | 삭제 대상 |
|----------|-----------|
| **컴포넌트** | pipeline-bar, stage-node, stage-panel, stage-transition-modal, timeline-bar |
| **API** | `/api/stages/*`, `/api/activities` |
| **타입** | Stage 관련 타입 전체 |
| **Store** | projectStore (NodeStore로 대체) |
| **Prisma** | Stage, TerminalLog, Activity 모델 |
| **패키지** | class-variance-authority, react-markdown, remark-gfm, dotenv |
