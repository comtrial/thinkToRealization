# 인핸스 AI Backend Engineer — 면접 준비 문서

> 프로젝트 2개(DevFlow + Commerce Intel Agent)를 하나의 스토리로 연결한 면접 대비

---

## 1. 프로젝트 전체 스토리 (30초 엘리베이터 피치)

```
"이커머스 상품의 수급 시그널을 AI로 분석하는 Commerce Intel Agent를 기획했습니다.
25개 구현 단계를 관리하기 위해 DevFlow라는 프로젝트 관리 플랫폼을 직접 만들었고,
MCP 프로토콜로 Claude CLI가 작업 상태를 자동으로 관리하게 했습니다.

결과적으로:
- DevFlow: 풀스택 웹앱 + MCP 서버 (11개 도구)
- Commerce Intel Agent: Claude Tool Use 멀티턴 + RAG + Structured Output + Eval 파이프라인

두 프로젝트가 하나의 생태계로 연결됩니다."
```

---

## 2. 두 프로젝트의 연결 관계

```
Commerce Intel Agent (AI 포트폴리오 본체)
  "이커머스 상품 수급 시그널 분석 시스템"
  기술: Claude Tool Use, RAG, Structured Output, Eval-Optimize Loop
  상태: 기획 완료, 구현 중

         ↕ MCP 프로토콜로 연결

DevFlow (개발 워크플로 관리 도구)
  "AI CLI 세션이 자동으로 작업을 관리하는 플랫폼"
  기술: Next.js, MCP 서버, iron-session, ReactFlow, Zustand
  상태: 배포 완료, 실사용 중
```

**왜 이 구조가 면접에서 강력한가:**

1. Commerce Intel Agent = **"AI를 활용한 제품"** → 자격요건의 "AI-native 문제 정의"
2. DevFlow = **"AI를 위한 제품"** → 우대사항의 "챗봇 이상의 새로운 서비스"
3. MCP 연동 = **"AI가 도구를 사용하는 구조"** → 자격요건의 "LLM 프레임워크 능숙"
4. 두 프로젝트가 실제로 연결되어 사용 중 → "PoC를 넘어 실제 서비스 적용"

---

## 3. 채용공고 매핑 — "이 요구사항을 어디서 보여주는가"

### 자격요건 1: "AI-native 관점에서 문제 정의하고 구조화"

```
[내 대답]
"Commerce Intel Agent에서 이커머스 상품 데이터의 핵심 문제를 정의했습니다.

문제: 같은 'Galaxy S25 Ultra'가 쿠팡에서는 '[당일발송] 삼성 갤럭시 S25 울트라',
      라쿠텐에서는 '【即日発送】Galaxy S25 Ultra 256GB'로 표기됩니다.
      플랫폼마다 표기가 다르니 '같은 상품'을 매칭할 수 없습니다.

AI-native 해결:
1. Normalizer Agent (Haiku + Structured Output)
   → 다국어 상품명을 정규화하여 'samsung-galaxy-s25-ultra-256gb'라는
     통일된 product_key를 생성합니다.
   → JSON Schema로 출력 형식을 강제해서 프로덕션에서 안정적으로 동작합니다.

2. RAG Classifier (Dense 검색 + Sonnet 판단)
   → product_key를 표준 카테고리에 매핑합니다.
   → ChromaDB 벡터 검색으로 후보를 찾고, Sonnet이 최종 판단합니다.

3. Analyst Agent (Sonnet + Tool Use 멀티턴)
   → 3~4개 도구를 상황에 맞게 조합해서 수급 인사이트를 생성합니다.
   → LLM이 도구 선택을 '판단'하는 것이 핵심입니다.

이 파이프라인의 관리를 DevFlow에서 하고, MCP로 CLI가 자동 업데이트합니다."
```

### 자격요건 2: "LLM 기반 라이브러리 및 프레임워크 능숙 사용"

```
[내 대답]
"두 가지를 직접 구현했습니다.

1. MCP 서버 (Model Context Protocol)
   MCP는 Anthropic이 만든 표준 프로토콜로, LLM이 외부 도구를 호출할 수 있게 합니다.
   저는 이 프로토콜의 서버를 직접 구현해서 11개 도구를 등록했습니다.

   기술적으로 의미 있는 점:
   - JSON-RPC 2.0 기반 stdin/stdout 통신
   - Zod 스키마로 도구 파라미터 타입 강제
   - iron-session 쿠키 기반 인증 자동화 (캐시 + 재로그인)
   - 401 응답 시 자동 재인증 후 요청 재시도

2. Claude Tool Use 멀티턴 (Commerce Intel Agent)
   Analyst Agent가 3~4개 도구를 조합하는 과정:
   Turn 1: resolve_product('galaxy s25 ultra') → product_key
   Turn 2: get_trend_data(product_key, 7일) → 시계열 데이터
   Turn 3: detect_anomalies(product_key) → 수급 이상 탐지
   Turn 4: generate_insight(data) → 자연어 인사이트

   각 턴에서 tool_use 블록 파싱 → 도구 실행 → tool_result 반환 →
   다음 턴 호출의 메시지 루프를 구현합니다."
```

### 자격요건 3: "프롬프트 엔지니어링, RAG, context engineering"

```
[내 대답]
"세 가지 모두 Commerce Intel Agent에서 구현합니다.

프롬프트 엔지니어링:
  - Normalizer: XML 태그 구조화 프롬프트 (<role>, <noise_patterns>, <few_shot_examples>)
  - Classifier: RAG 검색 결과 + 상품 컨텍스트를 주입한 분류 프롬프트
  - Eval-Optimize Loop: 실패 패턴 분석 → 프롬프트 자동 수정 → 회귀 검사

RAG:
  - v1: Dense-only (Voyage AI 임베딩 + ChromaDB)
  - v2: + BM25 Sparse 검색 + Reciprocal Rank Fusion
  - v3: + Adaptive Score Fusion (고유명사 비율에 따라 Dense/Sparse 가중치 동적 조절)

context engineering (Supply-Demand Matrix):
  LLM에게 원시 수치('가격 +2.3%, 판매 +129%')만 주면 뻔한 말을 합니다.
  가격×판매 2×2 매트릭스로 '수요 급증(DEMAND_SURGE)' 상태를 분류해서 주면,
  '재고 확보 우선 권장'이라는 액션 가능한 인사이트를 생성합니다.
  → LLM에게 무엇을 주느냐가 출력 품질을 결정합니다. 이것이 context engineering."
```

### 자격요건 4: "API 개발 및 배포 경험"

```
[내 대답]
"DevFlow는 Next.js App Router 기반으로 20개 이상의 REST API를 구현했습니다.

구조:
  - Zod 4로 모든 요청 바디를 런타임 검증
  - iron-session으로 쿠키 기반 인증 (AES-256 암호화)
  - RBAC 권한 체계 (owner > admin > member)
  - Prisma ORM으로 SQLite(로컬) / PostgreSQL(프로덕션) 듀얼 DB

배포:
  - Vercel 서버리스 배포 (git push → 자동 빌드 → 배포)
  - Supabase PostgreSQL (프로덕션 DB, Mumbai 리전)
  - Vercel과 Supabase 같은 리전 배치로 크로스리전 지연 제거

실전 경험:
  - Vercel 빌드 캐시 오염으로 6회 연속 배포 실패 → 원인 분석 후 해결
  - tsconfig.json의 include 범위가 MCP 서버까지 포함 → exclude로 격리
  - iron-session 쿠키 만료 시 MCP 서버 자동 재인증 구현"
```

### 우대사항: "LLM 활용 챗봇 이상의 새로운 서비스"

```
[내 대답]
"DevFlow + MCP 연동이 정확히 '챗봇 이상'입니다.

일반적인 LLM 서비스: 사용자가 질문 → LLM이 대답 (챗봇)

DevFlow: LLM이 도구를 호출 → 외부 시스템(웹 대시보드)을 변경
  → 노드 상태 변경, 코멘트 추가, 결정 기록
  → 변경 출처 추적 (source 필드: 'web' vs 'cli')
  → 여러 AI 세션이 하나의 대시보드를 공유

이것은 LLM이 '대화'를 넘어 '행동'하는 것입니다.
MCP 프로토콜이 이를 표준화된 방식으로 가능하게 합니다."
```

---

## 4. 예상 기술 질문 + 답변

### Q1: "MCP가 뭔가요? 왜 직접 만들었나요?"

```
MCP는 Model Context Protocol의 약자로, Anthropic이 만든 개방형 표준입니다.
LLM이 외부 도구를 호출할 수 있게 해주는 프로토콜입니다.

기존 방식: LLM에게 "curl 명령어 실행해"라고 시키면, LLM이 텍스트로 명령어를 생성
→ 파싱 에러, 인증 누락, 에러 핸들링 불가

MCP 방식: LLM이 구조화된 도구 목록을 받고, JSON으로 파라미터를 생성하여 호출
→ Zod 스키마로 타입 검증, 에러를 구조적으로 전달, 인증은 서버가 투명하게 처리

직접 만든 이유:
기존 MCP 서버 중에 "프로젝트 관리 도구와 연동"하는 것이 없었습니다.
Linear, Notion 등의 MCP 서버는 있지만, 제가 만든 DevFlow에 맞는 건 없으니
직접 만드는 게 가장 빠르고 정확했습니다.
```

### Q2: "iron-session을 왜 선택했나요? JWT와 뭐가 다른가요?"

```
JWT: 토큰 내용이 Base64로 인코딩되어 있어서 누구나 디코딩 가능합니다.
     서명으로 위변조만 검증하지, 내용 자체는 노출됩니다.
     eyJhbGciOiJIUzI1NiJ9... → 디코딩하면 {userId: "123"} 보임

iron-session: AES-256으로 암호화합니다.
     Fe26.2*1*3002a... → 서버의 비밀키 없이는 해독 자체가 불가능
     쿠키에 userId가 있어도 클라이언트에서 절대 읽을 수 없음

또 하나의 이유: Next.js middleware에서 자연스럽게 쿠키를 검증할 수 있습니다.
JWT는 별도 라이브러리가 필요하지만, iron-session은 Next.js와 네이티브로 연동됩니다.

MCP 서버에서의 활용:
MCP 서버가 iron-session 쿠키를 받아서 API를 호출합니다.
쿠키 만료(7일) 시 자동 재로그인하고, 새 쿠키를 캐시합니다.
LLM은 인증 과정을 전혀 인식하지 못합니다 — 투명한 인증입니다.
```

### Q3: "Tiptap에서 테이블이 깨지는 문제를 어떻게 해결했나요?"

```
증상: 마크다운 테이블을 붙여넣으면 에디터에서는 잘 보이는데,
      다른 곳 갔다가 돌아오면 테이블이 텍스트로 풀려 있음

원인 추적 과정:
1. 입력 시: 마크다운 → marked(MD→HTML 변환) → <table> 태그 → Tiptap 렌더 ✓
2. 저장 시: Tiptap의 HTML → turndown(HTML→MD 변환) → 마크다운 → DB 저장
3. 재로드 시: DB의 마크다운 → marked → HTML → Tiptap ← 여기서 깨짐

디버깅:
- turndown의 변환 결과를 확인 → 테이블 separator(| --- |)가 누락됨
- 원인 1: turndown에 <table> 변환 규칙이 없음 → 직접 추가
- 원인 2: 추가했는데도 깨짐 → Tiptap이 <thead>를 안 쓰고 <tbody>에 <th>를 직접 넣음
  → 제가 만든 separator 규칙이 <thead>에 매칭했는데, <thead>가 없으니 매칭 실패
- 해결: <tr> 안에 <th>가 있는지 querySelector로 감지, 해당 행 뒤에 separator 삽입

이 과정에서 배운 것:
- 라이브러리의 HTML 출력 형식을 가정하면 안 됨 (Tiptap ≠ marked의 HTML)
- roundtrip 테스트(입력 → 저장 → 재로드)를 반드시 해야 함
```

### Q4: "자동 저장에서 debounce 문제를 어떻게 해결했나요?"

```
문제: 노드 A를 편집하다가 노드 B를 클릭하면,
      A의 내용이 B에 저장되는 버그가 있었습니다.

원인: saveDescription 함수가 closure로 selectedNode.id를 캡처합니다.
      debounce 타이머(500ms)가 아직 안 끝났는데 노드가 B로 전환되면,
      타이머가 실행될 때 selectedNode.id가 이미 B로 바뀌어 있습니다.

해결: pendingDescRef에 {nodeId: 'A', content: '...'} 형태로 저장합니다.
      노드가 전환되면, prevNodeIdRef로 이전 노드 ID를 감지하고,
      pendingDescRef의 저장된 nodeId('A')로 즉시 flush합니다.

추가 문제: Tiptap의 useEditor는 초기화 시 콜백을 고정합니다.
      onBlur 콜백이 props 변경에 반응하지 않습니다 (stale closure).
      해결: useRef로 콜백을 래핑, Tiptap은 ref를 통해 항상 최신 함수를 호출.

5가지 저장 트리거를 만들어서 어떤 상황에서든 데이터 유실을 방지합니다:
1. 타이핑 → 500ms debounce
2. 에디터 blur (포커스 이탈)
3. 노드 전환 (이전 노드 즉시 flush)
4. 패널 닫기 / 탭 전환
5. 컴포넌트 언마운트 → fetch + keepalive:true
```

### Q5: "캔버스에서 시맨틱 줌을 어떻게 구현했나요?"

```
목표: 줌 아웃하면 노드가 작게 보이면서 제목만, 줌 인하면 상세 정보까지 보이게

일반적인 구현: 줌 레벨에 따라 React가 다른 컴포넌트를 렌더
→ 30개 노드 × 줌 변경마다 리렌더 = 느림

제 구현 (Dual-DOM):
하나의 노드 안에 compact 버전과 expanded 버전을 동시에 렌더합니다.
줌이 0.8을 넘으면 CSS opacity만 0↔1로 전환합니다.

<div class="compact" style="opacity: 1">제목만</div>
<div class="expanded" style="opacity: 0">상세 정보</div>

줌 변경 시 React 리렌더 = 0회.
CSS transition으로 부드러운 전환.
30개 노드에서도 60fps 유지.

추가로: 상태별 시각 차이도 줌 아웃에서 구분 가능하게 했습니다.
- in_progress: 인디고 글로우 + 두꺼운 왼쪽 바
- backlog: 점선 테두리 + 회색 배경 + 반투명
- done: 초록 + 취소선 + 페이드
이것은 inline style로 적용해서 Tailwind CSS purge에 영향받지 않습니다.
```

### Q6: "이커머스 도메인에서 AI로 뭘 해결하려는 건가요?"

```
"같은 상품인데 플랫폼마다 이름이 다른 문제"를 해결합니다.

쿠팡: [당일발송] 삼성 갤럭시 S25 울트라 256GB 팬텀블랙
라쿠텐: 【即日発送】Galaxy S25 Ultra 256GB ファントムブラック
아마존: Samsung Galaxy S25 Ultra, 256GB, Phantom Black

이 셋을 "같은 상품"으로 인식하고, 시계열 데이터를 합쳐서 분석하면:
"플랫폼 A에서 가격이 올랐는데 판매가 급증 → 수요 급증(DEMAND_SURGE)"
이런 수급 시그널을 자동으로 감지할 수 있습니다.

이것을 하려면 3가지가 필요합니다:
1. 상품 정규화 (Normalizer) → product_key 생성
2. 카테고리 분류 (RAG Classifier) → "이 상품은 Smartphones 카테고리"
3. 시계열 분석 (Time-Series Engine) → 가격/판매/재고 추이

이 3가지를 Analyst Agent가 Tool Use로 조합해서 인사이트를 생성합니다.
```

---

## 5. 어필 포인트 정리

### 어필 1: "PoC가 아니라 실사용 중인 시스템"

```
DevFlow는 포트폴리오용 데모가 아닙니다.
실제로 Commerce Intel Agent의 25개 구현 단계를 관리하는 데 사용 중입니다.
- 35개 노드, 54개 엣지
- 2개 이상의 CLI 세션이 동시에 작업
- 코멘트/결정 기록이 실제로 쌓이는 중
- 상태 변경 이력이 NodeStateLog에 기록

"직접 만들고, 직접 쓰고, 직접 문제를 겪고, 직접 고쳤습니다."
```

### 어필 2: "AI가 도구를 사용하는 구조를 직접 설계"

```
인핸스 공고: "Anthropic Computer Use 등 자동화 웹 에이전트 기술 연구개발"

MCP 서버가 정확히 이것입니다:
- LLM이 도구 목록을 보고 상황에 맞는 도구를 선택
- JSON-RPC로 구조화된 호출
- 에러 핸들링, 인증, 재시도까지 자동화

Commerce Intel Agent의 Analyst Agent도 같은 패턴:
- LLM이 3~4개 도구를 멀티턴으로 조합
- 각 턴의 결과에 따라 다음 도구를 동적으로 선택
```

### 어필 3: "데이터 파이프라인 자동화 경험"

```
인핸스 공고: "데이터 정제 프로세스 자동화"

Commerce Intel Agent의 파이프라인:
  원본 텍스트 → Normalizer(정규화) → Classifier(분류) → Analyst(인사이트)
  각 단계의 비용/지연/정확도를 추적하고 대시보드에 시각화

DevFlow의 자동화:
  스크립트 1회 실행으로 35개 노드 + 54개 엣지 자동 생성
  계층형 데이터 구조 (Phase → Day → Step) 자동 구성
  MCP로 상태 변경/코멘트 추가 자동화
```

### 어필 4: "문제를 만나고 해결한 실전 경험"

```
면접에서 "어려웠던 점"을 물어보면 구체적으로 답할 수 있습니다:

1. Tiptap stale closure → useRef 래핑으로 해결
2. debounce + 노드 전환 → nodeId를 pending에 같이 저장
3. Zod 5000자 제한 silent failure → 제한 확대 + 저장 상태 인디케이터
4. Vercel 빌드 캐시 오염 → tsconfig exclude + 클린 빌드
5. Turndown 테이블 깨짐 → Tiptap의 HTML 출력 분석 후 커스텀 규칙 추가
6. iron-session 쿠키 만료 → 자동 재인증 + 캐시

모두 "문제 → 원인 분석 → 해결 → 재발 방지"의 흐름입니다.
```

---

## 6. 기술 용어 사전 (면접에서 내가 설명할 수 있어야 하는 것)

### MCP (Model Context Protocol)
```
뭐냐: LLM이 외부 도구를 호출하는 표준 프로토콜
누가 만들었나: Anthropic (Claude 만든 회사)
통신 방식: stdin/stdout으로 JSON-RPC 2.0 메시지를 주고받음
왜 중요한가: LLM이 "대화"를 넘어 "행동"할 수 있게 해줌
내가 한 것: MCP 서버를 직접 구현, 11개 도구 등록
```

### Tool Use (Function Calling)
```
뭐냐: LLM이 응답 중간에 "이 도구를 이 파라미터로 호출해줘"라고 요청하는 것
어떻게 동작:
  1. API 호출 시 tools=[{name, description, input_schema}] 전달
  2. LLM 응답에 tool_use 블록이 포함됨 (도구 이름 + 파라미터)
  3. 개발자가 도구를 실행하고 결과를 tool_result로 다시 전달
  4. LLM이 결과를 보고 다음 행동을 결정
왜 중요한가: LLM이 실시간 데이터를 조회하거나 외부 시스템을 변경할 수 있음
```

### Structured Output
```
뭐냐: LLM의 응답을 JSON Schema로 강제하는 것
왜 필요한가: LLM의 출력이 "자유 텍스트"면 파싱이 불안정. JSON Schema를 지정하면
            {brand: "Samsung", model: "Galaxy S25 Ultra"} 형태로 항상 나옴
어떻게: API 호출 시 response_format에 JSON Schema를 전달
내가 한 것: Normalizer Agent에서 상품 정규화에 사용
```

### RAG (Retrieval-Augmented Generation)
```
뭐냐: LLM에게 질문하기 전에, 관련 문서를 먼저 검색해서 컨텍스트로 주는 것
왜 필요한가: LLM은 학습 데이터 이후의 정보를 모름. DB의 최신 데이터를 알려줘야 함
구성:
  1. 문서를 벡터(숫자 배열)로 변환해서 저장 (임베딩)
  2. 질문이 오면, 질문도 벡터로 변환
  3. 벡터 유사도로 관련 문서 검색
  4. 검색된 문서 + 질문을 LLM에게 전달
내가 한 것:
  - Dense: Voyage AI 임베딩 + ChromaDB
  - Sparse: BM25 키워드 검색
  - Hybrid: RRF(Reciprocal Rank Fusion)로 두 결과 병합
```

### Context Engineering
```
뭐냐: LLM에게 "무엇을 주느냐"를 설계하는 것
프롬프트 엔지니어링과의 차이:
  - 프롬프트 엔지니어링: "어떻게 물어볼까" (질문의 형태)
  - Context Engineering: "뭘 같이 줄까" (질문에 포함할 데이터)
내가 한 것: Supply-Demand Matrix
  - 원시 데이터: "가격 +2.3%, 판매 +129%"
  - context engineering 후: "DEMAND_SURGE 상태 (가격 인상에도 판매 급증)"
  → LLM이 "재고 확보 우선 권장"이라는 액션 가능한 인사이트를 생성
```

### iron-session
```
뭐냐: 서버 사이드에서 쿠키를 AES-256으로 암호화하는 세션 관리
JWT와의 차이: JWT는 디코딩 가능(내용 노출), iron-session은 해독 불가능
왜 선택: Next.js middleware에서 네이티브로 쿠키 검증 가능
MCP에서의 활용: 쿠키를 캐시해서 재사용, 만료 시 자동 재로그인
```

### Zustand
```
뭐냐: React 상태 관리 라이브러리 (Redux의 경량 대안)
왜 선택: Redux 대비 코드 70% 적음, 번들 2KB, 보일러플레이트 없음
내가 한 것: 4개 스토어 (UI, Canvas, Node, Session)
주의점: useShallow로 필요한 상태만 구독 → 불필요한 리렌더 방지
```

### Prisma
```
뭐냐: TypeScript ORM (코드로 DB를 다루는 도구)
왜 선택: 타입 자동 생성, SQLite↔PostgreSQL 전환 가능
내가 한 것: 10개 이상 모델 정의, 듀얼 DB 운영 (로컬 SQLite, 프로덕션 PostgreSQL)
```

---

## 7. 면접에서 하지 말아야 할 것

```
1. "Claude가 다 만들었습니다" → ✗
   → "Claude CLI를 활용해서 개발했고, 아키텍처 설계와 문제 해결은 제가 했습니다"

2. 기술 이름만 나열 → ✗
   → 각 기술을 "왜 선택했고, 어떤 문제를 해결했는지" 설명

3. "다 됩니다" → ✗
   → 삭감 기준을 알고 있음 (필수 vs 축소 가능 vs 포기 가능)

4. 완성도 과장 → ✗
   → "DevFlow는 배포 완료, Commerce Intel은 기획 완료 후 구현 중" 솔직하게
```
