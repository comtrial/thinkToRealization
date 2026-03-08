# v2 프론트엔드 개발 설계서

**작성일:** 2026-03-01
**기반 문서:** v2 UXUI 설계서 + v2 백엔드 아키텍처 설계서
**도출 방법:** UXUI 디자이너 2인 + 프론트 개발자 1인 심층 토론 → 백엔드 개발자 검토 → 확정
**목적:** UXUI 설계를 완벽하게 구현하는 프론트엔드 설계
---
## 0. 에이전트 팀 구성
- **🎨 Sora (Visual System Designer):** 컴포넌트 디자인 시스템, 디자인 토큰, 레이아웃, 타이포그래피, 애니메이션 스펙 전문가. "1px이 틀리면 전체 시스템이 틀린다"는 철학. Tailwind + CSS Variables 기반 디자인 시스템 구축 전문.
- **🔄 Hana (Interaction & Flow Designer):** 사용자 플로우, 인터랙션 패턴, 마이크로인터랙션, 접근성(a11y) 전문가. "1초의 애니메이션이 10초의 설명을 대체한다"는 철학. 상태 전이, 피드백 루프, 에러 UX 설계.
- **⚛️ Taesu (Frontend Engineer):** React/Next.js/xyflow 구현 전문가. 상태 관리(Zustand), 성능 최적화, 번들 사이즈, xterm.js 통합 경험. "UXUI가 원하는 걸 어떻게 구현할 수 있느냐"를 판단하는 역할.
- **🔧 Backend Dev (필요 시 소환):** 백엔드 설계서와 충돌 발생 시 호출되어 API Contract 수정을 협의하는 역할.
---
## 1. 에이전트 팀 심층 토론 기록
### 1.1 Round 1: "컴포넌트 라이브러리는 무엇을 쓰나?"
**Taesu:** "옵션이 3가지다. (1) shadcn/ui (Radix UI 기반), (2) Radix UI 직접 사용, (3) 풀 커스텀. Linear는 Radix UI를 쓴다. 우리도 Radix가 맞다고 본다."

**Sora:** "shadcn/ui는 기본 스타일이 우리 디자인 토큰과 많이 다르다. 결국 전부 오버라이드해야 한다. Radix UI Primitives를 직접 쓰고, 우리 디자인 토큰으로 스타일링하는 게 더 깨끗하다."

**Hana:** "접근성 관점에서 Radix UI Primitives는 WAI-ARIA를 완벽히 지원한다. 드롭다운, 다이얼로그, 팝오버, 탭스 모두 내장되어 있다. 우리가 직접 만들면 a11y를 놓칠 수 있다."

**Taesu:** "shadcn/ui 대신 Radix Primitives + Tailwind 조합으로 가자. shadcn/ui의 장점인 'copy-paste 컴포넌트'는 우리가 직접 만들면 된다. 추가로 cmdk(커맨드 팔레트), xterm.js(터미널), @xyflow/react(캔버스)는 필수 의존성."

> **합의:** Radix UI Primitives + Tailwind CSS + CSS Variables. shadcn/ui는 사용하지 않음. 코어 컴포넌트를 직접 제작하되 Radix의 접근성 기능을 활용.
---
### 1.2 Round 2: "xyflow 커스텀 노드에서 Semantic Zoom을 어떻게 구현하나?"
**Sora:** "UXUI 설계서에 노드가 2단계 시맨틱 줌이다. 줌 ≤80%: 200x52px, 줌 >80%: 280x140px. 두 레벨이 깊이감 없이 전환되어야 한다."

**Taesu:** "xyflow의 `useViewport()` 훅으로 현재 zoom 레벨을 실시간으로 읽을 수 있다. 문제는 성능이다. zoom이 변할 때마다 50개 노드가 전부 리렌더링되면 버벅거린다."

**Hana:** "전환이 부드러움 없이 되려면 CSS transition이 필요하다. opacity와 transform으로 Level 1 → Level 2 전환 시 200ms fade-crossover 효과."

**Taesu:** "성능 해결책: (1) zoom 레벨을 80% 기준으로 boolean으로 변환 (`isExpanded`). (2) 이 boolean이 변할 때만 노드 컴포넌트 리렌더링. (3) `React.memo` + `useMemo`로 증분 줌 변경 시 노드 리렌더 방지. (4) zoom이 80%를 오가는 순간에만 전체 노드 리렌더."

**Sora:** "Level 1과 Level 2를 동시에 DOM에 두고, CSS로 하나만 보이게 하는 건? React 리렌더링 없이 CSS만으로 전환 가능."

**Taesu:** "DOM이 2배로 늘지만, 50개 노드에서 100개 요소는 문제없다. CSS `opacity: 0/1` + `pointer-events: none/auto` 토글이면 트랜지션 비용 제로. 좋다."

> **합의:** Dual-DOM 접근. Level 1과 Level 2를 둘 다 렌더링하되 CSS로 토글. zoom threshold를 Zustand에 저장하고, CSS class로 전환. React 리렌더링 0회.
---
### 1.3 Round 3: "사이드패널 애니메이션 — Framer Motion vs CSS?"
**Hana:** "사이드패널은 3상태다: Closed → Side Peek (40%) → Full Page. 각 전환에 애니메이션이 필요하다. Framer Motion이 가장 자연스럽다."

**Taesu:** "Framer Motion은 번들 사이즈가 30KB+다. 사이드패널 애니메이션은 CSS `transition`으로 충분하다. `width`, `transform: translateX()`, `opacity`만 쓰면 된다. GPU 가속도 된다."

**Sora:** "CSS로 가되, `transition-timing-function`은 Linear의 커스텀 easing을 참고하자. `cubic-bezier(0.25, 0.1, 0.25, 1.0)` — 빠른 진입, 부드러운 감속."

**Hana:** "동의한다. 대신 터미널 섹션의 슬라이드업/다운은 `max-height` + `transition`으로. Framer Motion은 나중에 복잡한 애니메이션(노드 승격 시 캔버스 플라이 효과 등)이 필요하면 그때 도입."

> **합의:** CSS Transitions 기본. Framer Motion은 v2.2+에서 필요 시 도입. 패널 전환: 250ms ease `cubic-bezier(0.25, 0.1, 0.25, 1.0)`. 터미널 슬라이드: 200ms ease.
---
### 1.4 Round 4: "⭐ 하이라이트 — 터미널에서 Claude 응답 블록을 어떻게 식별하나?" ⚠️
**Hana:** "UXUI 설계에서 ⭐는 'Claude 응답 블록 좌측에 hover 시 표시'라고 했다. 근데 xterm.js는 raw 터미널 스트림이다. Claude의 응답 시작/끝을 어떻게 알지?"

**Taesu:** "이건 심각한 문제다. xterm.js는 ANSI 시퀀스를 렌더링하는 터미널 에뮤레이터다. 텍스트의 '의미'를 모른다. Claude CLI의 출력 패턴을 파싱해야 하는데, 이건 깨지기 쉬운 방법이다."

**Sora:** "두 가지 접근이 있다. (A) 터미널 위에 투명 오버레이 레이어를 놓고, 응답 블록 영역을 계산해서 표시. (B) 터미널과는 별도의 '세션 로그 뷰어'를 만들어서, 구조화된 데이터로 렌더링."

**Taesu:** "(A)는 기술적으로 너무 불안정하다. Claude CLI의 출력 포맷이 바뀌면 깨진다. (B)가 맞다. **활성 세션 중에는 xterm.js로 로우 터미널 표시, 세션 종료 후에는 구조화된 로그 뷰어**로 전환. 로그 뷰어에서 ⭐ 마킹."

**Hana:** "좋다. 활성 세션에서도 ⭐를 하고 싶은 사용자가 있을 수 있으니, 활성 중에는 터미널 상단에 '현재 응답 하이라이트' 버튼을 두자. 클릭하면 현재 보이는 Claude 응답의 마지막 내용을 결정사항으로 저장. 텍스트 선택 후 ⭐ 클릭."

**Taesu:** "그러려면 백엔드의 세션 로그 API가 단순 `{content: string}`이 아니라 구조화된 메시지 배열이어야 한다. 백엔드 설계서 수정이 필요하다."

**🔧 Backend Dev 소환:**
**Backend Dev:** "확인했다. 현재 `GET /api/sessions/:id/log`는 `{content: string}`을 반환한다. md 파일을 파싱해서 구조화된 형식으로 반환하는 엔드포인트를 추가하겠다."

> **합의 + 백엔드 수정 #1:** `GET /api/sessions/:id/log` 응답 타입 변경.
>
> **기존:** `{content: string}` (raw md)
> **변경:** `{raw: string, messages: SessionMessage[]}` 여기서 `SessionMessage = {role: 'user'|'assistant', content: string, index: number, highlightId?: string}`
>
> 활성 세션: xterm.js 로우 터미널 + 상단 "현재 응답 ⭐" 버튼.
> 종료된 세션: 구조화된 로그 뷰어 + 메시지별 ⭐ 토글.
---
### 1.5 Round 5: "상태 관리 — Zustand 스토어 설계"
**Taesu:** "전체 앱의 상태를 하나의 Zustand 스토어에 넣으면 리렌더링 성능이 나빠진다. 도메인별로 분리해야 한다."

**Hana:** "UI 상태(패널 열림/닫힘, 활성 탭)와 데이터 상태(노드, 엣지, 세션)를 분리해야 한다. UI 상태는 자주 변하지만 데이터 상태는 API 응답에만 변한다."

**Taesu:** "Zustand의 `slice` 패턴으로 4개 스토어: (1) UIStore, (2) CanvasStore, (3) NodeStore, (4) SessionStore. 각각 독립적으로 subscribe 가능."

**Sora:** "디자인 토큰(테마, 줌 레벨 등)도 스토어에 넣어야 하나?"

**Taesu:** "아니다. 테마는 CSS Variable을 바꾸는 것이라 Zustand에 넣을 필요 없다. `document.documentElement.dataset.theme`으로 충분. 줌 레벨은 xyflow의 `useViewport()`에서 직접 읽는다."

> **합의:** Zustand 4개 스토어. 테마는 CSS Variable. 줌은 xyflow viewport.
---
### 1.6 Round 6: "대시보드 카드의 '마지막 작업: 2시간 전'은 어디서 오나?" ⚠️
**Sora:** "UXUI 설계에서 대시보드 카드에 '마지막 작업: 2시간 전'이 표시된다. 이 데이터는 백엔드 API에서 와야 한다."

**Taesu:** "백엔드의 `NodeResponse` 타입을 보면 `sessionCount`, `decisionCount`, `fileChangeCount`, `hasActiveSession`이 computed로 있다. 하지만 `lastSessionAt`이나 `lastSessionTitle`은 없다."

**🔧 Backend Dev 소환:**
**Backend Dev:** "맞다. `NodeResponse`에 `lastSessionAt: string | null`과 `lastSessionTitle: string | null`을 추가하겠다. Session의 `startedAt`과 `title`을 조인해서 computed로 반환."

> **합의 + 백엔드 수정 #2:** `NodeResponse`에 `lastSessionAt`, `lastSessionTitle` 필드 추가.
---
### 1.7 Round 7: "캔버스 노드 드래그 성능 — 위치 저장 전략"
**Taesu:** "xyflow에서 노드를 드래그하면 `onNodesChange` 콜백이 매 프레임마다 발생한다. 이걸 매번 API로 보내면 초당 60회 API 호출이다."

**Hana:** "debounce가 필수다. 드래그 종료 후 500ms 기다렸다가 한 번에 저장. 사용자는 드래그 중에는 저장이 되는지 신경 쓰지 않는다."

**Taesu:** "흐름: `onNodeDragStop` 이벤트 → 변경된 노드 위치를 Zustand에 즉시 반영 (낙관적 UI) → 500ms debounce 후 `PUT /api/nodes/positions` 벌크 업데이트. 실패 시 Zustand에서 rollback."

**Sora:** "Auto-layout (Cmd+L) 시에는 모든 노드가 동시에 이동한다. 이때는 CSS transition으로 애니메이션을 주고, 애니메이션 종료 후 벌크 저장."

> **합의:** 노드 위치는 Zustand에 낙관적 업데이트, API로 debounce 저장. Auto-layout은 300ms transition 후 저장.
---
### 1.8 Round 8: "세션 종료 프롬프트 UX 최종 확정"
**Hana:** "UXUI 설계서에서 '터미널 하단 인라인, 3초 후 fade out, 기본=상태 유지'라고 했다. 마이크로인터랙션을 정밀하게 정의하자."

**Sora:** "프롬프트 애니메이션: (1) 터미널 하단에서 slideUp 200ms, (2) 3초 타이머, (3) fade out 300ms, (4) 사라진 후 터미널 섹션도 slideDown 200ms로 접힘. 전체 시퀀스: 200ms + 3000ms + 300ms + 200ms = ~3.7초."

**Taesu:** "3초 타이머 중에 사용자가 마우스를 올리면 타이머 일시정지. 버튼 클릭 시 타이머 즐시 취소하고 즉시 API 호출."

**Hana:** "완벽하다. 프롬프트가 사라지는 것은 '기본=이어서'가 된다는 의미. 사용자가 플로우를 중단하지 않고 계속 작업할 수 있다."

> **합의:** 세션 종료 프롬프트 시퀀스 확정. slideUp 200ms → 3s 타이머 (hover 시 일시정지) → fadeOut 300ms → slideDown 200ms.
---
### 1.9 Round 9: "레이아웃 기술 선택 — CSS Grid vs Flexbox"
**Sora:** "전체 레이아웃은 Inverted-L: Header(48px) + Sidebar(220px) + Main + SidePanel(0~50%). 이건 CSS Grid가 적합하다."

**Taesu:** "CSS Grid `grid-template-columns: auto 1fr auto`로 Sidebar(220px) | Main(fluid) | Panel(0 or 40%). `grid-template-rows: 48px 1fr`로 Header | Content. 사이드바 접힘 시 48px 아이콘 모드는 `auto`를 48px로 변경."

**Hana:** "Side Panel의 너비 전환은 CSS Grid의 column을 transition하는 게 아니라, Panel 내부에서 `width` + `transform`을 쓰는 게 맞다. Grid column 애니메이션은 성능이 좋지 않다."

**Taesu:** "동의. Grid는 정적 레이아웃용. Panel 열림/닫힘은 Main 영역 위에 `position: absolute`로 Panel을 올리고 Main의 `padding-right`를 애니메이션. 이러면 Panel이 Main 콘텐츠 위에 겨쳐지는 게 아니라 밀어내는 패턴."

> **합의:** CSS Grid (2행 2열 정적 레이아웃) + Panel은 absolute + Main padding-right 애니메이션.
---
### 1.10 Round 10: "뷰포트 저장 API 백엔드에 없다" ⚠️
**Taesu:** "백엔드 Prisma 스키마에 뷰포트 저장 필드가 없다. `CanvasResponse`에 `viewport: {x, y, zoom}`이 있지만, 이 데이터를 어디에 저장하는지 정의되지 않았다."

**🔧 Backend Dev 소환:**
**Backend Dev:** "Project 모델에 `canvasViewportX`, `canvasViewportY`, `canvasViewportZoom` 필드를 추가하겠다. 간단한 Float 세 개."

> **합의 + 백엔드 수정 #3:** Project 모델에 `canvasViewportX Float @default(0)`, `canvasViewportY Float @default(0)`, `canvasViewportZoom Float @default(1.0)` 세 필드 추가.
---
## 2. 컴포넌트 아키텍처
### 2.1 컴포넌트 트리
```
src/components/
├── layout/                          # 전체 레이아웃
│   ├── AppShell.tsx                  # Grid 레이아웃 (전체 래퍼)
│   ├── Header.tsx                    # 48px 헤더 바
│   ├── Sidebar.tsx                   # 220px 사이드바
│   ├── SidebarItem.tsx               # 사이드바 메뉴 항목
│   └── ProjectSelector.tsx           # 프로젝트 드롭다운
├── dashboard/                       # Welcome Back 대시보드
│   ├── Dashboard.tsx                 # 대시보드 전체
│   ├── DashboardSection.tsx          # 섹션 (In Progress / Todo / Done)
│   └── DashboardCard.tsx             # 개별 노드 카드
├── canvas/                          # xyflow 캔버스
│   ├── Canvas.tsx                    # ReactFlow 래퍼 + 설정
│   ├── CanvasControls.tsx            # 줌 컨트롤 + 미니맵 토글
│   ├── nodes/
│   │   ├── BaseNode.tsx              # 공통 노드 컴포넌트 (Dual-DOM)
│   │   ├── NodeLevel1.tsx            # 축소 뷰 (200x52)
│   │   ├── NodeLevel2.tsx            # 확대 뷰 (280x140)
│   │   ├── NodeHandle.tsx            # 엣지 연결 핸들
│   │   └── NodeTypeSelector.tsx      # 타입 선택 팝오버
│   ├── edges/
│   │   ├── SequenceEdge.tsx          # 순방향
│   │   ├── DependencyEdge.tsx        # 의존
│   │   ├── RelatedEdge.tsx           # 관련
│   │   ├── RegressionEdge.tsx        # 회귀
│   │   └── BranchEdge.tsx            # 분기
│   └── Frame.tsx                     # Group Node (프레임)
├── panel/                           # 사이드 패널
│   ├── SidePanel.tsx                 # 패널 컨테이너 + 3모드 전환
│   ├── PanelHeader.tsx               # 헤더 (타이틀 + 닫기/Full Page)
│   ├── tabs/
│   │   ├── OverviewTab.tsx           # 설명 + 결정사항 + 연결노드
│   │   ├── SessionsTab.tsx           # 세션 목록 + 로그 뷰어
│   │   └── FilesTab.tsx              # 변경 파일 + diff 뷰어
│   ├── DecisionItem.tsx              # 결정사항 항목 + ⭐ + ↗ 승격
│   ├── SessionCard.tsx               # 세션 카드 (Resume/View Log)
│   ├── SessionLogViewer.tsx          # 구조화된 로그 뷰어 (⭐ 마킹)
│   └── terminal/
│       ├── TerminalSection.tsx       # 터미널 섹션 (접힘/확장)
│       ├── TerminalView.tsx          # xterm.js 래퍼
│       ├── TerminalToolbar.tsx       # 활성 세션 시 ⭐ 버튼 등
│       └── SessionEndPrompt.tsx      # 종료 프롬프트 (인라인)
├── command/                         # Command Palette
│   └── CommandPalette.tsx            # cmdk 래퍼
├── shared/                          # 공유 컴포넌트
│   ├── Badge.tsx                     # 상태/타입 배지
│   ├── StatusDropdown.tsx            # 상태 선택 드롭다운
│   ├── NodeTypeIcon.tsx              # 타입별 아이콘
│   ├── Toast.tsx                     # 알림 토스트
│   └── ContextMenu.tsx               # 우클릭 컨텍스트 메뉴
└── providers/                       # Context Providers
    ├── WebSocketProvider.tsx         # WS 연결 관리
    └── ProjectProvider.tsx           # 현재 프로젝트 컨텍스트
```

### 2.2 컴포넌트 계층 구조
```
AppShell
├── Header
│   ├── SidebarToggle
│   ├── ProjectSelector
│   ├── TabNav [대시보드 | 캔버스]
│   └── CommandPaletteTrigger
├── Sidebar
│   ├── SidebarItem (Inbox)
│   ├── SidebarItem (My Work)
│   └── ProjectList
├── MainContent
│   ├── [Dashboard Tab]
│   │   └── Dashboard
│   │       ├── DashboardSection (In Progress)
│   │       │   └── DashboardCard[]
│   │       ├── DashboardSection (Todo)
│   │       └── DashboardSection (Recent Done)
│   └── [Canvas Tab]
│       └── Canvas (ReactFlow)
│           ├── BaseNode[] (custom nodes)
│           ├── CustomEdge[] (5 types)
│           ├── Frame[] (group nodes)
│           └── CanvasControls
└── SidePanel (conditional)
    ├── PanelHeader
    ├── TabBar [Overview | Sessions | Files]
    ├── TabContent
    │   ├── OverviewTab
    │   │   ├── Description
    │   │   ├── DecisionItem[] (⭐ + ↗)
    │   │   └── ConnectedNodes
    │   ├── SessionsTab
    │   │   ├── SessionCard[]
    │   │   └── SessionLogViewer
    │   └── FilesTab
    └── TerminalSection
        ├── TerminalToolbar
        ├── TerminalView (xterm.js)
        └── SessionEndPrompt
```
---
## 3. Zustand 상태 설계
### 3.1 UIStore
```typescript
interface UIStore {
  // 레이아웃
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // 탭
  activeTab: 'dashboard' | 'canvas';
  setActiveTab: (tab: 'dashboard' | 'canvas') => void;

  // 사이드 패널
  panelMode: 'closed' | 'peek' | 'full';
  panelNodeId: string | null;
  panelTab: 'overview' | 'sessions' | 'files';
  openPanel: (nodeId: string) => void;
  closePanel: () => void;
  toggleFullPage: () => void;
  setPanelTab: (tab: 'overview' | 'sessions' | 'files') => void;

  // 터미널
  terminalExpanded: boolean;
  terminalHeight: number; // px, 드래그 리사이즈용
  setTerminalExpanded: (expanded: boolean) => void;
  setTerminalHeight: (height: number) => void;

  // 커맨드 팔레트
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
}
```

### 3.2 CanvasStore
```typescript
interface CanvasStore {
  // 노드 & 엣지 (xyflow 내부 상태와 동기화)
  nodes: Node<NodeData>[]; // xyflow Node 타입
  edges: Edge<EdgeData>[]; // xyflow Edge 타입

  // xyflow 콜백
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // CRUD
  addNode: (node: NodeData) => void;
  updateNode: (id: string, data: Partial<NodeData>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: EdgeData) => void;
  removeEdge: (id: string) => void;

  // 줌 레벨 (시맨틱 줌용)
  isZoomedIn: boolean; // zoom > 0.8
  setIsZoomedIn: (value: boolean) => void;

  // 캔버스 상태 로드/저장
  loadCanvas: (projectId: string) => Promise<void>;
  savePositions: (nodes: {id: string, x: number, y: number}[]) => Promise<void>;
  saveViewport: (viewport: {x: number, y: number, zoom: number}) => void;
}
```

### 3.3 NodeStore
```typescript
interface NodeStore {
  // 노드 상세 데이터 (패널용)
  selectedNode: NodeResponse | null;
  sessions: SessionResponse[];
  decisions: DecisionResponse[];
  connectedNodes: NodeResponse[];

  // 노드 선택
  selectNode: (nodeId: string) => Promise<void>;
  clearSelection: () => void;

  // 상태 변경
  updateNodeStatus: (nodeId: string, status: string) => Promise<void>;

  // 결정사항
  addDecision: (content: string, sessionId?: string) => Promise<void>;
  removeDecision: (decisionId: string) => Promise<void>;
  promoteDecision: (decisionId: string, nodeType: string, title: string) => Promise<void>;
}
```

### 3.4 SessionStore
```typescript
interface SessionStore {
  // 활성 세션
  activeSession: {
    sessionId: string;
    nodeId: string;
    claudeSessionId: string | null;
  } | null;

  // 세션 로그
  sessionLog: SessionMessage[] | null;

  // 상태
  isSessionStarting: boolean;
  sessionEndPromptVisible: boolean;

  // 액션
  startSession: (nodeId: string, title?: string) => Promise<void>;
  endSession: (completed: boolean) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  dismissEndPrompt: () => void;

  // 로그
  loadSessionLog: (sessionId: string) => Promise<void>;
}
```
---
## 4. 디자인 시스템 구현
### 4.1 Tailwind 설정 (tailwind.config.ts)
```typescript
const config = {
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',      // #FAFAF9
        surface: 'var(--color-surface)',              // #FFFFFF
        'surface-hover': 'var(--color-surface-hover)', // #F5F5F4
        'surface-active': 'var(--color-surface-active)', // #EEEEED
        border: 'var(--color-border)',                // #E5E5E3
        'border-hover': 'var(--color-border-hover)',  // #D4D4D4
        accent: 'var(--color-accent)',                // #4F46E5
        'accent-hover': 'var(--color-accent-hover)',  // #4338CA
        'text-primary': 'var(--color-text-primary)',  // #1A1A1A
        'text-secondary': 'var(--color-text-secondary)', // #6B6B6B
        'text-tertiary': 'var(--color-text-tertiary)', // #A3A3A3
        // 상태 색상
        'status-backlog': '#D4D4D4',
        'status-todo': '#FBBF24',
        'status-progress': '#4F46E5',
        'status-done': '#22C55E',
        'status-archived': '#A3A3A3',
        // 노드 타입 색상
        'type-idea': '#FBBF24',
        'type-decision': '#8B5CF6',
        'type-task': '#3B82F6',
        'type-issue': '#F87171',
        'type-milestone': '#10B981',
        'type-note': '#A3A3A3',
        // 터미널
        'terminal-bg': '#1E1E1E',
        'terminal-text': '#D4D4D4',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'page-title': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'section-header': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'node-title-lg': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'node-title-sm': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'body': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'badge': ['11px', { lineHeight: '14px', fontWeight: '500' }],
        'terminal': ['13px', { lineHeight: '20px', fontWeight: '400' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '48px',
      },
      boxShadow: {
        'elevation-1': '0 1px 3px rgba(0,0,0,0.08)',
        'elevation-2': '0 4px 12px rgba(0,0,0,0.12)',
        'elevation-3': '0 8px 24px rgba(0,0,0,0.16)',
        'elevation-4': '0 12px 32px rgba(0,0,0,0.20)',
      },
      borderRadius: {
        'node': '8px',
        'frame': '12px',
        'button': '6px',
        'badge': '4px',
        'palette': '12px',
        'dropdown': '8px',
      },
      transitionTimingFunction: {
        'ttr': 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      },
      transitionDuration: {
        'panel': '250ms',
        'terminal': '200ms',
        'zoom': '200ms',
        'prompt': '300ms',
      },
    }
  }
}
```

### 4.2 CSS Variables (globals.css)
```css
:root {
  --color-background: #FAFAF9;
  --color-surface: #FFFFFF;
  --color-surface-hover: #F5F5F4;
  --color-surface-active: #EEEEED;
  --color-surface-overlay: rgba(0, 0, 0, 0.4);
  --color-border: #E5E5E3;
  --color-border-hover: #D4D4D4;
  --color-border-focus: #4F46E5;
  --color-accent: #4F46E5;
  --color-accent-hover: #4338CA;
  --color-accent-light: #EEF2FF;
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-text-tertiary: #A3A3A3;
  --color-text-on-accent: #FFFFFF;
  --sidebar-width: 220px;
  --sidebar-collapsed-width: 48px;
  --header-height: 48px;
  --panel-min-width: 400px;
}

/* v2.2+ 다크 모드
[data-theme='dark'] {
  --color-background: #1A1A1A;
  --color-surface: #262626;
  ...
}
*/
```
---
## 5. 핵심 컴포넌트 상세 스펙
### 5.1 BaseNode (xyflow 커스텀 노드)
```typescript
// Dual-DOM: Level 1과 Level 2를 동시 렌더링, CSS로 토글
const BaseNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const isZoomedIn = useCanvasStore(s => s.isZoomedIn);

  return (
    <div className={cn(
      'relative rounded-node border transition-shadow duration-zoom',
      selected ? 'border-accent border-2' : 'border-border',
      data.status === 'in_progress' && 'border-accent/30',
    )}>
      {/* 활성 세션 인디케이터 */}
      {data.hasActiveSession && (
        <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}

      {/* 타입 색상 바 */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-node',
        typeColorMap[data.type]
      )} />

      {/* Level 1: 축소 뷰 */}
      <div className={cn(
        'w-[200px] h-[52px] flex items-center px-3 gap-2',
        'transition-opacity duration-zoom',
        isZoomedIn ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'
      )}>
        <NodeTypeIcon type={data.type} size={16} />
        <span className="text-node-title-sm truncate flex-1">{data.title}</span>
        <StatusDot status={data.status} />
      </div>

      {/* Level 2: 확대 뷰 */}
      <div className={cn(
        'w-[280px] h-[140px] p-3 flex flex-col gap-1',
        'transition-opacity duration-zoom',
        isZoomedIn ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'
      )}>
        <div className="flex items-center gap-2">
          <NodeTypeIcon type={data.type} size={16} />
          <span className="text-node-title-lg truncate flex-1">{data.title}</span>
          <Badge status={data.status} />
        </div>
        <p className="text-caption text-text-secondary line-clamp-2">{data.description}</p>
        <div className="flex gap-3 mt-auto text-caption text-text-tertiary">
          <span>💬 {data.sessionCount}</span>
          <span>📌 {data.decisionCount}</span>
          <span>📁 {data.fileChangeCount}</span>
        </div>
      </div>

      {/* Handles */}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </div>
  );
});
```

**Sora의 디자인 노트:**
- Level 1 → Level 2 전환 시 `opacity` 크로스오버. DOM 재배치 없이 부드러운 전환.
- 활성 세션 도트는 `animate-pulse` (Tailwind 내장) — 1.5초 주기.
- 호버 시 `shadow-elevation-1` 추가.
- 드래그 중 `shadow-elevation-4` + `scale-[1.02]`.

### 5.2 SidePanel (사이드 패널)
```typescript
const SidePanel = () => {
  const { panelMode, panelNodeId, closePanel, toggleFullPage } = useUIStore();

  return (
    <>
      {/* 오버레이 (Full Page 모드) */}
      {panelMode === 'full' && (
        <div className="fixed inset-0 bg-surface-overlay z-40"
             onClick={closePanel} />
      )}

      {/* 패널 */}
      <aside className={cn(
        'absolute top-0 right-0 h-full bg-surface border-l border-border z-30',
        'flex flex-col',
        'transition-all duration-panel ease-ttr',
        panelMode === 'closed' && 'w-0 opacity-0 pointer-events-none',
        panelMode === 'peek' && 'w-[40%] min-w-[400px] max-w-[50%]',
        panelMode === 'full' && 'w-[80%] max-w-[900px] shadow-elevation-3',
      )}>
        <PanelHeader />
        <TabBar />

        {/* 스크롤 영역: Overview 위, Terminal 아래 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <TabContent />
          </div>
          <TerminalSection />
        </div>
      </aside>
    </>
  );
};
```

**Hana의 인터랙션 노트:**
- ESC 연속 2번: 1회 Full→Peek, 2회 Peek→Closed.
- 노드 클릭 시 이미 다른 노드가 열려있으면 패널 내용만 교체 (패널 닫힍다가 열리지 않음).
- 패널 너비 리사이즈: 좌측 경계에 4px 드래그 핸들.

### 5.3 TerminalSection (터미널)
```typescript
const TerminalSection = () => {
  const { terminalExpanded, terminalHeight, setTerminalHeight } = useUIStore();
  const { activeSession, sessionEndPromptVisible } = useSessionStore();

  return (
    <div className={cn(
      'border-t border-border flex flex-col',
      'transition-all duration-terminal ease-ttr',
      !terminalExpanded && 'max-h-0 border-t-0',
    )}
    style={terminalExpanded ? { height: `${terminalHeight}px` } : undefined}
    >
      {/* 드래그 핸들 */}
      <div className="h-1 cursor-row-resize bg-border-hover hover:bg-accent"
           onMouseDown={handleDragStart} />

      {/* 터미널 툴바 */}
      <TerminalToolbar />

      {/* xterm.js */}
      <div className="flex-1 overflow-hidden">
        <TerminalView
          nodeId={activeSession?.nodeId}
          sessionId={activeSession?.sessionId}
        />
      </div>

      {/* 세션 종료 프롬프트 */}
      {sessionEndPromptVisible && <SessionEndPrompt />}
    </div>
  );
};
```

### 5.4 SessionEndPrompt (종료 프롬프트)
```typescript
const SessionEndPrompt = () => {
  const { endSession, dismissEndPrompt } = useSessionStore();
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isHovered) {
      timerRef.current = setTimeout(() => {
        dismissEndPrompt();
      }, 3000);
    }
    return () => clearTimeout(timerRef.current);
  }, [isHovered]);

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 h-12',
        'bg-surface-hover border-t border-border',
        'animate-slideUp'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-caption text-text-secondary">세션이 종료되었습니다.</span>
      <div className="flex gap-2">
        <button
          className="px-3 py-1.5 rounded-button text-badge bg-green-600 text-white hover:bg-green-700"
          onClick={() => endSession(true)}
        >
          ✓ 작업 완료
        </button>
        <button
          className="px-3 py-1.5 rounded-button text-badge bg-surface border border-border text-text-secondary hover:bg-surface-hover"
          onClick={() => endSession(false)}
        >
          → 나중에 이어서
        </button>
      </div>
    </div>
  );
};
```

### 5.5 SessionLogViewer (구조화 로그 뷰어)
```typescript
// 종료된 세션의 로그를 구조화된 형식으로 표시
const SessionLogViewer = ({ sessionId }: { sessionId: string }) => {
  const { sessionLog, loadSessionLog } = useSessionStore();
  const { addDecision, removeDecision } = useNodeStore();

  useEffect(() => {
    loadSessionLog(sessionId);
  }, [sessionId]);

  return (
    <div className="flex flex-col gap-3 p-4">
      {sessionLog?.map((msg) => (
        <div key={msg.index}
             className={cn(
               'relative group rounded-node p-3',
               msg.role === 'user'
                 ? 'bg-accent-light border border-accent/20'
                 : 'bg-surface-hover border border-border',
               msg.highlightId && 'ring-2 ring-accent/20 bg-accent/5'
             )}
        >
          <div className="text-caption text-text-tertiary mb-1">
            {msg.role === 'user' ? '💬 나' : '🤖 Claude'}
          </div>
          <div className="text-body text-text-primary whitespace-pre-wrap">
            {msg.content}
          </div>

          {/* ⭐ 하이라이트 버튼 (Claude 응답에만) */}
          {msg.role === 'assistant' && (
            <button
              className={cn(
                'absolute top-2 right-2',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                msg.highlightId && 'opacity-100 text-accent'
              )}
              onClick={() => msg.highlightId
                ? removeDecision(msg.highlightId)
                : addDecision(msg.content, sessionId)
              }
            >
              {msg.highlightId ? '⭐' : '☆'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
```
---
## 6. WebSocket 클라이언트 설계
### 6.1 useWebSocket 훅
```typescript
const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);

      switch (msg.type) {
        case 'pty:data':
          // xterm.js로 직접 전달 (Zustand 경유 안 함 — 성능)
          ptyDataEmitter.emit(msg.payload.nodeId, msg.payload.data);
          break;

        case 'session:started':
          useSessionStore.getState().handleSessionStarted(msg.payload);
          break;

        case 'session:ended':
          useSessionStore.getState().handleSessionEnded(msg.payload);
          break;

        case 'node:stateChanged':
          useCanvasStore.getState().handleNodeStateChanged(msg.payload);
          break;

        case 'node:fileCountUpdated':
          useCanvasStore.getState().handleFileCountUpdated(msg.payload);
          break;
      }
    };

    ws.onclose = () => {
      // Exponential backoff: 1s, 2s, 4s, ... max 30s
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      setTimeout(connect, delay);
      reconnectAttempts.current++;
    };

    ws.onopen = () => {
      reconnectAttempts.current = 0;
    };

    wsRef.current = ws;
  }, []);

  // PTY 입력 전송 (성능: Zustand 경유 않고 직접 WS 전송)
  const sendPTYInput = useCallback((nodeId: string, data: string) => {
    wsRef.current?.send(JSON.stringify({
      type: 'pty:input',
      payload: { nodeId, data }
    }));
  }, []);

  return { connect, sendPTYInput };
};
```

**Taesu의 성능 노트:**
- `pty:data` 이벤트는 초당 수십~수백 회 발생. Zustand를 경유하면 매번 React 리렌더링이 트리거된다.
- 대신 커스텀 EventEmitter(`ptyDataEmitter`)로 직접 xterm.js에 전달.
- xterm.js는 React 라이프사이클 밖에서 작동하는 명령형 API.
---
## 7. 키보드 단축키 구현
### 7.1 전역 단축키 시스템
```typescript
// hooks/useKeyboardShortcuts.ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;

    // Command Palette
    if (isMod && e.key === 'k') {
      e.preventDefault();
      useUIStore.getState().toggleCommandPalette();
    }
    // 대시보드
    if (isMod && e.key === '1') {
      e.preventDefault();
      useUIStore.getState().setActiveTab('dashboard');
    }
    // 캔버스
    if (isMod && e.key === '2') {
      e.preventDefault();
      useUIStore.getState().setActiveTab('canvas');
    }
    // 사이드바 토글
    if (e.key === '[' && !e.target?.closest?.('input, textarea, [contenteditable]')) {
      useUIStore.getState().toggleSidebar();
    }
    // 패널 닫기
    if (e.key === 'Escape') {
      const { panelMode } = useUIStore.getState();
      if (panelMode === 'full') useUIStore.getState().toggleFullPage();
      else if (panelMode === 'peek') useUIStore.getState().closePanel();
    }
    // Full Page 토글
    if (isMod && e.key === 'Enter') {
      e.preventDefault();
      useUIStore.getState().toggleFullPage();
    }
    // 새 노드
    if (isMod && e.key === 'n') {
      e.preventDefault();
      // 캔버스 중앙에 타입 선택 팝오버
    }
    // 새 세션
    if (isMod && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      // 현재 노드에 새 세션 시작
    }
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```
---
## 8. xterm.js 통합 상세
### 8.1 TerminalView 컴포넌트
```typescript
const TerminalView = ({ nodeId, sessionId }: Props) => {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { sendPTYInput } = useWebSocket();

  // xterm 초기화
  useEffect(() => {
    if (!termRef.current || !nodeId) return;

    const term = new Terminal({
      theme: {
        background: '#1E1E1E',
        foreground: '#D4D4D4',
        cursor: '#D4D4D4',
        selectionBackground: 'rgba(79, 70, 229, 0.3)',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();

    // PTY 입력 전송
    term.onData((data) => {
      sendPTYInput(nodeId, data);
    });

    // PTY 출력 수신 (EventEmitter 직접 구독)
    const handler = (data: string) => {
      term.write(data);
    };
    ptyDataEmitter.on(nodeId, handler);

    // 리사이즈 감지
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      // 백엔드에 새 cols/rows 전송
      sendPTYResize(nodeId, term.cols, term.rows);
    });
    resizeObserver.observe(termRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      ptyDataEmitter.off(nodeId, handler);
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [nodeId]);

  return (
    <div ref={termRef}
         className="w-full h-full bg-terminal-bg rounded-b-node" />
  );
};
```
---
## 9. 애니메이션 스펙 전체
**Sora + Hana 합의:**

| 요소 | 속성 | 듀레이션 | 이징 | 노트 |
|------|------|---------|------|------|
| 사이드패널 열림/닫힘 | width, opacity | 250ms | ttr | Main padding-right 동시 애니메이션 |
| 터미널 확장/접힘 | max-height | 200ms | ttr | 슬라이드업/다운 |
| 종료 프롬프트 등장 | translateY, opacity | 200ms | ttr | 하단에서 slideUp |
| 종료 프롬프트 사라짐 | opacity | 300ms | ease-out | 3초 타이머 후 |
| 노드 줌 전환 | opacity | 200ms | ease | Dual-DOM CSS 토글 |
| 노드 호버 | box-shadow | 150ms | ease | elevation-1 추가 |
| 노드 드래그 | box-shadow, scale | 0ms (즉시) | - | elevation-4 + scale 1.02 |
| 노드 상태 변경 | border-color | 300ms | ease | Track A 자동 전이 시 |
| 사이드바 접기/펼기 | width | 200ms | ttr | 220px → 48px |
| 캔버스 Auto-Layout | x, y | 300ms | ttr | dagre 결과 적용 시 |
| Command Palette | opacity, scale | 150ms | ease | scale 0.95→1.0 + fade |
| 토스트 알림 | translateY, opacity | 200ms | ease | 우상단에서 등장 |
| 프레임 노드 귀속 | border-color | 300ms | ease | blue highlight 피드백 |

---
## 10. 라우팅 구조 (Next.js App Router)
```
src/app/
├── layout.tsx              # 전역 레이아웃 (providers, fonts)
├── page.tsx                # / → 리다이렉트 to /project/[slug]
├── project/
│   └── [slug]/
│       └── page.tsx        # AppShell 렌더링 (대시보드/캔버스 탭)
└── api/                    # 백엔드 API Routes (별도 설계서)
```

**Taesu의 라우팅 노트:**
- SPA 패턴. 대시보드/캔버스는 URL 변경 없이 Zustand `activeTab`으로 전환.
- 프로젝트 전환만 URL 변경 (`/project/sequeliquance`).
- Electron에서는 Next.js routing이 단순하게 동작.
---
## 11. 성능 최적화 전략
### 11.1 렌더링 최적화

| 컴포넌트 | 전략 | 근거 |
|---------|------|------|
| BaseNode | `React.memo` + `shallowEqual` | 캔버스 노드는 자신의 data만 변할 때 리렌더링 |
| Canvas | xyflow 내장 가상화 (viewport 바깥 노드 렌더링 안 함) | 50+ 노드에서 60fps 유지 |
| Zoom 전환 | Dual-DOM + CSS toggle (React 리렌더링 0회) | 줌 변경 시 성능 병목 제거 |
| PTY 데이터 | EventEmitter 직접 전달 (Zustand 우회) | 초당 수십회 이벤트 처리 |
| 노드 위치 저장 | debounce 500ms + 벌크 API | API 호출 최소화 |
| 비활성 탭 | 비활성 탭 콘텐츠는 언마운트 | 메모리/DOM 절약 |

### 11.2 번들 사이즈 예상

| 라이브러리 | 예상 크기 | 노트 |
|-----------|----------|------|
| @xyflow/react | ~150KB gzip | 캔버스 핵심 |
| xterm.js + addons | ~80KB gzip | 터미널 핵심 |
| cmdk | ~8KB gzip | Command Palette |
| zustand | ~3KB gzip | 상태 관리 |
| @radix-ui (primitives) | ~30KB gzip (Dialog+Dropdown+Tabs+Popover) | UI 기초 |
| lucide-react | ~5KB gzip (tree-shaking) | 아이콘 |
| dagre | ~30KB gzip | Auto-layout |
| **합계** | **~306KB gzip** | 초기 로드 2초 이하 목표 |

---
## 12. 에러 UX 설계
**Hana의 에러 UX 원칙:**

| 에러 유형 | UX 처리 | 시각적 표현 |
|----------|---------|------------|
| API 실패 (CRUD) | 토스트 알림 + 재시도 버튼 | 우상단 빨간 토스트, 5초 후 자동 닫힘 |
| 세션 시작 실패 | 토스트 + "Claude CLI 설치 확인" 링크 | 터미널 영역에 에러 메시지 표시 |
| WebSocket 끊김 | 헤더에 노란 도트 + "재연결 중..." 툴팁 | 재연결 성공 시 도트 사라짐 |
| 노드 위치 저장 실패 | Zustand에서 rollback (사용자 눈에 안 보임) | 실패 시 노드가 원래 위치로 애니메이션 |
| 중단된 세션 복구 | 대시보드 상단 배너 | 노란 배경 배너 + [확인] 버튼 |

---
## 13. 백엔드 설계서 수정 요약
> 프론트엔드 설계 과정에서 발견된 백엔드 설계서 수정 3건:

### 수정 #1: 세션 로그 API 응답 타입 변경
**영향 범위:** `GET /api/sessions/:id/log`
**기존:**
```json
{ "content": "(raw md string)" }
```
**변경:**
```json
{
  "raw": "(raw md string)",
  "messages": [
    {
      "role": "user",
      "content": "인증 모듈을 JWT 기반으로 리팩토링...",
      "index": 0,
      "highlightId": null
    },
    {
      "role": "assistant",
      "content": "JWT 구현을 위해...",
      "index": 1,
      "highlightId": "dec_abc123"
    }
  ]
}
```
**근거:** ⭐ 하이라이트 기능을 세션 로그 뷰어에서 구현하려면, Claude 응답 블록을 개별적으로 식별할 수 있어야 한다. raw string으로는 불가능.
**백엔드 구현:** md 파일을 파싱해서 user/assistant 메시지를 분리. Claude CLI의 md 로그 포맷(`## Human:`, `## Assistant:` 등)을 파싱 기준으로 사용. `highlightId`는 decisions 테이블을 조인해서 매칭.

### 수정 #2: NodeResponse에 세션 시간 필드 추가
**영향 범위:** `NodeResponse` 타입 (`src/lib/types/api.ts`)
**추가 필드:**
```typescript
export interface NodeResponse {
  // ... 기존 필드 유지
  lastSessionAt: string | null;      // 추가: 마지막 세션 시작 시간
  lastSessionTitle: string | null;    // 추가: 마지막 세션 제목
}
```
**근거:** 대시보드 카드에 "마지막 작업: 2시간 전" 표시 필요.
**백엔드 구현:** `Session` 테이블에서 `ORDER BY startedAt DESC LIMIT 1`로 조인해서 computed 반환.

### 수정 #3: Project 모델에 뷰포트 필드 추가
**영향 범위:** Prisma `Project` 모델
**추가 필드:**
```prisma
model Project {
  // ... 기존 필드 유지
  canvasViewportX    Float @default(0)
  canvasViewportY    Float @default(0)
  canvasViewportZoom  Float @default(1.0)
}
```
**근거:** 캔버스 뷰포트 위치/줌을 저장해야 앱 재시작 시 동일한 뷰를 복원할 수 있다.
---
## 14. 구현 순서 (프론트엔드 관점)
### Phase F-1: 기반 + 레이아웃 (3일)
1. Tailwind 설정 + CSS Variables + 디자인 토큰
2. AppShell (CSS Grid 레이아웃)
3. Header + Sidebar + Tab 네비게이션
4. Zustand 4개 스토어 초기 설정
5. WebSocket Provider + 연결 관리

### Phase F-2: 대시보드 + 캔버스 코어 (4일)
1. Dashboard 컴포넌트 + DashboardCard
2. Canvas 설정 (ReactFlow Provider, 배경, 그리드)
3. BaseNode (Dual-DOM Semantic Zoom)
4. CustomEdge 3종 (sequence, dependency, related)
5. CanvasControls (줌, 핏 투 뷰)

### Phase F-3: 사이드패널 (4일)
1. SidePanel (3모드 전환 + 애니메이션)
2. PanelHeader + TabBar
3. OverviewTab (설명 + 결정사항 + 연결노드)
4. SessionsTab (세션 목록 + 로그 뷰어)

### Phase F-4: 터미널 + 세션 (3일)
1. TerminalSection (접힘/확장 + 드래그 리사이즈)
2. TerminalView (xterm.js 통합 + PTY 연결)
3. SessionEndPrompt (3초 타이머 + hover 일시정지)
4. WS 이벤트 연결 (session:started, session:ended, node:stateChanged)

### Phase F-5: 결정사항 + 비즈니스 로직 (2일)
1. DecisionItem (⭐ 토글 + ↗ 노드 승격)
2. SessionLogViewer (구조화 로그 + ⭐ 마킹)
3. 노드 상태 수동 변경 (StatusDropdown)

### Phase F-6: Command Palette + 폴리시 (2일)
1. CommandPalette (cmdk + 검색 + 액션)
2. 키보드 단축키 전체 연결
3. 캔버스 컨텍스트 메뉴 (우클릭)
4. 토스트 알림 + 에러 UX 통합
---
## 15. 프론트엔드 ↔ 백엔드 통합 체크리스트

| 통합 포인트 | 프론트 응답 | 백엔드 응답 | 검증 방법 |
|------------|-----------|-----------|----------|
| 대시보드 로드 | `GET /api/projects/:pid/dashboard` 호출 | DashboardResponse 반환 | 카드에 노드 제목+상태+마지막작업시간 표시 |
| 캔버스 로드 | `GET /api/projects/:pid/canvas` 호출 | CanvasResponse 반환 | 노드+엣지+뷰포트 복원 |
| 노드 클릭 | `GET /api/nodes/:id` 호출 | Node 상세 반환 | 패널에 전체 정보 표시 |
| 세션 시작 | `POST /api/nodes/:nid/sessions` | Session + PTY spawn | 터미널 활성화 + xterm.js 렌더링 |
| PTY 입출력 | WS `pty:input` / `pty:data` | 양방향 스트리밍 | 키 입력 → 터미널 출력 확인 |
| 상태 자동 변경 | WS `node:stateChanged` 수신 | Track A 실행 | 캔버스 노드 상태 색상 변경 확인 |
| ⭐ 하이라이트 | `POST /api/decisions` 호출 | Decision INSERT | OverviewTab 결정사항 목록 업데이트 |
| 노드 승격 | `POST /api/decisions/:id/promote` | 트랜잭션 | 캔버스에 새 노드+엣지 렌더링 |
| 뷰포트 저장 | debounce 후 `PUT /api/projects/:pid/canvas/viewport` | DB 저장 | 앱 재시작 시 동일 뷰 |

---
> **이 프론트엔드 개발 설계서는 UXUI 설계서의 모든 시각적/인터랙션 요구사항을 구현 가능한 수준으로 분해한 것입니다. Sora가 디자인 토큰과 컴포넌트 스타일링을, Hana가 인터랙션 시퀀스와 에러 UX를, Taesu가 구현 아키텍처와 성능 최적화를 설계했으며, 백엔드 설계와 충돌된 3건을 식별하여 수정을 협의했습니다.**
