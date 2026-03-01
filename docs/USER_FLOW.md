# DevFlow — User Flow Diagrams

PRD 시나리오 A/B/C/D 기반 사용자 흐름도. 각 flow에서 호출되는 API 엔드포인트를 명시합니다.

---

## Scenario A: 새 프로젝트 시작

```
사용자                         시스템                          API
  │                             │                              │
  │  1. DevFlow 접속 (/)        │                              │
  │ ──────────────────────────> │                              │
  │                             │  프로젝트 목록 조회           │
  │                             │ ───────────────────────────> │ GET /api/projects
  │  <── 대시보드 렌더링 ────── │  <── ProjectWithProgress[] ─ │
  │                             │                              │
  │  2. "새 프로젝트" 클릭       │                              │
  │ ──────────────────────────> │                              │
  │                             │  CreateProjectDialog 열림     │
  │                             │                              │
  │  3. 이름 입력 + "생성"      │                              │
  │ ──────────────────────────> │  트랜잭션 실행:               │
  │                             │  - Project 생성               │
  │                             │  - 6개 Stage 생성             │
  │                             │    (첫번째: active, 나머지: waiting)
  │                             │  - Activity 기록              │
  │                             │ ───────────────────────────> │ POST /api/projects
  │  <── 프로젝트 카드 추가 ─── │  <── Project (201) ────────── │
  │                             │                              │
  │  4. 프로젝트 카드 클릭       │                              │
  │ ──────────────────────────> │  /project/[id]로 이동         │
  │                             │  프로젝트 상세 조회            │
  │                             │ ───────────────────────────> │ GET /api/projects/[id]
  │                             │  활동 조회                    │
  │                             │ ───────────────────────────> │ GET /api/activities?projectId=xxx
  │                             │                              │
  │  <── Workspace 렌더링 ────  │                              │
  │   - PipelineBar (6단계)     │                              │
  │   - StagePanel ("아이디어 발산" active)                     │
  │   - CLIPanel (세션 없음)    │                              │
  │                             │                              │
  │  5. "새 세션" 클릭          │                              │
  │ ──────────────────────────> │  세션 생성 트랜잭션:          │
  │                             │  - Session 생성               │
  │                             │  - Activity 기록              │
  │                             │ ───────────────────────────> │ POST /api/stages/[id]/sessions
  │                             │                              │
  │                             │  WebSocket 연결               │
  │                             │ ───────────────────────────> │ ws://localhost:3001/ws/terminal
  │                             │                              │  ?sessionId=xxx
  │  <── 터미널 활성화 ──────── │                              │
  │                             │                              │
  │  6. Claude CLI로 대화       │                              │
  │ ──────────────────────────> │  input → pty → output        │
  │  <── 터미널 출력 ────────── │  CaptureManager → DB 저장    │
  │                             │                              │
  │  7. Cmd+P (핀)              │                              │
  │ ──────────────────────────> │  결정사항 입력 prompt          │
  │  내용 입력 + 확인           │                              │
  │ ──────────────────────────> │  트랜잭션:                    │
  │                             │  - Decision 생성              │
  │                             │  - Activity 기록              │
  │                             │ ───────────────────────────> │ POST /api/decisions
  │  <── PinToast + 목록 갱신 ─ │  <── Decision (201) ───────── │
  │                             │                              │
  │  8. "다음 단계" 또는        │                              │
  │     Cmd+Shift+→             │                              │
  │ ──────────────────────────> │  StageTransitionModal 열림    │
  │                             │                              │
  │  9. 요약 입력 + "저장하고 이동"                             │
  │ ──────────────────────────> │  단계 전환 트랜잭션:          │
  │                             │  - 현재: completed + summary  │
  │                             │  - 다음: active               │
  │                             │  - Activity 기록              │
  │                             │ ───────────────────────────> │ POST /api/stages/[id]/transition
  │  <── Pipeline 갱신 ──────── │  <── Stage[] ─────────────── │
  │   "문제 정의" 활성화         │                              │
```

---

## Scenario B: 3일 뒤 복귀

```
사용자                         시스템                          API
  │                             │                              │
  │  1. DevFlow 접속 (/)        │                              │
  │ ──────────────────────────> │                              │
  │                             │ ───────────────────────────> │ GET /api/projects
  │  <── 대시보드 렌더링 ────── │                              │
  │   프로젝트 카드들:          │                              │
  │   - 이름, 현재 단계         │                              │
  │   - 진행률 바               │                              │
  │   - "3일 전" 시간 표시      │                              │
  │                             │                              │
  │  2. 프로젝트 클릭           │                              │
  │ ──────────────────────────> │  /project/[id]로 이동         │
  │                             │ ───────────────────────────> │ GET /api/projects/[id]
  │                             │ ───────────────────────────> │ GET /api/activities?projectId=xxx
  │                             │                              │
  │  <── Workspace 렌더링 ────  │                              │
  │   PipelineBar:              │                              │
  │   [아이디어발산 ✅] → [문제정의 🔄] → [기능구조화 ⬜] → ... │
  │                             │                              │
  │   StagePanel:               │                              │
  │   - "문제 정의" (진행 중)   │                              │
  │   - 결정사항 목록           │                              │
  │   - 이전 세션 목록          │                              │
  │                             │ ───────────────────────────> │ GET /api/stages/[id]/sessions
  │                             │                              │
  │  3. 이전 세션 클릭          │                              │
  │ ──────────────────────────> │  SessionHistory 렌더링       │
  │                             │ ───────────────────────────> │ GET /api/sessions/[id]/history
  │  <── 읽기전용 로그 표시 ─── │  <── 페이지네이션 로그 ────── │
  │                             │                              │
  │  ※ 5분 안에 맥락 복구:     │                              │
  │  - 파이프라인에서 현재 위치 │                              │
  │  - 결정사항으로 핵심 내용   │                              │
  │  - 이전 세션 로그로 상세    │                              │
  │                             │                              │
  │  4. "새 세션" 클릭 → 작업 재개                             │
  │ ──────────────────────────> │                              │
  │                             │ ───────────────────────────> │ POST /api/stages/[id]/sessions
  │                             │ → WebSocket 연결              │
```

---

## Scenario C: 단계 간 이동 (기술 설계 ↔ 구현)

```
사용자                         시스템                          API
  │                             │                              │
  │  현재: "기술 설계" 단계      │                              │
  │  Claude CLI로 아키텍처 논의  │                              │
  │                             │                              │
  │  1. "다음 단계" 클릭        │                              │
  │ ──────────────────────────> │  StageTransitionModal 열림    │
  │                             │                              │
  │  2. 요약 입력 + 저장        │                              │
  │ ──────────────────────────> │  direction: "next"            │
  │                             │  기술 설계 → completed        │
  │                             │  구현 → active                │
  │                             │ ───────────────────────────> │ POST /api/stages/[id]/transition
  │  <── Pipeline 갱신 ──────── │                              │
  │                             │                              │
  │  3. 구현 단계에서 코드 작업  │                              │
  │  "설계를 다시 봐야겠다"      │                              │
  │                             │                              │
  │  4. PipelineBar에서          │                              │
  │     "기술 설계" 노드 클릭    │                              │
  │ ──────────────────────────> │  activeStageId 변경           │
  │                             │  (Zustand store만, API 없음)  │
  │                             │ ───────────────────────────> │ GET /api/stages/[id]/sessions
  │  <── StagePanel 갱신 ────── │                              │
  │   - 기술 설계 결정사항       │                              │
  │   - 이전 세션 로그           │                              │
  │                             │                              │
  │  5. 확인 후 "구현" 노드 클릭 │                              │
  │ ──────────────────────────> │  activeStageId 복귀           │
  │  <── 구현 단계로 복귀 ────── │                              │
  │                             │                              │
  │  ※ 단계 "조회"는 파이프라인  │                              │
  │    노드 클릭만으로 가능.     │                              │
  │    단계 "전환"(상태변경)은   │                              │
  │    transition API 필요.     │                              │
```

---

## Scenario D: 아이디어 Add-on

```
사용자                         시스템                          API
  │                             │                              │
  │  현재: "구현" 단계           │                              │
  │  코딩 중 새 아이디어 떠오름  │                              │
  │                             │                              │
  │  1. PipelineBar에서          │                              │
  │     "아이디어 발산" 클릭     │                              │
  │ ──────────────────────────> │  activeStageId 변경           │
  │                             │ ───────────────────────────> │ GET /api/stages/[id]/sessions
  │  <── 아이디어 발산 세션 목록 │                              │
  │                             │                              │
  │  2. "새 세션" 클릭          │                              │
  │ ──────────────────────────> │                              │
  │                             │ ───────────────────────────> │ POST /api/stages/[id]/sessions
  │                             │ → WebSocket 연결              │
  │  <── 터미널 활성화 ──────── │                              │
  │                             │                              │
  │  3. 새 아이디어 Claude와 논의│                              │
  │                             │                              │
  │  4. Cmd+P로 핀              │                              │
  │ ──────────────────────────> │                              │
  │                             │ ───────────────────────────> │ POST /api/decisions
  │  <── PinToast ──────────── │                              │
  │                             │                              │
  │  5. 다시 "구현" 노드 클릭   │                              │
  │ ──────────────────────────> │  activeStageId 복귀           │
  │                             │ ───────────────────────────> │ GET /api/stages/[id]/sessions
  │  <── 구현 단계로 복귀 ────── │                              │
  │                             │                              │
  │  ※ 아이디어 발산 단계는     │                              │
  │    이미 completed이지만     │                              │
  │    세션 추가 + 결정사항     │                              │
  │    기록은 자유롭게 가능.    │                              │
  │    단계 상태 자체는 변경 안됨│                              │
```

---

## Flow Summary: API Endpoints per Scenario

| Scenario | API Calls |
|----------|-----------|
| **A: 새 프로젝트** | GET projects, POST projects, GET projects/[id], GET activities, POST stages/[id]/sessions, POST decisions, POST stages/[id]/transition |
| **B: 복귀** | GET projects, GET projects/[id], GET activities, GET stages/[id]/sessions, GET sessions/[id]/history, POST stages/[id]/sessions |
| **C: 단계 이동** | POST stages/[id]/transition, GET stages/[id]/sessions |
| **D: Add-on** | GET stages/[id]/sessions, POST stages/[id]/sessions, POST decisions |
