# DevFlow 프론트엔드 개발 명세서

**작성자:**

- 🎨 **Yuna** — UI 전문가 (shadcn/ui, Tailwind CSS, 컴포넌트 아키텍처)
- ⚡ **Joon** — Next.js 전문가 (App Router, API Routes, WebSocket, 서버 아키텍처)
**대상:** Claude CLI를 통해 개발하는 프론트엔드 개발자

---

## 0. 기술 스택 확정

| 영역 | 기술 | 버전 | 비고 |
| 프레임워크 | Next.js | 14.x | App Router |
| 언어 | TypeScript | 5.x | strict mode |
| ORM | Prisma | 5.x | SQLite → PostgreSQL 전환 대비 |
| 상태관리 | Zustand | 4.x | persist middleware 포함 |
| 터미널 | xterm.js | 5.x |   • @xterm/addon-fit, @xterm/addon-webgl |
| 터미널 백엔드 | node-pty | 1.x | WebSocket 통신 |
| WebSocket | ws | 8.x | 커스텀 서버 필요 |
| UI | shadcn/ui | latest | Tailwind CSS 기반 |
| 아이콘 | lucide-react | latest | shadcn 기본 |
| 리사이즈 | react-resizable-panels | 2.x | 패널 분할 |
| 마크다운 | react-markdown + remark-gfm | latest | 세션 렌더링 |
| 날짜 | date-fns | 3.x | 타임스탬프 |
| ID | nanoid | 5.x | 짧은 고유 ID |
| 폰트 | JetBrains Mono | — | CLI 터미널용 |
| 폰트 | Geist (Sans + Mono) | — | UI 본문용 |

### ⚡ Joon: 커스텀 서버가 필요한 이유

> xterm.js + node-pty 조합은 WebSocket이 필수. Next.js 기본 서버는 WebSocket을 네이티브 지원하지 않으므로 `server.ts`로 커스텀 서버를 만들어 HTTP 서버 위에 WebSocket 서버를 올려야 함. API Routes는 그대로 Next.js App Router 사용.

---

## 1. 프로젝트 구조

```javascript
devflow/
├── server.ts                    # 커스텀 서버 (HTTP + WebSocket)
├── prisma/
│   └── schema.prisma            # DB 스키마
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # 루트 레이아웃
│   │   ├── page.tsx             # 대시보드 (Level 1)
│   │   ├── project/
│   │   │   └── [id]/
│   │   │       └── page.tsx     # 워크스페이스 (Level 2+3)
│   │   └── api/
│   │       ├── projects/        # 프로젝트 CRUD
│   │       ├── stages/          # 단계 업데이트
│   │       ├── sessions/        # 세션 관리
│   │       ├── decisions/       # 결정사항
│   │       └── activities/      # 활동 타임라인
│   ├── components/
│   │   ├── ui/                  # shadcn/ui
│   │   ├── dashboard/           # 대시보드 컴포넌트
│   │   ├── workspace/           # 워크스페이스 컴포넌트
│   │   ├── terminal/            # CLI 패널
│   │   ├── timeline/            # 타임라인
│   │   └── shared/              # 공통 컴포넌트
│   ├── stores/                  # Zustand
│   ├── hooks/                   # 커스텀 훅
│   ├── lib/                     # 유틸리티
│   └── types/                   # 타입 정의
└── public/fonts/                # JetBrains Mono
```

---

## 2. Prisma 스키마

```javascript
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"          // → "postgresql" for Supabase
  url      = env("DATABASE_URL")
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      String   @default("active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  stages     Stage[]
  activities Activity[]
  @@map("projects")
}

model Stage {
  id         String   @id @default(cuid())
  projectId  String   @map("project_id")
  name       String
  orderIndex Int      @map("order_index")
  status     String   @default("waiting")
  summary    String?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sessions   Session[]
  decisions  Decision[]
  activities Activity[]
  @@map("stages")
}

model Session {
  id          String   @id @default(cuid())
  stageId     String   @map("stage_id")
  title       String?
  autoSummary String?  @map("auto_summary")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  stage     Stage      @relation(fields: [stageId], references: [id], onDelete: Cascade)
  messages  Message[]
  decisions Decision[]
  @@map("sessions")
}

model Message {
  id        String   @id @default(cuid())
  sessionId String   @map("session_id")
  role      String
  content   String
  isPinned  Boolean  @default(false) @map("is_pinned")
  createdAt DateTime @default(now()) @map("created_at")
  session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@map("messages")
}

model Decision {
  id        String   @id @default(cuid())
  stageId   String   @map("stage_id")
  sessionId String?  @map("session_id")
  content   String
  context   String?
  createdAt DateTime @default(now()) @map("created_at")
  stage   Stage    @relation(fields: [stageId], references: [id], onDelete: Cascade)
  session Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  @@map("decisions")
}

model Activity {
  id           String   @id @default(cuid())
  projectId    String   @map("project_id")
  stageId      String?  @map("stage_id")
  activityType String   @map("activity_type")
  description  String?
  createdAt    DateTime @default(now()) @map("created_at")
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stage   Stage?  @relation(fields: [stageId], references: [id], onDelete: SetNull)
  @@map("activities")
}
```

Supabase 전환 시: `provider`와 `url`만 변경. cuid를 일관 사용하면 전환이 가장 깔끔.

---

## 3. 화면별 상세 명세

### 3.1 대시보드 (Level 1)

**경로:** `src/app/page.tsx` (서버 컴포넌트)

**컴포넌트 구성:**

- `AppHeader` — 상단 네비게이션
- `RecentActivityCard` — 복귀 프라이밍 (가장 중요)
- `ProjectGrid` + `ProjectCard` — 프로젝트 목록
- `CreateProjectDialog` — 새 프로젝트 생성
**shadcn 컴포넌트:** Card, Button, Badge, Dialog, Input

**RecentActivityCard 레이아웃:**

```javascript
┌─────────────────────────────────────────────────┐
│ 🟢 프로젝트명                                       │
│ 📍 "기능 구조화" 단계에서 작업 중단                │
│ 🕛 마지막: 2시간 전 | 📌 최근 결정: "CLI only"  │
│                                  [이어서 작업 →]   │
└─────────────────────────────────────────────────┘
```

**핵심:** [이어서 작업 →] 버튼으로 원클릭 복귀. 프라이밍에 필요한 3가지: 단계명 + 마지막 결정사항 + 경과 시간.

**ProjectCard:**

```javascript
┌─────────────┐
│ 프로젝트명    │
│              │
│ ●●●●●○      │  ← 6개 도트 (단계별 상태)
│ 기능 구조화   │  ← 현재 단계명
│ 2시간 전     │  ← 마지막 활동
└─────────────┘
```

**CreateProjectDialog:** 입력 필드 프로젝트명 1개만. Apple 원칙: 최소 입력.

---

### 3.2 프로젝트 워크스페이스 (Level 2+3) — 핵심 화면

**경로:** `src/app/project/[id]/page.tsx`

**전체 구조:**

```javascript
┌─────────────────────────────────────────────────┐
│ AppHeader (← 대시보드 | 프로젝트명 | 설정)       │
├─────────────────────────────────────────────────┤
│ PipelineBar (수평 노드 체인, 상단 고정)           │
│ [아이디어]─→[문제정의]─→[기능구조화]─→...      │
├───────────────────┬─────────────────────────────┤
│ StagePanel (30%)  │ CLIPanel (70%)                │
│ 📌 결정사항        │ xterm.js 터미널               │
│ 💬 세션 목록       │ (WebSocket 통신)              │
│ 단계 이동 버튼    │                               │
├───────────────────┴─────────────────────────────┤
│ TimelineBar (접기 가능)                            │
└─────────────────────────────────────────────────┘
```

**shadcn 컴포넌트:** ResizablePanelGroup, ResizablePanel, ResizableHandle, ScrollArea, Separator, Badge, Tooltip, Button

**몰입 모드 (Cmd+):** 좌측 패널 접힘 + CLI 전체 너비 + 상단 파이프라인 유지

**⚡ Joon 주의:** `flex-1 min-h-0` 반드시 함께 사용. 빠지면 터미널이 무한 늘어남.

---

### 3.3 PipelineBar (수평 노드 체인)

**컴포넌트:** `pipeline-bar.tsx`, `stage-node.tsx`, `node-connector.tsx`

**StageNode 상태별 스타일:**

| 상태 | 배경 | 테두리 | 텍스트 | 아이콘 |
| waiting | bg-gray-800 | border-gray-700 | text-gray-500 | Circle |
| active | bg-blue-500/10 | border-blue-500 | text-blue-400 | PlayCircle |
| completed | bg-green-500/10 | border-green-500/50 | text-green-400 | CheckCircle |

**현재 선택된 노드(좌측 패널에 표시 중):** `ring-2 ring-blue-400/50` 추가

**NodeConnector:** 완료 구간 `bg-green-500/50`, 미완료 `bg-gray-700`. ChevronRight 아이콘.

---

### 3.4 StagePanel (좌측 패널)

**컴포넌트:** `stage-panel.tsx`, `decision-list.tsx`, `decision-item.tsx`, `session-list.tsx`, `session-item.tsx`, `stage-actions.tsx`

**구조:**

```javascript
┌───────────────────┐
│ 단계명 + 상태          │
├───────────────────┤
│ 📌 결정사항 (N개)       │
│ • 항목 1              │
│ • 항목 2              │
├───────────────────┤
│ 💬 세션 (N개)          │
│ #3 제목 | 📌2 | 2h전  │
│ #2 제목 | 📌3 | 어제   │
│ #1 제목 | 📌1 | 3일전 │
│ [+ 새 세션]            │
├───────────────────┤
│ [← 이전] [다음 →]     │
└───────────────────┘
```

**DecisionItem:** Pin 아이콘(amber-400) + 텍스트 + 삭제버튼(hover시만 노출)

**SessionItem 활성 상태:** `bg-blue-500/10 border border-blue-500/30 text-blue-300`

**새 세션 버튼:** `variant="outline"`, `border-dashed border-gray-700`

---

### 3.5 StageTransitionModal

**트리거:** "다음 단계 →" 버튼 클릭

**shadcn:** Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Textarea, Button

**동작:**

1. 결정사항들을 조합해 자동 요약 초안 생성 → Textarea 기본값
1. Susan이 수정하거나 그대로 확인
1. [건너뛰기] 버튼: 요약 없이 이동 (강제 아님)
1. [저장하고 이동]: 현재 단계 → completed, 다음 단계 → active
---

### 3.6 CLIPanel (터미널)

**아키텍처:**

```javascript
[브라우저]                    [서버]
xterm.js  ←── WebSocket ──→  ws 서버 ←──→ node-pty
                                │
                                ├── onData → 캐시 → DB
                                └── resize → pty.resize()
```

**컴포넌트:** `cli-panel.tsx`, `terminal-header.tsx`, `terminal-instance.tsx`

**TerminalHeader:**

```javascript
┌─────────────────────────────────────┐
│ 🖥️ 세션명                [📌 핀] [⬜ 확장] │
└─────────────────────────────────────┘
```

**xterm.js 테마 설정:**

```javascript
background: "#030712"    (gray-950)
foreground: "#e5e7eb"    (gray-200)
cursor: "#3b82f6"        (blue-500)
fontSize: 14
fontFamily: "JetBrains Mono"
cursorBlink: true
cursorStyle: "bar"
scrollback: 10000
```

**⚡ Joon: 커스텀 서버 **`**server.ts**`**는 별도 문서에 전체 코드 포함** (프론트엔드 명세서 .md 파일 참고)

---

## 4. Zustand 스토어

### 4.1 project-store

| 상태 | 타입 | 용도 |  |
| project | Project \ | null | 현재 프로젝트 |
| stages | Stage[] | 단계 목록 |  |
| activeStageId | string \ | null | 활성 단계 |
| 액션 | 설명 |  |  |
| -------- | ------ |  |  |
| setActiveStage(id) | 단계 전환 (좌측 패널만 변경, CLI 유지) |  |  |
| updateStageStatus(id, status) | 단계 상태 변경 |  |  |
| transitionToNextStage(summary?) | 단계 전환 (API 호출 + 상태 업데이트 + 활동 기록) |  |  |

### 4.2 session-store

| 상태 | 타입 | 용도 |  |
| activeSessionId | string \ | null | 활성 세션 |
| sessions | Session[] | 세션 목록 |  |
| 액션 | 설명 |  |  |
| -------- | ------ |  |  |
| createSession(stageId) | 새 세션 생성 + 활동 기록 |  |  |
| setActiveSession(id) | 세션 전환 |  |  |

### 4.3 ui-store (persist)

| 상태 | 기본값 | 용도 |
| isFocusMode | false | 몰입 모드 |
| isTimelineOpen | true | 타임라인 표시 |
| stagePanelSize | 30 | 좌측 패널 크기(%) |

`persist` 미들웨어로 `localStorage`에 UI 상태 유지.

---

## 5. 키보드 단축키

| 단축키 | 기능 | 비고 |
| `Cmd+P` | 핀 (결정사항 저장) | 브라우저 인쇄 방지됨 |
| `Cmd+\` | 몰입 모드 토글 | 충돌 없음 |
| `Cmd+Shift+N` | 새 세션 | Cmd+N 브라우저 충돌 회피 |
| `Cmd+Shift+→` | 다음 단계 | Cmd+→ 충돌 회피 |
| `Cmd+Shift+←` | 이전 단계 | Cmd+← 충돌 회피 |
| `Cmd+Shift+/` | 단축키 가이드 | 충돌 없음 |
| `Cmd+Z` | 핀 취소 (마지막) | Undo와 분리 필요 |

**⚡ Joon:** 터미널에 포커스 중일 때 Cmd 조합만 시스템이 가로챠 수 있음. `window.addEventListener("keydown")`으로 구현.

---

## 6. API Routes

### 프로젝트

```javascript
GET    /api/projects                 → Project[]
POST   /api/projects                 → Project (기본 6단계 자동 생성)
GET    /api/projects/[id]            → Project (with stages, decisions)
PATCH  /api/projects/[id]            → Project
DELETE /api/projects/[id]            → cascade delete
```

### 단계

```javascript
GET    /api/projects/[id]/stages     → Stage[]
PATCH  /api/stages/[id]              → Stage (status, summary)
```

### 세션

```javascript
GET    /api/stages/[id]/sessions     → Session[]
POST   /api/stages/[id]/sessions     → Session
GET    /api/sessions/[id]            → Session (with messages)
PATCH  /api/sessions/[id]            → Session
DELETE /api/sessions/[id]            → void
```

### 결정사항

```javascript
POST   /api/decisions                → Decision
PATCH  /api/decisions/[id]           → Decision
DELETE /api/decisions/[id]           → void
```

### 활동

```javascript
GET    /api/activities?projectId=xxx → Activity[]
POST   /api/activities               → Activity
```

### 기본 단계 템플릿

```typescript
export const DEFAULT_STAGES = [
  { name: "아이디어 발산" },
  { name: "문제 정의" },
  { name: "기능 구조화" },
  { name: "기술 설계" },
  { name: "구현" },
  { name: "검증/회고" },
];
```

---

## 7. shadcn/ui 설치

```bash
# 초기화
npx shadcn@latest init

# Phase 1 필수
npx shadcn@latest add button card badge dialog input textarea tooltip scroll-area separator resizable

# Phase 2
npx shadcn@latest add collapsible dropdown-menu toast skeleton

# Phase 3 (선택)
npx shadcn@latest add command
```

### 테마 커스터마이징 (globals.css)

| 변수 | 값 | Tailwind |
| --background | 3 7 18 | gray-950 |
| --foreground | 229 231 235 | gray-200 |
| --card | 17 24 39 | gray-900 |
| --primary | 59 130 246 | blue-500 |
| --muted | 31 41 55 | gray-800 |
| --accent | 251 191 36 | amber-400 |
| --border | 55 65 81 | gray-700 |

`className="dark"` 고정. 라이트모드 미지원.

---

## 8. 복귀 배너 & 토스트

**ReturnBanner:** 이전 단계로 복귀 시 상단 표시

```javascript
↩ "구현" 단계에서 이동함                    [돌아가기 →]
```

`bg-amber-500/10 border-amber-500/20 text-amber-300`

**PinToast:** 핀 저장 시 CLI 패널 상단에 2초 표시 후 자동 소멸

```javascript
📌 결정사항 저장됨
```

`bg-amber-500/10 text-amber-300 text-xs`

---

## 9. 개발 순서 (Claude CLI)

| Step | 내용 | 확인 방법 |
| 1 | Next.js + Prisma + shadcn 초기화 | `npx prisma studio` |
| 2 | 대시보드 랠들 | 브라우저에서 카드 확인 |
| 3 | 프로젝트 CRUD | 생성/조회/삭제 |
| 4 | 워크스페이스 레이아웃 | 파이프라인 + 좌우 분할 |
| 5 | 파이프라인 인터랙션 | 노드 클릭 시 좌측 전환 |
| **6** | **xterm.js 터미널** | **claude 명령어 실행** |
| 7 | 세션 관리 | 세션 생성/전환/목록 |
| 8 | 핀 기능 | Cmd+P → 결정사항 추가 |
| 9 | 단계 전환 | 모달 + 파이프라인 색상 변화 |
| 10 | 타임라인 + 폴리시 | 전체 플로우 테스트 |

---

## 10. 트러블슈팅 가이드

| 문제 | 원인 | 해결 |
| xterm 높이 무한 | 부모에 고정 높이 없음 | `h-full min-h-0` 체인 |
| WebSocket 실패 | Next.js 기본 WS 미지원 | `server.ts` 커스텀 서버 |
| node-pty 빌드 에러 | native addon | `npm rebuild` |
| 한글 깨짐 | locale 미설정 | `LANG: "ko_KR.UTF-8"` |
| Cmd+P 인쇄 | preventDefault 미적용 | keydown 핸들러 확인 |
| 몰입모드 리사이즈 | fit() 미호출 | isFocusMode 변경 시 fit() |

### UI 주의사항

| 항목 | 가이드라인 |
| 토스트 | 2초 자동 소멸, 최대 1개 |
| 모달 | 단계 전환만 허용 |
| 애니메이션 | 200ms ease-out, 300ms 이하 |
| 호버 | 삭제 버튼은 hover시만 |
| 빈 상태 | 안내 텍스트 + CTA |
| 다크모드 | 고정, 라이트모드 미지원 |

