# API 라우트 품질 분석

## 1. 공통 패턴 평가

### API 응답 프레임워크 (8/10)

```typescript
// 성공: { data: T, meta: { timestamp } }
// 에러: { error: { code, message, status } }
```

**좋은 점:**
- 일관된 응답 포맷 (`successResponse`, `errorResponse`)
- `apiHandler` 래퍼로 전역 에러 바운더리
- Zod 검증 에러 자동 포맷팅 (path + message)
- Prisma 에러 → HTTP 에러 매핑 (`handlePrismaError`)

**이슈:**
- `handleApiError`와 `handlePrismaError`가 분리 — 일부 라우트에서 혼용
- `validationErrorResponse`/`notFoundResponse` legacy 별칭 잔존
- `meta.timestamp`만 포함 — pagination meta 없음

### apiHandler 래퍼 (7/10)

```typescript
export function apiHandler(handler) {
  return async (req, context) => {
    try { return await handler(req, context) }
    catch (error) { return handleApiError(error) }
  }
}
```

**좋은 점:**
- 심플한 에러 바운더리
- Next.js App Router 시그니처 준수 (`params: Promise<Record<string, string>>`)

**이슈:**
- 인증/인가 미들웨어 삽입 포인트 없음
- 요청 로깅 없음
- Rate limiting 없음

---

## 2. 엔드포인트별 분석

### Projects API (29개 라우트 중 대표 분석)

| 엔드포인트 | Zod 검증 | 에러처리 | 쿼리 효율 | 비고 |
|-----------|:--------:|:-------:|:---------:|------|
| GET /api/projects | - | O | O | `isActive: true` 필터 |
| POST /api/projects | O | O | O | slug unique 검증 |
| GET /api/projects/[id] | - | O | O | nodeCount include |
| PUT /api/projects/[id] | O | O | O | 부분 업데이트 |
| DELETE /api/projects/[id] | - | O | O | Soft delete |
| GET /api/projects/[id]/canvas | - | O | △ | 전체 노드+엣지 로드 |
| GET /api/projects/[id]/dashboard | - | O | △ | 3개 쿼리 분리 실행 |

### Nodes API

| 엔드포인트 | Zod 검증 | 에러처리 | 쿼리 효율 | 비고 |
|-----------|:--------:|:-------:|:---------:|------|
| POST /api/projects/[id]/nodes | O | O | O | |
| GET /api/nodes/[id] | - | O | O | sessions/decisions include |
| PUT /api/nodes/[id] | O | O | O | |
| DELETE /api/nodes/[id] | - | O | O | Archive + StateLog |
| PUT /api/nodes/[id]/status | O | O | O | StateMachine 연동 |
| PUT /api/nodes/positions | O | O | △ | 벌크 업데이트지만 순차 처리 |

### Edges API

| 엔드포인트 | Zod 검증 | 에러처리 | 쿼리 효율 | 비고 |
|-----------|:--------:|:-------:|:---------:|------|
| POST /api/edges | O | O | O | self-ref + dup 검증 |
| PUT /api/edges/[id] | O | O | O | |
| DELETE /api/edges/[id] | - | O | O | |

### Sessions API

| 엔드포인트 | Zod 검증 | 에러처리 | 쿼리 효율 | 비고 |
|-----------|:--------:|:-------:|:---------:|------|
| POST /api/nodes/[id]/sessions | O | O | O | |
| GET /api/sessions/[id] | - | O | O | files + decisions include |
| PUT /api/sessions/[id]/end | O | O | O | duration 계산 |
| POST /api/sessions/[id]/resume | - | O | O | |
| GET /api/sessions/[id]/log | - | O | O | 파일 파싱 |

### Decisions API

| 엔드포인트 | Zod 검증 | 에러처리 | 쿼리 효율 | 비고 |
|-----------|:--------:|:-------:|:---------:|------|
| POST /api/decisions | O | O | O | |
| DELETE /api/decisions/[id] | - | O | O | |
| POST /api/decisions/[id]/promote | O | O | O | 노드+엣지 생성 |

---

## 3. 주요 이슈

### Critical

#### C1. 인증/인가 완전 부재
- 모든 엔드포인트가 인증 없이 접근 가능
- `/api/test/cleanup`이 프로덕션에서도 호출 가능
- Supabase 이관 시 Supabase Auth + RLS로 해결 가능

### High

#### H1. 위치 벌크 업데이트 비효율
```typescript
// PUT /api/nodes/positions — 순차 update
for (const node of nodes) {
  await prisma.node.update({ where: { id: node.id }, data: { canvasX, canvasY } })
}
```
- N개 노드 → N개 쿼리. `$transaction` 래핑은 되어있으나 개별 쿼리
- PostgreSQL에서는 `UPDATE ... FROM (VALUES ...)` 패턴 사용 가능

#### H2. Dashboard 쿼리 최적화 부족
- `in_progress`, `todo`, `recent_done` 3개 쿼리를 별도 실행
- 하나의 쿼리로 status별 그룹핑 가능

### Medium

#### M1. Canvas 데이터 전체 로드
- `GET /api/projects/[id]/canvas`가 모든 노드+엣지를 한 번에 로드
- 노드 수 증가 시 응답 크기 급증 — pagination 또는 viewport 기반 로딩 필요

#### M2. Promote 트랜잭션 누락
- `POST /api/decisions/[id]/promote`에서 Decision 업데이트 + Node 생성 + Edge 생성이 별도 쿼리
- 중간 실패 시 불일치 상태 가능 — `$transaction` 필요

#### M3. API 응답 캐싱 없음
- `Cache-Control` 헤더 미설정
- 특히 canvas 데이터는 폴링되므로 ETag/If-None-Match 유용

### Low

#### L1. 일부 라우트에서 Zod 미적용
- GET 라우트에서 query parameter 검증 없음 (예: `?status=` 필터)
- 잘못된 status 값으로 빈 결과 반환 (에러가 아님)

---

## 4. 보안 분석

| 항목 | 상태 | 위험도 | 설명 |
|------|:----:|:------:|------|
| 인증 | 미구현 | Critical | 모든 API 무방비 |
| 입력 검증 | 부분적 | Medium | Zod 적용된 곳은 안전 |
| SQL Injection | 안전 | - | Prisma ORM 사용 |
| XSS | 부분적 | Low | React 자동 이스케이프, 단 description Markdown 렌더링 주의 |
| CSRF | 미구현 | Medium | SameSite 쿠키 미설정 (현재 쿠키 미사용이라 실질 위험 낮음) |
| Rate Limiting | 미구현 | Medium | DoS 가능 |
| CORS | Next.js 기본 | Low | 별도 설정 없음 |
| test/cleanup | 노출 | High | 프로덕션에서도 호출 가능 |

---

## 5. Supabase 이관 시 API 변경사항

### 필수 변경
1. **Prisma → Supabase Client**: 모든 라우트에서 `prisma.xxx` → `supabase.from('xxx')` 전환
2. **$transaction → RPC**: Prisma 인터랙티브 트랜잭션 → PostgreSQL function 또는 Supabase RPC
3. **인증 추가**: `apiHandler`에 인증 미들웨어 삽입 + RLS 정책 설정
4. **test/cleanup 제거 또는 보호**: 환경 변수 가드 추가

### 권장 변경
1. **API 클라이언트 레이어**: `fetch` 직접 호출 → 중앙화된 API 클라이언트
2. **React Query/SWR 도입**: 클라이언트 캐싱 + 자동 재검증
3. **Supabase Realtime 활용**: 일부 폴링을 실시간 구독으로 전환
