# DevFlow v2 — thinkToRealization

## Project Overview
DevFlow는 Claude CLI와 함께 프로젝트를 수행하는 개발자의 "사고 흐름"을 캔버스에서 시각화하고 구조화하는 로컬 웹 애플리케이션.

## v2 Migration Status
- [x] Phase 0: v1 audit + v2 migration plan
- [x] Phase B-1: Data layer migration
- [x] Phase B-2: Session core (PTY + EventBus + StateMachine)
- [x] Phase B-3: Realtime layer (WebSocket)
- [x] Phase B-4: File watcher + decisions
- [ ] Phase B-5: Recovery + error handling
- [x] Phase F-1: Design system + layout + stores
- [x] Phase F-2: Dashboard + canvas + semantic zoom
- [ ] Phase F-3: Side panel + tabs
- [ ] Phase F-4: Terminal + session lifecycle
- [ ] Phase F-5: Decisions + business logic UI
- [ ] Phase F-6: Command palette + shortcuts + polish
- [ ] Phase INT: Integration testing

## Tech Stack (v2)
- **Framework**: Next.js 14 (App Router, TypeScript strict)
- **UI**: Radix UI Primitives + Tailwind CSS (NO shadcn/ui in v2)
- **Canvas**: @xyflow/react (React Flow)
- **State**: Zustand v5 (4 stores: UI, Canvas, Node, Session)
- **DB**: SQLite via Prisma ORM
- **Terminal**: xterm.js v5 + node-pty (WebSocket port 3001)
- **WebSocket**: ws v8
- **Command Palette**: cmdk
- **Auto-layout**: dagre
- **File Watching**: chokidar
- **Validation**: Zod
- **Font**: Inter (UI), JetBrains Mono (terminal)
- **Theme**: Warm Light (dark terminal only)

## Architecture (CRITICAL)
- **Dual Server**: Next.js (port 3000) + WebSocket server (port 3001)
- **Execution**: `concurrently "next dev" "tsx watch server/ws-server.ts"`
- **Event Flow**: PTY/fs event → EventBus → DB Write → WebSocket Push
- **State Machine**: Track A (auto: session events) + Track B (manual: user clicks)
- **Canvas**: xyflow with Dual-DOM Semantic Zoom (CSS opacity toggle, 0 React re-renders)
- **PTY Data**: EventEmitter → xterm.js direct (bypass Zustand for performance)

## Data Model (v2)
7 models: Project, Node, Edge, Session, SessionFile, Decision, NodeStateLog
- All IDs: cuid()
- Cascade delete on parent relations
- Node.parentNodeId: self-reference for frame grouping

## Key Design Decisions
- **No shadcn/ui**: Radix UI Primitives + custom styling with design tokens
- **No Framer Motion**: CSS transitions only (30KB saved)
- **Dual-DOM Nodes**: Level 1 + Level 2 simultaneously in DOM, CSS opacity toggle
- **Warm Light Theme**: #FAFAF9 background, terminal stays dark #1E1E1E
- **Side Panel 3-mode**: Closed → Peek (40%) → Full (80%)
- **Session End Prompt**: slideUp 200ms → 3s timer → fadeOut 300ms

## Design Tokens
- Background: #FAFAF9, Surface: #FFFFFF
- Accent: #4F46E5 (Indigo-600)
- Status: backlog(gray), todo(amber), in_progress(indigo), done(green), archived(gray)
- Node types: idea(amber), decision(violet), task(blue), issue(red), milestone(emerald), note(gray)

## Spec Documents
- `docs/v2-specs/uxui-spec.md` — v2 UXUI 설계서
- `docs/v2-specs/backend-spec.md` — v2 백엔드 아키텍처 설계서
- `docs/v2-specs/frontend-spec.md` — v2 프론트엔드 개발 설계서
- `docs/v2-migration-plan.md` — v1→v2 마이그레이션 계획

## Key Conventions
- Node.js v22: `source ~/.nvm/nvm.sh && nvm use 22` before any npm/node command
- Korean for UI strings, English for code/comments
- API Response: success `{data, meta}`, error `{error: {code, message, status}}`
- git commit per Phase completion

## Learnings
(To be updated during development)
