# DevFlow v2 - 프로젝트 종합 분석 보고서

> 분석일: 2026-03-05
> 목적: 리팩토링 Go/Stop 판단 + Supabase 이관 사전 평가

---

## 1. 종합 점수표

| 영역 | 점수 (1-10) | 등급 | 핵심 소견 |
|------|:-----------:|:----:|-----------|
| **백엔드/서버 아키텍처** | 6.5 | B- | EventBus+StateMachine 우수, WS 핸들러 200줄 중복, SessionManager race condition, server/db/prisma.ts dead code |
| **프론트엔드 아키텍처** | 6.5 | B- | Zustand 5-store 분리, Dual-DOM Zoom 우수, SidePanel 150줄 중복, CanvasView 전체 store 구독, Error Boundary 전무 |
| **API 라우트** | 7.0 | B | Zod 검증 일관, **apiHandler 래퍼 0개 라우트에서 사용**, Session duration 계산 버그, 인증 부재 |
| **데이터 모델** | 7.0 | B | 정규화 적절, Edge/Node 인덱스 누락, Enum→String, Decision.promotedToNodeId FK 없음 |
| **테스트** | 5.7 | C+ | E2E 22개 spec, `waitForTimeout` 40+회 사용, 유닛테스트/WS테스트 전무, 환경 종속 경로 |
| **의존성/설정** | 6.0 | C+ | strict 모드 양호, **next.config.mjs 완전 빈 파일**, Google Fonts 이중 로드 버그, dagre 6년 미유지보수 |
| **전체 평균** | **6.5** | **B-** | 로컬 개발 도구로서 기능적으로 동작, 프로덕션 전환 시 상당한 보완 필요 |

---

## 2. 리팩토링 판정: **GO (조건부)**

### 근거
- 아키텍처 기반이 탄탄 (EventBus, StateMachine, 싱글톤 패턴)
- Zustand 4-store 설계가 관심사 분리를 잘 반영
- 이미 동작하는 E2E 테스트 22개 spec이 리팩토링 안전망 역할
- Prisma 스키마가 PostgreSQL 전환에 큰 수정 없이 이관 가능

### 선행 조건 (리팩토링 전 필수)
1. **인증/인가 레이어** 추가 (현재 완전 무방비)
2. **WS 서버 메시지 핸들러** 중복 제거 (global + node-specific 로직 통합)
3. **유닛 테스트** 최소한의 코어 로직 커버 (StateMachine, SessionManager)

---

## 3. Supabase 이관 판정: **GO (중간 난이도)**

### 예상 작업량: 중 (2-3주)

| 영역 | 난이도 | 설명 |
|------|:------:|------|
| Prisma schema 전환 | 낮음 | `sqlite` → `postgresql`, DateTime 처리 자동 |
| PRAGMA 제거 | 낮음 | WAL/busy_timeout 등 SQLite 전용 코드 삭제 |
| WebSocket 서버 | 높음 | Supabase Realtime으로 전환 or 별도 WS 유지 결정 필요 |
| PTY/터미널 | N/A | 로컬 전용 기능, Supabase와 무관 |
| 세션 로그 | 중간 | 파일 기반(.devflow-logs/) → Supabase Storage or 유지 |
| 파일 워처 | N/A | 로컬 전용 기능, Supabase와 무관 |
| 인증 | 중간 | Supabase Auth 추가 필요 (현재 미구현) |

### 핵심 결정 사항
1. **듀얼 서버 유지 vs Supabase Realtime**: PTY I/O는 로컬 WS 필수 → 하이브리드 구조 권장
2. **로그 저장소**: DB 이관 시 `.devflow-logs/` 파일 → Supabase Storage 전환 검토
3. **2개 Prisma 인스턴스 통합**: 현재 `src/lib/prisma.ts` + `server/db/prisma.ts` 분리 → 연결 풀 관리 필요

---

## 4. 우선순위별 이슈 분류

### Critical (즉시 수정)
| # | 이슈 | 영역 | 상세 |
|---|------|------|------|
| C1 | 인증/인가 완전 부재 | API | 모든 엔드포인트가 무인증 |
| C2 | WS 메시지 검증 없음 | Server | JSON.parse 후 payload 검증 없이 바로 처리 |
| C3 | test/cleanup 환경 가드 없음 | API | 프로덕션에서도 데이터 삭제 API 호출 가능 |
| C4 | SidePanel 150줄 코드 중복 | Frontend | 모바일/데스크톱 렌더링이 거의 동일하게 복사됨 |
| C5 | Error Boundary 전무 | Frontend | 컴포넌트 에러 시 전체 앱 크래시 |
| C6 | SessionManager.startSession race condition | Server | findFirst + create가 트랜잭션 아님 → 중복 active 세션 가능 |

### High (리팩토링 시 수정)
| # | 이슈 | 영역 | 상세 |
|---|------|------|------|
| H1 | ws-server.ts 메시지 핸들러 200줄 중복 | Server | global/node 클라이언트 동일 로직 2번 작성 |
| H2 | Session duration 계산 버그 | API | resume 후 종료 시 `now - startedAt`이 전체 시간 이중 계산 |
| H3 | apiHandler 래퍼 미사용 | API | 존재하지만 0개 라우트에서 사용, 15+ 라우트에 try/catch 중복 |
| H4 | CanvasView 전체 store 구독 | Frontend | 구조분해로 13개 필드 구독 → 어떤 변경이든 전체 리렌더 |
| H5 | CustomEdge memo 미적용 | Frontend | viewport 이동마다 모든 edge 리렌더 |
| H6 | server/db/prisma.ts dead code | Server | 파일 존재하나 0곳에서 import |
| H7 | Enum을 String으로 저장 | Schema | 런타임 타입 안전성 없음 |
| H8 | 유닛 테스트 전무 | Testing | 핵심 로직 미테스트 |
| H9 | NodeDetailPanel inline API 호출 | Frontend | onChange에서 직접 fetch, store action 추출 필요 |
| H10 | Decision promote 중복 방지 없음 | API | 이미 promote된 decision 재promote 가능 |

### Medium (개선 권장)
| # | 이슈 | 영역 | 상세 |
|---|------|------|------|
| M1 | next.config.mjs 완전 빈 파일 | Config | 보안 헤더, serverExternalPackages 미설정 |
| M2 | Google Fonts 이중 로드 | Config | globals.css @import + layout.tsx localFont 중복 |
| M3 | classifyRole() 휴리스틱 불안정 | Server | ">" 시작 → user, "Claude" 포함 → assistant |
| M4 | Playwright waitForTimeout 40+회 | Testing | 하드코딩된 대기로 flaky 테스트 원인 |
| M5 | nodeTypeOptions 3곳 중복 정의 | Frontend | CanvasContextMenu, PromoteDialog, NodeDetailPanel |
| M6 | Plans JSON.parse try/catch 없음 | API | 잘못된 JSON 시 전체 500 에러 |
| M7 | dagre 6년 미유지보수 | Config | 마지막 릴리즈 2018년 |
| M8 | Edge/Decision 스키마 ID .min(1) 누락 | API | 빈 문자열 nodeId 통과 가능 |

### Low (나중에 개선)
| # | 이슈 | 영역 | 상세 |
|---|------|------|------|
| L1 | Edge 유니크 제약 없음 | Schema | 동일 from→to 중복 엣지 DB 레벨 방지 못함 |
| L2 | Decision.promotedToNodeId FK 없음 | Schema | 참조 무결성 미보장 |
| L3 | node-pty devDependencies 위치 | Config | 서버 런타임 사용인데 devDeps |
| L4 | @types/node ^20 → ^22 필요 | Config | Node.js 22 런타임과 타입 불일치 |
| L5 | @xterm/addon-webgl 미사용 | Config | package.json에 있으나 코드 미사용 |

---

## 5. 상세 분석 문서 목차

| 문서 | 내용 |
|------|------|
| [01-backend-server.md](./01-backend-server.md) | 백엔드/서버 아키텍처 상세 분석 |
| [02-frontend-architecture.md](./02-frontend-architecture.md) | 프론트엔드 컴포넌트/스토어 분석 |
| [03-api-routes.md](./03-api-routes.md) | API 라우트 품질 분석 |
| [04-data-model.md](./04-data-model.md) | 데이터 모델 + Supabase 이관 체크리스트 |
| [05-testing.md](./05-testing.md) | 테스트 커버리지 및 품질 분석 |
| [06-dependencies-config.md](./06-dependencies-config.md) | 의존성 및 설정 분석 |
