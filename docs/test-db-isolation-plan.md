# 테스트 DB 격리 작업 계획서

## 문제 정의

현재 dev 서버(port 3000)와 Playwright 테스트 서버(port 3333)가 **동일한 SQLite 파일(`prisma/dev.db`)을 공유**하고 있어 다음 문제가 발생:

1. **데이터 훼손**: `cleanTestData()`가 dev DB의 실제 프로젝트 데이터를 건드릴 수 있음
2. **동시 접근 충돌**: 여러 에이전트가 E2E 테스트를 동시 실행하면 같은 DB에서 race condition 발생
3. **테스트 격리 실패**: 테스트 잔여 데이터가 dev 환경에 남아 UI가 오염됨
4. **WAL 파일 비대화**: 테스트 데이터 생성/삭제 반복으로 dev.db-wal이 비정상적으로 커짐

### 현재 아키텍처 (문제 있는 구조)
```
Dev Server (port 3000) ──┐
                         ├──→ prisma/dev.db  ← 같은 DB 파일!
Test Server (port 3333) ─┘
WS Server (port 3001) ──┘
```

### 목표 아키텍처 (격리된 구조)
```
Dev Server (port 3000) + WS (3001) ──→ prisma/dev.db     (개발 데이터)
Test Server (port 3333)             ──→ prisma/test.db    (테스트 전용, 매 실행 초기화)
```

---

## 핵심 원리

1. **환경 변수 기반 분기**: `DATABASE_URL` 환경 변수로 dev.db / test.db 전환
2. **테스트 시작 시 자동 초기화**: test.db는 매 테스트 스위트 시작 시 마이그레이션 적용 + 빈 상태로 시작
3. **dev.db 보호**: 테스트 코드가 절대 dev.db에 접근하지 못하도록 격리
4. **기존 코드 최소 변경**: Prisma client 초기화 로직만 수정, 비즈니스 로직 변경 없음

---

## 작업 내역 (5개)

### 작업 1: .env.test 파일 생성

```bash
# .env.test
DATABASE_URL="file:./test.db"
```

- `.env`는 그대로 유지 (`file:./dev.db`)
- `.gitignore`에 `prisma/test.db*` 추가

**변경 파일**: `.env.test` (신규), `.gitignore`

---

### 작업 2: Playwright 설정에 테스트 DB 환경 변수 주입

```typescript
// playwright.config.ts
webServer: {
  command: `npx next dev --port ${PORT}`,
  url: `http://localhost:${PORT}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120000,
  env: {
    NODE_OPTIONS: "--max-old-space-size=4096",
    DATABASE_URL: "file:./test.db",    // ← 추가
    NODE_ENV: "test",                   // ← 추가
  },
},
```

- Playwright가 시작하는 Next.js dev server가 test.db를 사용하도록 강제
- `NODE_ENV=test`로 테스트 환경 명시

**변경 파일**: `playwright.config.ts`

---

### 작업 3: Playwright globalSetup에서 test.db 자동 초기화

```typescript
// e2e/global-setup.ts
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export default async function globalSetup() {
  const projectRoot = path.resolve(__dirname, "..");
  const testDbPath = path.join(projectRoot, "prisma", "test.db");

  // 1. 기존 test.db 삭제 (clean slate)
  for (const ext of ["", "-shm", "-wal", "-journal"]) {
    const f = testDbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  // 2. Prisma migrate deploy로 스키마 적용 (빈 DB 생성)
  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: "file:./test.db",
    },
    stdio: "pipe",
  });

  console.log("[globalSetup] test.db initialized with latest migrations");
}
```

- 매 `npx playwright test` 실행 시 test.db를 완전히 새로 생성
- `migrate deploy`로 모든 마이그레이션 적용 (dev와 동일한 스키마)

```typescript
// playwright.config.ts에 추가
globalSetup: "./e2e/global-setup.ts",
```

**변경 파일**: `e2e/global-setup.ts` (신규), `playwright.config.ts`

---

### 작업 4: WS 서버 DB 경로 환경변수 대응

현재 `server/db/prisma.ts`가 `prisma/dev.db`를 하드코딩하고 있음:
```typescript
// Before (하드코딩)
const dbPath = path.resolve(__dirname, "../../prisma/dev.db");
process.env.DATABASE_URL = `file:${dbPath}`;
```

환경변수가 있으면 그것을 사용하도록 변경:
```typescript
// After (환경변수 우선)
const dbPath = process.env.DATABASE_URL
  ? undefined  // 이미 설정됨, 덮어쓰지 않음
  : (() => {
      const resolved = path.resolve(__dirname, "../../prisma/dev.db");
      process.env.DATABASE_URL = `file:${resolved}`;
      return resolved;
    })();
```

- dev 환경: DATABASE_URL 없음 → dev.db 사용 (기존 동작 유지)
- test 환경: DATABASE_URL 있음 → test.db 사용

**주의**: 테스트 시 WS 서버는 별도로 시작하지 않으므로 (Playwright는 Next.js만 시작), 이 변경은 안전망 역할

**변경 파일**: `server/db/prisma.ts`

---

### 작업 5: cleanTestData() 단순화 + 안전장치

test.db가 격리되었으므로, cleanup을 더 공격적으로 할 수 있음:

```typescript
// e2e/helpers.ts — cleanTestData 개선
export async function cleanTestData() {
  const res = await fetch(`${API}/test/cleanup`, { method: "POST" });
  if (!res.ok) {
    // test.db이므로 전체 초기화해도 안전
    console.warn("cleanTestData failed, but test.db is isolated — continuing");
    return;
  }
}
```

추가로 `api/test/cleanup/route.ts`에 안전장치:
```typescript
// 개발 DB 보호 — test 환경에서만 동작
export async function POST() {
  if (process.env.NODE_ENV !== "test" && !process.env.DATABASE_URL?.includes("test.db")) {
    return new Response(JSON.stringify({ error: "Cleanup only allowed in test environment" }), {
      status: 403,
    });
  }
  // ... 기존 로직
}
```

**변경 파일**: `e2e/helpers.ts`, `src/app/api/test/cleanup/route.ts`

---

## 변경 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `.env.test` | 신규 | `DATABASE_URL="file:./test.db"` |
| `.gitignore` | 수정 | `prisma/test.db*` 추가 |
| `playwright.config.ts` | 수정 | DATABASE_URL, NODE_ENV 주입 + globalSetup 연결 |
| `e2e/global-setup.ts` | 신규 | test.db 삭제 → migrate deploy |
| `server/db/prisma.ts` | 수정 | 환경변수 우선 사용 |
| `e2e/helpers.ts` | 수정 | cleanTestData 에러 핸들링 개선 |
| `src/app/api/test/cleanup/route.ts` | 수정 | test 환경 전용 가드 추가 |

---

## 검증 방법

```bash
# 1. dev.db에 실제 프로젝트 데이터가 있는 상태에서
source ~/.nvm/nvm.sh && nvm use 22

# 2. 테스트 실행
npx playwright test --reporter=list

# 3. 테스트 완료 후 확인:
#    - prisma/dev.db: 실제 데이터 그대로 보존 ✅
#    - prisma/test.db: 테스트 데이터만 존재 (또는 정리됨) ✅
#    - dev 서버 (port 3000): 정상 동작, 데이터 무손실 ✅

# 4. dev 서버에서 프로젝트 목록 확인 (데이터 보존 검증)
curl -s http://localhost:3000/api/projects | jq '.data | length'
```

---

## 리스크

| 리스크 | 대응 |
|--------|------|
| Prisma client 캐싱 (globalThis) | NODE_ENV=test로 분기 가능 |
| test.db 마이그레이션 실패 | globalSetup에서 에러 로그 + 테스트 중단 |
| 동시 Playwright 실행 | workers: 1이므로 단일 프로세스 (기존 설정) |
| CI 환경 차이 | CI에서도 동일하게 DATABASE_URL 주입 |

---

## 작업 소요 (예상)
- 전체 변경: 7개 파일 (신규 2, 수정 5)
- 코드량: ~50줄 추가/수정
- 단일 에이전트로 30분 이내 완료 가능
