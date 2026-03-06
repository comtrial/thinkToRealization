# 테스트 커버리지 및 품질 분석

## 1. 테스트 현황

### 구성
- **프레임워크**: Playwright (chromium + mobile)
- **Spec 파일**: 22개 (API 8개 + UI 11개 + integration 2개 + layout 1개)
- **설정**: sequential (workers: 1), retries: 2, timeout: 30s
- **포트**: 3333 (개발 서버와 분리)
- **유닛 테스트**: 없음

### Spec 파일 목록

| 카테고리 | 파일 | 테스트 대상 |
|----------|------|-----------|
| API | api-projects.spec.ts | Projects CRUD |
| API | api-nodes.spec.ts | Nodes CRUD + status |
| API | api-edges.spec.ts | Edges CRUD |
| API | api-sessions.spec.ts | Sessions lifecycle |
| API | api-decisions.spec.ts | Decisions + promote |
| API | api-validation.spec.ts | 입력 검증 에러 |
| API | api-plans.spec.ts | Plans CRUD |
| API | api-filesystem.spec.ts | 파일시스템 API |
| UI | ui-canvas.spec.ts | 캔버스 상호작용 |
| UI | ui-dashboard.spec.ts | 대시보드 표시 |
| UI | ui-sidepanel.spec.ts | 사이드 패널 동작 |
| UI | ui-command-palette.spec.ts | 커맨드 팔레트 |
| UI | ui-shortcuts.spec.ts | 키보드 단축키 |
| UI | ui-projects.spec.ts | 프로젝트 선택/전환 |
| UI | ui-project-creation.spec.ts | 프로젝트 생성 |
| UI | ui-project-flow.spec.ts | 프로젝트 전체 플로우 |
| UI | ui-sub-issue.spec.ts | 하위 이슈 |
| UI | ui-plan-flow.spec.ts | 계획서 플로우 |
| UI | ui-ux-improvements.spec.ts | UX 개선사항 |
| Integration | integration.spec.ts | 통합 시나리오 |
| Integration | user-flow-complete.spec.ts | 전체 사용자 플로우 |
| Layout | layout.spec.ts | 레이아웃 반응형 |

---

## 2. 테스트 품질 평가 (6.5/10)

### 좋은 점
1. **API 테스트 충실**: 모든 CRUD 엔드포인트 + 검증 에러 + 엣지 케이스 커버
2. **테스트 데이터 격리**: `__e2e__` prefix 슬러그로 실제 데이터와 분리
3. **Helper 함수 체계적**: `cleanTestData()`, `createTestProject()`, `createTestNode()` 등 재사용 가능
4. **모바일 뷰포트 프로젝트**: Playwright 설정에 mobile 프로젝트 포함
5. **Retry 설정**: 2회 재시도로 flaky 테스트 완화

### 이슈

#### H3. 유닛 테스트 부재
- **StateMachine**: 상태 전이 규칙이 복잡하나 직접 테스트 없음
- **SessionManager**: 라이프사이클 로직 미테스트
- **EventBus**: 이벤트 발행/구독 미테스트
- **reconcileWithAPI()**: Undo/Redo diff 로직 미테스트
- **log-parser**: 파싱 로직 미테스트

#### M4. WebSocket 테스트 없음
- Playwright 설정에서 WS 서버 시작하지 않음 (`npx next dev`만 실행)
- 세션 시작/종료, PTY I/O, 실시간 이벤트 모두 미테스트
- 터미널 관련 UI 테스트도 제한적

#### 기타 이슈
- **하드코딩된 대기**: `page.waitForTimeout(500)` 등 고정 대기 — flaky 원인
- **networkidle 의존**: `waitForLoadState('networkidle')` — 폴링 API 있으면 불안정
- **cleanup 신뢰성**: retry 루프로 cleanup 확인 (10회, 300ms) — 때때로 실패 가능

---

## 3. 커버리지 갭 분석

### 테스트됨
- [x] Projects CRUD (생성, 조회, 수정, 삭제, 목록)
- [x] Nodes CRUD (생성, 조회, 수정, 삭제, 상태 변경)
- [x] Edges CRUD (생성, 수정, 삭제, 검증)
- [x] Sessions API (생성, 종료, 재개, 로그)
- [x] Decisions (생성, 삭제, 프로모션)
- [x] Plans (생성, 조회, 수정)
- [x] 캔버스 노드 표시
- [x] 대시보드 카드 표시
- [x] 사이드 패널 열기/닫기
- [x] 커맨드 팔레트
- [x] 키보드 단축키
- [x] 프로젝트 전환
- [x] 반응형 레이아웃

### 미테스트 (중요)
- [ ] **WebSocket 연결/재연결**
- [ ] **터미널 I/O** (PTY 데이터 흐름)
- [ ] **세션 시작/종료 전체 흐름** (WS → PTY → 상태 전이)
- [ ] **Undo/Redo** (캔버스 + API 동기화)
- [ ] **파일 워처** (파일 변경 감지 → DB 저장 → WS 브로드캐스트)
- [ ] **동시 접근** (다중 탭/클라이언트)
- [ ] **에러 시나리오** (WS 끊김, API 실패, DB 잠금)
- [ ] **StateMachine 전이 규칙** (모든 from→to 조합)
- [ ] **Recovery** (서버 재시작 후 세션 복구)

### 미테스트 (낮은 우선순위)
- [ ] 접근성 (a11y 자동 테스트)
- [ ] 성능 (페이지 로드 시간, 대량 노드 렌더링)
- [ ] 브라우저 호환성 (Firefox, Safari)
- [ ] 다크 모드 (현재 미지원)

---

## 4. Playwright 설정 분석

### 현재 설정
```typescript
{
  fullyParallel: false,    // 순차 실행
  workers: 1,              // 단일 워커
  retries: 2,              // 2회 재시도
  timeout: 30000,          // 30초
  webServer: {
    command: "npx next dev --port 3333",  // Next.js만 실행
    timeout: 120000,
  }
}
```

### 이슈
1. **WS 서버 미포함**: `webServer`에서 `npm run dev`가 아닌 `npx next dev`만 실행
   - 세션/터미널 관련 E2E 테스트 불가
   - 해결: `command`를 `concurrently` 사용으로 변경 또는 두 번째 `webServer` 추가

2. **순차 실행 + 단일 워커**: 안전하지만 느림
   - API 테스트는 독립적이므로 병렬 가능
   - 해결: API 테스트를 별도 프로젝트로 분리하여 병렬 실행

3. **Trace 설정**: `on-first-retry`만 — 첫 실행 실패 시 디버깅 어려움
   - 해결: CI에서는 `on` 또는 `retain-on-failure`

---

## 5. 개선 권장사항

### 단기 (즉시)
1. **유닛 테스트 프레임워크 도입** (vitest 권장)
   - StateMachine 전이 규칙 100% 커버
   - log-parser 파싱 로직
   - reconcileWithAPI diff 로직
2. **Playwright에 WS 서버 포함**
   - `webServer.command`를 `npm run dev` 또는 concurrently로 변경

### 중기
3. **WebSocket 통합 테스트**
   - ws 라이브러리로 직접 WS 클라이언트 테스트
   - 세션 시작→PTY 출력→종료 전체 플로우
4. **하드코딩된 대기 제거**
   - `waitForTimeout` → `waitForSelector` 또는 `expect.poll`로 대체
5. **테스트 병렬화**
   - API 테스트를 `fullyParallel: true`로 전환
   - 프로젝트별 고유 slug로 격리

### 장기
6. **성능 테스트**: 100+ 노드 캔버스 렌더링 시간
7. **접근성 테스트**: `@axe-core/playwright` 통합
8. **Visual Regression**: Playwright 스크린샷 비교
