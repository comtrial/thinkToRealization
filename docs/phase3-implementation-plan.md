# Phase 3 MVP 구현 작업 계획서

> **목표**: 이슈를 만드는 곳에서 실행 계획 검토까지 일어나는 "관리 + 계획" 통합 도구
> **범위**: Step 1~4 (프로젝트 생성 → 이슈/하위이슈 → @Claude 실행 계획서 생성/검토)
> **아키텍처**: 기존 v2 (Next.js 14 + WebSocket + SQLite/Prisma + xyflow) 위에 확장

---

## 현재 상태 분석 (v2 → Phase 3 Gap)

### 이미 있는 것 (재사용)
- Canvas 시스템 (@xyflow/react 12 + dagre)
- SQLite + Prisma ORM (7 models)
- WebSocket 서버 (port 3001)
- Side Panel (3-mode: closed/peek/full)
- Node CRUD + parent-child self-relation
- Edge CRUD
- Session/Decision 시스템
- State Machine (Track A auto + Track B manual)
- 프로젝트 CRUD (projectDir 필드 이미 존재)

### 새로 만들어야 하는 것
1. **Prisma 스키마 확장**: Plan 모델 추가
2. **프로젝트 생성 강화**: 로컬 디렉토리 브라우저, CLAUDE.md 자동 감지
3. **이슈 관리 UX 강화**: 이슈 생성 → 노드 자동 생성 플로우 명확화
4. **하위 이슈 UX**: 부모 노드에서 하위 이슈 직접 생성
5. **Context Assembler**: CLAUDE.md + 이슈 체인 + 히스토리 → 프롬프트 조합
6. **CLI Manager**: `claude --print --output-format json` subprocess 실행
7. **실행 계획서 UI**: 사이드패널 탭, 생성/검토/승인 플로우
8. **~/.devflow/ 구조**: 로컬 설정 + 계획서 파일 저장

---

## 마일스톤 구조 (7개)

```
M1 (DB/Data Layer) → M2 (프로젝트 강화) → M3 (이슈 관리)
                                              ↓
M4 (Context Assembler) → M5 (CLI Manager) → M6 (실행 계획서 UI)
                                              ↓
                                         M7 (통합 테스트)
```

---

## M1. 데이터 레이어 확장

### 목표
Phase 3에 필요한 DB 스키마와 로컬 파일 구조 준비

### 작업 내역

#### 1-1. Prisma 스키마에 Plan 모델 추가
```prisma
model Plan {
  id          String   @id @default(cuid())
  nodeId      String
  node        Node     @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  version     Int      @default(1)
  status      String   @default("draft")  // draft, approved, rejected, revised
  content     String                       // JSON: { files, changes, tests, risks }
  prompt      String                       // Context Assembler가 생성한 전체 프롬프트
  rawResponse String?                      // Claude CLI 원본 응답
  reviewNote  String?                      // 사용자 수정 요청 사유
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([nodeId])
}
```

#### 1-2. Project 모델에 claudeMdPath 필드 추가
```prisma
// Project 모델에 추가
claudeMdPath String?  // CLAUDE.md 파일 절대 경로
```

#### 1-3. Node 모델에 issue 관련 필드 보강
```prisma
// Node 모델에 추가 (기존 type에 "issue" 이미 있음 — OK)
// description 필드 이미 있음 — OK (에이전트 컨텍스트로 활용)
```
- Node type enum에 `issue` 이미 포함 확인 → 변경 없음
- description이 에이전트 컨텍스트 역할 → 추가 필드 불필요

#### 1-4. ~/.devflow/ 디렉토리 구조 초기화
```
~/.devflow/
├── config.json              # { cliPath: "claude", defaultProjectDir: "..." }
└── projects/
    └── {project-id}/
        └── plans/
            └── {plan-id}.json
```
- 서버 시작 시 `~/.devflow/` 존재 여부 확인 + 자동 생성
- `config.json` 기본값 작성

#### 1-5. Prisma Migration 실행
- `npx prisma migrate dev --name phase3-plan-model`

### 변경 파일
- `prisma/schema.prisma`
- `server/db/devflow-config.ts` (신규)
- `src/lib/types/api.ts` (PlanResponse 타입 추가)

---

## M2. 프로젝트 생성 강화

### 목표
프로젝트 생성 시 로컬 디렉토리 선택 + CLAUDE.md 자동 감지

### 작업 내역

#### 2-1. 로컬 디렉토리 목록 API
- `GET /api/filesystem/directories?path=/Users/...`
- 지정 경로 하위 디렉토리 목록 반환
- 보안: personal-project 하위로 제한 (configurable)
- `.git` 존재 여부, `CLAUDE.md` 존재 여부 함께 반환

#### 2-2. CLAUDE.md 자동 감지
- 디렉토리 선택 시 `{dir}/CLAUDE.md` 자동 탐색
- 존재하면 경로 자동 설정, 미리보기 제공

#### 2-3. CreateProjectDialog 개선
- 기존: title, slug, description, projectDir (텍스트 입력)
- 변경: 디렉토리 트리 브라우저 UI 추가
  - 폴더 아이콘 + 트리 네비게이션
  - `.git` 배지, `CLAUDE.md` 배지 표시
  - 선택 시 projectDir + claudeMdPath 자동 설정
- CLAUDE.md 내용 미리보기 (접을 수 있는 섹션)

#### 2-4. Project API 업데이트
- POST/PUT `/api/projects`: `claudeMdPath` 필드 처리
- GET `/api/projects/[id]`: `claudeMdPath` 포함 응답

### 변경 파일
- `src/app/api/filesystem/directories/route.ts` (신규)
- `src/components/layout/CreateProjectDialog.tsx`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[id]/route.ts`
- `src/lib/schemas/project.ts`

---

## M3. 이슈 관리 UX 강화

### 목표
이슈 생성 → 노드 자동 생성, 하위 이슈 → 자식 노드 자동 연결

### 작업 내역

#### 3-1. 이슈 생성 플로우 강화
- 캔버스 컨텍스트 메뉴에 "새 이슈 생성" 항목 추가
- 이슈 생성 시 type="issue", status="backlog" 기본값
- 생성 즉시 캔버스에 노드 렌더링 (기존 로직 활용)
- Sidebar에 이슈 리스트 패널 추가 (필터: status별)

#### 3-2. 하위 이슈 생성
- 노드 선택 상태에서 "하위 이슈 추가" 버튼 (Side Panel + 노드 컨텍스트 메뉴)
- 생성 시 자동:
  - `parentNodeId` 설정
  - 부모→자식 Edge 생성 (type="dependency")
  - 자식 노드 위치 = 부모 아래 (Y + 200px)
- 트리 시각화: dagre로 부모-자식 자동 레이아웃 옵션

#### 3-3. 이슈 노드 전용 UI 강화
- BaseNode에 이슈 타입 전용 렌더링:
  - description 미리보기 (첫 2줄)
  - 하위 이슈 개수 배지
  - @Claude 실행 계획서 상태 인디케이터 (없음/생성중/검토중/승인됨)
  - priority 컬러 바
- Expanded 모드에서 description 편집 가능 (TipTap 이미 설치됨)

#### 3-4. Description 편집 강화
- Side Panel overview 탭에서 description을 TipTap 에디터로 편집
- Markdown 지원 (이미 react-markdown, remark-gfm 설치됨)
- 자동 저장 (500ms debounce — 기존 패턴 활용)

### 변경 파일
- `src/components/canvas/CanvasContextMenu.tsx`
- `src/components/canvas/BaseNode.tsx`
- `src/components/panel/NodeDetailPanel.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/stores/canvas-store.ts`
- `src/stores/node-store.ts`

---

## M4. Context Assembler

### 목표
이슈 노드의 컨텍스트 체인을 조합하여 Claude CLI용 프롬프트 생성

### 작업 내역

#### 4-1. Context Assembler 모듈 (서버)
```typescript
// server/context/context-assembler.ts
export async function assembleContext(nodeId: string): Promise<AssembledContext> {
  // 1. 노드 조회 (description, parentNodeId)
  // 2. 부모 체인 탐색 (재귀적으로 상위 이슈 수집)
  // 3. 프로젝트의 CLAUDE.md 읽기 (claudeMdPath)
  // 4. 관련 세션 히스토리 수집 (최근 3개)
  // 5. 프롬프트 템플릿에 조합
  return { prompt, contextChain, metadata }
}
```

#### 4-2. 프롬프트 템플릿
```markdown
## 프로젝트 컨텍스트
{CLAUDE.md 내용 — 최대 8K chars}

## 작업 배경
{상위 이슈 체인 — 부모 → 조부모 순}

## 이번 작업
{현재 노드 description}

## 이전 세션 히스토리
{관련 세션 요약 — 최대 3개}

## 출력 형식
아래 JSON 형식으로 실행 계획서를 작성해주세요:
{
  "summary": "변경 사항 한줄 요약",
  "affectedFiles": [{ "path": "...", "action": "create|modify|delete", "description": "..." }],
  "changes": [{ "title": "...", "description": "...", "risk": "low|medium|high" }],
  "testPlan": [{ "description": "...", "type": "unit|integration|e2e" }],
  "risks": [{ "description": "...", "severity": "low|medium|high", "mitigation": "..." }]
}
```

#### 4-3. Context Assembly API
- `POST /api/nodes/[id]/context` — 컨텍스트 조합 결과 반환 (디버그/프리뷰용)

### 변경 파일
- `server/context/context-assembler.ts` (신규)
- `server/context/prompt-template.ts` (신규)
- `src/app/api/nodes/[id]/context/route.ts` (신규)

---

## M5. CLI Manager

### 목표
Claude CLI를 subprocess로 실행하여 실행 계획서 생성

### 작업 내역

#### 5-1. CLI Manager 모듈 (서버)
```typescript
// server/cli/cli-manager.ts
export async function executeClaudeprint(prompt: string, options?: {
  cwd?: string;
  timeout?: number;  // default 120s
}): Promise<CLIResult> {
  // spawn('claude', ['--print', '--output-format', 'json', '-p', prompt])
  // stdout 수집 → JSON 파싱
  // 에러 핸들링 (timeout, non-zero exit, invalid JSON)
  return { success, data, rawOutput, error }
}
```

#### 5-2. CLI 존재 확인
- 서버 시작 시 `which claude` 실행하여 CLI 설치 확인
- 미설치 시 경고 로그 + 프론트엔드에 상태 표시
- `~/.devflow/config.json`의 `cliPath` 오버라이드 지원

#### 5-3. Plan 생성 API
- `POST /api/nodes/[id]/plans` — 실행 계획서 생성 요청
  1. Context Assembler로 프롬프트 조합
  2. CLI Manager로 실행
  3. 응답 파싱 → Plan 모델 저장
  4. `~/.devflow/projects/{projectId}/plans/{planId}.json` 에도 백업
  5. WebSocket으로 plan:created 이벤트 push

#### 5-4. Plan CRUD API
- `GET /api/nodes/[id]/plans` — 노드의 계획서 목록
- `GET /api/plans/[id]` — 계획서 상세
- `PUT /api/plans/[id]` — 상태 변경 (approve/reject) + reviewNote
- `PUT /api/plans/[id]/content` — 직접 편집

### 변경 파일
- `server/cli/cli-manager.ts` (신규)
- `src/app/api/nodes/[id]/plans/route.ts` (신규)
- `src/app/api/plans/[id]/route.ts` (신규)
- `src/app/api/plans/[id]/content/route.ts` (신규)
- `src/lib/schemas/plan.ts` (신규)
- `src/lib/types/api.ts` (PlanResponse 추가)

---

## M6. 실행 계획서 UI

### 목표
노드에서 @Claude 버튼 → 실행 계획서 생성 → 사이드패널에서 검토/승인

### 작업 내역

#### 6-1. @Claude 실행계획서 버튼
- BaseNode expanded 모드에 `@claude 실행계획서` 버튼 추가
- 버튼 상태: idle / generating (spinner) / has-plan (배지)
- 클릭 시 `POST /api/nodes/{id}/plans` 호출
- 생성 중 WebSocket으로 진행 상태 수신

#### 6-2. Side Panel에 Plans 탭 추가
- 기존 탭: overview | sessions | files
- 추가 탭: **plans**
- Plans 탭 내용:
  - 계획서 버전 리스트 (최신 순)
  - 선택된 계획서 상세 뷰

#### 6-3. 실행 계획서 뷰어 컴포넌트
```
PlanViewer
├── PlanHeader (summary, version, status badge, 생성일)
├── PlanAffectedFiles (파일 목록 — path + action 컬러코딩)
├── PlanChanges (변경 사항 카드 리스트 — risk 컬러)
├── PlanTestPlan (테스트 항목 체크리스트)
├── PlanRisks (위험 요소 — severity별 경고 아이콘)
└── PlanActions (✅ 승인 | ❌ 수정 요청 | ✏️ 직접 편집)
```

#### 6-4. 승인/수정 요청 플로우
- **승인**: Plan status → "approved", 노드에 승인 배지 표시
- **수정 요청**: 사유 입력 다이얼로그 → Plan status → "rejected" + reviewNote → 재생성 가능
- **직접 편집**: Plan content를 JSON 에디터로 수정 가능 (CodeMirror or textarea)

#### 6-5. Plan Store (Zustand)
```typescript
// src/stores/plan-store.ts
{
  currentPlan: PlanResponse | null
  plans: PlanResponse[]
  isGenerating: boolean
  generatePlan(nodeId: string): Promise<void>
  approvePlan(planId: string): Promise<void>
  rejectPlan(planId: string, note: string): Promise<void>
  loadPlans(nodeId: string): Promise<void>
}
```

#### 6-6. WebSocket 이벤트 추가
- `plan:generating` — 계획서 생성 시작
- `plan:created` — 계획서 생성 완료
- `plan:error` — 생성 실패

### 변경 파일
- `src/components/canvas/BaseNode.tsx`
- `src/components/panel/PanelTabs.tsx`
- `src/components/panel/PlanTab.tsx` (신규)
- `src/components/plan/PlanViewer.tsx` (신규)
- `src/components/plan/PlanHeader.tsx` (신규)
- `src/components/plan/PlanAffectedFiles.tsx` (신규)
- `src/components/plan/PlanChanges.tsx` (신규)
- `src/components/plan/PlanTestPlan.tsx` (신규)
- `src/components/plan/PlanRisks.tsx` (신규)
- `src/components/plan/PlanActions.tsx` (신규)
- `src/stores/plan-store.ts` (신규)
- `server/ws-server.ts` (plan 이벤트 추가)

---

## M7. 통합 테스트 & 마무리

### 목표
전체 플로우 E2E 검증, 빌드 확인, 버그 수정

### 작업 내역

#### 7-1. E2E 테스트 작성
- `e2e/api-plans.spec.ts` — Plan CRUD API 테스트
- `e2e/api-filesystem.spec.ts` — 디렉토리 목록 API 테스트
- `e2e/ui-plan-flow.spec.ts` — 이슈 생성 → @Claude → 계획서 검토 플로우
- `e2e/ui-project-creation.spec.ts` — 디렉토리 선택 프로젝트 생성
- `e2e/ui-sub-issue.spec.ts` — 하위 이슈 생성/연결

#### 7-2. 빌드 검증
- `npm run build` 성공 확인
- TypeScript strict 모드 에러 0
- ESLint 통과

#### 7-3. 기존 테스트 호환성
- 기존 16개 spec 파일 모두 통과 확인
- 스키마 변경으로 인한 기존 API 테스트 수정

### 변경 파일
- `e2e/api-plans.spec.ts` (신규)
- `e2e/api-filesystem.spec.ts` (신규)
- `e2e/ui-plan-flow.spec.ts` (신규)
- `e2e/ui-project-creation.spec.ts` (신규)
- `e2e/ui-sub-issue.spec.ts` (신규)
- 기존 e2e 파일 수정 (스키마 변경 반영)

---

## 에이전트 팀 구성

### 팀 구조
```
Team Lead (orchestrator)
├── Agent 1: DB & Backend  — M1 + M4 + M5
├── Agent 2: Frontend UI   — M2 + M3 + M6
└── Agent 3: Testing       — M7 (M1~M6 완료 후)
```

### Agent 1: DB & Backend Engineer
**담당**: 데이터 레이어, 서버 모듈, API 라우트
- Prisma 스키마 확장 + migration
- ~/.devflow/ 구조 초기화
- Context Assembler 모듈
- CLI Manager 모듈
- Plan CRUD API
- Filesystem API
- WebSocket 이벤트 확장

### Agent 2: Frontend Engineer
**담당**: UI 컴포넌트, 스토어, 사용자 플로우
- CreateProjectDialog 개선 (디렉토리 브라우저)
- 이슈 관리 UX (컨텍스트 메뉴, 하위 이슈)
- BaseNode 강화 (@Claude 버튼, 계획서 상태)
- Plan 탭 + PlanViewer 컴포넌트 6개
- Plan Store (Zustand)
- Side Panel 탭 추가

### Agent 3: QA Engineer
**담당**: E2E 테스트, 빌드 검증, 버그 리포트
- 신규 E2E 테스트 5개
- 기존 테스트 호환성 확인
- 빌드/린트 검증
- 통합 플로우 테스트

---

## 의존성 & 실행 순서

```
Phase 1 (병렬):
  Agent 1: M1 (DB 스키마 + 마이그레이션)
  Agent 2: M3-1~M3-3 (이슈 UX — 기존 스키마로 가능한 부분)

Phase 2 (M1 완료 후, 병렬):
  Agent 1: M4 (Context Assembler) + M5 (CLI Manager)
  Agent 2: M2 (프로젝트 생성 강화) + M3-4 (Description 편집)

Phase 3 (M4+M5 완료 후, 병렬):
  Agent 1: Plan API 마무리 + WS 이벤트
  Agent 2: M6 (실행 계획서 UI)

Phase 4:
  Agent 3: M7 (전체 테스트)
```

---

## 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Claude CLI 미설치 환경 | @Claude 기능 사용 불가 | CLI 상태 체크 + 안내 메시지 표시 |
| CLI 응답 JSON 파싱 실패 | 계획서 생성 실패 | rawResponse 저장 + fallback 텍스트 표시 |
| CLAUDE.md 8K 초과 | 프롬프트 토큰 초과 | 최대 8K chars 잘라서 전달 |
| 기존 테스트 깨짐 | CI 실패 | 스키마 변경 후 기존 seed/helper 즉시 업데이트 |
| 디렉토리 접근 권한 | 파일시스템 API 실패 | try-catch + 권한 오류 메시지 |

---

## 신규 패키지 (추가 설치 불필요)
- Claude CLI: 이미 시스템에 설치됨 (subprocess로 호출)
- 기타 모든 의존성: 이미 package.json에 존재
  - Prisma, xyflow, Zustand, TipTap, react-markdown, ws 등
