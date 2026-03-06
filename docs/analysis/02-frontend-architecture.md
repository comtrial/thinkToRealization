# 프론트엔드 아키텍처 상세 분석

## 1. Zustand Store 분석

### 1.1 ui-store.ts (8/10)

**좋은 점:**
- 단순하고 명확한 UI 상태 관리
- 3-mode 패널 (closed → peek → full) 설계 우수
- SSR 안전한 `window` 체크 (`typeof window !== 'undefined'`)

**이슈:**
- `openPanel()`이 항상 `panelTab: 'overview'`로 리셋 — 사용자가 다른 탭에 있었을 때 UX 저하 가능
- `terminalHeight` 범위 검증 없음 (150-600px 제한은 UI에서만 적용)

### 1.2 canvas-store.ts (7/10)

**좋은 점:**
- **Undo/Redo**: `structuredClone` 기반 스냅샷 + `reconcileWithAPI()` diff 동기화 — 매우 잘 설계됨
- Optimistic update 패턴 (로컬 먼저 → API 동기화)
- 뷰포트 저장 1초 debounce
- 모바일 히스토리 크기 조절 (`getMaxHistory`)

**이슈:**
- **[H4] `reconcileWithAPI()`에서 fetch 직접 사용** — API 클라이언트 레이어 없이 raw fetch. 에러 핸들링 최소 (console.error만)
- `onConnect`에서 edge 매칭 로직(`!e.data` 조건)이 fragile — 동시에 여러 연결 생성 시 오매칭 가능
- `viewportSaveTimer`가 모듈 레벨 변수 — 여러 프로젝트 전환 시 이전 타이머 누출 가능
- `loadCanvas`에서 에러 시 빈 상태로 남음 — 에러 상태 없음

### 1.3 node-store.ts (7/10)

**좋은 점:**
- `selectNode`에서 3개 API 병렬 호출 (`Promise.all`)
- 중복 요청 방지 가드 (isLoading + 같은 nodeId 체크)
- `promoteDecision`이 캔버스에 노드+엣지 자동 추가

**이슈:**
- **[H4] canvas-store 직접 참조**: `useCanvasStore.getState()` 직접 호출 — store 간 결합도 높음
  ```
  권장: 이벤트 기반 또는 미들웨어 패턴으로 store 간 통신
  ```
- `addSubIssue`가 node-store에 있으나 대부분 canvas 조작 — 책임 경계 불명확
- `selectNode`에서 하나의 API 실패 시 나머지도 무시될 수 있음 (`Promise.all` vs `Promise.allSettled`)

### 1.4 session-store.ts (7/10)

**좋은 점:**
- WS 이벤트 핸들러(`handleSessionStarted/Ended`)와 API 호출 분리
- `sessionEndPromptVisible` 상태로 세션 종료 프롬프트 관리
- 깔끔한 인터페이스

**이슈:**
- `startSession`이 API 호출로 세션 생성 후 WS를 통해 PTY 시작하지 않음 — `WebSocketProvider.sendSessionStart`와 역할 중복/혼동
- `endSession` 성공 시 `activeSession: null` 설정하지만, WS에서 `session:ended` 이벤트도 올 수 있어 이중 처리
- `sessionLog`이 null | SessionMessage[] — 로딩 상태 구분 불가

---

## 2. 컴포넌트 아키텍처 분석

### 2.1 컴포넌트 계층
```
Providers (WebSocket, Project, ReactFlow)
└── AppShell
    ├── Header (ProjectSelector, 탭 전환)
    ├── Sidebar (프로젝트 목록)
    ├── MainContent
    │   ├── DashboardView
    │   │   ├── DashboardSection
    │   │   └── DashboardCard
    │   └── CanvasView
    │       ├── BaseNode (memo)
    │       ├── CustomEdge
    │       └── CanvasContextMenu
    ├── SidePanel (3-mode)
    │   ├── NodeDetailPanel
    │   ├── PanelTabs
    │   ├── DecisionList + PromoteDialog
    │   ├── SessionLogViewer
    │   └── PlanTab + PlanViewer
    ├── TerminalPanel (xterm.js)
    │   ├── SessionControls
    │   └── SessionEndPrompt
    └── CommandPalette (cmdk)
```

### 2.2 BaseNode.tsx (8/10)

**좋은 점:**
- **Dual-DOM Semantic Zoom**: CompactNode + ExpandedNode를 동시 렌더, CSS opacity 전환 — 0 React 리렌더 성능 최적화
- `memo()` 적용으로 불필요한 리렌더 방지
- 모바일 대응 핸들 크기 조절
- HandleWithPlus의 더블클릭 → CustomEvent 발행 — 느슨한 결합

**이슈:**
- `data as unknown as NodeData` 타입 캐스팅 — ReactFlow의 타입 제네릭 활용 가능
- `priorityColorMap`에 `urgent` 키 존재하나 스키마에는 `critical` — 불일치 가능

### 2.3 WebSocketProvider.tsx (8/10)

**좋은 점:**
- 지수 백오프 재연결 (`Math.min(1000 * 2^n, 30000)`)
- `intentionalClose` 플래그로 의도적 close와 비의도적 close 구분
- `onclose = null` 설정 후 close — stale close 이벤트 방지 (CLAUDE.md Learnings 반영)
- 모든 send 함수 `useCallback`으로 메모이제이션
- 재연결 시 canvas 데이터 자동 리로드

**이슈:**
- 재연결 시 활성 세션 상태 복원 없음 — 터미널 내용 유실
- WS readyState 체크 없이 `send()` 호출 — 연결 안 된 상태에서 에러 가능
- `window.location.hostname` 사용 — SSR 시 에러 가능 (useEffect 안이라 실제로는 안전)

### 2.4 TerminalPanel.tsx (8/10)

**좋은 점:**
- 동적 import로 SSR 문제 회피 (`import('@xterm/xterm')`)
- `sendPTYInputRef`/`sendPTYResizeRef` 패턴으로 useEffect deps 안정화 (CLAUDE.md Learnings 반영)
- `disposed` 플래그로 비동기 cleanup race 방지
- ResizeObserver로 자동 크기 조절

**이슈:**
- WebGL addon 미사용 (package.json에는 있음) — 성능 최적화 기회
- 모바일 터치 입력 처리 없음
- xterm 인스턴스가 `unknown` 타입 — 타입 안전성 부족

---

## 3. 공통 패턴 평가

### 좋은 패턴
1. **PTY 데이터 Zustand 우회**: `ptyDataEmitter` (EventEmitter) → xterm 직접 전달. 고빈도 데이터가 상태 관리를 거치지 않아 성능 우수
2. **Dual-DOM Zoom**: CSS만으로 줌 레벨 전환 — React 리렌더 0
3. **Optimistic Updates**: 캔버스 조작 시 로컬 먼저 → API 동기화
4. **useRef 패턴**: WS 콜백을 ref로 감싸 useEffect deps 안정화

### 개선 필요 패턴
1. **[H5] Error Boundary 부재**: 컴포넌트 에러 시 전체 앱 크래시
2. **API 클라이언트 레이어 없음**: 모든 곳에서 raw `fetch()` — 인터셉터, 에러 핸들링, 토큰 관리 불가
3. **로딩/에러 상태 불완전**: 대부분의 store에서 `isLoading`만 있고 `error` 상태 없음
4. **store 간 직접 참조**: `useCanvasStore.getState()` 호출이 3개 store에서 발생

---

## 4. 성능 최적화 포인트

| 항목 | 현재 | 권장 |
|------|------|------|
| BaseNode 리렌더 | `memo` 적용됨 | 양호 |
| PTY 데이터 | Zustand 우회 | 양호 |
| Canvas 재렌더 | `onNodesChange` 매번 새 배열 | `immer` 미들웨어 고려 |
| API 캐싱 | 없음 | SWR/React Query 도입 고려 |
| 번들 크기 | xterm 동적 import | 양호, ReactFlow tree-shaking 확인 필요 |
| 이미지/폰트 | Inter + JetBrains Mono 번들 | subset 폰트 사용 고려 |

---

## 5. 접근성(a11y) 평가

| 항목 | 상태 | 설명 |
|------|:----:|------|
| 키보드 네비게이션 | 부분 | Cmd+K, Cmd+1/2 등 단축키 존재 |
| ARIA 속성 | 미흡 | Radix UI 기본 ARIA만 의존 |
| 포커스 관리 | 미흡 | 패널 열기/닫기 시 포커스 트랩 없음 |
| 스크린 리더 | 미흡 | aria-label 대부분 미설정 |
| 색상 대비 | 양호 | Warm Light 테마 대비 적절 |
