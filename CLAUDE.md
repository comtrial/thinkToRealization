# DevFlow v2 — thinkToRealization

## Project Overview
DevFlow는 Claude CLI와 함께 프로젝트를 수행하는 개발자의 "사고 흐름"을 캔버스에서 시각화하고 구조화하는 **로컬 웹 애플리케이션**.
- **Path**: `/Users/choeseung-won/personal-project/thinkToRealization`
- **Git**: Yes (has `.git`)
- **NOT serverless** — localhost:3000 + WebSocket:3001 전용

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript strict) |
| UI | Radix UI Primitives + Tailwind CSS 3.4 (**NO shadcn/ui** — base ui/ 컴포넌트만 사용) |
| Canvas | @xyflow/react 12 + dagre (auto-layout) |
| State | Zustand v5 (4 stores: UI, Canvas, Node, Session) |
| DB | SQLite via Prisma 5.22 |
| Terminal | @xterm/xterm 6 + node-pty (WebSocket port 3001) |
| WebSocket | ws v8 |
| Command Palette | cmdk 1.1 |
| Validation | Zod 4 |
| File Watching | chokidar 5 |
| Font | Inter (UI), JetBrains Mono (terminal) |
| Theme | Warm Light (#FAFAF9 bg, terminal dark #1E1E1E) |
| Testing | Playwright (chromium, port 3333) |

---

## Architecture (CRITICAL)

### Dual Server
```
Next.js (port 3000) ─── REST API + SSR
WebSocket (port 3001) ── PTY I/O + Realtime events
```
- **Start**: `npm run dev` = `concurrently "next dev" "tsx watch server/ws-server.ts"`
- **Build**: `npm run build` = `next build`

### Event Flow
```
PTY/fs event → EventBus → DB Write → WebSocket Push → Client Store/Emitter
```

### PTY Data Path (Performance Critical)
```
Keystroke → xterm.onData → WS sendPTYInput → ws-server → ptyManager.write() → node-pty
node-pty output → EventBus "pty:data" → WS broadcast → ptyDataEmitter.emit() → xterm.write()
```
- PTY data bypasses Zustand — flows through `ptyDataEmitter` (EventEmitter) directly to xterm.js

### Canvas Rendering
- **Dual-DOM Semantic Zoom**: BaseNode renders compact + expanded versions simultaneously
- CSS opacity toggle at zoom threshold 0.8 — **0 React re-renders**

### State Machine (Dual-Track)
- **Track A (auto)**: Session events trigger node status transitions via defined rules
- **Track B (manual)**: user_manual trigger allows any-to-any status transition

---

## Commands
```bash
# CRITICAL: Always run this first
source ~/.nvm/nvm.sh && nvm use 22

npm run dev          # Start both Next.js + WebSocket server
npm run dev:web      # Next.js only
npm run dev:ws       # WebSocket server only
npm run build        # Production build
npm run lint         # ESLint

npm run db:migrate   # npx prisma migrate dev
npm run db:seed      # tsx prisma/seed.ts
npm run db:studio    # Prisma Studio

npx playwright test  # E2E tests (port 3333)
```

---

## Directory Structure
```
thinkToRealization/
├── prisma/
│   ├── schema.prisma          # 7 models (SQLite)
│   ├── seed.ts                # Demo data seeder
│   └── migrations/
│
├── server/                    # WebSocket server (tsx, separate process)
│   ├── ws-server.ts           # Main entry (port 3001, heartbeat 30s)
│   ├── db/
│   │   ├── prisma.ts          # Server-side Prisma client
│   │   └── capture-store.ts   # File-based log storage (.devflow-logs/)
│   ├── events/
│   │   └── event-bus.ts       # Typed EventEmitter (7 events), singleton
│   ├── terminal/
│   │   ├── pty-manager.ts     # node-pty per node, 30min idle timeout
│   │   └── capture-manager.ts # PTY output → .devflow-logs/, 2s flush
│   ├── session/
│   │   └── session-manager.ts # start/end/resume lifecycle
│   ├── state/
│   │   └── state-machine.ts   # Dual-track (A:auto + B:manual) transitions
│   ├── file-watcher/
│   │   └── file-watcher.ts    # chokidar, 300ms debounce, depth 5
│   ├── recovery/
│   │   └── recovery-manager.ts # Stale session recovery on startup
│   └── log-parser/
│       └── log-parser.ts      # Parse .log → structured messages
│
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (fonts, Providers)
│   │   ├── page.tsx           # Home (AppShell + MainContent + Terminal)
│   │   ├── globals.css        # CSS variables, animations
│   │   └── api/               # REST API routes (see API section)
│   │
│   ├── components/
│   │   ├── canvas/            # CanvasView, BaseNode, CustomEdge, CanvasContextMenu
│   │   ├── command/           # CommandPalette (cmdk)
│   │   ├── dashboard/         # DashboardView, DashboardCard, DashboardSection
│   │   ├── decisions/         # DecisionList, PromoteDialog
│   │   ├── layout/            # AppShell, Header, Sidebar, ProjectSelector, CreateProjectDialog
│   │   ├── panel/             # SidePanel (3-mode), PanelTabs, NodeDetailPanel, SessionLogViewer
│   │   ├── providers/         # Providers, ProjectProvider, WebSocketProvider
│   │   ├── shared/            # Badge, EmptyState, LoadingSkeleton, Toast, NodeTypeIcon, etc.
│   │   ├── terminal/          # TerminalPanel (xterm.js), SessionControls, SessionEndPrompt
│   │   └── ui/                # Base components (button, dialog, input, card, etc.)
│   │
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   │
│   ├── lib/
│   │   ├── utils.ts           # cn() (clsx + tailwind-merge)
│   │   ├── prisma.ts          # Singleton PrismaClient
│   │   ├── constants.ts       # Enums, ERROR_CODES, WS_PORT(3001)
│   │   ├── api-response.ts    # successResponse, errorResponse, validationError, notFound
│   │   ├── api-route-handler.ts # apiHandler wrapper
│   │   ├── prisma-error.ts    # Prisma → HTTP error mapping
│   │   ├── node-helpers.ts    # nodeWithCounts, toNodeResponse()
│   │   ├── log-parser.ts      # Client-side log parser
│   │   ├── pty-emitter.ts     # PTYDataEmitter (EventEmitter, per-nodeId)
│   │   ├── schemas/           # Zod schemas (node, project, session, edge, decision)
│   │   └── types/
│   │       └── api.ts         # Response types (NodeResponse, SessionResponse, etc.)
│   │
│   ├── stores/
│   │   ├── ui-store.ts        # Sidebar, tabs, panel mode, terminal, command palette
│   │   ├── canvas-store.ts    # Nodes, edges, undo/redo, viewport, API sync
│   │   ├── node-store.ts      # Selected node, sessions, decisions
│   │   └── session-store.ts   # Active session, session log, lifecycle
│   │
│   └── types/
│       └── index.ts           # Re-exports + legacy types
│
├── e2e/                       # Playwright tests (16 spec files)
│   ├── helpers.ts             # cleanDatabase, createTest* helpers
│   ├── api-*.spec.ts          # API endpoint tests
│   ├── ui-*.spec.ts           # UI interaction tests
│   ├── integration.spec.ts
│   └── layout.spec.ts
│
├── .devflow-logs/             # Runtime session logs ({sessionId}.log)
└── docs/                      # Spec documents
    ├── v2-specs/              # uxui-spec, backend-spec, frontend-spec
    └── v2-migration-plan.md
```

---

## Data Model (Prisma — SQLite)

```
Project ──< Node ──< Session ──< SessionFile
               │         └──< Decision
               ├──< Decision
               ├──< Edge (outEdges/inEdges)
               ├──< NodeStateLog
               └──? Node (parentNodeId self-ref)
```

### Models
| Model | Key Fields | Notes |
|-------|-----------|-------|
| **Project** | id(cuid), title, slug(unique), projectDir, isActive, canvasViewportX/Y/Zoom | Viewport persistence |
| **Node** | id, projectId(FK), type, title, status, priority, canvasX/Y/W/H, parentNodeId? | Index: [projectId, status] |
| **Edge** | id, fromNodeId(FK), toNodeId(FK), type(default:"sequence"), label? | Cascade delete on both nodes |
| **Session** | id, nodeId(FK), claudeSessionId?, status(default:"active"), fileChangeCount, resumeCount, logFilePath? | Index: [nodeId] |
| **SessionFile** | id, sessionId(FK), filePath, changeType, detectedAt | Index: [sessionId] |
| **Decision** | id, nodeId(FK), sessionId?(FK, onDelete:SetNull), content, promotedToNodeId? | Index: [nodeId] |
| **NodeStateLog** | id, nodeId(FK), fromStatus?, toStatus, triggerType, triggerSessionId? | Index: [nodeId] |

### Enums
- **Node type**: idea, task, decision, issue, milestone, note
- **Node status**: backlog, todo, in_progress, done, archived
- **Priority**: low, medium, high, critical
- **Edge type**: sequence, dependency, related, regression, branch
- **Session status**: active, paused, completed, error

### State Machine Transition Rules (Track A — auto)
```
backlog    + session_start  → in_progress
todo       + session_start  → in_progress
todo       + session_resume → in_progress
in_progress + session_end_done  → done
in_progress + session_end_pause → todo
done       + session_resume → in_progress
```

---

## API Routes

### Projects
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/projects` | List active projects |
| POST | `/api/projects` | Create (title, slug, projectDir required) |
| GET | `/api/projects/[id]` | Detail with node count |
| PUT | `/api/projects/[id]` | Update |
| DELETE | `/api/projects/[id]` | Soft delete (isActive=false) |
| GET | `/api/projects/[id]/canvas` | Canvas data (nodes + edges + viewport) |
| PUT | `/api/projects/[id]/canvas/viewport` | Save viewport |
| GET | `/api/projects/[id]/dashboard` | Dashboard data (inProgress, todo, recentDone) |
| GET | `/api/projects/[id]/nodes` | List nodes (?status= filter) |
| POST | `/api/projects/[id]/nodes` | Create node |
| GET | `/api/projects/[id]/edges` | List edges |

### Nodes
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/nodes/[id]` | Detail with sessions, decisions, edges |
| PUT | `/api/nodes/[id]` | Update fields |
| DELETE | `/api/nodes/[id]` | Archive (status=archived + state log) |
| PUT | `/api/nodes/[id]/status` | Status change with validation + state log |
| GET | `/api/nodes/[id]/sessions` | List sessions |
| POST | `/api/nodes/[id]/sessions` | Create session |
| GET | `/api/nodes/[id]/decisions` | List decisions |
| PUT | `/api/nodes/positions` | Bulk update positions |

### Edges
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/edges` | Create (validates no self-ref, no dup) |
| PUT | `/api/edges/[id]` | Update type/label |
| DELETE | `/api/edges/[id]` | Delete |

### Sessions
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sessions/[id]` | Detail with files and decisions |
| PUT | `/api/sessions/[id]/end` | End session (completed → node:done, false → node:todo) |
| POST | `/api/sessions/[id]/resume` | Resume paused session |
| GET | `/api/sessions/[id]/log` | Parsed session log |

### Decisions
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/decisions` | Create |
| DELETE | `/api/decisions/[id]` | Delete |
| POST | `/api/decisions/[id]/promote` | Promote to new node + edge |

### Other
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/recovery/sessions` | Find stale active sessions |
| POST | `/api/test/cleanup` | Hard delete all (E2E only) |

### API Response Pattern
```typescript
// Success
{ data: T, meta: { timestamp: string } }

// Error
{ error: { code: string, message: string, status: number } }

// Helpers: successResponse(), errorResponse(), validationError(), notFound(), handleApiError()
// All routes: Zod validate → Prisma operation → successResponse() / handlePrismaError()
```

---

## Zustand Stores

### ui-store.ts
```typescript
{
  sidebarOpen: boolean
  activeTab: 'dashboard' | 'canvas'
  panelMode: 'closed' | 'peek' | 'full'   // Side panel 3-mode
  panelNodeId: string | null
  panelTab: 'overview' | 'sessions' | 'files'
  terminalExpanded: boolean
  terminalHeight: number                    // 150-600px
  commandPaletteOpen: boolean
  // + toggle/set methods
}
```

### canvas-store.ts
```typescript
{
  nodes: Node[]                 // @xyflow/react Node[]
  edges: Edge[]
  undoStack: Snapshot[]         // Max 30, structuredClone snapshots
  redoStack: Snapshot[]
  initialViewport: { x, y, zoom } | null
  isZoomedIn: boolean           // zoom > 0.8 threshold
  // Key methods:
  pushSnapshot()                // Save current state, clear redo
  undo() / redo()               // Restore + reconcileWithAPI()
  loadCanvas(projectId)         // Resets stacks
  savePositions(nodes[])        // Bulk PUT
  saveViewport(projectId, vp)   // Debounced 1s
}
```

### node-store.ts
```typescript
{
  selectedNode: NodeResponse | null
  sessions: SessionResponse[]
  decisions: DecisionResponse[]
  // Key methods:
  selectNode(nodeId)            // Parallel fetch: node + sessions + decisions
  updateNodeStatus(nodeId, status)
  addDecision(nodeId, content, sessionId?)
  promoteDecision(decisionId, nodeType, title)  // Creates node + edge on canvas
}
```

### session-store.ts
```typescript
{
  activeSession: { sessionId, nodeId, claudeSessionId } | null
  sessionLog: SessionMessage[] | null
  isSessionStarting: boolean
  sessionEndPromptVisible: boolean
  // Key methods:
  startSession(nodeId, title?)  // POST API + WS
  endSession(completed)         // PUT API
  resumeSession(sessionId)      // POST API
  handleSessionStarted/Ended(payload)  // Called by WebSocket
}
```

---

## WebSocket Messages

### Client → Server
| Type | Payload | Purpose |
|------|---------|---------|
| `pty:input` | `{ nodeId, data }` | Send keystroke to PTY |
| `pty:resize` | `{ nodeId, cols, rows }` | Resize terminal |
| `session:start` | `{ nodeId, cols, rows, title?, cwd? }` | Start session |
| `session:end` | `{ nodeId, markDone }` | End session |
| `session:resume` | `{ nodeId, sessionId, cols, rows }` | Resume session |
| `ping` | — | Keepalive |

### Server → Client
| Type | Payload | Purpose |
|------|---------|---------|
| `pty:data` | `{ nodeId, data }` | PTY output |
| `pty:exit` | `{ nodeId, code }` | PTY process exit |
| `session:started` | `{ sessionId, nodeId, ... }` | Session created |
| `session:ended` | `{ sessionId, nodeId, status }` | Session ended |
| `node:stateChanged` | `{ nodeId, fromStatus, toStatus }` | Status transition |
| `node:fileCountUpdated` | `{ nodeId, count }` | File change detected |

---

## Keyboard Shortcuts
| Key | Action | Guard |
|-----|--------|-------|
| `Cmd+K` | Toggle command palette | Always |
| `Cmd+S` | Prevent browser save | Always |
| `Escape` | Close panel/dialog (palette → full → peek) | Always |
| `Cmd+Z` | Undo canvas | Not in input |
| `Cmd+Shift+Z` | Redo canvas | Not in input |
| `Cmd+1` | Dashboard tab | Not in input |
| `Cmd+2` | Canvas tab | Not in input |
| `Cmd+\` or `[` | Toggle sidebar | Not in input |
| `Cmd+Enter` | Toggle full page panel | Not in input |
| `Backspace` / `Delete` | Delete selected nodes/edges (ReactFlow) | Canvas focused |

---

## Design Tokens
```
Background: #FAFAF9    Surface: #FFFFFF       Accent: #4F46E5 (Indigo-600)
Border: #E5E5E3        Text Primary: #1A1A1A  Text Secondary: #6B6B6B

Status colors:     backlog(gray) todo(amber) in_progress(indigo) done(green) archived(gray)
Node type colors:  idea(amber) decision(violet) task(blue) issue(red) milestone(emerald) note(gray)
Terminal:          bg #1E1E1E, text #D4D4D4

Layout:  sidebar 220px, header 48px, panel-min 400px
Radius:  node(8) frame(12) button(6) badge(4) palette(12) dropdown(8)
Shadow:  elevation-1 ~ elevation-4
```

---

## Testing
- **Framework**: Playwright (chromium only, sequential, retries: 2)
- **Port**: 3333 (separate from dev)
- **16 spec files**: API tests (6) + UI tests (7) + integration + layout
- **Helpers** (`e2e/helpers.ts`): `cleanDatabase()`, `createTestProject/Node/Edge/Session/Decision()`
- **Run**: `npx playwright test`

---

## Key Conventions
1. **Node.js v22**: `source ~/.nvm/nvm.sh && nvm use 22` before ANY npm/node command
2. **Language**: Korean for UI strings, English for code and comments
3. **API Pattern**: Zod validate → Prisma → `successResponse()` / `handlePrismaError()`
4. **Optimistic Updates**: Canvas ops update local state first, then API sync
5. **Undo/Redo**: Snapshot-based with `reconcileWithAPI()` diff sync
6. **PTY Bypass**: Terminal data uses `ptyDataEmitter` (EventEmitter), NOT Zustand
7. **Dual-DOM Zoom**: BaseNode renders both compact/expanded, CSS opacity toggles at 0.8 zoom
8. **Side Panel**: 3-mode (closed → peek 40% → full 80%)
9. **Session Logs**: File-based in `.devflow-logs/{sessionId}.log`, NOT in database
10. **Singletons**: EventBus, StateMachine, SessionManager, FileWatcher, RecoveryManager
11. **Dynamic Imports**: xterm.js components use dynamic import to avoid SSR issues
12. **WebSocket Refs**: Use `useRef` for WS callbacks in useEffect deps to prevent re-mount

---

## Spec Documents
- `docs/v2-specs/uxui-spec.md` — UXUI 설계서
- `docs/v2-specs/backend-spec.md` — 백엔드 아키텍처 설계서
- `docs/v2-specs/frontend-spec.md` — 프론트엔드 개발 설계서
- `docs/v2-migration-plan.md` — v1→v2 마이그레이션 계획

---

## Post-Edit Workflow (모든 세션에서 수행 — CRITICAL)
1. 코드 수정 완료 후 항상 빌드: `source ~/.nvm/nvm.sh && nvm use 22 && cd /Users/choeseung-won/personal-project/thinkToRealization && npm run build`
2. 빌드 성공 시 Playwright 테스트: `npx playwright test`
3. 실패 시 수정 → 재빌드 → 재테스트 루프
4. **데이터 로딩 검증 (필수)**: 빌드/테스트 후 반드시 dev 서버가 살아있는지 + 데이터가 정상 로딩되는지 확인:
   ```bash
   # 4-1. Dev 서버 확인 (죽었으면 재시작)
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login || (npm run dev:web &)
   # 4-2. 로그인 + 데이터 로딩 E2E 검증
   curl -s -c /tmp/ttr-verify.txt -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@ttr.local","password":"devflow123"}'
   curl -s -b /tmp/ttr-verify.txt http://localhost:3000/api/projects  # 프로젝트 목록 확인
   # 4-3. Dashboard + Canvas 데이터 확인 (PROJECT_ID는 위 응답에서 추출)
   curl -s -b /tmp/ttr-verify.txt http://localhost:3000/api/projects/{PROJECT_ID}/dashboard
   curl -s -b /tmp/ttr-verify.txt http://localhost:3000/api/projects/{PROJECT_ID}/canvas
   ```
   - **주의**: `rm -rf .next` 실행 시 dev 서버가 죽음 → 반드시 재시작 필요
   - **인증 정보**: email=`admin@ttr.local`, password=`devflow123`, cookie=`ttr-session`
   - API 응답에 `data` 필드가 비어있거나 401이면 문제 — 즉시 해결
5. **프로덕션 DB 마이그레이션 확인 (Prisma 스키마 변경 시 필수)**:
   - DB 스키마(모델 필드 추가/삭제/변경)가 발생한 경우 반드시 실행:
   ```bash
   npm run db:check-prod          # 프로덕션 DB 스키마 drift 확인
   npm run db:migrate:prod        # drift 발견 시 프로덕션에 적용
   ```
   - **로컬은 SQLite, 프로덕션은 Supabase PostgreSQL** — `prisma migrate dev`는 로컬만 적용됨
   - 프로덕션 마이그레이션을 빠뜨리면 Vercel 배포에서 P2022(column not found) 에러 발생
   - **스키마 변경 없이 코드만 수정한 경우는 생략 가능**

---

## Learnings
- **`.next` 캐시 + dev 서버 사망 패턴**: `rm -rf .next`는 dev 서버를 즉시 죽임. `npm run build`는 별도 프로세스라 dev 서버를 재시작하지 않음. 빌드 후 반드시 dev 서버 생존 확인 + 필요시 재시작. 또한 stale `.next` 캐시는 500 에러(`Cannot find module vendor-chunks/...`) 또는 삭제된 API 라우트 참조 에러를 유발하므로 빌드 실패 시 `rm -rf .next` 후 재빌드
- **Cookie 이름 변경 시 세션 무효화**: cookie 이름을 변경하면(`devflow-session` → `ttr-session`) 기존 브라우저 세션이 모두 무효화됨. 사용자에게 재로그인 안내 필수
- **WebSocket Strict Mode 이중 연결**: `onclose` 핸들러에서 `wsRef.current !== ws` 가드 필수. cleanup 시 `ws.onclose = null` 설정 후 close하여 stale close 이벤트 방지
- **Terminal useEffect deps**: `sendPTYInput`/`sendPTYResize`를 ref로 감싸서 deps에서 제거. 그렇지 않으면 WS context 변경 시 터미널 재생성으로 이중 리스너 발생
- **Undo/Redo API 동기화**: 스냅샷 복원 후 diff 기반으로 나타난 노드(unarchive)/사라진 노드(archive)/엣지 재생성·삭제/위치 변경을 `Promise.allSettled`로 병렬 처리
- **Node 삭제 API 누락 버그**: ReactFlow의 `onNodesDelete`/`onEdgesDelete` 핸들러에서 명시적으로 `DELETE /api/nodes/:id`, `DELETE /api/edges/:id` 호출 필요. 없으면 새로고침 시 삭제한 노드 복활
- **Build 경고**: `_document` PageNotFoundError는 App Router 프로젝트에서 정상 (Pages Router 파일 없음)
- **Playwright + React controlled input**: `fill()`이나 `keyboard.type()`이 React onChange를 안정적으로 트리거하지 못할 수 있음. 확실한 방법은 `evaluate()`로 `nativeInputValueSetter` + `dispatchEvent(new Event('input', {bubbles: true}))` 사용
- **Debounced auto-save 패턴**: `useRef`로 debounce timer 관리, `useCallback([selectedNode])`로 save 함수 메모이제이션, 500ms debounce가 로컬 SQLite에 적합
- **ReactFlow onConnectEnd**: 핸들에서 빈 공간으로 드래그 시 `onConnectEnd`에서 `target.classList.contains('react-flow__handle')` 체크로 기존 연결 vs 새 노드 생성 구분
- **Decisions API 정렬**: `createdAt: "desc"` — 테스트 시 생성 순서와 표시 순서가 반대임에 주의
- **Zustand useShallow 패턴**: 전체 스토어 destructuring 금지. `useShallow((s) => ({ data1: s.data1 }))` + 함수는 `useCanvasStore((s) => s.fn)` 개별 셀렉터. 전체 구독은 무관한 상태 변경에도 리렌더 유발
- **Viewport 콜백 안정화**: `useCallback` deps에 자주 바뀌는 상태(isZoomedIn 등) 넣지 말고 `useRef`로 관리. 콜백 무한 재생성 방지
- **nodeWithCounts 분리**: Dashboard/Canvas는 `nodeCountsOnly` (카운트만), Detail은 `nodeWithCounts` (세션/플랜 데이터 포함). 서브쿼리 66% 절감
- **successResponse headers**: `successResponse(data, { headers: { "Cache-Control": "..." } })` 형태로 캐시 헤더 전달. GET 라우트에만 적용, PUT/POST/DELETE에는 미적용
- **N+1 쿼리 방지 패턴**: 루프 내 개별 findUnique 대신, 프로젝트 전체 노드를 한번에 findMany → Map으로 인메모리 조회 (context-assembler)
- **Vercel 리전 설정**: vercel.json의 `regions`를 Supabase와 동일 리전으로 (bom1=Mumbai). 크로스리전 지연 제거
- **PrismaClient globalThis 캐싱**: production 포함 모든 환경에서 `globalForPrisma.prisma = prisma` 설정 필수. Vercel 서버리스에서 매 요청 새 클라이언트 방지
