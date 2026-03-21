# TTR MCP Server — 작업계획서

> 다른 Claude Code CLI 세션에서 thinkToRealization(TTR)의 노드 상태를 자동으로 관리할 수 있는 MCP 서버

---

## 1. 문제 정의

```
현재 워크플로:
  CLI 세션 (Commerce Intel Agent 개발)
    → Step 1 완료
    → 브라우저로 이동
    → TTR 대시보드에서 수동으로 상태 변경
    → 다시 CLI로 복귀

원하는 워크플로:
  CLI 세션 (Commerce Intel Agent 개발)
    → Step 1 완료
    → "TTR에서 #01 done으로 바꿔줘"
    → Claude가 ttr_update_status 도구 호출 (MCP)
    → 완료. CLI 떠나지 않음.
```

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────┐
│  Claude Code CLI (어떤 프로젝트든)              │
│  "Step 1 완료, TTR 업데이트해줘"                │
└──────────────┬──────────────────────────────┘
               │ MCP (stdin/stdout)
┌──────────────▼──────────────────────────────┐
│  ttr-mcp-server (로컬 프로세스)                │
│  - 8개 도구 제공                               │
│  - 인증 자동 관리 (cookie 캐시 + 재로그인)        │
│  - ~/.ttr-mcp/ 에 credentials 저장            │
└──────────────┬──────────────────────────────┘
               │ HTTPS (fetch)
┌──────────────▼──────────────────────────────┐
│  https://think-to-realization.vercel.app     │
│  REST API (iron-session cookie 인증)          │
└─────────────────────────────────────────────┘
```

---

## 3. 인증 전략

### 현재 TTR 인증 구조
- **iron-session** 기반 쿠키 (`ttr-session`)
- 쿠키 TTL: **7일**
- 로그인: `POST /api/auth/login` → Set-Cookie 헤더로 세션 발급
- 모든 API: 쿠키 필수 (없으면 401)

### MCP 서버 인증 방식

```
Phase 1 (쿠키 재사용 — TTR 코드 변경 없음):
  1. ~/.ttr-mcp/.env 에 이메일/비밀번호 저장
  2. 서버 시작 시 POST /api/auth/login → 쿠키 획득
  3. ~/.ttr-mcp/session.json 에 쿠키 + 만료 시각 캐시
  4. API 호출 시 캐시된 쿠키 사용
  5. 401 응답 시 자동 재로그인

Phase 2 (향후, 선택 — TTR에 API Key 인증 추가):
  - X-API-Key 헤더 기반 인증 미들웨어 추가
  - MCP 서버에서 쿠키 관리 불필요
  - 현재는 불필요 — Phase 1으로 충분
```

### credentials 파일 구조

```
~/.ttr-mcp/
├── .env              # TTR_EMAIL, TTR_PASSWORD, TTR_BASE_URL
├── session.json      # { cookie: "ttr-session=...", expiresAt: "..." }
└── node-map.json     # 프로젝트별 노드 ID 매핑 캐시 (선택)
```

```bash
# ~/.ttr-mcp/.env
TTR_BASE_URL=https://think-to-realization.vercel.app
TTR_EMAIL=admin@ttr.local
TTR_PASSWORD=devflow123
```

---

## 4. MCP 도구 설계 (8개)

### 4.1 ttr_list_projects
```
용도: 프로젝트 목록 조회
입력: (없음)
출력: [{ id, title, slug, memberCount }]
API: GET /api/projects
```

### 4.2 ttr_get_dashboard
```
용도: 프로젝트 대시보드 요약 (진행중/할일/백로그/완료)
입력: { projectId: string }
출력: { inProgress: [...], todo: [...], backlog: [...], recentDone: [...] }
API: GET /api/projects/{projectId}/dashboard
```

### 4.3 ttr_list_nodes
```
용도: 프로젝트 노드 목록 (상태 필터 가능)
입력: { projectId: string, status?: string }
출력: [{ id, title, status, priority, type, parentNodeId, childCount }]
API: GET /api/projects/{projectId}/nodes?status={status}
```

### 4.4 ttr_get_node
```
용도: 노드 상세 (설명, 세션, 결정, 엣지 포함)
입력: { nodeId: string }
출력: { ...NodeResponse, sessions, decisions, outEdges, inEdges }
API: GET /api/nodes/{nodeId}
```

### 4.5 ttr_update_status
```
용도: 노드 상태 변경
입력: { nodeId: string, status: "backlog"|"todo"|"in_progress"|"done"|"archived" }
출력: { id, title, status, previousStatus }
API: PUT /api/nodes/{nodeId}/status  body: { status, triggerType: "user_manual" }
주의: in_progress, done 전환 시 assigneeId 필요 → 없으면 자동 할당
```

### 4.6 ttr_update_node
```
용도: 노드 정보 수정 (제목, 설명, 우선순위 등)
입력: { nodeId: string, title?: string, description?: string, priority?: string }
출력: { ...NodeResponse }
API: PUT /api/nodes/{nodeId}
```

### 4.7 ttr_add_comment
```
용도: 노드에 진행 상황 코멘트 추가
입력: { nodeId: string, content: string }
출력: { id, content, createdAt, user }
API: POST /api/nodes/{nodeId}/comments  body: { content }
```

### 4.8 ttr_add_decision
```
용도: 노드에 결정 사항 기록
입력: { nodeId: string, content: string }
출력: { id, content, createdAt }
API: POST /api/decisions  body: { nodeId, content }
```

---

## 5. 구현 계획

### Phase 1: MCP 서버 코어 (핵심)
```
예상 시간: 2~3시간
파일 수: ~5개
코드량: ~400줄

구현 순서:
1. 프로젝트 초기화 + 의존성 (15분)
   - package.json (@modelcontextprotocol/sdk, dotenv)
   - tsconfig.json
   - 디렉토리 구조

2. 인증 모듈 (30분)
   - auth.ts: login(), getValidCookie(), 자동 재로그인
   - session.json 캐시 관리
   - ~/.ttr-mcp/.env 로드

3. API 클라이언트 (20분)
   - client.ts: fetch 래퍼 (cookie 주입, 에러 핸들링, 401 재인증)
   - TTR API 응답 파싱

4. MCP 도구 8개 등록 (60분)
   - server.ts: StdioServerTransport + 도구 정의
   - 각 도구의 inputSchema (JSON Schema)
   - 각 도구의 handler (API 호출 + 응답 포맷팅)

5. 등록 + 테스트 (20분)
   - settings.json에 mcpServers 등록
   - CLI에서 도구 호출 테스트
```

### Phase 2: 사용성 개선 (선택)
```
예상 시간: 1~2시간

1. ttr_search_nodes — 제목/설명 텍스트 검색
2. ttr_bulk_update — 여러 노드 한번에 상태 변경
3. ttr_get_progress — 프로젝트 진행률 요약 (done/total %)
4. 노드 ID 매핑 캐시 — 프로젝트별 CLAUDE.md에서 자동 추출
```

### Phase 3: TTR API 확장 (선택)
```
예상 시간: 1시간

1. X-API-Key 인증 추가 (쿠키 대안)
2. triggerType에 "cli_automation" 추가 (감사 로그 구분)
3. POST /api/nodes/{id}/progress — 진행률 업데이트 전용 엔드포인트
```

---

## 6. 파일 구조

```
thinkToRealization/
├── mcp-server/                    # MCP 서버 (별도 패키지)
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts               # 엔트리포인트 (서버 시작)
│   │   ├── server.ts              # MCP 서버 + 8개 도구 등록
│   │   ├── auth.ts                # 로그인 + 쿠키 캐시 관리
│   │   ├── client.ts              # TTR API 클라이언트 (fetch 래퍼)
│   │   └── types.ts               # TTR API 응답 타입
│   └── README.md
│
├── ~/.ttr-mcp/                    # 사용자 홈 디렉토리 (gitignore)
│   ├── .env                       # 인증 정보
│   └── session.json               # 쿠키 캐시
│
└── ~/.claude/settings.json        # MCP 서버 등록
    └── mcpServers.ttr: { command, args }
```

---

## 7. MCP 서버 등록 (settings.json)

```jsonc
// ~/.claude/settings.json
{
  "mcpServers": {
    "ttr": {
      "command": "npx",
      "args": ["tsx", "/Users/choeseung-won/personal-project/thinkToRealization/mcp-server/src/index.ts"],
      "env": {}
    }
  }
}
```

---

## 8. 사용 시나리오

### 시나리오 1: 작업 상태 업데이트
```
[Commerce Intel Agent CLI 세션]

유저: Step 1 프로젝트 초기화 완료했어. TTR 업데이트해줘.

Claude:
  1. ttr_list_projects() → Commerce Intel Agent 프로젝트 ID 확인
  2. ttr_list_nodes(projectId, status="in_progress") → #01 노드 확인
  3. ttr_update_status(nodeId, "done") → 상태 변경
  4. ttr_add_comment(nodeId, "프로젝트 초기화 완료. DB 7개 테이블, Docker Compose, Alembic 마이그레이션 설정.")

  → "✓ P1.D1.#01 상태를 done으로 변경하고 코멘트를 추가했습니다."
```

### 시나리오 2: 진행 상황 확인
```
유저: 지금 Commerce Intel 진행 상황이 어떻게 돼?

Claude:
  1. ttr_get_dashboard(projectId) → inProgress 3개, todo 5개, done 2개

  → "현재 진행 상황:
     ✅ 완료 (2): #01 프로젝트 초기화, #02 더미 데이터
     🔄 진행중 (3): #03 Claude API 래퍼, #04 Normalizer, #05 대시보드
     📋 대기 (5): #06~#10
     전체 진행률: 8% (2/25)"
```

### 시나리오 3: 결정 사항 기록
```
유저: Normalizer에서 Haiku 대신 Sonnet을 쓰기로 했어. 기록해줘.

Claude:
  1. ttr_list_nodes(projectId) → #04 Normalizer 노드 찾기
  2. ttr_add_decision(nodeId, "Normalizer 모델을 Haiku에서 Sonnet으로 변경. Haiku의 confidence가 0.7 미만인 경우가 30%를 초과하여 품질 우선으로 결정.")

  → "✓ #04에 결정 사항을 기록했습니다."
```

---

## 9. 기술적 고려 사항

### 쿠키 만료 처리
```
1. session.json에 expiresAt 저장 (로그인 시각 + 7일)
2. API 호출 전 expiresAt 체크 → 1시간 이내면 사전 갱신
3. 401 응답 시 자동 재로그인 → 재시도
4. 재로그인 실패 시 MCP 에러 응답 ("인증 실패. ~/.ttr-mcp/.env 확인")
```

### assignee 자동 할당
```
in_progress/done 전환 시 assigneeId 필요.
1. ttr_update_status에서 현재 노드의 assigneeId 확인
2. 없으면 GET /api/auth/me → 현재 유저 ID 획득
3. PUT /api/nodes/{id} → assigneeId 설정
4. 그 후 PUT /api/nodes/{id}/status → 상태 변경
```

### 에러 처리
```
MCP 도구 응답:
  성공: { content: [{ type: "text", text: "✓ 상태 변경 완료" }] }
  실패: { content: [{ type: "text", text: "✗ 에러: 노드를 찾을 수 없습니다 (NODE_NOT_FOUND)" }], isError: true }

Claude가 에러를 받으면 자동으로 재시도하거나 유저에게 안내.
```

### 동시성
```
여러 CLI 세션이 동시에 같은 노드를 수정할 수 있음.
TTR API는 Last-Write-Wins (LWW) 패턴.
코멘트/결정은 append-only라 충돌 없음.
상태 변경은 낙관적 — 충돌 가능성 낮음 (한 노드를 동시에 두 사람이 작업하는 경우 드뭄).
```

---

## 10. 의존성

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## 11. 리스크 & 대안

| 리스크 | 영향 | 대안 |
|--------|------|------|
| iron-session 쿠키 파싱 불안정 | 인증 실패 | Phase 3에서 API Key 추가 |
| Vercel cold start (2~3초) | MCP 응답 지연 | 허용 범위 내 (CLI 대화형) |
| 노드 ID 외우기 어려움 | 잘못된 노드 업데이트 | 제목 검색 도구 + CLAUDE.md 매핑 |
| MCP SDK 버전 호환성 | 서버 시작 실패 | 버전 고정 + 테스트 |

---

## 12. 완료 기준

```
✅ ~/.ttr-mcp/.env 설정 후 CLI에서 도구 사용 가능
✅ ttr_list_projects → 프로젝트 목록 반환
✅ ttr_update_status → 노드 상태 변경 + TTR 대시보드에 반영 확인
✅ ttr_add_comment → 코멘트 추가 + TTR 패널에서 확인
✅ 쿠키 만료 후 자동 재로그인 동작
✅ 에러 시 명확한 메시지 (노드 없음, 인증 실패 등)
✅ Commerce Intel Agent 프로젝트에서 실제 사용 테스트
```
