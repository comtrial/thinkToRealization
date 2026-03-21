# DevFlow — AI 개발 워크플로 자동화 플랫폼

> AI CLI 세션의 작업 흐름을 캔버스에서 시각화하고, MCP 프로토콜로 **다른 AI 세션이 자동으로 작업 상태를 관리**하는 풀스택 플랫폼

**Live**: https://think-to-realization.vercel.app
**MCP Guide**: https://think-to-realization.vercel.app/guide

---

## 목차

1. [프로젝트 개요 — 무엇을, 왜](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [핵심 기술 구현 상세](#3-핵심-기술-구현-상세)
4. [MCP 서버 — AI 세션 간 자동 연동](#4-mcp-서버--ai-세션-간-자동-연동)
5. [실전 적용 사례](#5-실전-적용-사례)
6. [기술 스택 & 선택 근거](#6-기술-스택--선택-근거)
7. [배운 것들 — 실전에서 마주친 문제와 해결](#7-배운-것들)

---

## 1. 프로젝트 개요

### 문제 정의

AI CLI(Claude Code)로 대규모 프로젝트를 수행할 때, **여러 세션이 동시에 다른 작업을 하면서도 전체 진행 상황을 한 곳에서 추적**해야 하는 문제가 있습니다.

```
기존 워크플로:
  CLI 세션 A: Step 1 구현 중
  CLI 세션 B: Step 3 구현 중
  개발자: 브라우저 → Notion/Linear → 수동으로 상태 업데이트 → CLI로 복귀
  → 컨텍스트 스위칭 비용이 높고, 상태 추적이 누락됨

해결한 워크플로:
  CLI 세션 A: Step 1 구현 완료 → ttr_update_status(#01, "done") ← MCP 자동 호출
  CLI 세션 B: ttr_get_dashboard() → "A가 Step 1 끝냄, 내가 Step 3 하면 됨"
  대시보드: 실시간 반영, 브라우저에서 확인 가능
  → CLI를 떠나지 않고 전체 프로젝트 관리
```

### 이 프로젝트가 보여주는 것

| 역량 | 구현 |
|------|------|
| **AI-native 문제 정의** | LLM CLI 세션의 워크플로 자체를 프로덕트로 구조화 |
| **LLM 프레임워크 활용** | MCP(Model Context Protocol) 서버 구현 — AI가 도구를 호출하는 표준 프로토콜 |
| **API 설계 & 배포** | Next.js REST API + Vercel 배포 + Supabase PostgreSQL |
| **데이터 파이프라인** | 실시간 이벤트 → DB → 대시보드 반영 |
| **풀스택 프로덕션** | 인증, 권한, 실시간 저장, 캔버스 시각화 |

---

## 2. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code CLI (어떤 프로젝트든)                              │
│  "Step 1 완료, TTR 업데이트해줘"                                │
└──────────┬──────────────────────────────────────────────────┘
           │ MCP Protocol (stdin/stdout, JSON-RPC 2.0)
           │
┌──────────▼──────────────────────────────────────────────────┐
│  TTR MCP Server (로컬 프로세스)                                │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ 8개 도구     │  │ Auth Manager  │  │ API Client         │  │
│  │ list_nodes  │  │ 쿠키 캐시     │  │ fetch + 재인증      │  │
│  │ update_st.. │  │ 자동 갱신     │  │ 에러 핸들링         │  │
│  └────────────┘  └──────────────┘  └────────────────────┘  │
└──────────┬──────────────────────────────────────────────────┘
           │ HTTPS (REST API)
           │
┌──────────▼──────────────────────────────────────────────────┐
│  TTR Web Service (Vercel)                                    │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐               │
│  │ Next.js   │  │ Prisma ORM │  │ iron-session│               │
│  │ App Router│  │ PostgreSQL │  │ Cookie Auth │               │
│  │ REST API  │  │ + SQLite   │  │ + RBAC      │               │
│  └──────────┘  └───────────┘  └────────────┘               │
│  ┌──────────────────────────────────────────┐               │
│  │ React 클라이언트                           │               │
│  │ Canvas (ReactFlow) + Dashboard + Panel    │               │
│  │ Zustand 상태관리 + 실시간 자동저장           │               │
│  └──────────────────────────────────────────┘               │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│  Supabase PostgreSQL (프로덕션 DB)                            │
│  User, Project, Node, Edge, Comment, Decision, Session...   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 핵심 기술 구현 상세

### 3.1 MCP (Model Context Protocol) 서버

**MCP란?**

Anthropic이 만든 개방형 표준 프로토콜로, **LLM이 외부 도구를 호출**할 수 있게 합니다. JSON-RPC 2.0 기반이며, `stdin/stdout`으로 LLM과 통신합니다.

```
일반 API 호출:      개발자 → curl → API → 응답
MCP 도구 호출:      LLM → MCP 프로토콜 → MCP 서버 → API → 응답 → LLM

차이점: LLM이 "도구 목록"을 보고, 상황에 맞는 도구를 스스로 선택하여 호출합니다.
이것이 "AI-native"한 인터페이스입니다.
```

**구현 구조** (`mcp-server/src/`)

```typescript
// index.ts — 엔트리포인트
// 1. ~/.ttr-mcp/.env에서 인증 정보 로드
// 2. TTR API 클라이언트 생성
// 3. MCP 서버 생성 + StdioTransport 연결
const client = new TTRClient(baseUrl, email, password)
const server = createServer(client)
await server.connect(new StdioServerTransport())
```

```typescript
// server.ts — 도구 등록 (8개)
// McpServer 인스턴스에 도구를 등록하면,
// LLM이 도구 목록을 받아서 상황에 맞게 호출합니다.
server.tool(
  "ttr_update_status",                    // 도구 이름
  "노드 상태 변경",                         // 설명 (LLM이 이걸 보고 판단)
  { nodeId: z.string(), status: z.enum([...]) },  // 파라미터 스키마
  async ({ nodeId, status }) => { ... }   // 실행 로직
)
```

**왜 이게 기술적으로 의미 있는가:**

1. **도구 스키마 설계** — LLM이 파라미터를 정확히 생성할 수 있도록 Zod 스키마로 타입을 강제합니다. 잘못된 입력은 런타임 전에 차단됩니다.

2. **인증 자동화** — iron-session 쿠키 기반 인증을 MCP 서버가 투명하게 처리합니다. 쿠키 캐시 + 만료 감지 + 자동 재로그인. LLM은 인증을 신경 쓸 필요 없습니다.

3. **에러 전파** — API 에러를 MCP 응답 형식(`isError: true`)으로 변환하여, LLM이 에러를 이해하고 재시도하거나 사용자에게 안내할 수 있습니다.

---

### 3.2 인증 시스템 — iron-session + 자동 재인증

**iron-session이란?**

서버 사이드에서 쿠키를 **암호화**(sealed)하여 저장하는 세션 관리 방식입니다. JWT와 달리 쿠키 내용이 암호화되어 클라이언트에서 읽을 수 없습니다.

```
JWT 방식:    eyJhbGc... (Base64, 누구나 디코딩 가능)
iron-session: Fe26.2*1*3002a... (AES-256 암호화, 서버 키 없이 해독 불가)
```

**MCP 서버에서의 인증 흐름:**

```
1. 서버 시작 → ~/.ttr-mcp/session.json에서 캐시된 쿠키 로드
2. 쿠키 유효? → 그대로 사용 (7일 TTL)
3. 쿠키 만료/없음? → POST /api/auth/login → 새 쿠키 획득 → 캐시 저장
4. API 호출 중 401? → 쿠키 클리어 → 재로그인 → 요청 재시도
```

```typescript
// auth.ts — 쿠키 수명 관리
async function getValidCookie(baseUrl, email, password) {
  const cached = loadSession()     // ~/.ttr-mcp/session.json
  if (cached) return cached.cookie // 6일 이내면 재사용
  return login(baseUrl, email, password) // 만료 시 재로그인
}
```

**왜 이 설계인가:**

- API Key 방식은 TTR 코드 수정이 필요 → 쿠키 재사용으로 **서버 변경 없이** 연동
- 쿠키 TTL 7일이지만 6일로 사전 갱신 → 만료 직전 에러 방지
- 401 응답 시 자동 재인증 → 사용자가 인증을 의식하지 않음

---

### 3.3 실시간 자동 저장 시스템

노드의 설명(description)을 편집할 때, **타이핑 중에는 debounce, 이탈 시에는 즉시 저장**하는 하이브리드 전략을 사용합니다.

**문제와 해결 과정:**

```
문제 1: Tiptap(WYSIWYG 에디터)의 useEditor는 초기화 시 콜백을 고정
→ props가 바뀌어도 onBlur 콜백이 갱신 안 됨 (stale closure)
→ 해결: useRef로 콜백을 래핑, 항상 최신 함수 참조

문제 2: debounce 중 다른 노드로 전환하면 selectedNode가 바뀜
→ 이전 노드의 내용이 새 노드에 저장되는 버그
→ 해결: pending에 {nodeId, content}를 함께 저장, flush 시 저장된 nodeId 사용

문제 3: 컴포넌트 언마운트 시 pending save가 소멸
→ 해결: fetch + keepalive:true로 브라우저가 요청 완료를 보장

문제 4: 대용량 마크다운 붙여넣기 시 Zod 5000자 제한으로 조용히 실패
→ 해결: 50000자로 확장 + 저장 상태 인디케이터 추가 (저장 중/저장됨/실패)
```

```typescript
// 5가지 저장 트리거 (어떤 상황에서든 데이터 유실 방지)
1. 타이핑 → 500ms debounce → 저장
2. 에디터 blur (포커스 이탈) → 즉시 flush
3. 노드 전환 (selectedNode.id 변경) → 이전 노드 즉시 flush
4. 패널 닫기 / 탭 전환 → flush
5. 컴포넌트 언마운트 → fetch + keepalive
```

---

### 3.4 캔버스 시스템 — ReactFlow + 시맨틱 줌

**Dual-DOM 시맨틱 줌:**

노드가 작을 때(줌 아웃)는 compact 뷰, 클 때(줌 인)는 expanded 뷰를 보여줍니다. **React 리렌더 없이** CSS opacity만 토글합니다.

```
줌 < 0.8: compact 뷰 (제목 + 상태 뱃지만)
줌 > 0.8: expanded 뷰 (설명, 세션 수, 결정 수 포함)

구현: 두 DOM을 동시에 렌더, opacity 0/1 전환
→ 줌 변경 시 React 리렌더 0회
→ 30+ 노드에서도 부드러운 줌 인/아웃
```

**노드 포커스 (MCP 연동):**

대시보드에서 "캔버스에서 보기" 버튼을 누르면, ReactFlow의 `setCenter`를 호출하여 해당 노드로 부드럽게 이동합니다.

```typescript
// ui-store.ts
focusNodeOnCanvas: (nodeId) => set({
  activeTab: 'canvas',
  focusNodeId: nodeId,
  panelMode: 'peek',
  panelNodeId: nodeId,
})

// CanvasView.tsx — focusNodeId 감지
useEffect(() => {
  if (!focusNodeId) return
  const node = nodes.find(n => n.id === focusNodeId)
  if (node) setCenter(x, y, { zoom: 1.2, duration: 400 })
  clearFocusNode()
}, [focusNodeId])
```

---

### 3.5 권한 시스템 — RBAC (Role-Based Access Control)

```
소유자(owner) > 관리자(admin) > 멤버(member)

- 프로젝트 생성자 → 자동으로 owner
- owner만 admin 역할 부여 가능
- 모든 API 라우트에서 requireProjectAccess() 가드
- MCP 서버도 동일한 권한 체계를 통과
```

---

### 3.6 데이터 모델 — 관계형 설계

```
Project ──< Node ──< Comment
               │──< Decision
               │──< Session ──< SessionFile
               │──< Edge (outEdges/inEdges)
               │──< Attachment
               │──< Plan
               ├──< NodeStateLog (감사 로그)
               └──? Node (parentNodeId 자기참조)
```

**핵심 설계 결정:**

- `parentNodeId` 자기참조: Phase → Day → Step 계층 구조
- `Edge` 별도 테이블: sequence, dependency, related 등 다양한 관계 표현
- `NodeStateLog`: 모든 상태 변경 이력 추적 (누가, 언제, 어떤 트리거로)
- 듀얼 DB: 로컬 SQLite + 프로덕션 Supabase PostgreSQL (Prisma 추상화)

---

## 4. MCP 서버 — AI 세션 간 자동 연동

### 4.1 도구 목록 (8개)

| 도구 | 용도 | API | 특이사항 |
|------|------|-----|---------|
| `ttr_list_projects` | 프로젝트 목록 | GET /api/projects | |
| `ttr_get_dashboard` | 대시보드 요약 | GET /api/projects/{id}/dashboard | 진행률(%) 자동 계산 |
| `ttr_list_nodes` | 노드 목록 | GET /api/projects/{id}/nodes | 상태 필터 지원 |
| `ttr_get_node` | 노드 상세 | GET /api/nodes/{id} | 세션, 결정, 엣지 포함 |
| `ttr_update_status` | 상태 변경 | PUT /api/nodes/{id}/status | 담당자 미할당 시 자동 할당 + 출처 코멘트 |
| `ttr_update_node` | 노드 수정 | PUT /api/nodes/{id} | assignToMe 파라미터 |
| `ttr_add_comment` | 코멘트 추가 | POST /api/nodes/{id}/comments | via 파라미터로 세션 출처 추적 |
| `ttr_add_decision` | 결정 기록 | POST /api/decisions | via 파라미터 |

### 4.2 세션 추적 (via 파라미터)

여러 CLI 세션이 동시에 TTR을 업데이트할 때, **어떤 세션이 무엇을 변경했는지** 추적합니다.

```
CLI 세션 A (Commerce Intel Agent):
  ttr_update_status(#01, "done", via="Commerce Intel CLI", note="DB 7개 테이블 완료")

TTR 대시보드에서 보이는 코멘트:
  💬 [via Commerce Intel CLI] 상태 변경: → done DB 7개 테이블 완료

→ 어떤 세션이, 언제, 무엇을 바꿨는지 즉시 파악 가능
```

### 4.3 등록 방법

```json
// ~/.claude/.mcp.json (글로벌 — 모든 CLI 세션에서 사용)
{
  "mcpServers": {
    "ttr": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-server/src/index.ts"],
      "cwd": "/path/to/mcp-server"
    }
  }
}
```

CLI가 시작되면 MCP 서버가 자동으로 spawn되고, LLM의 도구 목록에 `ttr_*` 8개가 추가됩니다.

---

## 5. 실전 적용 사례

### Commerce Intel Agent 프로젝트 관리

25개 구현 Step + 8개 마일스톤 = **35개 노드**를 생성하고, 54개 엣지(sequence, dependency, related)로 연결했습니다.

```
스크립트 1회 실행으로:
- 35개 노드 생성 (Phase 3개 + Day 7개 + Step 25개)
- 54개 엣지 생성 (순서 16 + 의존 27 + 부모-자식 7 + 연관 4)
- 계층형 제목 접두어: P1.D1.#01. ~ P3.D7.#25.
- 전체 캔버스 좌표 배치

다른 CLI 세션에서:
- ttr_get_dashboard → 전체 진행률 확인
- ttr_update_status → Step 완료 시 자동 상태 변경
- ttr_add_comment → 각 Step 완료 내용 기록
- ttr_add_decision → 기술 결정 사항 기록
```

---

## 6. 기술 스택 & 선택 근거

| 레이어 | 기술 | 선택 근거 |
|--------|------|----------|
| **프레임워크** | Next.js 14 (App Router) | API + SSR 통합, Vercel 배포 최적화 |
| **DB** | Prisma + SQLite/PostgreSQL | 로컬/프로덕션 듀얼 DB, 타입 안전 ORM |
| **인증** | iron-session | 서버 사이드 암호화, JWT보다 안전 |
| **상태 관리** | Zustand v5 | 작은 번들, useShallow로 불필요한 리렌더 방지 |
| **캔버스** | @xyflow/react | 노드 그래프 시각화, 줌/패닝/엣지 내장 |
| **에디터** | Tiptap (ProseMirror) | 마크다운 ↔ HTML 변환, 모바일 툴바 |
| **MCP** | @modelcontextprotocol/sdk | Anthropic 공식 MCP 표준 |
| **배포** | Vercel + Supabase | 서버리스 + 관리형 PostgreSQL |
| **검증** | Zod 4 | 런타임 타입 검증, API 스키마 강제 |

---

## 7. 배운 것들

### Tiptap useEditor의 stale closure
`useEditor`는 초기화 시 콜백을 고정합니다. props가 바뀌어도 내부 콜백은 갱신되지 않습니다. **해결**: `useRef`로 콜백을 래핑하여 항상 최신 함수를 참조.

### debounce + 컴포넌트 전환 = 잘못된 대상에 저장
`saveDescription`이 closure로 `selectedNode.id`를 캡처하면, 노드 전환 후 debounce가 실행될 때 새 노드 ID로 저장됩니다. **해결**: pending에 `{nodeId, content}`를 함께 저장.

### Zod validation 제한의 silent failure
5000자 제한을 넘는 마크다운을 붙여넣으면 API가 validation error를 반환하지만, 프론트엔드에서 에러 표시 없이 조용히 실패합니다. **해결**: 제한 확대 + 저장 상태 인디케이터 필수.

### Vercel 빌드 캐시와 tsconfig.json
`tsconfig.json`의 `include: ["**/*.ts"]`가 `mcp-server/src/*.ts`까지 포함시켜, `@modelcontextprotocol/sdk` import가 Next.js 빌드를 깨뜨렸습니다. **해결**: `exclude`에 `mcp-server` 추가.

### MCP 서버의 인증 순환 문제
iron-session 쿠키는 7일 만료. 장기 실행 MCP 서버에서 쿠키가 만료되면 모든 요청이 실패합니다. **해결**: 401 응답 감지 → 자동 재로그인 → 요청 재시도.

---

## 파일 구조

```
thinkToRealization/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # 메인 (캔버스 + 대시보드)
│   │   ├── guide/page.tsx           # MCP 가이드 (public)
│   │   └── api/                     # REST API (20+ 라우트)
│   ├── components/
│   │   ├── canvas/                  # ReactFlow 캔버스
│   │   ├── dashboard/               # 대시보드 뷰
│   │   ├── panel/                   # 사이드 패널 (노드 상세)
│   │   └── shared/                  # 공통 컴포넌트
│   ├── stores/                      # Zustand (UI, Canvas, Node, Session)
│   └── lib/
│       ├── auth/                    # iron-session + RBAC
│       └── schemas/                 # Zod 스키마
├── mcp-server/                      # MCP 서버 (별도 패키지)
│   └── src/
│       ├── index.ts                 # 엔트리포인트
│       ├── server.ts                # 8개 도구 등록
│       ├── client.ts                # TTR API 클라이언트
│       └── auth.ts                  # 쿠키 캐시 + 자동 재인증
├── prisma/                          # DB 스키마 + 마이그레이션
└── docs/                            # 설계 문서
```
