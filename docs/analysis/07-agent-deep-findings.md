# 심층 분석 에이전트 보충 발견사항

> 6개 병렬 분석 에이전트가 발견한 추가 이슈 중 00~06 문서에 미반영된 중요 항목

---

## 백엔드 에이전트 추가 발견

### server/db/prisma.ts는 Dead Code
- 파일이 존재하지만 실제 서버 코드(`session-manager.ts`, `state-machine.ts`, `recovery-manager.ts`, `file-watcher.ts`)는 모두 `../../src/lib/prisma`를 import
- 이 파일의 Prisma 인스턴스를 사용하는 곳이 0개
- **조치**: 삭제 또는 서버 코드에서 실제 사용하도록 통일

### PTY 생성 시 기존 PTY 세션 ID 불일치 가능
- `pty-manager.ts:31-35`에서 이미 PTY가 있으면 그대로 반환하는데, 이때 `sessionId`가 다를 수 있음
- 새 세션에 대해 호출했는데 이전 세션의 PTY를 받게 되는 상황 발생 가능

### ws-server.ts는 God Object
- 이벤트 리스너 등록 + 메시지 라우팅 + 세션 오케스트레이션 + 파일 와처 시작 등 너무 많은 책임
- **권장**: MessageRouter, SessionOrchestrator, BroadcastManager로 분리

### session:start 부분 실패 시 롤백 없음
- `sessionManager.startSession()` 성공 → `ptyManager.create()` 실패 시
- DB에는 active 세션이 있지만 PTY는 없는 고아 상태 발생

### 추가 서버 파일 존재 (CLAUDE.md 미기재)
- `server/db/devflow-config.ts` — `~/.devflow/` 디렉토리 구조 관리
- `server/cli/cli-manager.ts` — Claude CLI 통합
- `server/context/context-assembler.ts` + `prompt-template.ts` — Plan 생성용 컨텍스트 조립

---

## 프론트엔드 에이전트 추가 발견

### plan-store.ts 존재 (5번째 store)
- CLAUDE.md에 "4 stores"로 명시되어 있으나 실제로는 `plan-store.ts`가 존재
- 문서와 코드 불일치

### CanvasView 430줄 과대 컴포넌트
- `handleAutoLayout`, `handleCreateNode`, `handleConnectEnd` 등 대형 핸들러가 모두 한 컴포넌트 안
- **권장**: `useCanvasHandlers(projectId)`, `useAutoLayout()` 커스텀 훅으로 분리

### window.dispatchEvent(CustomEvent) 안티 패턴
- `BaseNode.tsx:116-119`에서 handle double-click을 `window.dispatchEvent(new CustomEvent(...))` 방식으로 전달
- React의 데이터 흐름을 우회하는 안티 패턴

### CreateProjectDialog에 useState 10개
- `useReducer` 또는 `react-hook-form` 적용 권장

### viewportSaveTimer 모듈 레벨 변수
- `canvas-store.ts:41` — HMR 시 타이머 누수 가능
- Zustand 내부나 ref로 관리해야 함

### useMobile() 거의 모든 컴포넌트에서 호출
- `useSyncExternalStore` 기반이라 성능 문제는 없지만
- Context로 한 번만 계산 후 전파하는 것이 더 깔끔

---

## API 에이전트 추가 발견

### apiHandler 래퍼가 실제 0개 라우트에서 사용됨
- `api-route-handler.ts`에 래퍼가 존재하지만 **모든 라우트가 직접 try/catch 작성**
- 래퍼의 존재 의의가 없는 상태 — 적용하거나 삭제

### Session duration 계산 버그 (resume 시나리오)
- `PUT /api/sessions/[id]/end`에서 `now - startedAt`을 계산
- resume된 세션의 경우 `startedAt`이 최초 시작 시간이므로 전체 경과 시간이 이중 계산됨
- **수정**: `startedAt` 대신 마지막 resume 시점을 사용해야 함

### Dashboard priority 정렬 버그
- `priority: "desc"` — String 정렬이므로 "urgent" > "none" > "medium" > "low" > "high"
- 의도한 우선순위 정렬이 아님

### Filesystem API symlink 우회 가능
- `path.resolve` + `startsWith(ALLOWED_ROOT)` 기본 방어는 있으나
- symlink를 통한 우회 가능 — `fs.lstat`로 심볼릭 링크 체크 필요

### POST /api/nodes/[id]/context — 서버 모듈 직접 import
- `../../../../../../server/context/context-assembler` 상대경로 import
- Next.js App Router에서 server/ 디렉토리의 모듈을 직접 import — 빌드 시 번들링 문제 가능

---

## 데이터 모델 에이전트 추가 발견

### Session 종료 로직 중복
- `session-manager.ts`(WS 서버)와 `sessions/[id]/end/route.ts`(REST API) 모두 세션 종료 + 상태 전이 로직 보유
- 비즈니스 로직이 두 곳에 분산되어 불일치 위험
- **권장**: 공통 서비스 레이어로 추출

### priority default 불일치
- CLAUDE.md에는 `low|medium|high|critical`로 기술
- 실제 schema default는 `"none"` — 문서와 코드 불일치

### Node.parentNodeId에 onDelete 규칙 주의
- `parentNode`에 명시적 `onDelete` 없음 — Prisma 기본값 적용
- 부모 노드 삭제 시 자식의 `parentNodeId`가 자동 null 설정되는지 확인 필요

---

## 테스트 에이전트 추가 발견

### waitForTimeout 40+회 사용
- `waitForTimeout(500)` ~20회, `waitForTimeout(1000)` ~15회, `waitForTimeout(1500-2000)` ~5회
- 주요 flaky 원인 — `waitForSelector` 또는 `expect.poll`로 대체 필요

### user-flow-complete.spec.ts 격리 문제
- 자체 `cleanFlowData()` 사용 — `e2e-flow-` prefix
- `cleanTestData()`가 이 데이터를 삭제하지 않아 **테스트 간 데이터 누출 가능**
- `cleanFlowData()`는 soft-delete만 수행하여 실제 DB 데이터 잔류

### 환경 종속 경로
- `api-filesystem.spec.ts`: 하드코딩된 `/Users/choeseung-won/personal-project`
- `ui-project-creation.spec.ts`: 실제 파일시스템 경로에 의존
- 다른 개발 환경에서 실패

### Plans 테스트 대부분 skip
- Claude CLI 가용성에 의존하여 CI 환경에서 거의 모든 테스트가 `test.skip()` 또는 500 에러

### 프로젝트 생성 테스트 삼중 중복
- `ui-projects.spec.ts`, `ui-project-flow.spec.ts`, `ui-project-creation.spec.ts` 모두 프로젝트 생성 테스트 포함

---

## 의존성/설정 에이전트 추가 발견

### globals.css Google Fonts 이중 로드 버그
- `globals.css` 1행에 `@import url('...Inter...')`
- `layout.tsx`에서 이미 `localFont`로 Inter 로드 중
- 불필요한 외부 네트워크 요청 + FOUT 발생 가능
- **즉시 수정**: globals.css의 @import 삭제

### next.config.mjs 완전 빈 파일
- `const nextConfig = {}` — 설정이 전혀 없음
- 보안 헤더, `serverExternalPackages: ['node-pty']`, 환경변수 등 미설정

### globals.css의 `* { margin: 0; padding: 0 }` 중복
- Tailwind Preflight가 이미 리셋 처리하므로 불필요

### Tailwind content에 pages/ 경로 포함
- App Router 전용인데 `./src/pages/**/*` 스캔 — 불필요

### ESLint 최소 구성
- `no-console`, `import` 정렬, `@typescript-eslint/no-explicit-any` 등 누락

### 프로덕션 start 스크립트 불완전
- `next start`만 실행 — WebSocket 서버 미포함
- `server/ws-server.ts`가 `tsx`로만 실행 가능(TS 그대로) — 프로덕션 빌드 스크립트 없음

### highlight.js 인라인 테마 230줄
- `globals.css`에 직접 정의 — 별도 파일 분리 권장
