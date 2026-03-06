# 데이터 모델 + Supabase 이관 분석

## 1. 스키마 설계 평가 (7.5/10)

### 모델 구조
```
Project ──< Node ──< Session ──< SessionFile
               │         └──< Decision
               ├──< Decision
               ├──< Edge (self-join: from/to)
               ├──< NodeStateLog
               ├──< Plan
               └──? Node (parentNodeId self-ref)
```

### 좋은 점
1. **정규화 수준 적절** (3NF): 중복 데이터 없음
2. **Cascade delete 일관성**: 프로젝트 삭제 → 노드 삭제 → 세션/엣지 등 자동 삭제
3. **Self-referential 관계**: `Node.parentNodeId`로 하위 이슈 구조 지원
4. **감사 로그**: `NodeStateLog`로 상태 변경 이력 추적
5. **cuid ID**: 분산 환경에서도 안전한 ID 생성
6. **인덱스 설계**: 주요 FK에 복합 인덱스 (`[projectId, status]`, `[nodeId]`, `[sessionId]`)

### 이슈

#### H2. Enum을 String으로 저장
```prisma
type      String   @default("task")      // idea|task|decision|issue|milestone|note
status    String   @default("backlog")    // backlog|todo|in_progress|done|archived
priority  String   @default("none")       // none|low|medium|high|critical
```
- **문제**: DB 레벨에서 잘못된 값 삽입 방지 불가
- **SQLite 제한**: enum 타입 미지원 → String 사용은 불가피
- **PostgreSQL 전환 시**: `@db.VarChar` 또는 PostgreSQL enum 타입 활용 가능

#### L2. Edge 유니크 제약 없음
```prisma
model Edge {
  fromNodeId String
  toNodeId   String
  // @@unique([fromNodeId, toNodeId, type]) 없음
}
```
- API에서 중복 체크하나 DB 레벨 보장 없음
- 동시 요청 시 중복 가능

#### 기타
- `Decision.promotedToNodeId`가 FK가 아닌 String — 참조 무결성 미보장
- `Session.logFilePath` 대부분 미사용 (CaptureStore가 sessionId 기반으로 경로 생성)
- `Plan.content`와 `Plan.rawResponse`가 String — 대용량 텍스트에 TEXT 타입 명시 필요 (PostgreSQL)

---

## 2. 인덱스 분석

### 현재 인덱스
| 모델 | 인덱스 | 용도 |
|------|--------|------|
| Node | `@@index([projectId, status])` | 프로젝트별 상태 필터링 |
| Session | `@@index([nodeId])` | 노드별 세션 조회 |
| SessionFile | `@@index([sessionId])` | 세션별 파일 목록 |
| Decision | `@@index([nodeId])` | 노드별 결정 목록 |
| Plan | `@@index([nodeId])` | 노드별 계획서 목록 |
| NodeStateLog | `@@index([nodeId])` | 노드별 상태 로그 |

### 누락된 인덱스 (권장)
| 모델 | 권장 인덱스 | 이유 |
|------|-----------|------|
| Edge | `@@index([fromNodeId])` | 노드의 outEdges 조회 |
| Edge | `@@index([toNodeId])` | 노드의 inEdges 조회 |
| Session | `@@index([nodeId, status])` | 활성 세션 조회 (빈번) |
| Project | `@@index([isActive])` | 활성 프로젝트 필터 |

---

## 3. Prisma 클라이언트 분석

### 이중 인스턴스 문제
```
src/lib/prisma.ts      → Next.js 프로세스용 (globalThis 캐싱)
server/db/prisma.ts    → WS 서버 프로세스용 (별도 인스턴스)
```

- 두 프로세스가 동일 SQLite 파일(`prisma/dev.db`)에 접근
- WAL 모드 + `busy_timeout=5000`으로 동시 접근 처리
- **SQLite에서는 동작하나**, PostgreSQL에서는 연결 풀 관리가 다름

### PRAGMA 설정 (SQLite 전용)
```typescript
PRAGMA journal_mode=WAL;        // Write-Ahead Logging
PRAGMA busy_timeout=5000;       // 5초 대기
PRAGMA synchronous=NORMAL;      // 성능 최적화
PRAGMA cache_size=-20000;       // 20MB 캐시
```
- PostgreSQL 전환 시 **모두 삭제** 필요
- 대신 연결 풀 설정 (pgBouncer, Supabase 기본 제공)

---

## 4. SQLite → PostgreSQL/Supabase 이관 체크리스트

### Phase 1: 스키마 전환

#### 필수 변경
- [ ] `datasource db { provider = "sqlite" }` → `provider = "postgresql"`
- [ ] `DATABASE_URL` 환경변수 → Supabase connection string
- [ ] `server/db/prisma.ts`의 PRAGMA 코드 삭제
- [ ] `src/lib/prisma.ts`의 PRAGMA 코드 삭제

#### 권장 변경
- [ ] String enum 필드에 `@db.VarChar(20)` 추가 또는 PostgreSQL enum 사용
- [ ] Edge에 `@@unique([fromNodeId, toNodeId, type])` 추가
- [ ] Plan의 `content`, `rawResponse`에 `@db.Text` 추가
- [ ] `Decision.promotedToNodeId`를 FK로 변경 (optional Node 관계)
- [ ] 누락 인덱스 추가 (Edge의 fromNodeId/toNodeId)

### Phase 2: 코드 전환

#### Prisma 유지 시 (권장 — 변경 최소화)
- [ ] `prisma migrate dev` 재실행으로 PostgreSQL 마이그레이션 생성
- [ ] `$transaction` 인터랙티브 트랜잭션 호환 확인 (PostgreSQL에서 더 안정적)
- [ ] `$executeRawUnsafe` PRAGMA 호출 제거
- [ ] 연결 풀 설정 (Supabase는 기본 pgBouncer 제공)

#### Supabase Client 전환 시 (선택)
- [ ] 모든 `prisma.xxx` 호출을 `supabase.from('xxx')` 로 전환
- [ ] 트랜잭션 → Supabase RPC (PostgreSQL function)
- [ ] 타입 생성: `supabase gen types typescript`

### Phase 3: 인프라

- [ ] Supabase 프로젝트 생성 및 설정
- [ ] 환경변수 전환 (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- [ ] RLS 정책 설정 (인증 도입 시)
- [ ] 기존 SQLite 데이터 마이그레이션 스크립트 작성
- [ ] Supabase Storage 설정 (세션 로그 파일 이관 시)

### Phase 4: 검증

- [ ] 전체 E2E 테스트 통과 확인
- [ ] 동시 접근 테스트 (PostgreSQL 격리 수준 확인)
- [ ] 성능 비교 (로컬 SQLite vs 원격 Supabase — 레이턴시 증가 예상)

---

## 5. 데이터 모델 개선 제안

### 단기 (이관 전)
1. Edge 유니크 제약 추가
2. 누락 인덱스 추가
3. `Session.logFilePath` 필드 제거 (사용되지 않음)

### 중기 (이관 시)
1. String enum → PostgreSQL enum 또는 CHECK 제약
2. `Decision.promotedToNodeId` → FK 관계
3. `Plan.content` → `@db.Text`
4. Soft delete 패턴 통일 (Project만 isActive, Node는 status=archived)

### 장기 (이관 후)
1. Full-text search (PostgreSQL `tsvector` 활용)
2. `NodeStateLog` 파티셔닝 (대량 누적 시)
3. Supabase Realtime 구독 (변경 알림)
