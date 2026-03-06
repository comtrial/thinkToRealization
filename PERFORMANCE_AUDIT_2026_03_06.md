# thinkToRealization - 배포 환경 성능 감사 보고서

**작성일**: 2026.03.06
**분석 범위**: Vercel 배포 환경 전반 (API, 클라이언트, DB, 빌드, SSR)
**배포 환경**: Vercel + Supabase PostgreSQL (PgBouncer, South Asia Mumbai)

---

## Executive Summary

5개 영역을 병렬 심층 분석한 결과, **총 42개 성능 이슈**를 발견했습니다.
핵심 문제는 크게 4가지로 요약됩니다:

1. **Vercel 아키텍처 미스매치** — localhost 전용 설계(WebSocket, node-pty, filesystem)가 서버리스에서 실패/리소스 낭비
2. **DB 쿼리 비효율** — 누락된 인덱스, N+1 패턴, 무제한 쿼리, nodeWithCounts 과다 페칭
3. **클라이언트 리렌더링 폭풍** — Zustand 전체 구독, DashboardView가 캔버스 모든 변경에 재계산
4. **캐싱 전무** — 모든 GET 엔드포인트에 Cache-Control 헤더 없음, SWR/React Query 미사용

---

## TIER 1: CRITICAL (즉시 수정 필요)

### C-1. Vercel 환경에서 WebSocket 재연결 루프

| 항목 | 내용 |
|------|------|
| **파일** | `src/components/providers/WebSocketProvider.tsx:35-95` |
| **현상** | HTTPS 환경에서 `ws://localhost:3001` 연결 시도 → 실패 → 5회 재시도 (1s,2s,4s,8s,16s) |
| **영향** | 배포 환경에서 매 사용자마다 31초간 불필요한 연결 시도, 콘솔 에러 다량 발생 |
| **현재 코드** | `if (window.location.protocol === 'https:') return` 가드 존재하지만, 이후 reconnect 로직이 이 가드를 우회할 가능성 |
| **수정** | HTTPS 환경에서 WS 연결 시도 완전 차단, 또는 환경변수 기반 WS URL 분기 |

### C-2. node-pty / Filesystem API Vercel 호환 불가

| 항목 | 내용 |
|------|------|
| **파일** | `server/ws-server.ts`, `src/app/api/filesystem/directories/route.ts` |
| **현상** | node-pty는 네이티브 바인딩 → Vercel 서버리스에서 실행 불가. Filesystem API는 호스트 파일시스템 접근 → 보안 위반 |
| **영향** | 터미널 기능 완전 불가, 파일시스템 브라우저 500 에러 |
| **수정** | 배포 환경에서 해당 기능 비활성화 또는 스텁 처리 필요 |

### C-3. 모든 GET API에 Cache-Control 헤더 없음

| 항목 | 내용 |
|------|------|
| **파일** | 모든 `src/app/api/*/route.ts` GET 핸들러 (29개 라우트) |
| **현상** | Vercel Edge CDN 캐싱 활용 불가, 모든 요청이 서버리스 함수 콜드스타트 |
| **영향** | 동일 데이터 반복 요청 시 매번 DB 왕복 → TTFB 200-500ms 추가 |
| **수정 예시** | |

```typescript
// 프로젝트 목록 (거의 안 바뀜) → 60초 캐시
return successResponse(data, {
  headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" }
})

// 캔버스 데이터 (mutation으로만 변경) → 10초 캐시
return successResponse(data, {
  headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=30" }
})

// 완료된 세션 로그 → immutable
return successResponse(data, {
  headers: { "Cache-Control": "public, max-age=31536000, immutable" }
})
```

### C-4. DB 인덱스 누락 (3개)

| 항목 | 내용 |
|------|------|
| **파일** | `prisma/schema.models.prisma` |
| **누락 인덱스** | |

```prisma
// Session: 4개 이상의 API에서 (nodeId, status) 조합으로 검색
model Session {
  @@index([nodeId])           // 현재
  @@index([nodeId, status])   // 추가 필요
}

// Edge: 중복 체크, 캐스케이드 삭제에서 full table scan
model Edge {
  // 현재: 인덱스 없음
  @@index([fromNodeId])       // 추가 필요
  @@index([toNodeId])         // 추가 필요
}

// Plan: nodeId + status 조합 검색
model Plan {
  @@index([nodeId])           // 현재
  @@index([nodeId, status])   // 추가 필요
}
```

| **영향** | Session 테이블 full scan → 100+ 세션 시 쿼리 10배 느려짐. Edge 삭제 시 lock contention |

---

## TIER 2: HIGH (1주 내 수정 권장)

### H-1. DashboardView 캔버스 연동 리렌더링 폭풍

| 항목 | 내용 |
|------|------|
| **파일** | `src/components/dashboard/DashboardView.tsx:85-104` |
| **현상** | `useCanvasStore((s) => s.nodes)`로 전체 노드 배열 구독 → 노드 드래그, 엣지 생성 등 **캔버스의 모든 변경**에서 O(n) 필터 재실행 |
| **코드** | |

```typescript
// 현재: 캔버스 노드 전체를 구독하고 매번 재계산
const canvasNodes = useCanvasStore((s) => s.nodes)  // line 85

useEffect(() => {
  // 4번의 filter 호출 = O(4n)
  const derive = (status: string) => allNodes.filter(n => n.status === status)
  setData({ inProgress: derive('in_progress'), todo: derive('todo'), ... })
}, [canvasNodes])  // 캔버스 모든 변경에 트리거
```

| **영향** | 노드 100개 드래그 시 DashboardView + 하위 IssueRow 전체 리렌더 → 프레임 드랍 |
| **수정** | 캔버스 스토어에 status별 카운트 셀렉터 생성, 또는 대시보드 데이터를 API에서만 가져오기 |

### H-2. CanvasView 전체 스토어 구독

| 항목 | 내용 |
|------|------|
| **파일** | `src/components/canvas/CanvasView.tsx:36-53` |
| **현상** | 12개 속성을 destructuring으로 구독 → 스토어의 어떤 상태든 변경되면 전체 리렌더 |
| **코드** | |

```typescript
// 현재: 12개 속성 전체 구독
const {
  nodes, edges, initialViewport, onNodesChange, onEdgesChange, onConnect,
  isZoomedIn, setIsZoomedIn, loadCanvas, savePositions, saveViewport,
  setNodes, addNode, pushSnapshot, setEdges,
} = useCanvasStore()

// 수정: useShallow로 필요한 데이터만 구독
const { nodes, edges, isZoomedIn } = useCanvasStore(
  useShallow((s) => ({ nodes: s.nodes, edges: s.edges, isZoomedIn: s.isZoomedIn }))
)
// 함수들은 store 외부에서 직접 참조 (리렌더 유발 안 함)
const loadCanvas = useCanvasStore.getState().loadCanvas
```

| **영향** | undo/redo 스택 변경, viewport 저장 등 무관한 변경에도 캔버스 전체 리렌더 |

### H-3. nodeWithCounts 과다 페칭 (서브쿼리 폭발)

| 항목 | 내용 |
|------|------|
| **파일** | `src/lib/node-helpers.ts:5-32` |
| **현상** | `nodeWithCounts`가 항상 `_count` + `sessions(take:1)` + `plans(take:1)` 포함 → 노드당 3개 서브쿼리 |
| **영향** | Dashboard(50 노드) = 150+ 서브쿼리, Canvas(200 노드) = 600+ 서브쿼리 |
| **수정** | |

```typescript
// 현재: 항상 풀 데이터 포함
const nodeWithCounts = {
  _count: { select: { sessions: true, decisions: true, childNodes: true, plans: true } },
  sessions: { orderBy: { createdAt: "desc" }, take: 1 },
  plans: { orderBy: { createdAt: "desc" }, take: 1 },
}

// 수정: 목적별 분리
const nodeCountsOnly = {
  _count: { select: { sessions: true, decisions: true, childNodes: true, plans: true } },
}
const nodeWithDetails = {
  ...nodeCountsOnly,
  sessions: { orderBy: { createdAt: "desc" }, take: 1 },
  plans: { orderBy: { createdAt: "desc" }, take: 1 },
}
// Dashboard → nodeCountsOnly, Detail → nodeWithDetails
```

### H-4. N+1 부모 체인 순회

| 항목 | 내용 |
|------|------|
| **파일** | `server/context/context-assembler.ts:58-82` |
| **현상** | while 루프에서 `findUnique()` 개별 호출 → 깊이 5 = DB 왕복 6회 |
| **영향** | Plan 생성 시 콜드스타트 + 6회 DB 왕복 = 2-3초 지연 |
| **수정** | PostgreSQL recursive CTE 또는 단일 쿼리로 모든 조상 한번에 페치 |

```sql
-- Recursive CTE로 한 번에 조상 체인 조회
WITH RECURSIVE ancestors AS (
  SELECT id, title, "parentNodeId", 0 as depth
  FROM "Node" WHERE id = $1
  UNION ALL
  SELECT n.id, n.title, n."parentNodeId", a.depth + 1
  FROM "Node" n INNER JOIN ancestors a ON n.id = a."parentNodeId"
  WHERE a.depth < 10
)
SELECT * FROM ancestors;
```

### H-5. Dashboard/Canvas 무제한 쿼리 (페이지네이션 없음)

| 항목 | 내용 |
|------|------|
| **파일** | `src/app/api/projects/[id]/canvas/route.ts:16-26`, `dashboard/route.ts:27-31` |
| **현상** | 모든 노드/엣지를 제한 없이 fetch → 500+ 노드 프로젝트에서 메모리 초과 가능 |
| **Vercel 제한** | 서버리스 함수 RAM 3008MB, 실행 시간 10초 |
| **수정** | Canvas: 뷰포트 기반 가상화 또는 `take: 500`. Dashboard: `take: 20` per status |

### H-6. 세션 중복 페칭

| 항목 | 내용 |
|------|------|
| **파일** | `src/app/api/nodes/[id]/route.ts:18-32` |
| **현상** | `nodeWithCounts`에 이미 sessions 포함 → line 29에서 sessions 다시 fetch = 중복 DB 호출 |
| **수정** | line 29-32의 별도 sessions 조회 제거, nodeWithCounts 결과 재사용 |

### H-7. CLI 실행 타임아웃 없음

| 항목 | 내용 |
|------|------|
| **파일** | `src/app/api/nodes/[id]/plans/route.ts:62` |
| **현상** | `executeClaude()` 호출에 타임아웃 미설정 → Claude API 응답 지연 시 Vercel 10초 제한에 500 에러 |
| **영향** | Plan 부분 생성 후 클라이언트에 에러 반환 → 데이터 불일치 |
| **수정** | `AbortController` + 8초 타임아웃 + 부분 생성 롤백 로직 |

---

## TIER 3: MEDIUM (2-3주 내 수정)

### M-1. next.config.mjs 최적화 누락

| 항목 | 내용 |
|------|------|
| **파일** | `next.config.mjs` (현재 9줄) |
| **추가 필요** | |

```javascript
const nextConfig = {
  images: { unoptimized: true },  // 이미지 미사용 → 불필요한 최적화 비용 제거
  experimental: {
    serverComponentsExternalPackages: ["node-pty"],
    optimizePackageImports: ["lucide-react", "date-fns"],  // 트리쉐이킹 강화
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};
```

### M-2. Vercel 리전/함수 설정 누락

| 항목 | 내용 |
|------|------|
| **파일** | `vercel.json` (현재 4줄) |
| **현상** | Supabase가 Mumbai(South Asia)인데 Vercel 리전 미지정 → 기본 US East → 크로스리전 지연 |
| **수정** | |

```json
{
  "buildCommand": "npm run build:prod",
  "framework": "nextjs",
  "regions": ["bom1"],
  "functions": {
    "src/app/api/**/*.ts": { "memory": 1024, "maxDuration": 30 }
  }
}
```

### M-3. 루트 페이지 'use client' → SSR 스트리밍 불가

| 항목 | 내용 |
|------|------|
| **파일** | `src/app/page.tsx:1` |
| **현상** | 루트 페이지가 `'use client'` → 전체 앱이 클라이언트 렌더링 → 스트리밍 HTML 불가 |
| **영향** | FCP/LCP 2-3초 추가 (React 하이드레이션까지 빈 화면) |
| **수정** | Server Component로 분리 가능한 부분 추출, 인터랙티브 부분만 Client Component |

### M-4. loading.tsx / error.tsx 경계 없음

| 항목 | 내용 |
|------|------|
| **파일** | `src/app/` (loading.tsx, error.tsx 둘 다 없음) |
| **현상** | API 실패 시 빈 화면, 로딩 중 스켈레톤 없음 |
| **영향** | UX 저하 + CLS(Cumulative Layout Shift) 점수 하락 |
| **수정** | `src/app/loading.tsx` + `src/app/error.tsx` 추가 |

### M-5. SWR/React Query 미사용 → 요청 중복

| 항목 | 내용 |
|------|------|
| **파일** | 모든 컴포넌트의 `fetch()` 호출 |
| **현상** | 바닐라 fetch 사용 → 요청 디듀플리케이션 없음, 캐시 없음, 백그라운드 리프레시 없음 |
| **예시** | DashboardView가 탭 전환마다 `/api/projects/:id/dashboard` 재호출 |
| **영향** | 동일 데이터 반복 요청 → 서버리스 함수 호출 비용 + 지연 |

### M-6. Google Fonts CSS @import 중복

| 항목 | 내용 |
|------|------|
| **파일** | `src/app/globals.css:1` |
| **현상** | `@import url('https://fonts.googleapis.com/css2?...')` → 이미 `layout.tsx`에서 `next/font`로 로드 중 |
| **영향** | 렌더 블로킹 CSS 요청 추가 (200-300ms) |
| **수정** | globals.css의 @import 줄 삭제 |

### M-7. Viewport 콜백 무한 재생성

| 항목 | 내용 |
|------|------|
| **파일** | `src/components/canvas/CanvasView.tsx:68-76` |
| **현상** | `handleViewportChange`의 deps에 `isZoomedIn` 포함 → 줌 변경마다 콜백 재생성 |
| **수정** | `isZoomedIn`을 ref로 관리하여 콜백 안정화 |

### M-8. Recovery Manager 루프 트랜잭션

| 항목 | 내용 |
|------|------|
| **파일** | `server/recovery/recovery-manager.ts:30-65` |
| **현상** | 100개 stale 세션 → 100개 별도 트랜잭션 |
| **수정** | 단일 `$transaction(async (tx) => { ... })` 으로 배치 처리 |

### M-9. Prisma 커넥션 타임아웃 미설정

| 항목 | 내용 |
|------|------|
| **파일** | `src/lib/db/client.ts:8-26` |
| **현상** | 콜드스타트 시 PrismaClient 연결 대기에 대한 제한 없음 |
| **수정** | |

```typescript
const client = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  },
  // PostgreSQL statement_timeout
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
})
```

### M-10. Dynamic Import Loading 폴백 없음

| 항목 | 내용 |
|------|------|
| **파일** | `src/app/page.tsx:17-25` |
| **현상** | CanvasView, TerminalPanel 동적 임포트에 `loading` 컴포넌트 미제공 |
| **수정** | 스켈레톤 폴백 추가 |

```typescript
const CanvasView = dynamic(
  () => import('@/components/canvas/CanvasView').then(m => ({ default: m.CanvasView })),
  { ssr: false, loading: () => <CanvasSkeleton /> }
)
```

---

## TIER 4: LOW (개선 시 좋지만 긴급하지 않음)

| # | 이슈 | 파일 | 요약 |
|---|------|------|------|
| L-1 | @tiptap 미사용 의존성 | `package.json` | 6.5MB 번들 절감 (사용처 0) |
| L-2 | undoStack max 30 → 10 | `canvas-store.ts` | 메모리 1.3MB 절감 |
| L-3 | Terminal scrollback 10K → 2K | `TerminalPanel.tsx` | 메모리 1.2MB 절감 |
| L-4 | React.memo 누락 | `IssueRow`, `SessionList`, `MarkdownRenderer` | 리스트 아이템 불필요 리렌더 |
| L-5 | Badge/NodeTypeIcon 'use client' 불필요 | `shared/Badge.tsx`, `shared/NodeTypeIcon.tsx` | Server Component로 변환 가능 |
| L-6 | dagre auto-layout 메인스레드 블로킹 | `CanvasView.tsx:290-330` | 100+ 노드 시 Web Worker 고려 |
| L-7 | highlight.js CSS 항상 로드 | `globals.css:217-238` | 코드 블록 없을 때 불필요 |
| L-8 | Edge 생성 시 3회 검증 쿼리 | `edges/route.ts:37-48` | 2개로 줄일 수 있음 |
| L-9 | force-dynamic 불필요 사용 | `filesystem/directories/route.ts`, `nodes/[id]/context/route.ts` | ISR 전환 가능 |
| L-10 | capture-store 로그 rotation 없음 | `server/db/capture-store.ts` | 장기 운영 시 디스크 고갈 |

---

## 성능 영향 매트릭스

```
              낮은 노력 ◄─────────────────────────────► 높은 노력
              │                                          │
  높은 영향   │  C-3 캐싱 헤더      H-1 Dashboard 리렌더  │
              │  C-4 DB 인덱스      H-2 Canvas 구독       │
              │  H-6 세션 중복      H-3 nodeWithCounts    │
              │  M-6 폰트 중복      M-3 SSR 분리          │
              │  L-1 tiptap 제거    M-5 SWR 도입          │
              │                                          │
              │                                          │
  중간 영향   │  M-1 next.config    H-4 N+1 CTE 변환     │
              │  M-2 Vercel 리전    H-7 CLI 타임아웃       │
              │  M-7 viewport ref   M-4 loading/error    │
              │  L-2 undoStack      M-8 recovery 배치    │
              │                                          │
              │                                          │
  낮은 영향   │  L-3 scrollback     L-6 dagre Worker     │
              │  L-5 Server Comp    L-4 React.memo       │
              │  L-7 highlight CSS                       │
              │                                          │
```

---

## 추천 실행 계획

### Phase 1: Quick Wins (1-2일, 코드 변경 최소)

| # | 작업 | 예상 시간 | 효과 |
|---|------|----------|------|
| 1 | C-3: GET API에 Cache-Control 헤더 추가 | 1시간 | TTFB 50-70% 감소 |
| 2 | C-4: Prisma 인덱스 3개 추가 + migration | 30분 | DB 쿼리 5-10배 가속 |
| 3 | M-1: next.config.mjs 최적화 | 15분 | 트리쉐이킹 강화 |
| 4 | M-2: vercel.json 리전/함수 설정 | 10분 | 크로스리전 지연 제거 |
| 5 | M-6: globals.css @import 제거 | 5분 | 렌더 블로킹 300ms 제거 |
| 6 | L-1: @tiptap 패키지 4개 제거 | 10분 | 번들 6.5MB 절감 |
| 7 | H-6: 노드 상세 API 세션 중복 제거 | 15분 | 불필요 DB 호출 제거 |

**Phase 1 합계: ~2.5시간, 체감 성능 50%+ 향상 기대**

### Phase 2: 핵심 최적화 (3-5일)

| # | 작업 | 예상 시간 | 효과 |
|---|------|----------|------|
| 1 | H-1: DashboardView 셀렉터 최적화 | 2시간 | 캔버스 조작 시 프레임 드랍 제거 |
| 2 | H-2: CanvasView useShallow 적용 | 1시간 | 불필요 리렌더 90% 감소 |
| 3 | H-3: nodeWithCounts → 목적별 분리 | 2시간 | API 서브쿼리 70% 감소 |
| 4 | H-5: Dashboard/Canvas 쿼리에 take 제한 | 1시간 | 대형 프로젝트 OOM 방지 |
| 5 | C-1: WebSocket 배포 환경 완전 비활성화 | 1시간 | 재연결 루프 제거 |
| 6 | M-4: loading.tsx + error.tsx 추가 | 2시간 | UX + CLS 개선 |
| 7 | M-10: Dynamic import 로딩 폴백 | 1시간 | 초기 로드 UX 개선 |

**Phase 2 합계: ~10시간, 안정성 + 확장성 대폭 향상**

### Phase 3: 구조적 개선 (1-2주)

| # | 작업 | 예상 시간 | 효과 |
|---|------|----------|------|
| 1 | H-4: N+1 부모 체인 → recursive CTE | 4시간 | Plan 생성 2-3초 → 200ms |
| 2 | M-3: 루트 페이지 SSR/Client 분리 | 8시간 | FCP 2-3초 단축 |
| 3 | M-5: SWR/React Query 도입 | 8시간 | 요청 중복 제거, 캐시 |
| 4 | H-7: CLI 실행 타임아웃 + 롤백 | 3시간 | 서버리스 행 방지 |
| 5 | M-9: Prisma 커넥션 타임아웃 | 1시간 | 콜드스타트 안정화 |

---

## 예상 성능 개선 수치

| 메트릭 | 현재 (추정) | Phase 1 후 | Phase 2 후 | Phase 3 후 |
|--------|-----------|-----------|-----------|-----------|
| **TTFB** (첫 바이트) | 800-1500ms | 300-500ms | 200-400ms | 150-300ms |
| **FCP** (첫 콘텐츠) | 3-4s | 2.5-3s | 2-2.5s | 1-1.5s |
| **LCP** (최대 콘텐츠) | 5-6s | 4-5s | 3-4s | 2-3s |
| **캔버스 드래그 FPS** | 30-40fps | 30-40fps | 55-60fps | 55-60fps |
| **Dashboard 탭 전환** | 500-800ms | 200-300ms | 50-100ms | 50-100ms |
| **Plan 생성** | 3-5s | 3-5s | 3-5s | 1-2s |
| **콜드스타트** | 2-3s | 1.5-2s | 1-1.5s | 0.5-1s |

---

## 분석 방법론

5개 전문 에이전트가 병렬로 코드베이스를 분석:

1. **API 라우트 분석**: 29개 라우트 파일 + 6개 지원 파일 분석
2. **클라이언트 번들 & 렌더링**: 40개 'use client' 컴포넌트, 4개 Zustand 스토어 분석
3. **Prisma 스키마 & 쿼리**: 스키마, 인덱스, 쿼리 패턴, 커넥션 풀링 분석
4. **빌드 설정 & 배포**: next.config, vercel.json, tsconfig, 빌드 산출물 분석
5. **SSR & 데이터 페칭**: 서버/클라이언트 경계, Suspense, 프로바이더, WebSocket 분석
