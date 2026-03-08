# ThinkToRealization 아키텍처 확장 계획서 — DB 격리 + LLM 추상화 + 배포 구조

## 현재 아키텍처 문제점

### 1. PrismaClient 이중 관리
```
src/lib/prisma.ts       ── PrismaClient + PRAGMA 4개 (Next.js)
server/db/prisma.ts     ── PrismaClient + PRAGMA 4개 (WS Server)
```
- 동일한 PRAGMA 로직이 2곳에서 중복
- `server/db/prisma.ts`가 `DATABASE_URL`을 강제 덮어씀
- 테스트/배포 환경 분기 불가능

### 2. Claude CLI 하드코딩
```
server/cli/cli-manager.ts  ── spawn("claude", [...])
```
- Claude CLI만 사용 가능, 다른 LLM 연결 불가
- 배포 환경(서버리스)에서 CLI 실행 불가
- API 기반 LLM 호출로 전환 시 대규모 리팩토링 필요

### 3. WS 서버 의존성 하드코딩
```
WebSocketProvider.tsx   ── ws://localhost:3001 직접 연결
```
- 로컬 WS 서버 없으면 무한 재연결 시도
- 배포 환경에서 Realtime 채널(Supabase Realtime 등) 전환 불가

### 4. 테스트-개발 DB 공유
```
Dev Server + Test Server ──→ 같은 prisma/dev.db
```

---

## 목표 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                        ThinkToRealization v2                                │
│                                                                  │
│  ┌─── src/lib/db/ ──────────────────────────────────────────┐   │
│  │  config.ts   → DB 환경 감지 (sqlite/postgres)             │   │
│  │  client.ts   → PrismaClient 싱글톤 팩토리 (유일한 진입점)  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── server/llm/ ──────────────────────────────────────────┐   │
│  │  types.ts    → LLMProvider 인터페이스                      │   │
│  │  factory.ts  → 환경/설정 기반 프로바이더 해석               │   │
│  │  providers/                                                │   │
│  │    claude-cli.ts  → 로컬 CLI (현재)                       │   │
│  │    (향후: anthropic-api.ts, openai.ts 등)                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── server/realtime/ ─────────────────────────────────────┐   │
│  │  types.ts    → RealtimeAdapter 인터페이스                  │   │
│  │  ws-adapter.ts → 로컬 WebSocket (현재)                    │   │
│  │  (향후: supabase-realtime.ts 등)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── 3가지 환경 ───────────────────────────────────────────┐   │
│  │  Development  │  Test (QA)     │  Production              │   │
│  │  SQLite       │  SQLite        │  PostgreSQL (Supabase)   │   │
│  │  dev.db       │  test.db       │  devflow schema          │   │
│  │  WS local     │  WS local      │  (Supabase Realtime)     │   │
│  │  Claude CLI   │  Mock/Skip     │  API-based LLM           │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 마일스톤 구조 (5개)

```
M1 (테스트 DB 격리)                      ── 독립, 즉시 시작
M2 (DB 레이어 통합)                      ── M1 이후
M3 (LLM Provider 추상화)                 ── M2와 병렬 가능
M4 (Prisma Multi-Provider + devflow)     ── M2 완료 후
M5 (WS/Realtime 추상화 + 배포 설정)      ── M3, M4 완료 후
```

---

## M1. 테스트 DB 격리

### 목표
Playwright 테스트가 `test.db`를 사용하여 `dev.db`를 절대 건드리지 않도록 격리.
가장 시급한 문제이므로 아키텍처 변경 없이 **최소 변경으로 먼저 해결**.

### 1-1. `.env.test` 생성

```bash
# .env.test
DATABASE_URL="file:./test.db"
NODE_ENV="test"
```

### 1-2. `.gitignore` 업데이트

```gitignore
# Test database
prisma/test.db
prisma/test.db-shm
prisma/test.db-wal
prisma/test.db-journal
```

### 1-3. `e2e/global-setup.ts` 생성 (신규)

```typescript
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export default async function globalSetup() {
  const projectRoot = path.resolve(__dirname, "..");
  const testDbPath = path.join(projectRoot, "prisma", "test.db");

  // 기존 test.db 삭제 → 매번 깨끗한 상태
  for (const ext of ["", "-shm", "-wal", "-journal"]) {
    const f = testDbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  // 마이그레이션 적용 → 빈 test.db 생성
  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: `file:${testDbPath}`,
    },
    stdio: "pipe",
  });

  console.log("[globalSetup] test.db initialized");
}
```

### 1-4. `playwright.config.ts` 수정

```typescript
import { defineConfig } from "@playwright/test";
import path from "path";

const PORT = 3333;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: "html",
  timeout: 30000,
  globalSetup: "./e2e/global-setup.ts",    // ← 추가
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_OPTIONS: "--max-old-space-size=4096",
      DATABASE_URL: `file:${path.resolve(__dirname, "prisma/test.db")}`,  // ← 추가
      NODE_ENV: "test",                                                    // ← 추가
    },
  },
});
```

### 1-5. `src/app/api/test/cleanup/route.ts` 안전장치

```typescript
// 맨 위에 추가 — dev DB 보호
const isTestEnv =
  process.env.NODE_ENV === "test" ||
  process.env.DATABASE_URL?.includes("test.db");

export async function POST() {
  if (!isTestEnv) {
    return new Response(
      JSON.stringify({ error: "Cleanup only allowed in test environment" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  // ... 기존 로직
}
```

### 변경 파일
| 파일 | 유형 |
|------|------|
| `.env.test` | 신규 |
| `.gitignore` | 수정 |
| `e2e/global-setup.ts` | 신규 |
| `playwright.config.ts` | 수정 |
| `src/app/api/test/cleanup/route.ts` | 수정 |

---

## M2. DB 레이어 통합 — 단일 진입점

### 목표
- PrismaClient 초기화를 **한 곳**으로 통합
- DB 종류(SQLite/PostgreSQL)에 따른 분기를 **설정 레이어**에 캡슐화
- `server/db/prisma.ts`와 `src/lib/prisma.ts`의 중복 제거

### 현재 문제
```
src/lib/prisma.ts       ── createPrismaClient() + PRAGMA 4개
server/db/prisma.ts     ── new PrismaClient() + PRAGMA 4개 + DATABASE_URL 강제 덮어쓰기
```
두 파일이 동일한 초기화 로직을 독립적으로 관리 → 변경 시 한쪽만 수정하는 실수 발생.

### 설계 원칙
1. **DB 설정은 `src/lib/db/` 모듈 하나에서 관리**
2. **환경 감지는 명시적 `DB_PROVIDER` 환경변수 우선, 없으면 `DATABASE_URL`에서 추론**
3. **PRAGMA 같은 provider 전용 로직은 설정 파일에서 한번만 정의**
4. **WS 서버도 같은 팩토리 사용** (import 경로만 다름)

### 2-1. `src/lib/db/config.ts` 생성 (신규)

```typescript
/**
 * DB 환경 설정 — Single Source of Truth
 *
 * 환경 감지 우선순위:
 *   1. DB_PROVIDER 환경변수 (명시적)
 *   2. DATABASE_URL 패턴 매칭 (암시적)
 *   3. 기본값: sqlite
 */

export type DBProvider = "sqlite" | "postgresql";

export function getDBProvider(): DBProvider {
  // 1. 명시적 환경변수
  const explicit = process.env.DB_PROVIDER;
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";
  if (explicit === "sqlite") return "sqlite";

  // 2. DATABASE_URL 패턴
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }

  // 3. 기본값
  return "sqlite";
}

export function isSQLite(): boolean {
  return getDBProvider() === "sqlite";
}

export function isPostgres(): boolean {
  return getDBProvider() === "postgresql";
}
```

### 2-2. `src/lib/db/client.ts` 생성 (신규)

```typescript
import { PrismaClient } from "@prisma/client";
import { isSQLite } from "./config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient();

  // SQLite 전용 성능 최적화 (PostgreSQL에서는 실행하지 않음)
  if (isSQLite()) {
    client.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});
    client.$executeRawUnsafe("PRAGMA busy_timeout=5000;").catch(() => {});
    client.$executeRawUnsafe("PRAGMA synchronous=NORMAL;").catch(() => {});
    client.$executeRawUnsafe("PRAGMA cache_size=-20000;").catch(() => {});
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * SQLite WAL 체크포인트 — 테스트 cleanup 후 사용
 */
export async function walCheckpoint(): Promise<void> {
  if (!isSQLite()) return;
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)").catch(() => {});
}
```

### 2-3. `src/lib/db/index.ts` 생성 (신규)

```typescript
// 단일 진입점 — 외부에서는 이 파일만 import
export { prisma, walCheckpoint } from "./client";
export { getDBProvider, isSQLite, isPostgres } from "./config";
export type { DBProvider } from "./config";
```

### 2-4. 기존 파일 마이그레이션

**`src/lib/prisma.ts` 수정** — 호환성 래퍼로 전환:
```typescript
// 기존 import 경로 호환 유지
// 신규 코드는 "@/lib/db"에서 import 할 것
export { prisma } from "./db";
```

**`server/db/prisma.ts` 수정** — 팩토리 위임:
```typescript
import path from "path";

// WS 서버는 별도 프로세스이므로 DATABASE_URL이 없을 수 있음
// 환경변수가 없으면 로컬 dev.db 경로를 설정
if (!process.env.DATABASE_URL) {
  const dbPath = path.resolve(__dirname, "../../prisma/dev.db");
  process.env.DATABASE_URL = `file:${dbPath}`;
}

// 동일한 팩토리 사용 — PRAGMA 중복 제거
// 주의: WS 서버는 별도 프로세스이므로 globalThis 충돌 없음
export { prisma as default } from "../../src/lib/db";
```

> **핵심**: `server/db/prisma.ts`는 **DATABASE_URL 설정만** 담당하고, 클라이언트 생성은 `src/lib/db/client.ts`에 위임.
> WS 서버가 별도 `tsx` 프로세스이므로 `globalThis` 싱글톤과 충돌하지 않음.

### 2-5. 기존 import 경로 갱신

29개 API 라우트는 현재 `import { prisma } from "@/lib/prisma"` 사용.
`src/lib/prisma.ts`를 re-export 래퍼로 유지하므로 **기존 코드 변경 0**.

신규 코드부터는 `import { prisma } from "@/lib/db"` 사용.

### 2-6. `src/app/api/test/cleanup/route.ts` 수정

```typescript
// Before
await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");

// After
import { walCheckpoint } from "@/lib/db";
// ...
await walCheckpoint();
```

### 변경 파일
| 파일 | 유형 | 설명 |
|------|------|------|
| `src/lib/db/config.ts` | 신규 | DB 환경 감지 |
| `src/lib/db/client.ts` | 신규 | PrismaClient 팩토리 (유일한 생성 지점) |
| `src/lib/db/index.ts` | 신규 | Public API re-export |
| `src/lib/prisma.ts` | 수정 | re-export 래퍼 (하위호환) |
| `server/db/prisma.ts` | 수정 | URL 설정만, 생성 위임 |
| `src/app/api/test/cleanup/route.ts` | 수정 | `walCheckpoint()` 사용 |

### 아키텍처 효과
```
Before:  2개의 독립적 PrismaClient 초기화 + 8줄 PRAGMA 중복
After:   1개의 팩토리 + PRAGMA 한 곳에서 관리

Next.js API  ──→ src/lib/db/client.ts  (import { prisma } from "@/lib/db")
WS Server    ──→ src/lib/db/client.ts  (import via server/db/prisma.ts re-export)
```

---

## M3. LLM Provider 추상화

### 목표
- Claude CLI를 **하나의 구현체**로 분리하고, LLM 호출을 인터페이스화
- 향후 Anthropic API, OpenAI API, 로컬 모델 등 교체 가능한 구조
- 배포 환경에서는 API 기반 호출, 로컬에서는 CLI 기반 호출

### 설계 원칙
1. **인터페이스 분리**: `LLMProvider`가 정의하는 계약만 따르면 어떤 LLM이든 교체 가능
2. **팩토리 패턴**: 환경/설정에 따라 적절한 프로바이더를 자동 선택
3. **기존 코드 최소 변경**: `executeClaude()` 호출부만 `llm.generate()`로 변경

### 3-1. `server/llm/types.ts` 생성 (신규)

```typescript
/**
 * LLM Provider 인터페이스
 *
 * 모든 LLM 프로바이더는 이 인터페이스를 구현.
 * CLI, API, 로컬 모델 등 구현 방식에 무관하게 동일한 계약.
 */

export interface LLMGenerateOptions {
  /** 작업 디렉토리 (CLI 모드에서 사용) */
  cwd?: string;
  /** 타임아웃 (ms) */
  timeout?: number;
  /** JSON 응답 강제 여부 */
  jsonMode?: boolean;
}

export interface LLMResult {
  success: boolean;
  /** 파싱된 응답 (JSON 모드일 때) */
  data: unknown | null;
  /** 원본 텍스트 응답 */
  rawOutput: string;
  /** 에러 메시지 (실패 시) */
  error: string | null;
  /** 어떤 프로바이더가 처리했는지 */
  provider: string;
}

export interface LLMProviderInfo {
  /** 프로바이더 식별자 */
  name: string;
  /** 사용 가능 여부 */
  available: boolean;
  /** 로컬 전용인지 */
  localOnly: boolean;
  /** 상세 정보 (버전, 경로 등) */
  details?: Record<string, unknown>;
}

export interface LLMProvider {
  /** 프로바이더 정보 조회 */
  getInfo(): Promise<LLMProviderInfo>;

  /** 프롬프트 실행 → 결과 반환 */
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult>;
}
```

### 3-2. `server/llm/providers/claude-cli.ts` 생성 (신규)

기존 `server/cli/cli-manager.ts` 코드를 `LLMProvider` 인터페이스로 래핑:

```typescript
import { spawn } from "child_process";
import { readConfig } from "../../db/devflow-config";
import type { LLMProvider, LLMResult, LLMGenerateOptions, LLMProviderInfo } from "../types";

const DEFAULT_TIMEOUT = 120_000;

export class ClaudeCLIProvider implements LLMProvider {
  private cliPath: string;

  constructor() {
    const config = readConfig();
    this.cliPath = config.cliPath || "claude";
  }

  async getInfo(): Promise<LLMProviderInfo> {
    const result = await this.checkAvailability();
    return {
      name: "claude-cli",
      available: result.available,
      localOnly: true,
      details: { path: result.path },
    };
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    return new Promise((resolve) => {
      const args = ["--print", "--output-format", "json", "-p", prompt];

      const proc = spawn(this.cliPath, args, {
        cwd: options?.cwd,
        timeout,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on("error", (err) => {
        resolve({
          success: false, data: null, rawOutput: stdout,
          error: `CLI spawn error: ${err.message}`, provider: "claude-cli",
        });
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          resolve({
            success: false, data: null, rawOutput: stdout,
            error: stderr || `CLI exited with code ${code}`, provider: "claude-cli",
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve({ success: true, data: parsed, rawOutput: stdout, error: null, provider: "claude-cli" });
        } catch {
          resolve({ success: true, data: null, rawOutput: stdout, error: "Failed to parse JSON", provider: "claude-cli" });
        }
      });
    });
  }

  private async checkAvailability(): Promise<{ available: boolean; path: string | null }> {
    return new Promise((resolve) => {
      const proc = spawn("which", [this.cliPath], { timeout: 5000 });
      let stdout = "";
      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.on("error", () => resolve({ available: false, path: null }));
      proc.on("close", (code) => {
        resolve(code === 0 ? { available: true, path: stdout.trim() } : { available: false, path: null });
      });
    });
  }
}
```

### 3-3. `server/llm/factory.ts` 생성 (신규)

```typescript
import type { LLMProvider } from "./types";
import { ClaudeCLIProvider } from "./providers/claude-cli";

/**
 * LLM 프로바이더 팩토리
 *
 * 우선순위:
 *   1. LLM_PROVIDER 환경변수 (명시적)
 *   2. 사용 가능한 프로바이더 자동 감지
 *   3. 기본값: claude-cli
 *
 * 향후 프로바이더 추가 시:
 *   1. server/llm/providers/에 구현 파일 추가
 *   2. 여기 registry에 등록
 *   3. 끝 — 호출부 변경 없음
 */

type ProviderFactory = () => LLMProvider;

const registry: Record<string, ProviderFactory> = {
  "claude-cli": () => new ClaudeCLIProvider(),
  // 향후 추가:
  // "anthropic-api": () => new AnthropicAPIProvider(),
  // "openai": () => new OpenAIProvider(),
};

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const explicit = process.env.LLM_PROVIDER;
  if (explicit && registry[explicit]) {
    cachedProvider = registry[explicit]();
    return cachedProvider;
  }

  // 기본값: claude-cli
  cachedProvider = registry["claude-cli"]();
  return cachedProvider;
}

/** 프로바이더 캐시 초기화 (테스트용) */
export function resetLLMProvider(): void {
  cachedProvider = null;
}
```

### 3-4. `server/llm/index.ts` 생성 (신규)

```typescript
export type { LLMProvider, LLMResult, LLMGenerateOptions, LLMProviderInfo } from "./types";
export { getLLMProvider, resetLLMProvider } from "./factory";
```

### 3-5. 기존 호출부 마이그레이션

**`server/cli/cli-manager.ts` → 호환 래퍼로 전환:**

```typescript
// 기존 코드 하위호환 유지
// 신규 코드는 getLLMProvider().generate()를 직접 사용할 것
import { getLLMProvider } from "../llm";
import type { LLMResult } from "../llm";

export type CLIResult = LLMResult;

export async function executeClaude(
  prompt: string,
  options?: { cwd?: string; timeout?: number }
): Promise<CLIResult> {
  const provider = getLLMProvider();
  return provider.generate(prompt, options);
}

export async function checkCLIAvailable(): Promise<{
  available: boolean;
  path: string | null;
  error: string | null;
}> {
  const provider = getLLMProvider();
  const info = await provider.getInfo();
  return {
    available: info.available,
    path: (info.details?.path as string) ?? null,
    error: info.available ? null : `Provider '${info.name}' not available`,
  };
}
```

> **기존 import 경로 그대로 동작** — `server/cli/cli-manager.ts`를 import하는 코드는 수정 불필요.
> 내부적으로 LLM Provider 인터페이스를 경유하게 됨.

### 변경 파일
| 파일 | 유형 | 설명 |
|------|------|------|
| `server/llm/types.ts` | 신규 | LLMProvider 인터페이스 |
| `server/llm/providers/claude-cli.ts` | 신규 | Claude CLI 구현체 |
| `server/llm/factory.ts` | 신규 | 프로바이더 팩토리 |
| `server/llm/index.ts` | 신규 | Public API |
| `server/cli/cli-manager.ts` | 수정 | 호환 래퍼로 전환 |

### 향후 확장 시나리오

```typescript
// 예시: Anthropic API 프로바이더 추가 시

// 1. server/llm/providers/anthropic-api.ts 생성
export class AnthropicAPIProvider implements LLMProvider {
  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    // ... 응답 파싱
  }
}

// 2. factory.ts의 registry에 등록
registry["anthropic-api"] = () => new AnthropicAPIProvider();

// 3. 환경변수만 설정하면 전환 완료
// LLM_PROVIDER=anthropic-api
// ANTHROPIC_API_KEY=sk-...
```

---

## M4. Prisma Multi-Provider + Supabase devflow 스키마

### 목표
- 기존 Supabase 프로젝트에 `devflow` PostgreSQL 스키마 생성
- Prisma multiSchema로 모든 테이블을 해당 스키마에 격리
- 로컬은 SQLite 유지, 배포만 PostgreSQL

### 설계 원칙
1. **`prisma/schema.models.prisma`가 Single Source of Truth** — 모델 정의는 여기에만
2. **`scripts/generate-prisma-schema.ts`로 환경별 `schema.prisma` 생성** — 수동 편집 금지
3. **정규식 대신 라인 기반 파싱** — 더 안정적인 변환
4. **생성 후 검증** — `prisma format`으로 유효성 체크

### 4-1. Supabase에 devflow 스키마 생성

Supabase SQL Editor에서 1회 실행:

```sql
CREATE SCHEMA IF NOT EXISTS devflow;

GRANT USAGE ON SCHEMA devflow TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA devflow TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA devflow
  GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA devflow
  GRANT SELECT ON TABLES TO anon, authenticated;
```

### 4-2. `prisma/schema.models.prisma` 생성 (신규)

현재 `schema.prisma`에서 `generator` + `datasource` 블록 제거한 순수 모델:

```prisma
// prisma/schema.models.prisma
// ──────────────────────────────────────────────
// 이 파일이 모델 정의의 Single Source of Truth.
// 직접 사용하지 말 것 — npm run schema:sqlite 또는 schema:postgres로 생성.
// ──────────────────────────────────────────────

model Project {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String?
  projectDir  String   @default("")
  isActive    Boolean  @default(true)
  claudeMdPath String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  canvasViewportX    Float @default(0)
  canvasViewportY    Float @default(0)
  canvasViewportZoom Float @default(1.0)
  nodes Node[]
}

model Node {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type        String   @default("task")
  title       String
  description String?
  status      String   @default("backlog")
  priority    String   @default("none")
  canvasX     Float    @default(0)
  canvasY     Float    @default(0)
  canvasW     Float    @default(280)
  canvasH     Float    @default(140)
  parentNodeId String?
  parentNode   Node?    @relation("NodeChildren", fields: [parentNodeId], references: [id])
  childNodes   Node[]   @relation("NodeChildren")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  sessions     Session[]
  decisions    Decision[]
  outEdges     Edge[]         @relation("EdgeFrom")
  inEdges      Edge[]         @relation("EdgeTo")
  stateLogs    NodeStateLog[]
  plans        Plan[]
  @@index([projectId, status])
}

model Edge {
  id         String   @id @default(cuid())
  fromNodeId String
  toNodeId   String
  fromNode   Node     @relation("EdgeFrom", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode     Node     @relation("EdgeTo", fields: [toNodeId], references: [id], onDelete: Cascade)
  type       String   @default("sequence")
  label      String?
  createdAt  DateTime @default(now())
}

model Session {
  id              String    @id @default(cuid())
  nodeId          String
  node            Node      @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  claudeSessionId String?
  title           String?
  status          String    @default("active")
  fileChangeCount Int       @default(0)
  resumeCount     Int       @default(0)
  logFilePath     String?
  startedAt       DateTime  @default(now())
  endedAt         DateTime?
  durationSeconds Int       @default(0)
  files     SessionFile[]
  decisions Decision[]
  @@index([nodeId])
}

model SessionFile {
  id         String   @id @default(cuid())
  sessionId  String
  session    Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  filePath   String
  changeType String
  detectedAt DateTime @default(now())
  @@index([sessionId])
}

model Decision {
  id              String   @id @default(cuid())
  nodeId          String
  node            Node     @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  sessionId       String?
  session         Session? @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  content         String
  promotedToNodeId String?
  createdAt       DateTime @default(now())
  @@index([nodeId])
}

model Plan {
  id          String   @id @default(cuid())
  nodeId      String
  node        Node     @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  version     Int      @default(1)
  status      String   @default("draft")
  content     String
  prompt      String
  rawResponse String?
  reviewNote  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([nodeId])
}

model NodeStateLog {
  id              String   @id @default(cuid())
  nodeId          String
  node            Node     @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  fromStatus      String?
  toStatus        String
  triggerType     String
  triggerSessionId String?
  createdAt       DateTime @default(now())
  @@index([nodeId])
}
```

### 4-3. `scripts/generate-prisma-schema.ts` 생성 (신규)

정규식 대신 **라인 기반 파싱** + 생성 후 검증:

```typescript
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "..");
const MODELS_PATH = path.join(ROOT, "prisma", "schema.models.prisma");
const OUTPUT_PATH = path.join(ROOT, "prisma", "schema.prisma");

// ─── 헤더 템플릿 ───

const SQLITE_HEADER = `// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Source: prisma/schema.models.prisma
// Generated by: npm run schema:sqlite

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
`;

const POSTGRES_HEADER = `// AUTO-GENERATED — DO NOT EDIT MANUALLY
// Source: prisma/schema.models.prisma
// Generated by: npm run schema:postgres

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas   = ["devflow"]
}
`;

// ─── 변환 로직 ───

function addSchemaAnnotations(models: string, schemaName: string): string {
  const lines = models.split("\n");
  const result: string[] = [];
  let insideModel = false;
  let braceDepth = 0;

  for (const line of lines) {
    // model 블록 시작 감지
    if (/^model\s+\w+\s*\{/.test(line)) {
      insideModel = true;
      braceDepth = 1;
      result.push(line);
      continue;
    }

    if (insideModel) {
      // 중첩 { } 추적
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      // model 블록 닫는 } 도달
      if (braceDepth === 0) {
        // @@schema가 아직 없으면 추가
        if (!result.some((l, i) => i > result.length - 5 && l.includes("@@schema"))) {
          result.push(`  @@schema("${schemaName}")`);
        }
        result.push(line); // closing }
        insideModel = false;
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

function removeSchemaAnnotations(models: string): string {
  return models
    .split("\n")
    .filter((line) => !line.trim().startsWith("@@schema("))
    .join("\n");
}

// ─── 메인 ───

const target = process.argv[2];

if (!target || !["sqlite", "postgres"].includes(target)) {
  console.error("Usage: tsx scripts/generate-prisma-schema.ts <sqlite|postgres>");
  process.exit(1);
}

if (!fs.existsSync(MODELS_PATH)) {
  console.error(`[generate-schema] Model file not found: ${MODELS_PATH}`);
  process.exit(1);
}

const modelsRaw = fs.readFileSync(MODELS_PATH, "utf-8");

let output: string;
if (target === "postgres") {
  output = POSTGRES_HEADER + "\n" + addSchemaAnnotations(modelsRaw, "devflow");
} else {
  output = SQLITE_HEADER + "\n" + removeSchemaAnnotations(modelsRaw);
}

fs.writeFileSync(OUTPUT_PATH, output);
console.log(`[generate-schema] Generated schema.prisma for ${target}`);

// 생성 후 검증 — prisma format으로 구문 체크
try {
  execSync("npx prisma format", { cwd: ROOT, stdio: "pipe" });
  console.log(`[generate-schema] Validation passed ✓`);
} catch (err) {
  console.error(`[generate-schema] ⚠ Generated schema has format issues:`);
  console.error((err as { stderr?: Buffer }).stderr?.toString() ?? "Unknown error");
  process.exit(1);
}
```

### 4-4. 환경 파일

```bash
# .env (기존 유지)
DATABASE_URL="file:./dev.db"

# .env.test (M1에서 생성)
DATABASE_URL="file:./test.db"
NODE_ENV="test"

# .env.production (신규)
DATABASE_URL="postgresql://postgres.smspuulcqydmminkuwus:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?schema=devflow&pgbouncer=true"
DIRECT_URL="postgresql://postgres.smspuulcqydmminkuwus:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?schema=devflow"
DB_PROVIDER="postgresql"
LLM_PROVIDER="anthropic-api"
```

### 4-5. package.json 스크립트 추가

```json
{
  "scripts": {
    "schema:sqlite": "tsx scripts/generate-prisma-schema.ts sqlite && npx prisma generate",
    "schema:postgres": "tsx scripts/generate-prisma-schema.ts postgres && npx prisma generate",
    "build:prod": "npm run schema:postgres && npm run build",
    "db:migrate": "npx prisma migrate dev",
    "db:migrate:prod": "npm run schema:postgres && npx prisma migrate deploy"
  }
}
```

### 모델 변경 워크플로우

```bash
# 1. schema.models.prisma 수정 (Single Source of Truth)
# 2. SQLite 마이그레이션 생성 + 적용
npm run schema:sqlite
npx prisma migrate dev --name <change_description>

# 3. (배포 시) PostgreSQL 마이그레이션 생성
npm run schema:postgres
DATABASE_URL="..." DIRECT_URL="..." npx prisma migrate dev --name <change_description>

# 4. 로컬로 복구
npm run schema:sqlite
```

### 변경 파일
| 파일 | 유형 |
|------|------|
| `prisma/schema.models.prisma` | 신규 |
| `scripts/generate-prisma-schema.ts` | 신규 |
| `.env.production` | 신규 |
| `package.json` | 수정 |

---

## M5. WS/Realtime 추상화 + 배포 설정

### 목표
- WS 서버를 **로컬 전용** 어댑터로 캡슐화
- 배포 환경에서는 WS 없이 동작하되, 향후 Supabase Realtime 등으로 확장 가능
- 로컬 전용 기능(터미널, 파일 감시, CLI)의 경계를 **모듈 구조**로 명확화

### 설계 원칙
1. **IS_LOCAL 플래그를 산발적으로 뿌리지 않는다** — 대신 API 라우트 수준에서 기능 가용성을 판단
2. **WS 연결은 optional** — 프론트엔드는 WS 미연결 시 graceful degradation
3. **로컬 전용 모듈은 `server/` 디렉토리에 격리** — Next.js API에서 `server/`를 import하면 그것은 로컬 전용 기능

### 5-1. 서버 기능 분류

```
┌─────────────────────────────────────────────────────────┐
│                  기능 분류표                              │
├──────────────────────────┬──────────────────────────────┤
│  어디서나 동작 (Core)     │  로컬 전용 (Local)           │
├──────────────────────────┼──────────────────────────────┤
│  Project CRUD            │  터미널 (node-pty)           │
│  Node/Edge CRUD          │  파일 감시 (chokidar)        │
│  Session 메타데이터       │  파일시스템 브라우저         │
│  Decision CRUD           │  Claude CLI 실행             │
│  Plan 메타데이터          │  세션 로그 파일 읽기         │
│  Plan 생성 (LLM 호출)    │  WebSocket 실시간 이벤트     │
│  Context Assembly        │  ~/.devflow/ 설정            │
└──────────────────────────┴──────────────────────────────┘
```

> **"Plan 생성"이 Core**인 이유: LLM Provider 추상화(M3)로 API 기반 LLM 호출이 가능해지므로,
> 배포 환경에서도 Plan 생성은 동작할 수 있음.

### 5-2. Realtime 어댑터 인터페이스 (향후 확장용)

```typescript
// server/realtime/types.ts

/**
 * Realtime 이벤트 어댑터 인터페이스
 *
 * 현재: WebSocket (로컬)
 * 향후: Supabase Realtime, SSE, Pusher 등
 */
export interface RealtimeEvent {
  type: string;
  payload: Record<string, unknown>;
  /** 특정 노드에만 전달 (null이면 전체) */
  targetNodeId?: string | null;
}

export interface RealtimeAdapter {
  /** 어댑터 이름 */
  readonly name: string;

  /** 이벤트 브로드캐스트 */
  broadcast(event: RealtimeEvent): void;

  /** 특정 노드 구독자에게만 전달 */
  broadcastToNode(nodeId: string, event: RealtimeEvent): void;

  /** 어댑터 초기화 */
  start(): Promise<void>;

  /** 어댑터 종료 */
  stop(): Promise<void>;
}
```

> 현재는 **인터페이스 정의만**. 기존 `ws-server.ts`는 그대로 유지하되,
> 향후 리팩토링 시 이 인터페이스를 구현하는 `WSAdapter`로 래핑.
> 이번 마일스톤에서는 인터페이스 + 타입만 작성하고, 실제 리팩토링은 배포 시점에 진행.

### 5-3. 프론트엔드 WS 연결 — graceful degradation

현재 `WebSocketProvider.tsx`는 WS 연결 실패 시 무한 재연결을 시도함.
배포 환경에서 WS 서버가 없을 때 불필요한 리소스 낭비.

```typescript
// WebSocketProvider.tsx 수정 사항

// 최대 재연결 시도 횟수 추가
const MAX_RECONNECT_ATTEMPTS = 5;

// onclose 핸들러 내부:
ws.onclose = () => {
  if (wsRef.current !== ws) return;
  setIsConnected(false);
  if (intentionalClose.current) return;

  // 최대 시도 횟수 초과 시 재연결 중지
  if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
    console.info("[WS] Max reconnect attempts reached — running in offline mode");
    return;
  }

  const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
  setTimeout(connect, delay);
  reconnectAttempts.current++;
};
```

### 5-4. 로컬 전용 API 라우트 가드

```typescript
// src/lib/api-guards.ts (신규)

/**
 * 로컬 전용 API 라우트 가드
 *
 * server/ 모듈을 import하는 API 라우트에서 사용.
 * 배포 환경에서는 503을 반환하여 클라이언트가 기능 비활성화 가능.
 */
export function requireLocal(): Response | null {
  // 로컬 여부 판단: WS 서버가 없는 환경 = 배포 환경
  // NODE_ENV=production + DB_PROVIDER=postgresql → 배포로 간주
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DB_PROVIDER === "postgresql"
  ) {
    return new Response(
      JSON.stringify({
        error: {
          code: "LOCAL_ONLY",
          message: "This feature is only available in local mode",
          status: 503,
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}
```

적용 대상 라우트:
- `/api/filesystem/directories` — 로컬 파일시스템
- `/api/filesystem/file` — CLAUDE.md 읽기
- `/api/sessions/[id]/log` — 세션 로그 파일

```typescript
// 사용 예: src/app/api/filesystem/directories/route.ts
import { requireLocal } from "@/lib/api-guards";

export async function GET(req: Request) {
  const localGuard = requireLocal();
  if (localGuard) return localGuard;
  // ... 기존 로직
}
```

### 5-5. `next.config.mjs` 업데이트

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // node-pty는 서버 사이드에서만 사용 (번들링 제외)
  serverExternalPackages: ["node-pty"],
};

export default nextConfig;
```

### 5-6. 빌드 스크립트 정리

```json
{
  "scripts": {
    "dev": "concurrently \"next dev\" \"tsx watch server/ws-server.ts\"",
    "dev:web": "next dev",
    "dev:ws": "tsx watch server/ws-server.ts",
    "build": "NODE_OPTIONS='--unhandled-rejections=warn' next build",
    "build:prod": "npm run schema:postgres && npm run build",
    "build:local": "npm run schema:sqlite && npm run build",
    "start": "next start",
    "start:ws": "node server/dist/ws-server.js",
    "start:all": "concurrently \"next start\" \"node server/dist/ws-server.js\"",
    "lint": "next lint",
    "schema:sqlite": "tsx scripts/generate-prisma-schema.ts sqlite && npx prisma generate",
    "schema:postgres": "tsx scripts/generate-prisma-schema.ts postgres && npx prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "db:migrate": "npx prisma migrate dev",
    "db:migrate:prod": "npm run schema:postgres && npx prisma migrate deploy",
    "db:studio": "npx prisma studio",
    "postinstall": "npx prisma generate"
  }
}
```

### 변경 파일
| 파일 | 유형 |
|------|------|
| `server/realtime/types.ts` | 신규 (인터페이스만) |
| `src/lib/api-guards.ts` | 신규 |
| `src/components/providers/WebSocketProvider.tsx` | 수정 (재연결 제한) |
| `src/app/api/filesystem/directories/route.ts` | 수정 (가드 추가) |
| `src/app/api/filesystem/file/route.ts` | 수정 (가드 추가) |
| `src/app/api/sessions/[id]/log/route.ts` | 수정 (가드 추가) |
| `next.config.mjs` | 수정 |
| `package.json` | 수정 |

---

## 전체 변경 요약

### 신규 파일 (14개)
| 파일 | 마일스톤 | 목적 |
|------|---------|------|
| `.env.test` | M1 | 테스트 DB 설정 |
| `e2e/global-setup.ts` | M1 | 테스트 DB 초기화 |
| `src/lib/db/config.ts` | M2 | DB 환경 감지 |
| `src/lib/db/client.ts` | M2 | PrismaClient 팩토리 |
| `src/lib/db/index.ts` | M2 | Public API |
| `server/llm/types.ts` | M3 | LLMProvider 인터페이스 |
| `server/llm/providers/claude-cli.ts` | M3 | Claude CLI 구현체 |
| `server/llm/factory.ts` | M3 | 프로바이더 팩토리 |
| `server/llm/index.ts` | M3 | Public API |
| `prisma/schema.models.prisma` | M4 | 모델 SSoT |
| `scripts/generate-prisma-schema.ts` | M4 | 스키마 생성기 |
| `.env.production` | M4 | Supabase 설정 |
| `server/realtime/types.ts` | M5 | Realtime 인터페이스 |
| `src/lib/api-guards.ts` | M5 | 로컬 전용 가드 |

### 수정 파일 (10개)
| 파일 | 마일스톤 | 변경 내용 |
|------|---------|----------|
| `.gitignore` | M1 | test.db 제외 |
| `playwright.config.ts` | M1 | globalSetup + DB 환경변수 |
| `src/app/api/test/cleanup/route.ts` | M1+M2 | 안전장치 + walCheckpoint |
| `src/lib/prisma.ts` | M2 | re-export 래퍼 |
| `server/db/prisma.ts` | M2 | URL 설정만, 생성 위임 |
| `server/cli/cli-manager.ts` | M3 | LLM Provider 호환 래퍼 |
| `package.json` | M4+M5 | 스크립트 추가 |
| `src/components/providers/WebSocketProvider.tsx` | M5 | 재연결 제한 |
| `src/app/api/filesystem/*/route.ts` (2개) | M5 | 로컬 가드 |
| `next.config.mjs` | M5 | serverExternalPackages |

### Supabase 작업 (1회)
| 작업 | 방법 |
|------|------|
| `devflow` 스키마 생성 | SQL Editor: `CREATE SCHEMA devflow` + 권한 |

---

## 아키텍처 원칙 요약

### 1. 단일 진입점 원칙
```
DB 접근     → src/lib/db/        (유일한 PrismaClient 생성 지점)
LLM 호출    → server/llm/        (유일한 LLM 호출 지점)
Realtime    → server/realtime/   (유일한 이벤트 브로드캐스트 지점)
```

### 2. 하위호환 래퍼 전략
```
기존 import 경로                    →  내부적으로 위임
import { prisma } from "@/lib/prisma"    →  src/lib/db/client.ts
import { executeClaude } from "server/cli/cli-manager"  →  server/llm/
import prisma from "server/db/prisma"    →  src/lib/db/client.ts
```
- **기존 29개 API 라우트 변경 0** — re-export 래퍼가 하위호환 보장
- 신규 코드부터 새 import 경로 사용

### 3. 모듈 경계 = 기능 경계
```
src/app/api/   ← server/ import하면 로컬 전용 기능
               ← src/lib/ import만이면 어디서든 동작
```
- IS_LOCAL 플래그 대신 **import 구조**가 로컬/배포 경계를 결정
- 로컬 전용 API에는 `requireLocal()` 가드로 명시적 차단

### 4. 환경 변수 체계
```
# 공통
DATABASE_URL     ← DB 연결 (모든 환경)
NODE_ENV         ← 환경 구분

# DB 전용
DB_PROVIDER      ← sqlite | postgresql (명시적, DATABASE_URL보다 우선)

# LLM 전용
LLM_PROVIDER     ← claude-cli | anthropic-api | openai
ANTHROPIC_API_KEY ← API 기반 LLM 사용 시

# PostgreSQL 전용
DIRECT_URL       ← Prisma direct connection (PgBouncer 우회)
```

### 5. 확장 시 터치포인트
| 확장 | 추가 파일 | 기존 코드 변경 |
|------|----------|--------------|
| 새 LLM 프로바이더 | `server/llm/providers/<name>.ts` | `factory.ts`에 registry 등록 1줄 |
| 새 Realtime 채널 | `server/realtime/<name>.ts` | 어댑터 선택 로직 추가 |
| 새 DB 프로바이더 | `schema.models.prisma` 헤더 추가 | `generate-prisma-schema.ts`에 분기 추가 |
| 새 앱 추가 (Supabase) | 해당 앱 스키마 생성 | **변경 없음** (스키마 격리) |

---

## 실행 순서

```bash
# ===== M1: 테스트 DB 격리 (즉시) =====
# .env.test, global-setup.ts, playwright.config.ts 수정
# → npx playwright test로 검증

# ===== M2: DB 레이어 통합 =====
# src/lib/db/ 모듈 생성
# 기존 prisma.ts 래퍼 전환
# → npm run build + npx playwright test

# ===== M3: LLM 추상화 (M2와 병렬 가능) =====
# server/llm/ 모듈 생성
# cli-manager.ts 래퍼 전환
# → npm run build 검증

# ===== M4: Multi-Provider =====
# schema.models.prisma + generate script
# → npm run schema:sqlite && npm run build
# → npm run schema:postgres 검증

# ===== M5: 배포 설정 =====
# realtime 인터페이스, api-guards, WS degradation
# → npm run build:prod 검증
```

---

## Supabase 공유 프로젝트 구조

```
Supabase 프로젝트: smspuulcqydmminkuwus (South Asia Mumbai)
│
├── public 스키마
│   ├── profiles, pipelines, tasks, ...  ← claudeDevelopmentSystem
│   └── (sequeliquance 테이블)
│
└── devflow 스키마
    ├── Project, Node, Edge, Session, ...  ← thinkToRealization
    └── _prisma_migrations                  ← 독립 마이그레이션
```

---

## 리스크 + 대응

| 리스크 | 대응 |
|--------|------|
| Prisma multiSchema (preview) | Prisma 5.x에서 안정적, 프로덕션 사용 보고 다수 |
| 이중 마이그레이션 관리 | schema.models.prisma SSoT + generate 스크립트 |
| WS 서버와 src/lib/db 간 import 경로 | WS는 별도 프로세스, tsconfig paths 설정으로 해결 |
| server/db/prisma.ts의 re-export | WS 서버 tsconfig에서 src/ 경로 해석 가능하게 설정 |
| LLM Provider 전환 시 응답 포맷 차이 | LLMResult 인터페이스가 통일 (provider별 파싱은 내부 처리) |
| node-pty 배포 환경 빌드 실패 | serverExternalPackages로 번들링 제외 |
