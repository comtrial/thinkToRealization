# 백엔드/서버 아키텍처 상세 분석

## 1. 아키텍처 개요

```
ws-server.ts (진입점)
├── EventBus (이벤트 허브, 싱글톤)
├── PtyManager (PTY 프로세스 관리)
├── CaptureManager (PTY 출력 로그 저장)
├── SessionManager (세션 라이프사이클)
├── StateMachine (노드 상태 전이)
├── FileWatcher (chokidar 파일 감시)
└── RecoveryManager (스테일 세션 복구)
```

**평가: 관심사 분리가 잘 되어 있음. 각 매니저가 단일 책임을 가짐.**

---

## 2. 파일별 분석

### 2.1 ws-server.ts (7/10)

**좋은 점:**
- EventBus 기반 이벤트 구독으로 컴포넌트 간 느슨한 결합
- Graceful shutdown 구현 (SIGINT/SIGTERM)
- 글로벌 + 노드별 클라이언트 분리 관리
- 재연결 시 세션 상태 복원 (`getSessionState`)

**이슈:**
- **[H1] 메시지 핸들러 중복**: global 클라이언트(L299-357)와 node 클라이언트(L379-494)의 `session:start`, `session:end`, `session:resume` 처리 로직이 거의 동일하게 2번 작성됨
  ```
  권장: 공통 `handleMessage(ws, msg, nodeId?)` 함수로 추출
  ```
- **[C2] 메시지 검증 없음**: `JSON.parse` 후 `msg.type`과 `msg.payload`를 바로 사용. Zod 스키마 검증 필요
- `broadcastToNode` + `broadcastToAll` + `broadcastToNodeAndGlobal` 3개 함수 유사하지만 적절한 분리
- `0.0.0.0` 바인딩은 개발 편의지만 프로덕션에서는 보안 위험

### 2.2 event-bus.ts (9/10)

**좋은 점:**
- TypeScript 제네릭으로 타입 안전한 이벤트 시스템
- `EventMap` 타입으로 모든 이벤트 페이로드 명시
- 심플한 싱글톤 패턴
- `setMaxListeners(50)` 적절한 설정

**이슈:**
- 에러 핸들링이 리스너 측에 위임됨 (리스너에서 throw하면 전파됨)
- `removeAllListeners()` 시 이벤트 단위 해제 가능 (잘 설계됨)

### 2.3 pty-manager.ts (8/10)

**좋은 점:**
- 노드당 1개 PTY 제한 (기존 PTY 재사용)
- 30분 idle timeout + `refreshTimeout` 패턴
- `killed` 플래그로 이중 cleanup 방지
- 역방향 lookup (`sessionToNode` Map)
- 환경 변수에서 Claude 관련 변수 필터링

**이슈:**
- `require("node-pty")` 사용 — ESM 호환성 약화. 단, 네이티브 모듈이라 현실적으로 필요
- `dispose()`에서 `kill()` 호출 시 동기적 처리만 — 비동기 cleanup 부족
- PTY 프로세스 OOM이나 좀비 프로세스 모니터링 없음

### 2.4 session-manager.ts (8/10)

**좋은 점:**
- 활성 세션 중복 방지 (`findFirst` 체크)
- 상태 전이를 StateMachine에 위임 (SRP)
- 이벤트 발행을 통한 느슨한 결합
- duration 누적 계산 로직 정확

**이슈:**
- `endSession`에서 이미 active가 아닌 세션을 warn으로만 처리 — 호출자에게 결과 알림 부족
- `resumeSession`에서 `startedAt`을 리셋 — 이전 duration은 보존되나 시작 시간 이력 손실

### 2.5 state-machine.ts (9/10)

**좋은 점:**
- **Prisma 인터랙티브 트랜잭션** 사용으로 race condition 방지 (read + validate + write 원자적)
- Track A(자동)/Track B(수동) 이원 설계
- 멱등성 보장 (같은 상태면 skip)
- 트랜잭션 외부에서 이벤트 발행 (DB 롤백과 이벤트 분리)
- NodeStateLog 자동 기록

**이슈:**
- `triggerType`이 string — Zod enum 검증이면 더 안전
- Track B의 any→any 전이는 의도적이나, `archived` → 다른 상태 전이 시 사이드 이펙트 없음

### 2.6 capture-manager.ts (6/10)

**좋은 점:**
- 2초 간격 flush + 1MB 버퍼 초과 시 즉시 flush
- `strip-ansi`로 ANSI 이스케이프 제거

**이슈:**
- **[M3] `classifyRole()` 휴리스틱 매우 불안정**: `">"` 시작이면 user, `"Claude"` 또는 `"│"` 포함이면 assistant. 실제 터미널 출력에서 오분류 빈번할 것
- `flush()` 내 순차 `saveLog()` 호출 — 대량 데이터 시 성능 저하
- `dispose()`에서 `stop()`이 async지만 await 안 함

### 2.7 file-watcher.ts (8/10)

**좋은 점:**
- 적절한 ignore 패턴 (node_modules, .git, .next 등)
- 300ms debounce로 파일 변경 배치 처리
- `createMany`로 벌크 인서트
- `awaitWriteFinish` 옵션으로 쓰기 완료 대기

**이슈:**
- `depth: 5` 제한 — 깊은 디렉토리 구조에서 누락 가능
- 파일 변경마다 개별 `eventBus.emit` — 대량 변경 시 이벤트 폭주
- `dispose()`에서 `unwatch`가 async지만 반환값 무시

### 2.8 recovery-manager.ts (8/10)

**좋은 점:**
- 서버 시작 시 자동 실행
- 트랜잭션으로 세션 + 노드 + 로그 원자적 처리
- `in_progress` → `todo` 복구 로직 정확

**이슈:**
- 복구 시 EventBus 이벤트를 발행하지 않음 — 클라이언트 연결 시 sync 필요
- `for...of` 순차 처리 — 대량 세션 시 느릴 수 있음 (`Promise.all` 가능)

### 2.9 capture-store.ts (7/10)

**좋은 점:**
- 심플한 파일 기반 로그 저장
- `appendFile` 사용으로 메모리 효율적

**이슈:**
- **[C3] `sessionId`를 파일명으로 직접 사용** — 경로 조작(path traversal) 위험. cuid 형식이라 실질적 위험은 낮으나 검증 필요
- `_rawLength` 미사용 파라미터

### 2.10 server/db/prisma.ts (6/10)

**이슈:**
- `__dirname` 사용은 tsx 실행 시 정상이나 빌드 환경에서 문제 가능
- `src/lib/prisma.ts`와 별도 인스턴스 — **2개의 Prisma 클라이언트가 동일 SQLite 파일 접근**
- PRAGMA 실행이 `.catch(() => {})` — 실패 무시

---

## 3. 아키텍처 수준 평가

### 강점
1. **이벤트 기반 아키텍처**: EventBus가 컴포넌트 간 결합도를 낮춤
2. **싱글톤 패턴 일관성**: 모든 매니저가 module-level export로 싱글톤
3. **Graceful shutdown**: 모든 리소스 정리 구현
4. **인터랙티브 트랜잭션**: StateMachine에서 race condition 방지
5. **Idle timeout**: PTY 리소스 누수 방지

### 약점
1. **WebSocket 메시지 검증 부재**: 악의적/잘못된 메시지에 취약
2. **로그 분류 휴리스틱**: 정확도가 낮아 세션 로그 품질 저하
3. **2중 Prisma 인스턴스**: 연결 관리 복잡성 증가
4. **비동기 cleanup 불완전**: `dispose()` 메서드들의 async 처리 일관성 부족

---

## 4. Supabase 이관 시 영향

| 컴포넌트 | 영향도 | 변경사항 |
|----------|:------:|---------|
| event-bus.ts | 없음 | 순수 in-memory, 변경 불필요 |
| pty-manager.ts | 없음 | 로컬 전용 |
| session-manager.ts | 중간 | Prisma 쿼리를 Supabase client로 전환 |
| state-machine.ts | 높음 | `$transaction` → Supabase RPC 또는 DB 함수 필요 |
| file-watcher.ts | 낮음 | 로컬 전용, DB 쓰기만 전환 |
| capture-store.ts | 중간 | 파일 저장 → Supabase Storage 검토 |
| recovery-manager.ts | 중간 | Prisma 쿼리 전환 |
| ws-server.ts | 낮음 | DB 직접 접근 최소, 대부분 매니저 위임 |
| server/db/prisma.ts | 삭제 | Supabase client로 대체 |
