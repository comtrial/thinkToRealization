# DevFlow — AI Agent 워크플로 자동화 플랫폼

> LLM이 MCP 프로토콜로 프로젝트를 직접 관리하는 시스템.
> "챗봇"을 넘어 "행동하는 AI"를 구현합니다.

**Live** https://think-to-realization.vercel.app
**MCP Guide** https://think-to-realization.vercel.app/guide

<!-- [전체 캔버스 뷰 — 35개 노드가 상태별 색상으로 구분되어 보이는 줌 아웃 스크린샷] -->

---

## 이 프로젝트는 뭘 하는가

AI CLI(Claude Code)로 개발할 때, **여러 CLI 세션이 동시에 작업하면서 진행 상황을 자동으로 관리**하는 문제를 해결합니다.

```
CLI 세션 A: "Step 1 끝났어, 업데이트해줘"
Claude: → ttr_update_status(#01, "done")     ← MCP 도구 자동 호출
        → ttr_add_comment(#01, "DB 7개 테이블 완료")

CLI 세션 B: "지금 진행 상황 어때?"
Claude: → ttr_get_dashboard()
        → "35개 중 5개 완료 (14%), 3개 진행중"
```

<!-- [CLI 터미널에서 ttr_update_status 호출 → 대시보드에 반영되는 모습 스크린샷 (터미널 + 브라우저 나란히)] -->

---

## 핵심 기능

### 1. MCP 서버 — LLM이 외부 시스템을 직접 조작

Anthropic의 [MCP(Model Context Protocol)](https://modelcontextprotocol.io/)를 구현하여, Claude CLI가 **11개 도구**로 프로젝트를 관리합니다.

```
ttr_set_session("Commerce Intel CLI")     세션 이름 설정
ttr_login(email, password)                계정 전환
ttr_get_dashboard(projectId)              진행률 조회
ttr_update_status(nodeId, "done")         상태 변경 + 출처 자동 기록
ttr_create_node(projectId, title, ...)    노드 생성 + 엣지 자동 연결
ttr_add_comment(nodeId, content)          코멘트 (CLI/웹 출처 DB 분리)
ttr_add_decision(nodeId, content)         기술 결정 기록
```

**기술적 특징:**
- LLM이 도구 스키마(Zod)를 보고 파라미터를 자동 생성
- iron-session 쿠키 인증을 MCP 서버가 투명하게 처리 (캐시 + 만료 시 자동 재로그인)
- `source`/`sourceSession` DB 필드로 CLI vs 웹 작성 구분

<!-- [노드 상세 패널의 Activity 섹션 — "CLI: Commerce Intel CLI" 배지가 붙은 코멘트와 일반 코멘트가 구분되는 스크린샷] -->

### 2. 캔버스 — 상태별 시맨틱 줌

35개 노드의 관계와 상태를 한눈에 파악할 수 있는 그래프 캔버스입니다.

**상태별 시각 구분:**

| 상태 | 시각 효과 |
|------|----------|
| in_progress | 인디고 글로우 + 왼쪽 5px 바 + 인디고 배경 |
| todo | 앰버 컬러바 + 기본 배경 |
| backlog | 점선 테두리 + 회색 배경 + 반투명 |
| done | 초록 + 페이드 + 제목 취소선 |
| archived | 매우 흐릿 + 회색 |

<!-- [캔버스 줌 아웃 — in_progress(인디고 글로우)와 backlog(점선+회색)가 확연히 구분되는 스크린샷] -->

**Dual-DOM 시맨틱 줌:**

줌 아웃 시 제목만, 줌 인 시 상세 정보를 보여줍니다. **React 리렌더 0회** — CSS opacity만 전환하여 30+ 노드에서도 60fps.

<!-- [줌 인 상태 — 노드 하나가 확대되어 설명, 세션 수, 상태 배지가 보이는 스크린샷] -->

### 3. 실시간 자동 저장 (5중 안전장치)

| 트리거 | 동작 |
|--------|------|
| 타이핑 | 500ms debounce 후 저장 |
| 에디터 blur | 즉시 flush |
| 노드 전환 | 이전 노드를 **저장된 nodeId로** flush |
| 패널/탭 전환 | flush |
| 컴포넌트 언마운트 | `fetch + keepalive:true` |

저장 상태 인디케이터: `저장 중...` → `✓ 저장됨` → `✗ 저장 실패`

<!-- [노드 설명 에디터 하단에 "✓ 저장됨" 인디케이터가 보이는 스크린샷] -->

### 4. 권한 + 출처 추적

```
RBAC: owner > admin > member
출처: NodeComment.source = "web" | "cli" | "system"
      NodeComment.sourceSession = "Commerce Intel CLI"
생성자: Node.createdByName = "최승원"
```

---

## 실전 적용: Commerce Intel Agent 관리

이커머스 수급 시그널 분석 시스템(Commerce Intel Agent)의 **25개 구현 단계**를 DevFlow에서 관리하고 있습니다.

```
스크립트 1회 실행:
  → 35개 노드 생성 (Phase 3 + Day 7 + Step 25)
  → 54개 엣지 생성 (sequence 16 + dependency 27 + parent_child 7 + related 4)
  → 계층형 제목: P1.D1.#01. ~ P3.D7.#25.
```

<!-- [대시보드 뷰 — 진행중/할일/백로그/완료 섹션으로 노드들이 분류되어 보이는 스크린샷] -->

**Commerce Intel Agent가 보여주는 AI 기술:**

| 기술 | 구현 |
|------|------|
| **Claude Tool Use 멀티턴** | Analyst Agent가 3~4개 도구를 턴마다 조합하여 인사이트 생성 |
| **Structured Output** | Normalizer가 JSON Schema로 상품 정규화 (product_key 생성) |
| **RAG** | Dense(Voyage AI) + BM25 Sparse + RRF 병합으로 카테고리 분류 |
| **Context Engineering** | Supply-Demand Matrix로 수급 상태를 LLM에 전달 → 액션 가능한 인사이트 |
| **Eval-Optimize Loop** | 자동 채점 → 실패 분석 → 프롬프트 수정 → 회귀 검사 |

---

## 아키텍처

```
Claude Code CLI
  └── MCP (stdin/stdout, JSON-RPC 2.0)
        └── TTR MCP Server (11 tools, TypeScript)
              ├── Auth: iron-session 쿠키 캐시 + 자동 재로그인
              ├── Source tracking: source/sourceSession DB 필드
              └── HTTPS → Vercel (Next.js 14 App Router)
                            ├── REST API 20+ endpoints (Zod validation)
                            ├── Prisma ORM (SQLite dev / PostgreSQL prod)
                            ├── iron-session auth + RBAC
                            └── React Client
                                  ├── ReactFlow 캔버스 (Dual-DOM semantic zoom)
                                  ├── Zustand 4 stores (UI, Canvas, Node, Session)
                                  ├── Tiptap 에디터 (table ext + turndown rules)
                                  └── 5-trigger auto-save system
```

---

## 기술 스택

| 레이어 | 기술 | 선택 이유 |
|--------|------|----------|
| Framework | Next.js 14 App Router | API + SSR 통합, Vercel 최적화 |
| DB | Prisma + SQLite/PostgreSQL | 듀얼 DB, 타입 안전 ORM |
| Auth | iron-session | AES-256 암호화 (JWT보다 안전) |
| State | Zustand v5 | 2KB 번들, useShallow 리렌더 최적화 |
| Canvas | @xyflow/react 12 | 노드 그래프, 줌/패닝/엣지 내장 |
| Editor | Tiptap + Table ext | 마크다운 ↔ HTML, 커스텀 turndown 규칙 |
| MCP | @modelcontextprotocol/sdk | Anthropic 공식 MCP 표준 |
| Deploy | Vercel + Supabase | 서버리스 + 관리형 PostgreSQL |
| Validation | Zod 4 | 런타임 타입 검증, API 스키마 강제 |

---

## 실전에서 해결한 문제들

### Tiptap 테이블 roundtrip 깨짐
마크다운 테이블 → HTML → 저장 시 turndown이 separator(`| --- |`) 누락 → 재로드 시 테이블 소멸.
**원인**: Tiptap은 `<thead>` 없이 `<tbody>`에 `<th>`를 직접 넣음. **해결**: `<tr>` 내 `<th>` 감지 후 separator 삽입.

### debounce + 노드 전환 = 잘못된 곳에 저장
`saveDescription`이 closure로 `selectedNode.id`를 캡처 → 노드 전환 후 새 노드에 저장.
**해결**: `pendingDescRef`에 `{nodeId, content}` 쌍으로 저장, flush 시 저장된 nodeId 사용.

### Tiptap useEditor stale closure
`useEditor`는 초기화 시 콜백 고정 → blur 시 저장 함수가 항상 null.
**해결**: `useRef`로 콜백 래핑, Tiptap은 ref를 통해 항상 최신 함수 호출.

### Vercel 빌드 6회 연속 실패
`tsconfig.json`의 `**/*.ts`가 `mcp-server/` 포함 → MCP SDK import 실패.
**해결**: `exclude`에 `mcp-server` 추가.

### MCP 인증 순환
iron-session 쿠키 7일 만료 → MCP 서버 장기 실행 시 모든 요청 실패.
**해결**: 401 감지 → 자동 재로그인 → 요청 재시도.

---

## 실행

```bash
# 웹 서비스
npm install
npm run dev          # Next.js + WebSocket

# MCP 서버 (별도 터미널 불필요 — Claude CLI가 자동 spawn)
# ~/.ttr-mcp/.env에 credentials 설정 후
# .mcp.json에 서버 등록하면 CLI 시작 시 자동 연결
```

---

## 파일 구조

```
thinkToRealization/
├── src/app/                    Next.js 페이지 + API (20+ routes)
├── src/components/
│   ├── canvas/                 ReactFlow 캔버스 (BaseNode, semantic zoom)
│   ├── dashboard/              대시보드 (IssueRow, DashboardCard)
│   ├── panel/                  사이드 패널 (NodeDetailPanel, 5-trigger save)
│   └── comments/               코멘트 (source badge: CLI/web/system)
├── src/stores/                 Zustand (UI, Canvas, Node, Session)
├── src/lib/auth/               iron-session + RBAC
├── mcp-server/src/             MCP 서버 (11 tools)
│   ├── server.ts               도구 등록 + session/source tracking
│   ├── client.ts               HTTP client + auto re-auth
│   └── auth.ts                 쿠키 캐시 + 재로그인
├── prisma/                     DB 스키마 (10+ models)
└── docs/
    ├── portfolio-ttr-mcp.md    기술 상세 문서
    └── interview-prep.md       면접 Q&A + 기술 용어 사전
```
