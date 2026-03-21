# DevFlow — AI 개발 워크플로 자동화 플랫폼

> AI CLI 세션의 작업 흐름을 캔버스에서 시각화하고, MCP 프로토콜로 **다른 AI 세션이 자동으로 작업 상태를 관리**하는 풀스택 플랫폼

**Live**: https://think-to-realization.vercel.app
**MCP Guide**: https://think-to-realization.vercel.app/guide

---

## 1. 이 프로젝트는 뭘 하는 건가

### 한 줄 요약

**AI CLI(Claude Code)로 개발할 때, 여러 CLI 세션의 작업 진행 상황을 웹 대시보드에서 보고, CLI가 직접 대시보드를 업데이트하게 만드는 시스템.**

### 구체적으로

내가 "Commerce Intel Agent"라는 프로젝트를 만든다고 하자. 이 프로젝트에는 25개의 구현 단계(Step)가 있다.

```
문제 상황 (이 프로젝트 전):
  나: 터미널 A에서 Claude CLI로 Step 1 구현
  나: 터미널 B에서 Claude CLI로 Step 3 구현
  나: "아 Step 1 끝났는데 어디 가서 체크해야 하지..."
  나: 브라우저 열고 → Notion 가서 → 수동으로 "완료" 체크 → 다시 터미널로
  → 이 과정이 매번 귀찮고, 까먹기도 하고, 진행 상황이 뒤죽박죽

해결 (이 프로젝트 후):
  나: 터미널 A에서 "Step 1 끝났어, 업데이트해줘"
  Claude: (자동으로 MCP 도구 호출) → 웹 대시보드의 Step 1이 "완료"로 변경
  나: 브라우저에서 대시보드 새로고침 → Step 1이 ✅ 완료로 표시
  → 터미널을 떠나지 않고 모든 관리가 됨
```

---

## 2. 시스템 전체 구조 (큰 그림)

이 시스템은 크게 **3개의 파트**로 구성된다.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  파트 1           │     │  파트 2           │     │  파트 3           │
│  웹 서비스 (TTR)  │ ←── │  MCP 서버         │ ←── │  Claude CLI      │
│  브라우저에서 보는  │     │  CLI와 웹을        │     │  개발자가 실제로   │
│  대시보드 + 캔버스  │     │  연결하는 다리      │     │  작업하는 곳       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 파트 1: 웹 서비스 (TTR)
- **무엇**: 브라우저에서 접속하는 웹사이트 (https://think-to-realization.vercel.app)
- **하는 일**: 프로젝트의 노드(작업 단위)를 캔버스에 시각화, 상태 관리, 코멘트, 결정 기록
- **기술**: Next.js (React 프레임워크) + PostgreSQL (데이터베이스) + Vercel (배포)
- **비유**: "Notion이나 Linear 같은 프로젝트 관리 도구"를 직접 만든 것

### 파트 2: MCP 서버
- **무엇**: 내 컴퓨터에서 로컬로 돌아가는 작은 프로그램
- **하는 일**: Claude CLI가 "노드 상태 바꿔줘"라고 하면, TTR 웹 서비스의 API를 대신 호출해줌
- **기술**: TypeScript + MCP SDK (Anthropic이 만든 표준 프로토콜)
- **비유**: "CLI와 웹 서비스 사이의 통역사"

### 파트 3: Claude CLI
- **무엇**: 터미널에서 Claude와 대화하면서 코드를 작성하는 도구
- **하는 일**: 코드 작성 + MCP 서버를 통해 TTR 대시보드 자동 업데이트
- **비유**: "개발자의 AI 파트너"

---

## 3. 파트 1 상세: 웹 서비스 (TTR)

### 3.1 웹 서비스란?

사용자가 브라우저에서 접속하는 웹사이트. 두 가지 화면이 있다:

**대시보드**: 모든 작업의 상태를 한눈에 보는 화면
```
┌──────────────────────────────────┐
│  진행중 (3)                        │
│  ● Step 1: DB 초기화              │
│  ● Step 2: 더미 데이터             │
│  ● Step 3: API 래퍼              │
│                                  │
│  할일 (5)                         │
│  ○ Step 4: Normalizer            │
│  ○ Step 5: 대시보드               │
│  ...                             │
│                                  │
│  완료 (2)                         │
│  ✓ Phase 1 마일스톤               │
│  ✓ Day 1 마일스톤                 │
└──────────────────────────────────┘
```

**캔버스**: 작업 간의 관계를 그래프로 보는 화면
```
[Phase 1] ──→ [Day 1] ──→ [Step 1] ──→ [Step 2]
                                   ──→ [Step 3]
              [Day 2] ──→ [Step 6] ──→ [Step 7]
```
노드를 드래그하고, 엣지(화살표)로 연결하고, 줌 인/아웃으로 전체를 조감할 수 있다.

### 3.2 REST API란?

웹 서비스가 외부(MCP 서버, 브라우저 등)와 데이터를 주고받는 **규격화된 통신 방법**.

```
비유: 레스토랑의 메뉴판

  메뉴판(API):
    GET  /api/projects         → "프로젝트 목록 주세요"
    POST /api/projects         → "새 프로젝트 만들어주세요"
    PUT  /api/nodes/123/status → "123번 노드 상태를 'done'으로 바꿔주세요"
    POST /api/nodes/123/comments → "123번 노드에 코멘트 추가해주세요"

  손님(MCP 서버)이 메뉴판(API)을 보고 주문(요청)하면,
  주방(서버)이 요리(처리)해서 음식(응답)을 내놓는 것.
```

이 프로젝트에는 **20개 이상의 API 엔드포인트**가 있다:
- 프로젝트 CRUD (생성, 조회, 수정, 삭제)
- 노드 CRUD + 상태 변경
- 엣지(연결선) 관리
- 코멘트, 결정, 세션
- 인증 (로그인, 로그아웃, 회원가입)

### 3.3 데이터베이스 (DB)

모든 데이터가 저장되는 곳. **10개 이상의 테이블**이 서로 관계를 맺고 있다.

```
비유: 엑셀 파일이 10개 있고, 서로 연결되어 있는 것

  [User 테이블]
  | id    | email            | name   |
  |-------|------------------|--------|
  | usr_1 | admin@ttr.local  | 관리자 |

  [Project 테이블]
  | id     | title                | createdBy |
  |--------|----------------------|-----------|
  | prj_1  | Commerce Intel Agent | usr_1     |

  [Node 테이블]
  | id     | projectId | title              | status      | parentNodeId |
  |--------|-----------|--------------------|-------------|--------------|
  | nd_1   | prj_1     | Phase 1            | in_progress | (없음)       |
  | nd_2   | prj_1     | Day 1              | in_progress | nd_1         |
  | nd_3   | prj_1     | Step 1: DB 초기화   | done        | nd_2         |

  → parentNodeId로 "Phase → Day → Step" 계층 구조를 표현
  → 하나의 Phase 아래에 여러 Day, 하나의 Day 아래에 여러 Step
```

**핵심 테이블과 역할:**

| 테이블 | 저장하는 것 | 예시 |
|--------|-----------|------|
| User | 사용자 계정 | 이메일, 비밀번호(암호화), 이름 |
| Project | 프로젝트 | "Commerce Intel Agent" |
| Node | 작업 단위 | "Step 1: DB 초기화", 상태: done |
| Edge | 노드 간 연결 | Step 1 → Step 2 (순서), Step 3 → Step 7 (의존) |
| NodeComment | 코멘트 | "[via CLI] DB 7개 테이블 완료" |
| Decision | 결정 사항 | "Haiku 대신 Sonnet 사용하기로 결정" |
| NodeStateLog | 상태 변경 이력 | "nd_3: backlog → in_progress (13:00), in_progress → done (14:30)" |
| ProjectMember | 프로젝트 멤버 | "usr_1은 prj_1의 owner" |

**왜 이렇게 나눠놨는가?**

하나의 큰 테이블에 다 넣으면, 예를 들어 "코멘트 3개를 가진 노드"를 조회할 때 노드 데이터가 3번 중복된다. 테이블을 나누면 중복 없이 필요한 데이터만 조합해서 가져올 수 있다. 이것을 **정규화(normalization)**라고 한다.

### 3.4 인증 시스템

"이 사람이 누구인지 확인하고, 권한이 있는지 검사하는 시스템"

```
비유: 놀이공원

  1. 입구(로그인): 신분증(이메일+비밀번호) 보여주면, 팔찌(쿠키)를 받는다
  2. 놀이기구(API): 팔찌를 보여줘야 탈 수 있다
  3. VIP 구역(관리자 기능): 팔찌에 "VIP" 표시가 있어야 입장 가능
  4. 팔찌 만료: 7일 후 자동으로 무효화, 다시 입구로
```

**기술적 구현:**

```
[로그인 과정]
1. 사용자: POST /api/auth/login {email: "admin@ttr.local", password: "devflow123"}
2. 서버: 비밀번호를 bcrypt로 검증 (DB에 저장된 해시와 비교)
3. 서버: iron-session으로 쿠키를 암호화하여 브라우저에 전달
   → 쿠키 내용: {userId: "usr_1"} → AES-256 암호화 → "Fe26.2*1*3002a..."
   → JWT는 Base64라서 누구나 디코딩 가능하지만,
     iron-session은 서버의 비밀키 없이는 해독 불가능
4. 이후 모든 API 요청에 이 쿠키가 자동으로 포함됨

[쿠키(cookie)란?]
브라우저가 서버로부터 받은 작은 데이터 조각.
이후 같은 서버에 요청할 때마다 자동으로 함께 전송된다.
"자동으로"가 핵심 — 개발자가 매번 "나 로그인했어" 안 해도 됨.

[권한 체계 (RBAC = Role-Based Access Control)]
owner(소유자) > admin(관리자) > member(멤버)

예시:
  - owner: 프로젝트 삭제 가능, admin 임명 가능
  - admin: 멤버 초대 가능, 노드 생성/삭제 가능
  - member: 노드 조회, 코멘트 추가 가능

모든 API 요청마다 이 권한을 체크한다:
  PUT /api/nodes/123/status → 이 사용자가 이 프로젝트의 멤버인지 확인
```

### 3.5 캔버스 (ReactFlow)

**ReactFlow란?**

노드(네모 상자)와 엣지(화살표)로 그래프를 그리는 React 라이브러리. 마우스로 드래그, 줌 인/아웃, 연결선 드래그 등이 내장되어 있다.

**시맨틱 줌이란?**

지도 앱에서 줌 아웃하면 도시 이름만 보이고, 줌 인하면 가게 이름이 보이는 것처럼, 줌 레벨에 따라 **노드가 보여주는 정보량이 달라지는 것**.

```
[줌 아웃 (0.5배)] — 캔버스에 30개 노드가 한눈에 보임
  ┌──────────┐
  │ Step 1 ✅ │  ← 제목 + 상태만 보임
  └──────────┘

[줌 인 (1.2배)] — 하나의 노드를 자세히 봄
  ┌──────────────────────┐
  │ Step 1: DB 초기화     │
  │ 상태: 완료 ✅          │
  │ 세션 2개, 코멘트 3개   │  ← 상세 정보까지 보임
  │ 마지막 작업: 2시간 전   │
  └──────────────────────┘
```

**구현 방식 (Dual-DOM):**

보통은 줌이 바뀔 때마다 React가 노드를 다시 그린다(리렌더). 30개 노드가 있으면 30번 리렌더 → 느려짐.

이 프로젝트에서는 **두 가지 버전의 DOM을 동시에 렌더**하고, CSS opacity(투명도)만 0↔1로 전환한다.
→ React 리렌더 = **0회**
→ 30개 노드에서도 부드러운 줌

```html
<!-- 하나의 노드 안에 두 가지 버전이 동시에 존재 -->
<div class="compact" style="opacity: 1">Step 1 ✅</div>          <!-- 줌 아웃 -->
<div class="expanded" style="opacity: 0">Step 1: DB 초기화...</div> <!-- 줌 인 -->

<!-- 줌 레벨이 0.8을 넘으면 opacity를 뒤집음 -->
<!-- CSS만 바뀌니까 React는 아무것도 다시 안 그림 -->
```

### 3.6 상태 관리 (Zustand)

**상태 관리란?**

웹 앱에서 여러 컴포넌트(화면 조각)가 **같은 데이터를 공유**해야 할 때, 그 데이터를 한 곳에서 관리하는 것.

```
비유: 회사 공용 화이트보드

  화이트보드(Store)에 "현재 선택된 노드: Step 1"이라고 적어놓으면,
  대시보드 팀(DashboardView)도 보고, 사이드 패널 팀(SidePanel)도 보고,
  캔버스 팀(CanvasView)도 볼 수 있다.

  누군가 화이트보드를 바꾸면("선택된 노드: Step 2"),
  모든 팀이 자동으로 업데이트를 받는다.
```

이 프로젝트에는 **4개의 Store**가 있다:

| Store | 관리하는 데이터 | 예시 |
|-------|---------------|------|
| UI Store | 화면 상태 | 사이드바 열림/닫힘, 패널 모드, 활성 탭 |
| Canvas Store | 캔버스 데이터 | 노드 위치, 엣지, 줌 레벨, Undo/Redo 스택 |
| Node Store | 선택된 노드 | 현재 보고 있는 노드의 상세 정보, 코멘트, 결정 |
| Session Store | 터미널 세션 | 활성 세션, 세션 로그 (로컬 전용) |

### 3.7 자동 저장 시스템

노드의 설명(description)을 편집할 때, **저장 버튼 없이 자동으로 저장**되는 시스템.

```
[Debounce란?]
타이핑할 때마다 매번 저장하면 1초에 10번 API 호출 → 서버 부하.
대신 "마지막 키 입력 후 500ms 동안 추가 입력이 없으면 저장" → 효율적.

비유: 엘리베이터
  누군가 탈 때마다 바로 출발하지 않고,
  5초 동안 아무도 안 타면 그때 출발하는 것.

[문제가 됐던 상황들]

문제 1: 글 쓰다가 다른 노드를 클릭하면?
  → 500ms 타이머가 아직 안 끝났는데 노드가 바뀜
  → 이전 노드의 글이 새 노드에 저장되는 버그!
  → 해결: 저장 대기 중인 내용에 "이건 노드 A의 글이야"라고 노드 ID를 같이 저장
          노드가 바뀌면, 바뀌기 전에 이전 노드 ID로 즉시 저장

문제 2: 큰 문서(8000자)를 붙여넣으면?
  → API의 글자 수 제한이 5000자여서, 서버가 "안 돼" 응답
  → 그런데 에러 메시지가 화면에 안 나옴 → 사용자는 저장된 줄 알고 나감 → 데이터 유실
  → 해결: 제한을 50000자로 늘리고, "저장 중..." / "✓ 저장됨" / "✗ 실패" 표시 추가

문제 3: 패널을 닫으면?
  → 컴포넌트가 화면에서 사라지면(언마운트), 진행 중이던 타이머도 같이 사라짐
  → 해결: 사라지기 직전에 fetch + keepalive:true 옵션으로 저장 요청
          keepalive = "브라우저야, 이 요청은 페이지가 닫혀도 끝까지 보내줘"

[5가지 저장 트리거 — 어떤 상황에서든 데이터가 안 날아감]
1. 타이핑 → 500ms 후 자동 저장
2. 에디터에서 포커스 벗어남 (다른 곳 클릭) → 즉시 저장
3. 다른 노드 선택 → 이전 노드 즉시 저장
4. 패널 닫기 / 탭 전환 → 즉시 저장
5. 컴포넌트 사라짐 → keepalive 저장
```

---

## 4. 파트 2 상세: MCP 서버

### 4.1 MCP가 뭔가?

**MCP = Model Context Protocol**

Anthropic(Claude를 만든 회사)이 만든 **표준 규약**으로, "LLM이 외부 도구를 호출할 수 있게 해주는 프로토콜".

```
[도구(Tool)란?]
LLM이 텍스트 생성만으로는 할 수 없는 일을 해주는 기능.
예: 파일 읽기, API 호출, DB 조회 등.

Claude CLI에는 이미 내장 도구가 있다:
  - Read: 파일 읽기
  - Edit: 파일 수정
  - Bash: 명령어 실행
  - Grep: 코드 검색

MCP 서버를 만들면 여기에 **커스텀 도구를 추가**할 수 있다:
  - ttr_update_status: TTR 노드 상태 변경
  - ttr_add_comment: TTR에 코멘트 추가
  - (내가 만들고 싶은 아무 기능)
```

```
[MCP 통신 방식]

Claude CLI ←──stdin/stdout──→ MCP 서버

stdin/stdout이란?
  프로그램끼리 텍스트를 주고받는 가장 기본적인 방법.
  stdin = 입력 (키보드로 타이핑하는 것의 프로그래밍 버전)
  stdout = 출력 (화면에 글자가 나오는 것의 프로그래밍 버전)

  Claude CLI가 MCP 서버의 stdin에 JSON을 보내면,
  MCP 서버가 처리하고 stdout으로 결과 JSON을 보낸다.

실제 오가는 JSON (JSON-RPC 2.0 형식):

  Claude → MCP서버:
  {"jsonrpc":"2.0", "id":3, "method":"tools/call",
   "params":{"name":"ttr_update_status",
             "arguments":{"nodeId":"nd_3","status":"done"}}}

  MCP서버 → Claude:
  {"jsonrpc":"2.0", "id":3,
   "result":{"content":[{"type":"text","text":"✓ Step 1 → done"}]}}
```

### 4.2 MCP 서버의 파일 구조

```
mcp-server/src/
├── index.ts    ← 프로그램 시작점
├── server.ts   ← 8개 도구를 등록하는 곳
├── client.ts   ← TTR API를 호출하는 HTTP 클라이언트
├── auth.ts     ← 로그인 + 쿠키 관리
└── types.ts    ← 데이터 타입 정의
```

### 4.3 각 파일이 하는 일 (코드 수준)

#### index.ts — "프로그램의 시작"

```typescript
// 1단계: 인증 정보 로드
//   ~/.ttr-mcp/.env 파일에서 이메일, 비밀번호, 서버 주소를 읽는다.
//   이 파일은 내 컴퓨터에만 있고, git에 올라가지 않는다 (보안).
const baseUrl = process.env.TTR_BASE_URL  // "https://think-to-realization.vercel.app"
const email = process.env.TTR_EMAIL       // "admin@ttr.local"
const password = process.env.TTR_PASSWORD // "devflow123"

// 2단계: API 클라이언트 생성
//   이 클라이언트가 TTR 웹 서비스에 HTTP 요청을 보내는 역할.
const client = new TTRClient(baseUrl, email, password)

// 3단계: MCP 서버 생성 + 도구 등록
//   createServer 안에서 8개 도구가 등록된다.
const server = createServer(client)

// 4단계: stdin/stdout 연결
//   Claude CLI와 JSON을 주고받을 수 있게 연결.
//   이 시점부터 Claude가 "ttr_update_status" 같은 도구를 호출할 수 있다.
const transport = new StdioServerTransport()
await server.connect(transport)
```

#### auth.ts — "로그인 + 쿠키 관리"

```
[쿠키 캐시란?]
매번 로그인하면 느리니까, 한 번 로그인해서 받은 쿠키를
파일(~/.ttr-mcp/session.json)에 저장해두고 재사용하는 것.

[전체 흐름]
1. MCP 서버 시작
2. session.json 파일이 있는지 확인
3. 있으면 → 쿠키 만료 안 됐으면 그대로 사용
4. 없거나 만료 → POST /api/auth/login으로 새 쿠키 획득
5. 새 쿠키를 session.json에 저장 (다음에 재사용)
6. API 호출 중 401(인증 실패) 응답 → 쿠키 삭제 → 재로그인 → 재시도

[쿠키 만료 타이밍]
TTR의 쿠키는 7일 후 만료.
MCP 서버는 6일 시점에 미리 갱신 → 만료 직전 에러 방지.
```

#### client.ts — "TTR API를 대신 호출하는 HTTP 클라이언트"

```
[이 파일이 하는 일]
1. HTTP 요청에 쿠키를 자동으로 붙여서 보냄
2. 401 응답이 오면 자동으로 재로그인하고 다시 시도
3. API 에러를 파싱해서 읽기 쉬운 형태로 변환

[코드 흐름]
client.put("/api/nodes/123/status", {status: "done"})
  ↓
fetch("https://think-to-realization.vercel.app/api/nodes/123/status", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "Cookie": "ttr-session=Fe26.2*1*..."  ← 자동으로 붙음
  },
  body: '{"status":"done","triggerType":"user_manual"}'
})
  ↓
응답: 200 OK → 성공, 결과 반환
응답: 401 → 쿠키 만료 → 자동 재로그인 → 같은 요청 다시 보냄
응답: 404 → "노드를 찾을 수 없습니다" 에러 반환
```

#### server.ts — "8개 도구를 등록"

각 도구는 이런 구조로 등록된다:

```typescript
server.tool(
  "도구_이름",           // Claude가 이 이름으로 도구를 호출
  "이 도구가 뭘 하는지",  // Claude가 이 설명을 읽고 "이 도구를 써야겠다" 판단
  { 파라미터_스키마 },    // 어떤 값을 받는지 (Zod로 타입 검증)
  async (파라미터) => {   // 실제 실행 로직
    // ... API 호출 ...
    return { content: [{ type: "text", text: "결과" }] }
  }
)
```

**8개 도구 각각의 역할:**

| # | 도구 이름 | 뭘 하는가 | 언제 쓰는가 |
|---|----------|----------|-----------|
| 1 | `ttr_list_projects` | 프로젝트 목록 조회 | "내 프로젝트 뭐가 있지?" |
| 2 | `ttr_get_dashboard` | 대시보드 요약 | "지금 진행률 어때?" |
| 3 | `ttr_list_nodes` | 노드 목록 | "할일 목록 보여줘" |
| 4 | `ttr_get_node` | 노드 상세 | "Step 3 내용 자세히 보여줘" |
| 5 | `ttr_update_status` | 상태 변경 | "Step 1 완료로 바꿔" |
| 6 | `ttr_update_node` | 정보 수정 | "제목 바꿔줘", "담당자 할당해" |
| 7 | `ttr_add_comment` | 코멘트 추가 | "DB 7개 테이블 완료 기록해" |
| 8 | `ttr_add_decision` | 결정 기록 | "Sonnet 대신 Haiku 쓰기로 결정" |

**`ttr_update_status`의 상세 동작 (가장 핵심 도구):**

```
Claude: ttr_update_status(nodeId="nd_3", status="done", via="Commerce Intel CLI")

MCP 서버 내부:
  1. 상태가 "done"인데 이 노드에 담당자가 없다면?
     → GET /api/auth/me → 내 유저 ID 가져옴
     → PUT /api/nodes/nd_3 → {assigneeId: "usr_1"} 담당자 자동 할당
  2. PUT /api/nodes/nd_3/status → {status: "done", triggerType: "user_manual"}
  3. POST /api/nodes/nd_3/comments → "[via Commerce Intel CLI] 상태 변경: → done"
     → 누가 바꿨는지 추적 가능

결과 → Claude에게 전달:
  "✓ Step 1: DB 초기화 → done (via Commerce Intel CLI)"
```

**왜 `via` 파라미터가 있는가?**

```
여러 CLI 세션이 동시에 작업할 때:
  세션 A: Commerce Intel Agent 개발 중
  세션 B: 다른 프로젝트 개발 중

둘 다 TTR을 업데이트하면, 대시보드에서:
  💬 [via Commerce Intel CLI] 상태 변경: → done
  💬 [via Other Project CLI] Step 3 시작

→ 어떤 세션이 뭘 바꿨는지 바로 구분 가능
→ 모든 변경의 출처가 추적됨 (감사 로그 역할)
```

---

## 5. 파트 3 상세: CLI에서 실제로 쓰는 법

### 5.1 최초 설정 (1회)

```bash
# 1. TTR 인증 정보 저장
mkdir -p ~/.ttr-mcp
cat > ~/.ttr-mcp/.env << 'EOF'
TTR_BASE_URL=https://think-to-realization.vercel.app
TTR_EMAIL=admin@ttr.local
TTR_PASSWORD=devflow123
EOF

# 2. MCP 서버 등록 (글로벌 — 모든 CLI 세션에서 사용)
# ~/.claude/.mcp.json에 다음 추가:
{
  "mcpServers": {
    "ttr": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-server/src/index.ts"],
      "cwd": "/path/to/mcp-server"
    }
  }
}

# 3. 작업 프로젝트의 CLAUDE.md에 노드 ID 매핑 추가
# (Claude가 어떤 노드를 업데이트할지 알 수 있도록)
```

### 5.2 실제 사용 시나리오

```
[시나리오 1: 작업 완료 보고]
나: "Step 1 프로젝트 초기화 끝났어. DB 7개 테이블이랑 Docker 설정 완료."
Claude:
  → ttr_update_status("nd_3", "done", via="Commerce Intel CLI", note="DB 7개 테이블 + Docker 완료")
  → "✓ Step 1 → done으로 변경했습니다."

[시나리오 2: 진행 상황 확인]
나: "지금 Commerce Intel 진행 상황이 어때?"
Claude:
  → ttr_get_dashboard("prj_1")
  → "전체 35개 노드:
     ✅ 완료 (5): #01~#05
     🔄 진행중 (2): #06, #07
     📦 백로그 (28): #08~#25
     진행률: 14%"

[시나리오 3: 기술 결정 기록]
나: "Normalizer에서 Haiku가 confidence 낮아서 Sonnet으로 바꾸기로 했어."
Claude:
  → ttr_add_decision("nd_7", "[via Commerce Intel CLI] Normalizer 모델 Haiku→Sonnet 변경. confidence < 0.8인 케이스가 30% 초과.")
  → "✓ 결정 기록됨"
```

---

## 6. 기술 선택 근거

| 기술 | 이것이 뭔가 | 왜 이걸 선택했나 |
|------|-----------|---------------|
| **Next.js 14** | React 기반 풀스택 프레임워크 | API와 프론트엔드를 하나의 프로젝트에서 관리. Vercel에 최적화. |
| **Prisma** | 데이터베이스 ORM (코드로 DB 조작) | TypeScript 타입 자동 생성, 로컬(SQLite)과 프로덕션(PostgreSQL) 전환 가능 |
| **iron-session** | 쿠키 암호화 세션 | JWT보다 보안이 높음 (내용 해독 불가), Next.js middleware와 자연스럽게 연동 |
| **Zustand** | React 상태 관리 | Redux보다 코드가 70% 적고, 번들 크기가 작음 (2KB) |
| **ReactFlow** | 노드 그래프 캔버스 | 드래그, 줌, 엣지, 미니맵 내장. D3.js로 직접 만들면 3배 이상 걸림 |
| **Tiptap** | WYSIWYG 마크다운 에디터 | ProseMirror 기반, 마크다운 ↔ HTML 변환 내장 |
| **MCP SDK** | LLM 도구 프로토콜 | Anthropic 공식 표준, Claude Code에 네이티브 통합 |
| **Vercel** | 서버리스 배포 플랫폼 | git push만 하면 자동 배포, 별도 서버 관리 불필요 |
| **Supabase** | 관리형 PostgreSQL | 무료 티어, Vercel과 같은 리전(Mumbai) 배포로 지연 최소화 |
| **Zod 4** | 런타임 타입 검증 | API에 잘못된 데이터가 들어오면 바로 거부. TypeScript 타입과 동기화 |

---

## 7. 인핸스(Enhans) 채용공고와의 연결

| 자격요건 | 이 프로젝트에서 보여주는 것 |
|----------|------------------------|
| **AI-native 문제 정의** | CLI 세션의 워크플로 자체를 프로덕트로 구조화. "AI가 도구를 호출해서 프로젝트를 관리한다"는 AI-native 접근. |
| **LLM 프레임워크 능숙** | MCP 프로토콜 서버 직접 구현. LLM이 8개 도구를 상황에 맞게 선택·호출하는 구조 설계. |
| **프롬프트/RAG/context engineering** | 도구 설명문(description)이 곧 프롬프트 — LLM이 도구를 정확히 선택하도록 설계. Commerce Intel Agent(별도 프로젝트)에서 RAG + Structured Output + Tool Use 멀티턴 구현 예정. |
| **API 개발 & 배포** | 20+ REST API 엔드포인트, Zod 검증, iron-session 인증, Vercel 배포. |
| **데이터 정제 자동화** | 35개 노드 + 54개 엣지를 스크립트 1회로 자동 생성. 계층형 데이터 구조(Phase→Day→Step) 설계. |
| **e-commerce 도메인** | Commerce Intel Agent — 이커머스 수급 시그널 분석 시스템. 상품 정규화, RAG 카테고리 분류, 시계열 분석 파이프라인 기획 완료(TTR에서 관리 중). |

---

## 8. 실전에서 배운 것들

### 8.1 Tiptap의 stale closure (오래된 함수 참조 문제)

```
[무슨 문제?]
Tiptap 에디터는 처음 만들어질 때 "blur 되면 이 함수 호출해"라고 등록한다.
그런데 나중에 그 함수가 바뀌어도, Tiptap 내부에는 옛날 함수가 그대로 남아있다.
→ blur 시 저장 함수가 호출은 되는데, 옛날 버전이라 아무 동작도 안 함.

[비유]
택배 기사한테 "이 주소로 배달해"라고 했는데,
나중에 이사를 가도 택배 기사가 옛날 주소로 계속 가는 것.

[해결]
함수 자체를 전달하지 않고, "함수를 담고 있는 상자(useRef)"를 전달.
상자 안의 함수는 항상 최신으로 교체되지만, 상자의 주소는 안 바뀜.
→ Tiptap은 항상 같은 상자를 보지만, 상자 안의 내용은 항상 최신.
```

### 8.2 debounce + 노드 전환 = 잘못된 곳에 저장

```
[무슨 문제?]
타이머가 500ms 남았는데 사용자가 다른 노드를 클릭.
→ 500ms 후 저장 함수 실행
→ 그런데 selectedNode가 이미 새 노드로 바뀌어 있음
→ 이전 노드의 글이 새 노드에 저장됨!

[해결]
저장 대기열에 "노드 ID"를 같이 넣음:
  pendingDescRef = { nodeId: "nd_3", content: "이전 노드의 글" }
노드가 바뀌면, 바뀌기 전에 이 대기열을 비우면서 저장:
  "nd_3한테 저장해!" (새 노드 nd_4가 아니라)
```

### 8.3 Vercel 빌드가 6번 연속 실패

```
[무슨 문제?]
mcp-server/ 디렉토리를 프로젝트에 추가했더니,
tsconfig.json의 "include": ["**/*.ts"]가 mcp-server의 TypeScript 파일도 포함시킴.
→ Next.js가 @modelcontextprotocol/sdk를 찾으려고 함
→ 메인 프로젝트의 node_modules에는 없음
→ "Cannot find module" 에러 → 빌드 실패

[해결]
tsconfig.json의 exclude에 "mcp-server" 추가.
→ Next.js 빌드가 mcp-server 디렉토리를 무시.
```

### 8.4 조용한 실패 (Silent Failure)

```
[무슨 문제?]
8000자짜리 마크다운을 붙여넣으면, API의 Zod 검증(5000자 제한)에 걸림.
서버는 400 에러를 반환하지만, 프론트엔드에서 이 에러를 표시 안 함.
→ 사용자: "저장됐겠지" → 다른 곳으로 이동 → 데이터 유실

[교훈]
"에러가 났는데 사용자가 모르는 것"이 가장 위험.
→ 모든 API 에러에는 사용자 피드백 필수 (토스트, 인디케이터 등)
→ CLAUDE.md에 "UX 검증 지침" 추가: silent failure 절대 금지
```

---

## 파일 구조 요약

```
thinkToRealization/
├── src/                        ← 웹 서비스 소스코드
│   ├── app/                    ← Next.js 페이지 + API 라우트
│   │   ├── page.tsx            ← 메인 페이지 (캔버스 + 대시보드)
│   │   ├── guide/page.tsx      ← MCP 가이드 페이지 (공개)
│   │   └── api/                ← REST API 엔드포인트 20+개
│   ├── components/             ← React UI 컴포넌트
│   │   ├── canvas/             ← 캔버스 (ReactFlow, 시맨틱 줌)
│   │   ├── dashboard/          ← 대시보드 (노드 목록, 필터)
│   │   ├── panel/              ← 사이드 패널 (노드 상세, 에디터)
│   │   └── shared/             ← 공통 (배지, 토스트, 에디터)
│   ├── stores/                 ← Zustand 상태 관리 (4개 스토어)
│   └── lib/                    ← 유틸리티
│       ├── auth/               ← 인증 (iron-session, RBAC)
│       └── schemas/            ← Zod 검증 스키마
├── mcp-server/                 ← MCP 서버 (별도 패키지)
│   └── src/
│       ├── index.ts            ← 시작점 (env 로드 + 서버 연결)
│       ├── server.ts           ← 8개 도구 등록
│       ├── client.ts           ← TTR API HTTP 클라이언트
│       ├── auth.ts             ← 쿠키 캐시 + 자동 재로그인
│       └── types.ts            ← 타입 정의
├── prisma/                     ← DB 스키마 + 마이그레이션
├── docs/                       ← 설계 문서
└── .mcp.json                   ← MCP 서버 등록 설정
```
