# AI CLI 워크플로우 프로젝트 관리 플랫폼

> LLM이 MCP 프로토콜로 프로젝트의 문서와 작업 히스토리, 선후행 작업 등의 파악을 통해
> 보다 누락없는 업무 구현과 관리를 동시에 돕는 시스템.
> 문서 기반의 지식관계를 통해 관리 중인 프로젝트에 대한 히스토리, 인과관계성을 주입할 수 있도록 설계


<!-- [전체 캔버스 뷰 — 35개 노드가 상태별 색상으로 구분되어 보이는 줌 아웃 스크린샷] -->
<img width="1440" height="755" alt="image" src="https://github.com/user-attachments/assets/82b8cc2a-1dc7-4688-be10-89bda689f7df" />


---

## 이 프로젝트는 뭘 하는가

CLI 를 통한 작업이 도입되면서, 더욱이 계획서와 설계 side-effect 등을 고려해야 하는 **문서** 에 중요성이 더해지는 것 같다고 느꼈습니다.

코딩 자체의 업무는 일부 위임할 순 있지만, 무얼 계획 했고, 어떻게 설계하였는지는 놓치지 말아야 할 하네스가 된다고 느껴

보다 우리가 작성하는 문서를 꼼꼼하게 놓치지 않고, 우리의 생각 ( 문서 )을 보다 CLI 풍부한 히스토리를 통해 파악할 수 있도록 하는 것이 목적이였습니다. 

```
CLI 세션 A: "Step 1 끝났어, 업데이트해줘"
Claude: → ttr_update_status(#01, "done")     ← MCP 도구 자동 호출
        → ttr_add_comment(#01, "DB 7개 테이블 완료")

CLI 세션 B: "지금 진행 상황 어때?"
Claude: → ttr_get_dashboard()
        → "35개 중 5개 완료 (14%), 3개 진행중"

CLI 세션 C: "해당 작업의 상위/히위 이슈 모두 고려해서 영향도 없게 진행해야 해"
Claude: → ttr_get_node()
        → "상위/하위/연관 노드 조회하여 영향도 파악"
```
<img width="1440" height="857" alt="image" src="https://github.com/user-attachments/assets/9eb34bf2-4f5c-4aac-9df2-9bb482f7ce01" />


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
<img width="1440" height="754" alt="image" src="https://github.com/user-attachments/assets/61faa030-6ad5-4718-bae1-8eff83d036a0" />


**Dual-DOM 시맨틱 줌:**

줌 아웃 시 제목만, 줌 인 시 상세 정보를 보여줍니다. **React 리렌더 0회** — CSS opacity만 전환하여 30+ 노드에서도 60fps.

<!-- [줌 인 상태 — 노드 하나가 확대되어 설명, 세션 수, 상태 배지가 보이는 스크린샷] -->


### 3. 권한 + 출처 추적

```
RBAC: owner > admin > member
출처: NodeComment.source = "web" | "cli" | "system"
      NodeComment.sourceSession = "Commerce Intel CLI"
생성자: Node.createdByName = "사용자명"
```

---

## 실전 적용: Commerce Intel Agent 관리

이커머스 수급 시그널 분석 시스템(marketPulse)의 **25개 구현 단계**를 DevFlow에서 관리하고 있습니다.

```
스크립트 1회 실행:
  → 35개 노드 생성 (Phase 3 + Day 7 + Step 25)
  → 54개 엣지 생성 (sequence 16 + dependency 27 + parent_child 7 + related 4)
  → 계층형 제목: P1.D1.#01. ~ P3.D7.#25.
```

<!-- [대시보드 뷰 — 진행중/할일/백로그/완료 섹션으로 노드들이 분류되어 보이는 스크린샷] -->
<img width="1440" height="754" alt="image" src="https://github.com/user-attachments/assets/08e1580b-1eee-43cd-9c63-45b1bc3f8ffc" />

 

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

## 온톨로지 기반 지식 그래프

6종 엣지 + 계층 구조를 **도메인 온톨로지**로 확장하여, 시스템 간 영향도와 의사결정 이력이 조직의 지식 자산으로 축적되는 구조를 설계

### 해결하려는 현업 문제

엔터프라이즈 시스템에서는 하나의 변경이 여러 시스템에 연쇄적으로 영향을 미칩니다.

```
예시: FedEx WMS의 booking 로직 수정
  → OMS의 Booking 로직에 영향 → 장애 발생
  → 이후 다른 시스템에서 FedEx 연동 시, 과거 결정 이력을 코드와 슬랙에서 수동 탐색
```

기존 작업 관리 도구(Jira, Linear)는 티켓 간 관계를 "링크"로만 표현하고, **변경의 파급 경로와 의사결정 이력을 구조적으로 추적하지 못합니다.**

### 온톨로지 확장

```
[System: WMS] ──uses──> [Service: FedEx Booking API]
[System: OMS] ──uses──> [Service: FedEx Booking API]

[Decision: "Booking 파라미터 X를 Y로 변경"]
  ──affects──> [System: WMS]
  ──affects──> [System: OMS]

[Task: "다른 시스템에서 FedEx 연동"]
  ──references──> [위 Decision 이력들]
```

| 확장 | 설명 |
|------|------|
| **시스템/서비스 노드 타입** | 작업 노드뿐 아니라 시스템 구성 요소를 그래프에 포함 |
| **`affects` 엣지** | 변경이 영향을 미치는 시스템을 명시적으로 연결 |
| **영향 범위 자동 탐색** | Agent가 과거 결정 조회 시, 영향 받은 시스템과 후속 작업까지 그래프 탐색으로 반환 |
| **유사 작업 시 이력 추천** | "FedEx 연동" 키워드 포함 작업 생성 시, 과거 관련 결정·이슈·변경 이력을 Agent에게 자동 제공 |

이를 통해 AI Agent가 단순히 "현재 작업의 상태"만 아는 것이 아니라, **조직의 기술적 의사결정 히스토리와 시스템 간 의존 관계를 이해한 상태에서** 보다 정확한 개발 어시스턴스를 제공할 수 있는 구조로 설계

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
