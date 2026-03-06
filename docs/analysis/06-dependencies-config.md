# 의존성 및 설정 분석

## 1. 의존성 분석 (7/10)

### 핵심 의존성 현황

| 패키지 | 버전 | 최신 | 상태 | 비고 |
|--------|------|------|:----:|------|
| next | ^14.2.35 | 15.x | 주의 | Next.js 15 메이저 업그레이드 가능 |
| react | ^18 | 19.x | 주의 | React 19 메이저 업그레이드 가능 |
| @prisma/client | ^5.22.0 | 6.x | 주의 | Prisma 6 출시됨 |
| @xyflow/react | ^12.10.1 | 12.x | 양호 | |
| zustand | ^5.0.11 | 5.x | 양호 | |
| zod | ^4.3.6 | 4.x | 양호 | Zod 4 최신 |
| tailwindcss | ^3.4.1 | 4.x | 주의 | Tailwind 4 메이저 변경 |
| @xterm/xterm | ^6.0.0 | 6.x | 양호 | |
| ws | ^8.19.0 | 8.x | 양호 | |
| chokidar | ^5.0.0 | 5.x | 양호 | |

### 의존성 이슈

#### L3. node-pty가 devDependencies에 위치
```json
"devDependencies": {
  "node-pty": "^1.1.0",  // 서버 런타임에서 사용
}
```
- WS 서버에서 PTY 생성에 사용 → `dependencies`로 이동 필요
- 단, 빌드 시 네이티브 모듈 컴파일 이슈 있어 의도적일 수 있음

#### @types/turndown가 dependencies에 위치
```json
"dependencies": {
  "@types/turndown": "^5.0.6",  // 타입만 → devDeps로 이동
}
```

#### 번들 크기 우려
| 패키지 | 예상 크기 | 비고 |
|--------|----------|------|
| @xyflow/react | ~150KB | 트리 셰이킹 가능 |
| @xterm/xterm | ~250KB | 동적 import로 분리됨 |
| lucide-react | ~5KB (사용분) | 아이콘별 import로 양호 |
| react-markdown + remark/rehype | ~80KB | 마크다운 렌더링용 |
| @tiptap/* | ~120KB | 에디터 기능 |

### 불필요 의존성 후보
- `@xterm/addon-webgl`: package.json에 있으나 코드에서 미사용
- `strip-ansi` v6: ESM 호환 이슈로 구버전 고정 — 정상적 선택

---

## 2. TypeScript 설정 (8/10)

```json
{
  "strict": true,
  "target": "es2017",
  "module": "esnext",
  "moduleResolution": "bundler",
  "paths": { "@/*": ["./src/*"] }
}
```

**좋은 점:**
- `strict: true` 활성화
- `bundler` moduleResolution (Next.js 권장)
- `@/*` 경로 별칭

**이슈:**
- `skipLibCheck: true` — 라이브러리 타입 에러 무시
- `target: "es2017"` — 2024 기준 `es2022` 이상 가능 (top-level await 등)
- `server/` 디렉토리가 `include`에 포함되나 별도 tsconfig 없음

---

## 3. Next.js 설정

### 확인 필요
- `next.config.js` 또는 `next.config.mjs` 파일 존재 여부 미확인
- 기본 설정 사용 시:
  - 보안 헤더 미설정 (CSP, X-Frame-Options 등)
  - 이미지 최적화 설정 없음
  - webpack 커스터마이징 없음

### 이슈
- **[M1] 보안 헤더 미설정**: CSP, CORS, X-Content-Type-Options 등 미구성
- **node-pty 네이티브 모듈**: webpack에서 externals 설정 필요 가능

---

## 4. Playwright 설정 분석

```typescript
{
  fullyParallel: false,
  workers: 1,
  retries: 2,
  projects: ["chromium", "mobile"],
  webServer: { command: "npx next dev --port 3333" }
}
```

**좋은 점:**
- 모바일 뷰포트 프로젝트 포함
- reuseExistingServer 설정

**이슈:**
- WS 서버 미시작 (상세 분석은 05-testing.md 참조)
- Firefox/Safari 미포함

---

## 5. 빌드 스크립트

```json
{
  "dev": "concurrently \"next dev\" \"tsx watch server/ws-server.ts\"",
  "build": "NODE_OPTIONS='--unhandled-rejections=warn' next build",
  "db:migrate": "npx prisma migrate dev",
  "db:seed": "tsx prisma/seed.ts"
}
```

**좋은 점:**
- `concurrently`로 Next.js + WS 서버 동시 실행
- `tsx watch`로 서버 코드 변경 시 자동 재시작

**이슈:**
- `build`에서 WS 서버 빌드 없음 — 프로덕션 배포 시 `tsx`로 실행해야 함
- `db:generate` 스크립트 없음 (`prisma generate` 명시적 필요할 수 있음)
- `test` 스크립트 없음 (유닛 + E2E 통합)

### 누락 스크립트 (권장)
```json
{
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "test": "vitest run",
  "test:e2e": "npx playwright test",
  "test:all": "vitest run && npx playwright test",
  "typecheck": "tsc --noEmit"
}
```

---

## 6. CSS/스타일 분석

### Tailwind 설정
- Tailwind CSS 3.4 사용
- `tailwindcss-animate` 플러그인 포함
- 커스텀 디자인 토큰 (globals.css 변수)

### 좋은 점
- CSS 변수로 테마 토큰 관리
- `cn()` 유틸리티 (clsx + tailwind-merge)
- 커스텀 radius, shadow, color 토큰 체계적

---

## 7. 보안 설정

| 항목 | 상태 | 권장 |
|------|:----:|------|
| CSP 헤더 | 없음 | next.config에서 설정 |
| CORS | Next.js 기본 | API에서 origin 제한 |
| .env 관리 | .env (gitignore) | .env.example 추가 |
| Secrets in code | CLAUDE.md에 토큰 노출 | 환경변수로 이관 |
| Dependencies audit | 미실행 | `npm audit` 정기 실행 |

### 주의: CLAUDE.md에 API 토큰 하드코딩
```markdown
# 상위 CLAUDE.md에 Figma/Notion 토큰이 직접 노출됨
- Figma Personal Access Token: figd_5aiDhD6944...
- Notion API Token: ntn_354365253135...
```
- `.gitignore`에 포함되지 않으면 Git 히스토리에 토큰 노출
- 환경변수 또는 secrets manager로 이관 필요

---

## 8. 업그레이드 로드맵

### 즉시 가능 (Breaking change 없음)
- [ ] `@types/turndown` → devDependencies로 이동
- [ ] `node-pty` → dependencies로 이동 검토
- [ ] `@xterm/addon-webgl` → 사용하지 않으면 제거
- [ ] `npm audit fix` 실행

### 메이저 업그레이드 (계획 필요)
- [ ] Next.js 14 → 15 (Server Actions, Turbopack 안정화)
- [ ] React 18 → 19 (서버 컴포넌트, use() 등)
- [ ] Prisma 5 → 6 (Supabase 이관 시 함께)
- [ ] Tailwind 3 → 4 (CSS-first 구성, 빌드 시스템 변경)

### Supabase 이관 시 변경
- [ ] `@prisma/client` → `@supabase/supabase-js` (또는 Prisma 유지)
- [ ] `prisma` CLI → Supabase CLI 마이그레이션
- [ ] 환경변수 추가 (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
