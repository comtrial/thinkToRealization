**참석자:**

- 🖥️ **Kai** — 터미널-to-Web 임베드 전문가 (pty, ANSI 파싱, 터미널 에뮬레이션)
- 🔧 **Seo** — 백엔드 전문가 (API 설계, 프론트엔드 인터페이스, WebSocket)
- 🗄️ **Dr. Park** — DB 아키텍트 (스키마 설계, 인덱싱, Supabase 전환)
---

## 0. 구현 가능성 사전 검증

### 🖥️ Kai: 터미널 임베드 실현 가능성

**결론: 100% 구현 가능.** 검증된 패턴.

**선례:** VS Code Server, Theia IDE, Wetty, ttyd — 모두 xterm.js + node-pty 스택.

DevFlow는 **단일 사용자 로컬 머신**이므로 다중 사용자 격리, 보안, 스케일링 불필요.

**기술적 쟁점 3가지:**

1. Claude CLI 인터랙티브 모드 호환성 (ANSI 이스케이프)
1. CLI 출력 캐처 시 ANSI 코드 스트리핑
1. WebSocket 연결 유지 + 세션 재연결
### 🔧 Seo: 백엔드 아키텍처

**핵심 결정: 포트 분리 전략 채택**

| 방식 | 장점 | 단점 |
| A) 커스텀 server.ts | 단일 프로세스, 포트 하나 | next dev HMR 불안정 |
| **B) 별도 WS 서버** | Next.js 기본 서버 유지, 장애 격리 | 포트 2개 관리 |

**방식 B 채택 이유:**

1. Next.js `next dev` HMR 안정성 보장
1. 터미널 서버 죽어도 웹앱 살아있음 (장애 격리)
1. 개발 중 터미널 서버만 재시작 가능
### 🗄️ Dr. Park: DB 아키텍처

**프론트엔드 스키마 보완 3가지:**

1. messages 테이블 → terminal_logs + decisions 분리 (성격이 다른 데이터)
1. 인덱스 전략 추가 (쿼리 패턴별 최적화)
1. Supabase 전환 대비 설계 (cuid 일관 사용)
---

## 1. 시스템 아키텍처 최종안

```javascript
┌─────────────────────────────────────────────────────┐
│                     사용자 브라우저                     │
│  Next.js App (React)     │     xterm.js (터미널)   │
│       HTTP/REST           │      WebSocket          │
└────────────┬────────────┴─────────┬───────────────┘
             │                          │
             ▼                          ▼
┌───────────────────┐    ┌───────────────────────┐
│ Next.js API Routes│    │  WebSocket 서버 (ws)    │
│ (포트 3000)        │    │  (포트 3001)              │
│                   │    │  PtyManager             │
│ /api/projects/*   │    │  CaptureManager          │
│ /api/stages/*     │    │   ├ ANSI 스트리핑          │
│ /api/sessions/*   │    │   ├ 2초 버퍼 플러시        │
│ /api/decisions/*  │    │   └ DB 비동기 저장        │
└─────────┬─────────┘    └───────────┬───────────┘
          │                             │
          ▼                             ▼
┌───────────────────────────────────────────────────┐
│              Prisma ORM (SQLite → PostgreSQL)             │
└───────────────────────────────────────────────────┘
```

**실행 방식:** `concurrently "next dev" "tsx watch server/ws-server.ts"`

---

## 2. 터미널 임베드 상세 설계 (🖥️ Kai)

### 4개 레이어 구조

| Layer | 역할 | 기술 |
| 4. 렌더링 | ANSI → 픽셀 | xterm.js (브라우저) |
| 3. 전송 | 양방향 스트림 | WebSocket (ws) |
| 2. PTY 관리 | 가상 터미널 | node-pty |
| 1. 프로세스 | 실제 실행 | claude CLI |

### Claude CLI 호환성

Claude CLI는 **인터랙티브 TUI 애플리케이션**. node-pty는 실제 OS pseudoterminal을 생성하므로 Claude CLI 입장에서는 진짜 터미널과 구분 불가.

**필수 환경변수:**

```javascript
TERM=xterm-256color
COLORTERM=truecolor
LANG=ko_KR.UTF-8
FORCE_COLOR=3
```

### PtyManager — 핵심 클래스

**책임:**

- pty 프로세스 생성/재연결/종료
- 세션별 프로세스 격리
- 유휴 세션 자동 정리 (30분)
- 리사이즈 이벤트 전달
- 서버 종료 시 모든 pty 정리
**주요 메서드:** `create(sessionId, cols, rows)`, `write(sessionId, data)`, `resize(sessionId, cols, rows)`, `kill(sessionId)`, `dispose()`

### CaptureManager — CLI 출력 캐처

**흔름:**

```javascript
pty.onData()
    ├─→ [RAW] → xterm.js 직접 전달 (렌더링용)
    └─→ [CAPTURE] → CaptureManager
                    ├ 1. 버퍼 누적 (2초 간격)
                    ├ 2. ANSI 스트리핑 (strip-ansi)
                    ├ 3. 의미 단위 청킹 (user/assistant/system)
                    └ 4. DB 비동기 저장
```

**ANSI 스트리핑:** `strip-ansi` npm 패키지 사용 (주간 100M+ 다운로드). v7+는 ESM-only.

**역할 분류 휴리스틱:**

- `">"` 로 시작 → user 입력
- `"Claude"`, `"│"` 포함 → assistant 응답
- 나머지 → system (셸 출력)
### 네이티브 터미널 경험 체크리스트

| 항목 | 상태 | 구현 |
| 256-color | ✅ | TERM=xterm-256color |
| TrueColor (24bit) | ✅ | COLORTERM=truecolor |
| 한글 입력 (IME) | ✅ | xterm.js v5 |
| 커서 이동/편집 | ✅ | node-pty CSI 투명 전달 |
| 대체 스크린 버퍼 | ✅ | vim, less 동작 |
| Ctrl+C (SIGINT) | ✅ | xterm.js x03 전송 |
| 탭 자동완성 | ✅ | 셸 기본 기능 |
| 클립보드 | ⚠️ | attachCustomKeyEventHandler 설정 필요 |
| 리사이즈 | ✅ | FitAddon + ResizeObserver |
| 스크롤백 | ✅ | scrollback: 10000 |

---

## 3. WebSocket 서버 (🔧 Seo + 🖥️ Kai)

### WebSocket 메시지 프로토콜

**클라이언트 → 서버:**

| type | 필드 | 설명 |
| input | data: string | 키보드 입력 |
| resize | cols, rows: number | 터미널 리사이즈 |
| ping | — | 연결 확인 |

**서버 → 클라이언트:**

| type | 필드 | 설명 |
| output | data: string | pty 출력 (raw ANSI) |
| heartbeat | — | 30초마다 |
| pong | — | ping 응답 |
| error | message: string | 에러 |
| exit | — | pty 프로세스 종료 |

### 재연결 로직

지수 백오프: 1s → 2s → 4s → 8s → ... 최대 30s. 성공 시 카운터 리셋. 최대 10회 재시도.

### 서버 디렉토리 구조

```javascript
server/
├── ws-server.ts              # WebSocket 서버 진입점
├── terminal/
│   ├── pty-manager.ts         # pty 프로세스 생명주기
│   └── capture-manager.ts     # CLI 출력 캐처
├── db/
│   ├── prisma.ts              # WS 서버 전용 Prisma
│   └── capture-store.ts       # 캐처 데이터 DB 저장
└── tsconfig.json              # ESM 설정
```

---

## 4. API 설계 (🔧 Seo)

### 응답 형식 표준화

모든 API는 `{ data, error, meta }` 형식:

- 성공: `{ data: T, error: null }`
- 실패: `{ data: null, error: { code, message } }`
### 에러 코드

| 코드 | 설명 |
| NOT_FOUND | 리소스 없음 |
| VALIDATION_ERROR | 입력값 오류 |
| CONFLICT | 충돌 |
| INVALID_STAGE_TRANSITION | 잘못된 단계 전환 |
| INTERNAL_ERROR | 서버 오류 |

### 핵심 API 엔드포인트

**프로젝트:**

```javascript
GET    /api/projects                 → Project[] (currentStage, progress 포함)
POST   /api/projects                 → 트랜잭션: 프로젝트 + 6단계 + 초기활동 원자적 생성
GET    /api/projects/[id]            → Project (with stages, decisions)
PATCH  /api/projects/[id]            → name, description, status
DELETE /api/projects/[id]            → cascade delete
```

**단계 전환 (핵심 트랜잭션):**

```javascript
POST /api/stages/[id]/transition
body: { summary?, direction: "next" | "previous" | "jump", targetStageId? }

트랜잭션 내부:
1. 현재 단계 조회 + 유효성 검증
2. direction에 따라 대상 단계 결정
3. next일 때: 현재 단계 → completed (+ summary)
4. 대상 단계 → active
5. 프로젝트 updatedAt 갱신
6. 활동 기록 (stage_transition 또는 idea_addon)
```

**세션:**

```javascript
GET    /api/stages/[id]/sessions     → Session[] (단계별)
POST   /api/stages/[id]/sessions     → 새 세션 생성
GET    /api/sessions/[id]            → Session (with terminal_logs)
GET    /api/sessions/[id]/history    → 캐처 데이터 페이지네이션
```

**결정사항 (핀):**

```javascript
POST   /api/decisions                → 트랜잭션: Decision + Activity + Project.updatedAt
PATCH  /api/decisions/[id]           → content, context
DELETE /api/decisions/[id]           → void
```

**활동:**

```javascript
GET    /api/activities?projectId=xxx → Activity[] (타임라인)
```

### 프론트엔드용 API 클라이언트

프론트엔드가 사용할 fetch 래퍼:

```typescript
const result = await api<Project[]>("/projects");
if (result.ok) { setProjects(result.data); }
else { toast.error(result.error.message); }
```

---

## 5. DB 아키텍처 (🗄️ Dr. Park)

### 프론트엔드 스키마 대비 변경점

| 변경 | 이유 |
| messages → terminal_logs | 캐처 데이터(raw)와 결정사항(정제)은 성격이 다름 |
| rawLength 필드 추가 | ANSI 스트리핑 전후 용량 추적 |
| 복합 인덱스 추가 | 쿼리 패턴별 최적화 |

### 인덱스 전략

| 테이블 | 인덱스 | 용도 |
| projects | [status, updatedAt DESC] | 대시보드: 활성 프로젝트 최신순 |
| stages | [projectId, orderIndex] | 파이프라인: 순서대로 |
| stages | [projectId, status] | 활성 단계 빠른 조회 |
| sessions | [stageId, updatedAt DESC] | 세션 목록: 최신순 |
| terminal_logs | [sessionId, createdAt] | 캐처 데이터 시간순 |
| decisions | [stageId, createdAt DESC] | 결정사항: 최신순 |
| activities | [projectId, createdAt] | 타임라인 |
| activities | [stageId] | 단계별 필터 |

### SQLite 최적화 (Phase 1)

```javascript
PRAGMA journal_mode=WAL;        -- 동시 읽기 성능 향상
PRAGMA busy_timeout=5000;       -- 두 프로세스 동시 접근 대비
PRAGMA synchronous=NORMAL;      -- 성능/안전 균형
PRAGMA cache_size=-20000;       -- 20MB 캐시
```

**중요:** Next.js API Routes와 WS 서버는 별도 프로세스 → 각각 Prisma 인스턴스 + WAL 모드 필수.

### Supabase 전환 대비

| 차이점 | SQLite | PostgreSQL | 대비 |
| ID | cuid() | uuid 가능 | **cuid 일관 사용 → 전환 무관** |
| DateTime | TEXT | TIMESTAMP | Prisma 자동 변환 |
| Boolean | 0/1 | true/false | Prisma 자동 변환 |
| JSON | TEXT | JSONB | 현 스키마 미사용 → 안전 |
| 동시성 | WAL | MVCC | 로컬단일유저 → 무관 |

---

## 6. 터미널 세션 ↔ DB 세션 연동

```javascript
1. [새 세션] 클릭
   → POST /api/stages/:stageId/sessions → DB Session 생성 → { id: "clxyz..." }

2. WebSocket 연결
   → ws://localhost:3001/ws/terminal?sessionId=clxyz...
   → PtyManager.create("clxyz...")

3. CLI 작업
   → pty 출력 → WS → xterm.js (렌더링)
   → pty 출력 → CaptureManager → terminal_logs (저장)

4. Cmd+P (핀)
   → POST /api/decisions { stageId, sessionId, content }

5. 세션 전환
   → 기존 WS 유지 (pty idle)
   → 새 세션 ID로 WS 재연결
   → 이전 세션: GET /api/sessions/:id/history 로 읽기전용
```

---

## 7. 에러 핸들링 & 장애 격리

| 장애 시나리오 | 영향 | 대응 |
| WS 서버 다운 | CLI 터미널만 불가 | "터미널 연결 끊김" + 자동 재연결 |
| pty 크래시 | 해당 세션만 | "세션 종료됨, 새 세션?" |
| DB 캐처 실패 | 캐처만 유실 | 로그만, CLI 정상 |
| DB API 실패 | 결정/단계 저장 실패 | 에러 + 재시도 |
| Next.js 다운 | 웹앱 불가 | WS 서버는 독립, 웹앱 재시작으로 복구 |

---

## 8. 개발 순서 (백엔드)

| Step | 담당 | 내용 | 의존성 |
| 1 | Dr. Park | Prisma 스키마 + 마이그레이션 + 시드 | 없음 |
| 2 | Seo | API 응답 래퍼 + Prisma 싱글턴 + 상수 | Step 1 |
| 3 | Seo | 프로젝트 CRUD API | Step 2 |
| 4 | Seo | 단계/세션/결정/활동 API | Step 3 |
| 5 | Kai | PtyManager + CaptureManager | 없음 (독립) |
| 6 | Kai | WebSocket 서버 | Step 5 |
| 7 | Seo+Kai | 터미널 세션 ↔ DB 세션 연동 | Step 4+6 |
| 8 | Seo | 단계 전환 트랜잭션 | Step 4 |
| 9 | Dr. Park | 인덱스 최적화 + 성능 테스트 | Step 7 |
| 10 | 전체 | 통합 테스트 + 에러 핸들링 | All |

---

## 9. 트러블슈팅

### 터미널 관련 (Kai)

| 문제 | 해결 |
| Claude CLI 색상 깨짐 | TERM=xterm-256color, COLORTERM=truecolor |
| 한글 깨짐 | LANG=ko_KR.UTF-8 |
| node-pty 빌드 | macOS: xcode-select --install |
| pty 좀비화 | idle timeout 30분 + SIGTERM |
| Ctrl+C 안 먹힘 | attachCustomKeyEventHandler |

### API 관련 (Seo)

| 문제 | 해결 |
| CORS (WS) | WS 서버에 CORS 헤더 |
| SQLite BUSY | WAL + busy_timeout=5000 |
| Prisma 타입 불일치 | prisma generate |
| Route 404 | route.ts 파일명 확인 |

### DB 관련 (Dr. Park)

| 문제 | 해결 |
| terminal_logs 용량 | 90일 이상 로그 자동 삭제 |
| Supabase 오류 | raw SQL 금지, Prisma 쿼리만 |
| cuid 충돌 | cuid2 대안 고려 |

