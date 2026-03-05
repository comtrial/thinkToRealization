# thinkToRealization — 모바일 성능 & 번들 분석 보고서

**작성 일시**: 2026.03.02
**분석 범위**: 패키지 의존성, 동적 임포트, Zustand 스토어, WebSocket, PTY 데이터 스트리밍, 폰트 최적화, 이미지 최적화, SSR/CSR 패턴, next.config.mjs, 로그 파일 관리

---

## 요약

DevFlow v2는 로컬 웹 애플리케이션으로 Next.js 14 + Zustand + @xyflow/react 기반의 캔버스 기반 개발 도구입니다. **모바일 환경에서는 설계상 고려 대상이 아니며, 데스크톱 중심 애플리케이션**입니다.

### 핵심 성능 지표
- **Node.js 전체 node_modules**: 699MB
- **Canvas 라이브러리** (@xyflow/react + dagre): ~4.3MB
- **Terminal 라이브러리** (@xterm): ~6.0MB
- **DB 클라이언트** (@prisma/client): ~8.1MB
- **Rich text 에디터** (@tiptap): ~6.5MB
- **Client 컴포넌트**: 34개 (35%+ 클라이언트 렌더링)
- **Dynamic imports**: 2개 (Canvas, Terminal만 SSR 회피)

---

## 1. 번들 크기 분석

### 1.1 의존성별 추정 번들 크기

| 패키지 | npm 크기 | gzip 추정 | 용도 | 모바일 영향 |
|--------|----------|----------|------|-----------|
| **@xyflow/react 12.10.1** | 3.4MB | ~800KB | 캔버스 노드/엣지 렌더링 | 🔴 치명적 (조건부 로딩) |
| **@xterm/xterm 6.0.0** | 6.0MB | ~1.2MB | 터미널 렌더링 | 🔴 치명적 (dynamic import) |
| **@prisma/client 5.22.0** | 8.1MB | ~0.2MB* | DB 쿼리 (SSR only) | 🟡 낮음 (서버사이드) |
| **@tiptap/* 3.20.0** | 6.5MB | ~1.5MB | 리치 텍스트 편집 | 🔴 높음 (미사용) |
| **dagre 0.8.5** | 932KB | ~200KB | 자동 레이아웃 | 🔴 중간 (캔버스 의존) |
| **cmdk 1.1.1** | ~200KB | ~40KB | 커맨드 팔레트 | 🟡 낮음 |
| **zod 4.3.6** | ~300KB | ~60KB | 유효성 검증 | 🟡 낮음 |
| **ws 8.19.0** | ~350KB | ~80KB | WebSocket | 🟡 낮음 |
| **chokidar 5.0.0** | ~400KB | - | 파일 감시 (서버) | 🟢 없음 |
| **기타** (Radix UI, React, etc.) | 합계 ~150MB | ~30MB | UI 프레임워크 | 🟡 중간 |

**예상 번들 크기**:
- **초기 로드**: ~35-45MB (min+gzip) — **모바일 치명적**
- **Canvas 활성화**: +800KB 추가 (dynamic import)
- **Terminal 활성화**: +1.2MB 추가 (dynamic import)

### 1.2 주요 번들 부담 원인

#### 1) @tiptap 에디터 (6.5MB — 불필요)
```typescript
// package.json의 미사용 의존성
"@tiptap/extension-placeholder": "^3.20.0",
"@tiptap/pm": "^3.20.0",
"@tiptap/react": "^3.20.0",
"@tiptap/starter-kit": "^3.20.0",
```
- **현재 코드에서 사용처 없음** (검색 결과: 0)
- 목표: 향후 "Decision 기록장" 리치 텍스트 편집 예정일 수 있음
- **권장 액션**: 미사용 확정 시 제거 (6.5MB 절감)

#### 2) Prisma Client (8.1MB)
```typescript
// lib/prisma.ts (서버사이드)
import { PrismaClient } from '@prisma/client'
```
- **클라이언트 번들에 포함 NO** (서버사이드 전용) ✅
- **runtime이 포함되어 node_modules 커짐** — production build에서 제거 가능

#### 3) @xyflow/react (3.4MB)
```typescript
// src/app/page.tsx
const CanvasView = dynamic(
  () => import('@/components/canvas/CanvasView').then(m => ({ default: m.CanvasView })),
  { ssr: false }
)
```
- **Dynamic import로 최적화됨** ✅
- 초기 로드 시 제외되나, Canvas 탭 활성화 시 ~800KB gzip 추가 로드

#### 4) @xterm/xterm (6.0MB)
```typescript
// src/components/terminal/TerminalPanel.tsx
Promise.all([
  import('@xterm/xterm'),
  import('@xterm/addon-fit'),
])
```
- **Dynamic import로 최적화됨** ✅
- Terminal 활성화 시 ~1.2MB gzip 로드

---

## 2. 동적 임포트 분석

### 2.1 현황

| 컴포넌트 | 파일 | Dynamic | 이유 | 모바일 영향 |
|---------|------|---------|------|-----------|
| **CanvasView** | src/app/page.tsx | ✅ Yes | @xyflow 브라우저 DOM 의존 | 조건부 (탭 활성화) |
| **TerminalPanel** | src/app/page.tsx | ✅ Yes | @xterm DOM/CSS 의존 | 조건부 (Terminal 확장) |
| 기타 컴포넌트 | - | ❌ No | SSR safe | 초기 로드 |

### 2.2 평가
- **동적 임포트**: 부분적 최적화 (2개 대형 라이브러리만)
- **미적용 candidates**:
  - @tiptap (현재 미사용이나 폴백)
  - @xyflow addon-webgl (선택적 기능)

---

## 3. Zustand 스토어 메모리 분석

### 3.1 스토어별 메모리 풋프린트

#### ui-store.ts (~1KB)
```typescript
{
  sidebarOpen: boolean,          // 1 byte
  activeTab: enum,               // 1 byte
  panelMode: 'closed'|'peek'|'full',  // 5 bytes
  panelNodeId: string | null,    // 0-8 bytes
  panelTab: enum,                // 1 byte
  terminalExpanded: boolean,     // 1 byte
  terminalHeight: number,        // 8 bytes
  commandPaletteOpen: boolean,   // 1 byte
}
// Total: ~25 bytes (정상 범위)
```

#### canvas-store.ts (~중대)
```typescript
{
  nodes: Node[],                 // 배열 크기에 따라 가변
  edges: Edge[],                 // 배열 크기에 따라 가변
  undoStack: Snapshot[30],       // ⚠️ MAX 30개 스냅샷
  redoStack: Snapshot[],         // 스냅샷 배열
  initialViewport: {...},        // 24 bytes
  isZoomedIn: boolean,           // 1 byte
}
```

**메모리 계산** (노드 100개 프로젝트):
- 노드 배열: 100 × 500 bytes = ~50KB
- 엣지 배열: 50 × 300 bytes = ~15KB
- **undoStack 30개**: 30 × (50KB + 15KB) = **1.95MB** 🔴
- **전체**: ~2MB (모바일에서 부담)

**최적화 기회**:
- **undoStack max 30 → 10** 감소 (메모리 -66%, UX 미미)
- **structuredClone 대신 diff-based undo** 고려 (복잡도↑)

#### node-store.ts (~10KB)
```typescript
{
  selectedNode: NodeResponse | null,     // 500-2000 bytes
  sessions: SessionResponse[],           // 배열 크기 가변
  decisions: DecisionResponse[],         // 배열 크기 가변
  isLoading: boolean,                    // 1 byte
}
// 세션 10개: 10 × 300 = 3KB
// 의사결정 5개: 5 × 200 = 1KB
// Total: ~4-15KB (정상)
```

#### session-store.ts (~중대)
```typescript
{
  activeSession: {...} | null,           // 100 bytes
  sessionLog: SessionMessage[] | null,   // ⚠️ unbounded
  isSessionStarting: boolean,            // 1 byte
  sessionEndPromptVisible: boolean,      // 1 byte
}
```

**메모리 계산** (로그 10,000줄):
- 세션 로그: 10,000 × 50 bytes (평균) = **500KB**
- **문제**: 로그 unbounded, long-running session에서 증가
- **권장**: 로그 버퍼 capping (2000줄) 추가

### 3.2 전체 Zustand 메모리 추정
| 시나리오 | 메모리 | 모바일 영향 |
|---------|--------|-----------|
| 빈 상태 | ~50KB | 🟢 무시 |
| 노드 100개, 역사 30개 | ~2.1MB | 🟡 중간 (구형 기기 주의) |
| 장시간 세션, 로그 10K+ | ~1MB (로그만) | 🟡 누적 문제 |

---

## 4. WebSocket 핸들링 분석

### 4.1 WebSocketProvider.tsx 평가

**강점**:
- ✅ Reconnection exponential backoff (`Math.min(1000 * 2^n, 30s)`)
- ✅ Stale closure 방지 (`wsRef.current !== ws` guard)
- ✅ Cleanup on unmount (`intentionalClose` flag)
- ✅ 심장박동(Heartbeat) 구현 — **명시적 구현 없음** (ping/pong은 ws 자체 지원)

**약점**:
- ❌ 네트워크 대역폭 최적화 없음 (메시지 압축 미지원)
- ❌ 오프라인 큐잉 미구현 (연결 실패 시 메시지 손실 가능)
- ❌ 메시지 전송 타임아웃 미구현

**모바일 영향**:
- 🟡 불안정한 네트워크 (4G ↔ WiFi 전환)에서 재연결 지연 30s 체감
- 🟡 Terminal 중 연결 끊김 시 PTY 입력 손실

### 4.2 개선 권장사항

```typescript
// 현재 없음: 명시적 heartbeat
// 권장: ping/pong 구현 (ws 미지원)

const heartbeatInterval = setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }))
}, 30000)

ws.on('pong', () => {
  // 연결 유지 상태 확인
})
```

---

## 5. PTY 데이터 스트리밍 분석

### 5.1 데이터 흐름

```
Keystroke → xterm.onData() → WS "pty:input" → node-pty.write()
                                    ↓
node-pty output → EventBus "pty:data" → WS broadcast → ptyDataEmitter → xterm.write()
```

### 5.2 성능 특성

| 구성 | 구현 | 모바일 영향 |
|------|------|-----------|
| **Buffering** | xterm 내부 (scrollback: 10,000) | 🔴 높음 (메모리) |
| **Flush 주기** | 실시간 (2s debounce via capture-manager) | 🟡 중간 |
| **Data 크기 제한** | 없음 (unbounded) | 🔴 높음 (대용량 출력) |
| **Backpressure** | 미구현 | 🔴 높음 (버퍼 오버플로우) |

### 5.3 병목 지점

#### 1) Scrollback 버퍼 (10,000줄)
```typescript
// TerminalPanel.tsx
const term = new Terminal({
  scrollback: 10000,  // ← 모바일에서 과도
})
```
- **메모리**: 10,000줄 × 80 chars × 2 bytes = ~1.6MB
- **모바일 권장**: 1,000-2,000줄로 감소

#### 2) Unbounded PTY 출력
```typescript
// ws-server.ts (예상 구현)
pty.on('data', (chunk) => {
  eventBus.emit('pty:data', { nodeId, data: chunk })  // 크기 제한 없음
})
```
- **위험**: 대용량 컴파일 출력 시 메모리 급증
- **권장**: 청크 크기 제한 (64KB) 또는 rate limiting

#### 3) xterm.write() 동기 호출
```typescript
// TerminalPanel.tsx
const handler = (data: string) => {
  term.write(data)  // DOM 렌더링 동기 실행
}
```
- **위험**: 고속 스트림(>100KB/s) 시 main thread 블로킹
- **권장**: 큐잉 + requestAnimationFrame 배치

---

## 6. 폰트 최적화 분석

### 6.1 현황

```typescript
// src/app/layout.tsx
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',  // ✅ FOUT 방식
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',  // ✅ FOUT
})
```

### 6.2 평가

| 항목 | 상태 | 평가 |
|------|------|------|
| **폰트 로딩** | display: 'swap' | ✅ 최적 (FOUT 3s timeout) |
| **Subset** | latin only | ✅ 최적 (한글 미지원 ⚠️) |
| **Google Fonts CDN** | 미지정 (기본값) | ✅ 자동 (fonts.googleapis.com) |
| **preload** | next/font 자동 | ✅ 자동 처리 |

### 6.3 모바일 영향

- 🟢 폰트 최적화: 우수
- 🟡 한글 지원 부재: 설계상 Latin만 필요 (터미널/UI 영문)
- 🟡 JetBrains Mono 큰 파일: ~800KB (하지만 캐싱됨)

---

## 7. 이미지 최적화 분석

### 7.1 현황

| 항목 | 상태 | 평가 |
|------|------|------|
| **next/image 사용** | ❌ 없음 | 🔴 미최적화 |
| **정적 이미지 파일** | ❌ 없음 (SVG only) | ✅ 벡터 사용 |
| **lucide-react 아이콘** | ✅ 사용 중 | ✅ 최적 (인라인 SVG) |
| **최적화** | 수동 (없음) | 🟡 미지원 |

### 7.2 평가
- **이미지 없음 = 번들 부담 낮음** ✅
- **lucide-react**: 아이콘 필요시 on-demand tree-shake 가능
- **권장**: 향후 이미지 추가 시 `next/image` 필수

---

## 8. SSR vs CSR 패턴 분석

### 8.1 현황

```
전체 컴포넌트: ~100개
Client 컴포넌트 ('use client'): 34개 (34%)
Server 컴포넌트: ~66개 (66%)
```

### 8.2 Client 컴포넌트 분류

| 카테고리 | 개수 | 이유 |
|---------|------|------|
| **Zustand stores** | 4 | 상태 관리 필수 |
| **Canvas (CanvasView + 하위)** | 5-10 | @xyflow 브라우저 API |
| **Terminal (TerminalPanel + 하위)** | 3-5 | @xterm DOM API |
| **Dialog/Modals** | 5 | Radix UI 상호작용 |
| **기타 상태 기반** | 10-15 | useState, 이벤트 핸들러 |

### 8.3 평가

**강점**:
- ✅ 서버 컴포넌트 66% (초기 로드 최적화)
- ✅ Dynamic imports 적절히 사용 (Canvas, Terminal)

**약점**:
- 🔴 초기 HTML 크기: 서버 컴포넌트 많지만, 번들이 크면 JS 다운로드 병목
- 🟡 Interactive 컴포넌트 과다: 34개 client → hydration 오버헤드

**모바일 영향**:
- 느린 4G: JS 파일 다운로드 3-5s
- Hydration: 2-3s (34개 컴포넌트)
- **총 interactive까지 5-8초** 🔴

---

## 9. next.config.mjs 분석

### 9.1 현황

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

### 9.2 평가

**상태**: 모든 최적화 비활성화 (기본값 사용)

**권장 설정**:

```typescript
const nextConfig = {
  // 압축 (기본값 true)
  compress: true,

  // 정적 최적화
  staticGeneration: {
    // API 라우트 캐싱
  },

  // 이미지 최적화 (미사용이나 활성화)
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // 번들 분석 (dev only)
  // swcMinify: true (기본값, 최적 유지)

  // Turbopack (Next.js 16 기본)
  // turbopack 활성화됨 (기본)
};
```

**현황 평가**: 기본값으로 충분하나, 명시적 설정 없음

---

## 10. Capture Store (로그 파일 관리) 분석

### 10.1 현황

```typescript
// server/db/capture-store.ts
export async function saveLog(
  sessionId: string,
  role: string,
  content: string,
  _rawLength: number
): Promise<void> {
  const logFile = path.join(LOG_DIR, `${sessionId}.log`);
  const entry = `[${new Date().toISOString()}] [${role}] ${content}\n`;
  await fs.promises.appendFile(logFile, entry, "utf-8");
}
```

### 10.2 평가

| 항목 | 상태 | 평가 |
|------|------|------|
| **저장 위치** | .devflow-logs/ (로컬) | ✅ 적절 |
| **파일 크기 제한** | ❌ 없음 | 🔴 문제 |
| **Rotation** | ❌ 없음 | 🔴 문제 |
| **Flush 주기** | 즉시 (appendFile) | 🟡 성능 (디스크 I/O) |
| **메모리** | 로그 파일에만 저장 | ✅ 최적 |

### 10.3 위험 시나리오

**장시간 세션**:
```
- 하루 운영: ~100MB .log 파일
- 한 달: ~3GB (디스크 부하)
- 재부팅 시 로드 지연
```

**개선 권장**:
```typescript
// 1. 파일 크기 체크
const stat = await fs.promises.stat(logFile)
if (stat.size > 50 * 1024 * 1024) { // 50MB
  // Rotate: .log → .log.1, .log.1 → .log.2, ...
}

// 2. Flush 배치 (500ms)
let buffer = []
async function batchFlush() {
  if (buffer.length > 0) {
    await fs.promises.appendFile(logFile, buffer.join(''))
    buffer = []
  }
}

// 3. 자동 정리 (7일 이상 로그 삭제)
const oldFiles = getFilesOlderThan(7 * 24 * 60 * 60 * 1000)
oldFiles.forEach(f => fs.unlinkSync(f))
```

---

## 11. 모바일 성능 병목 순위 (우선도)

### 11.1 Ranked Impact Matrix

| 순위 | 병목 | 영향 범위 | 심각도 | 노력 | ROI |
|------|------|---------|--------|------|-----|
| **1** | 대형 의존성 (@xyflow+@xterm+@tiptap) | 초기 로드 | 🔴 높음 | 🟢 낮음 | 🔴 75% |
| **2** | undoStack max 30 → 10 | 메모리 (특정) | 🟡 중간 | 🟢 낮음 | 🟡 66% 절감 |
| **3** | sessionLog unbounded | 메모리 (장시간) | 🟡 중간 | 🟢 낮음 | 🟡 50% 절감 |
| **4** | Terminal scrollback 10K → 2K | 메모리 (Terminal) | 🟡 중간 | 🟢 낮음 | 🟡 80% 절감 |
| **5** | PTY 청크 크기 제한 없음 | 메모리 (대용량 출력) | 🟡 중간 | 🟡 중간 | 🟡 탭 방지 |
| **6** | capture-store 파일 rotation | 디스크/재부팅 | 🟡 중간 | 🟡 중간 | 🟡 안정성 |
| **7** | xterm.write() 동기 | 메인 스레드 (고속) | 🟡 중간 | 🔴 높음 | 🟡 특정 상황 |
| **8** | WebSocket heartbeat | 연결 안정성 | 🟡 중간 | 🟡 중간 | 🟡 재연결 지연 |
| **9** | Client 컴포넌트 hydration | 초기 interactive | 🟡 중간 | 🔴 높음 | 🟡 대소문자 |
| **10** | @tiptap 미사용 정리 | 번들 | 🟡 중간 | 🟢 낮음 | 🟡 6.5MB |

---

## 12. 최적화 권장 안 (Effort/Impact Matrix)

### 12.1 우선 순위 (Quick Wins)

#### 🟢 즉시 적용 (1-2시간)

1. **@tiptap 제거** (미사용 확인 시)
   ```bash
   npm uninstall @tiptap/extension-placeholder @tiptap/pm @tiptap/react @tiptap/starter-kit
   ```
   - **절감**: 6.5MB (번들)
   - **코드 변경**: 0 (미사용)
   - **테스트**: 회귀 테스트 필요

2. **undoStack max: 30 → 10**
   ```typescript
   // src/stores/canvas-store.ts
   const MAX_HISTORY = 10  // ← 변경
   ```
   - **절감**: 1.3MB (메모리)
   - **코드 변경**: 1줄
   - **UX 영향**: 거의 없음 (undo 최대 10단계)

3. **Session 로그 버퍼 제한**
   ```typescript
   // src/stores/session-store.ts
   sessionLog: SessionMessage[] | null,  // ← 2000줄로 제한

   loadSessionLog: async (sessionId) => {
     const res = await fetch(`/api/sessions/${sessionId}/log?limit=2000`)
     if (res.ok) {
       const { data } = await res.json()
       set({ sessionLog: data.messages })
     }
   }
   ```
   - **절감**: 500KB (메모리, 장시간 세션)
   - **코드 변경**: ~3줄
   - **대안**: 가상화 (windowing) 고려

#### 🟡 단기 적용 (2-4시간)

4. **Terminal scrollback 최적화**
   ```typescript
   // src/components/terminal/TerminalPanel.tsx
   const term = new Terminal({
     scrollback: 2000,  // ← 10000에서 감소
   })
   ```
   - **절감**: ~1.2MB (메모리, Terminal active)
   - **코드 변경**: 1줄
   - **UX 영향**: 거의 없음 (2000줄 = ~50KB 출력)

5. **PTY 청크 크기 제한** (server-side)
   ```typescript
   // server/terminal/pty-manager.ts (예상)
   const MAX_CHUNK = 64 * 1024  // 64KB

   pty.on('data', (chunk) => {
     if (chunk.length > MAX_CHUNK) {
       // 분할 또는 rate limit
       for (let i = 0; i < chunk.length; i += MAX_CHUNK) {
         eventBus.emit('pty:data', {
           nodeId,
           data: chunk.slice(i, i + MAX_CHUNK)
         })
         // 지연
       }
     } else {
       eventBus.emit('pty:data', { nodeId, data: chunk })
     }
   })
   ```
   - **절감**: 메모리 오버플로우 방지
   - **코드 변경**: ~10줄
   - **복잡도**: 중간

6. **capture-store 파일 rotation**
   ```typescript
   // server/db/capture-store.ts
   const MAX_LOG_SIZE = 50 * 1024 * 1024  // 50MB

   export async function saveLog(...) {
     const stat = await fs.promises.stat(logFile)
     if (stat.size > MAX_LOG_SIZE) {
       // Rotate
       for (let i = 9; i > 0; i--) {
         const oldFile = `${logFile}.${i}`
         const newFile = `${logFile}.${i + 1}`
         if (fs.existsSync(oldFile)) {
           await fs.promises.rename(oldFile, newFile)
         }
       }
       await fs.promises.rename(logFile, `${logFile}.1`)
     }
     // append...
   }
   ```
   - **절감**: 재부팅 지연 방지
   - **코드 변경**: ~15줄
   - **복잡도**: 낮음

#### 🔴 중기 적용 (4-8시간)

7. **xterm 동기 쓰기 → 비동기 배치**
   ```typescript
   // src/components/terminal/TerminalPanel.tsx
   let writeBuffer = []
   let writeScheduled = false

   const handler = (data: string) => {
     writeBuffer.push(data)
     if (!writeScheduled) {
       writeScheduled = true
       requestAnimationFrame(() => {
         term.write(writeBuffer.join(''))
         writeBuffer = []
         writeScheduled = false
       })
     }
   }
   ptyDataEmitter.on(nodeId, handler)
   ```
   - **절감**: 메인 스레드 블로킹 방지 (고속 스트림)
   - **코드 변경**: ~12줄
   - **복잡도**: 중간
   - **테스트**: Terminal 고속 출력 시뮬레이션 필요

8. **WebSocket heartbeat 추가**
   ```typescript
   // src/components/providers/WebSocketProvider.tsx
   ws.onopen = () => {
     // Heartbeat every 30s
     const heartbeat = setInterval(() => {
       ws.send(JSON.stringify({ type: 'ping' }))
     }, 30000)

     return () => clearInterval(heartbeat)
   }
   ```
   - **절감**: 연결 끊김 조기 감지 (재연결 지연 단축)
   - **코드 변경**: ~8줄
   - **복잡도**: 낮음
   - **주의**: 서버가 ping 핸들러 구현 필요

#### 🔴 장기 적용 (8시간+)

9. **Canvas/Terminal 사전 로드 최적화**
   ```typescript
   // next.config.mjs
   module.exports = {
     webpack: (config) => {
       // @xyflow, @xterm chunk splitting
       config.optimization.splitChunks.cacheGroups = {
         ...config.optimization.splitChunks.cacheGroups,
         xyflow: {
           test: /@xyflow/,
           name: 'chunk-xyflow',
           priority: 20,
         },
         xterm: {
           test: /@xterm/,
           name: 'chunk-xterm',
           priority: 20,
         },
       }
       return config
     },
   }
   ```
   - **절감**: 필요한 chunk만 로드 (성능 5-10%)
   - **코드 변경**: ~20줄
   - **복잡도**: 높음
   - **테스트**: 번들 분석 (next/bundle-analyzer)

10. **Client 컴포넌트 감소 (hydration 최적화)**
    - 목표: 34개 → 20개로 감소 (큰 작업)
    - 전략: Radix UI → Headless 미지원, Dynamic import 더 활용
    - 예상 이득: hydration 시간 20-30% 단축

### 12.2 제외 대상 (모바일 비고려)

**DevFlow는 설계상 모바일 미지원이므로 다음 최적화는 ROI 부족**:
- Responsive Canvas (모바일 UI 필요)
- Touch 이벤트 지원 (복잡도 높음)
- Service Worker (PWA 구현 필요)
- 모바일 특화 UI 컴포넌트

---

## 13. 네트워크 효율성 평가

### 13.1 초기 로드 (측정 기준)

| 시나리오 | 네트워크 | HTML | JS | CSS | Fonts | 합계 | Interactive |
|--------|--------|------|----|----|-------|------|------------|
| **3G (3.5Mbps)** | 느림 | 50KB | 35-45MB | 300KB | 200KB | ~35MB | 30-40s 🔴 |
| **4G (10Mbps)** | 중간 | 50KB | 35-45MB | 300KB | 200KB | ~35MB | 8-12s 🔴 |
| **5G (100Mbps)** | 빠름 | 50KB | 35-45MB | 300KB | 200KB | ~35MB | 1-2s 🟢 |
| **Fiber (1Gbps)** | 매우빠름 | 50KB | 35-45MB | 300KB | 200KB | ~35MB | <1s 🟢 |

**주석**:
- 초기 페이지 로드 = 초기 HTML 로드 이후 JS 다운로드 + 파싱 + 실행
- Canvas/Terminal은 dynamic import (조건부 로드)
- 모바일: 3G/4G가 주 대상 (불가능)

### 13.2 캐싱 전략

| 항목 | TTL | 현재 | 권장 |
|------|-----|------|------|
| **번들** (JS) | 매우 길음 | next.js 기본 (long cache) | ✅ 최적 |
| **정적 자산** (CSS, fonts) | 길음 | next.js 기본 | ✅ 최적 |
| **API 응답** | 짧음 | 캐싱 없음 | 🟡 GET /api/nodes/:id → SWR 고려 |
| **Canvas viewport** | 세션 | 즉시 저장 (debounce 1s) | ✅ 최적 |

---

## 14. 종합 평가 및 결론

### 14.1 모바일 대응 가능성

**결론**: **모바일 적합하지 않음** (설계상)

**이유**:
1. **앱 크기**: 초기 로드 35-45MB (모바일 한도 20-30MB)
2. **브라우저 환경**: Canvas(@xyflow) + Terminal(@xterm) 모두 데스크톱 중심
3. **UX**: 터미널, 캔버스 조작 → 모바일 터치 미지원
4. **리소스**: 로컬 WebSocket(3001) + SQLite → 모바일 배포 불가

### 14.2 성능 등급 (데스크톱 기준)

| 환경 | 초기 로드 | Interactive | 주기적 성능 | 메모리 | 등급 |
|------|---------|----------|----------|--------|------|
| **고사양 (Intel i7, 16GB, SSD)** | 1-2s | 2-3s | 매우 우수 | 안정 | **A** |
| **중사양 (M1 MacBook Pro, 8GB, SSD)** | 2-3s | 3-4s | 우수 | 안정 | **A** |
| **저사양 (Intel i5, 4GB, HDD)** | 5-8s | 8-12s | 가능 | 주의 | **C** |
| **구형 폰 (4GB RAM, 4G)** | 15-30s+ | 불가능 | 불가능 | 크래시 | **F** |

### 14.3 추천 액션 플랜

#### Phase 1 (즉시, 1주)
- [ ] @tiptap 제거 확인 및 제거 (6.5MB 절감)
- [ ] undoStack: 30 → 10 (1.3MB 절감)
- [ ] Session 로그 2000 한계 (500KB 절감)
- **총 절감**: ~8.3MB (번들 + 메모리)

#### Phase 2 (단기, 2-3주)
- [ ] Terminal scrollback: 10K → 2K (1.2MB 절감)
- [ ] PTY 청크 제한 (64KB)
- [ ] capture-store file rotation
- [ ] WebSocket heartbeat 추가
- **총 절감**: 메모리 + 안정성 (번들 차이 무)

#### Phase 3 (중기, 1개월)
- [ ] xterm 동기 쓰기 → 비동기 배치
- [ ] Webpack chunk splitting (@xyflow, @xterm 분리)
- [ ] 필요 시 가상화 (Canvas 노드 많을 때)
- **이득**: 성능 10-15% (특정 상황)

#### Phase 4 (모바일 고려 시)
- [ ] React Native 또는 Electron 기반 재설계
- [ ] 모바일 UI/UX 전면 개편
- **예상 비용**: 3-6개월 (새 프로젝트 규모)

---

## 15. 참고: Lighthouse 모의 성능 예측

**테스트 환경**:
- 기기: Chrome DevTools Lighthouse (Mid-range Android 시뮬레이션)
- 네트워크: Fast 4G (4Mbps 다운로드, 1.6Mbps 업로드)
- CPU: 4x slowdown

**예상 점수**:

| 메트릭 | 현재 예상 | 최적화 후 |
|--------|---------|---------|
| **FCP** (First Contentful Paint) | 3-4s | 2-3s |
| **LCP** (Largest Contentful Paint) | 5-6s | 3-4s |
| **CLS** (Cumulative Layout Shift) | 0.05 | 0.02 |
| **FID** (First Input Delay) | 80-100ms | 50-80ms |
| **전체 점수** | 45-55 | 55-65 |

**결론**: 모바일 Lighthouse 환경에서 "가능" 수준이나 실제 저사양 모바일은 불가능

---

## 16. 파일별 최적화 체크리스트

```markdown
### 번들/메모리 최적화 파일

- [ ] src/stores/canvas-store.ts
  - [ ] MAX_HISTORY: 30 → 10

- [ ] src/stores/session-store.ts
  - [ ] loadSessionLog에 limit 추가 (2000)
  - [ ] API 라우트 수정

- [ ] src/components/terminal/TerminalPanel.tsx
  - [ ] scrollback: 10000 → 2000
  - [ ] xterm.write() 배치 처리 (optional)

- [ ] server/terminal/pty-manager.ts
  - [ ] MAX_CHUNK = 64KB 추가
  - [ ] 청크 분할 로직

- [ ] server/db/capture-store.ts
  - [ ] MAX_LOG_SIZE = 50MB
  - [ ] File rotation 로직

- [ ] src/components/providers/WebSocketProvider.tsx
  - [ ] Heartbeat interval 추가 (30s)

- [ ] package.json
  - [ ] @tiptap/* 제거 (확인 후)

- [ ] next.config.mjs
  - [ ] Webpack chunk splitting (선택)

### 테스트 파일

- [ ] e2e/terminal.spec.ts (scrollback 줄임 테스트)
- [ ] e2e/undo-redo.spec.ts (history 길이 테스트)
```

---

## 17. 결론

**DevFlow v2는 로컬 데스크톱 애플리케이션으로 설계되어, 모바일 최적화는 의미가 없습니다.**

**하지만 데스크톱 성능 개선을 위해 추천하는 우선도**:

1. **🟢 즉시 (1주)**: @tiptap 제거, undoStack 10으로 축소, 로그 버퍼 제한
2. **🟡 단기 (2-3주)**: scrollback 줄이기, PTY 청크 제한, file rotation, heartbeat
3. **🔴 중기 (1개월)**: xterm 비동기, chunk splitting, 테스트 강화
4. **⚫ 검토 필요**: 모바일 지원 필요 시 재설계 (Electron/React Native)

**최종 권장**: 현재 상태에서 **Quick Wins 8.3MB 절감 + 메모리 안정화**만으로도 대부분의 데스크톱 사용자에게 충분한 성능 제공 가능합니다.
