# thinkToRealization — 레이아웃 & 반응형 CSS 분석 보고서

## 📊 종합 평가

**현재 모바일 대응 준비도: 📍 20% (매우 낮음)**

- ✅ **완료된 부분**: 기본 구조는 relative/absolute 레이아웃으로 유연함, CSS 변수 활용으로 값 중앙화
- ❌ **심각한 문제**: 고정 픽셀 치수, 반응형 클래스 전무, 터치 이벤트 미지원, 데스크톱 우선 설계
- 🔴 **위험도**: 최고 수준 — 현재 상태로는 320px~480px 모바일에서 완전히 사용 불가능

---

## 1️⃣ globals.css 분석 — 고정 치수의 중앙화된 문제

### ✅ 좋은 점
```css
/* globals.css:7-27 */
:root {
  --sidebar-width: 220px;         ✅ CSS 변수화됨
  --sidebar-collapsed-width: 48px;
  --header-height: 48px;
  --panel-min-width: 400px;       ✅ 변수로 한 곳에서 관리
}
```

### 🔴 문제점

#### 문제 1: 고정 픽셀 값의 문제
**위치**: `globals.css:23-26`

| 변수 | 값 | 모바일 적용 시 | 심각도 |
|-----|-----|---------|------|
| `--sidebar-width` | 220px | 320px 화면의 68% 차지 | 🔴 Critical |
| `--sidebar-collapsed-width` | 48px | 너무 좁아서 아이콘만 가능 (모바일에선 비효율) | 🟠 High |
| `--header-height` | 48px | 모바일에서 과도함 (40px 이하 권장) | 🟡 Medium |
| `--panel-min-width` | 400px | 480px 전체 화면을 점유 | 🔴 Critical |

#### 문제 2: 미디어 쿼리 전무
```css
/* globals.css 전체 검색 */
@media — 찾을 수 없음
```
**영향**: 화면 크기가 변해도 레이아웃이 적응하지 않음

#### 문제 3: 고정 줄 높이 및 폰트 크기 (모바일 터치 타겟 미달)
```css
/* globals.css:55-63 */
fontSize: {
  body: ['14px', { lineHeight: '22px' }],      ← 모바일에선 너무 작음 (16px 권장)
  caption: ['12px', { lineHeight: '16px' }],   ← 터치 타겟 47px 미달
  terminal: ['13px', { lineHeight: '20px' }],  ← 터미널은 13px로 부족
}
```

---

## 2️⃣ tailwind.config.ts 분석 — 반응형 설정 부재

### ✅ 좋은 점
```typescript
/* tailwind.config.ts:9-97 */
theme.extend.colors — 색상 변수 잘 정의됨
theme.extend.fontSize — 타이포그래피 토큰화됨
```

### 🔴 문제점

#### 문제 1: 기본 브레이크포인트 사용 안 함
```typescript
/* tailwind.config.ts 전체 검색 */
screens: { /* 없음 */ }
```

| 브레이크포인트 | Tailwind 기본값 | 현재 상태 |
|----------|----------|---------|
| `sm:` | 640px | ❌ 사용 안 함 |
| `md:` | 768px | ❌ 사용 안 함 |
| `lg:` | 1024px | ❌ 사용 안 함 |
| **모바일-only** | — | ❌ 없음 |

**결과**: 컴포넌트에 반응형 클래스가 0개

#### 문제 2: `max-w-` 제약 없음
```typescript
/* tailwind.config.ts 검색 */
maxWidth: { /* 없음 */ }
```

#### 문제 3: 터치 디바이스 최적화 토큰 부재
```typescript
/* 없음 */
spacing: { /* 4, 8, 12, 16, 24, 32, 48px만 있음 */ }
// 터치 타겟 최소 44px 를 위한 spacing 부족
```

---

## 3️⃣ 레이아웃 컴포넌트 분석

### AppShell.tsx — 이중 grid의 문제
**파일**: `src/components/layout/AppShell.tsx:17-35`

```typescript
return (
  <div style={{
    gridTemplateRows: 'var(--header-height) 1fr',  // 고정 48px
    gridTemplateColumns: `${sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)'} 1fr`,
    // 220px vs 48px 전환만 가능
  }} />
)
```

#### 문제점
| 항목 | 데스크톱 (1280px) | 태블릿 (768px) | 모바일 (375px) |
|-----|--------|--------|--------|
| **Sidebar 너비** | 220px (17%) | 220px (29%) ⚠️ | 48px (13%) 🔴 |
| **Main 패딩** | 계산됨 | 오버플로우 가능 | 처리 안 됨 |
| **Header** | 48px (↔️) | 48px (크기 그대로) | 48px (↔️ 비율 높음) |
| **반응형 여부** | 데스크톱 기준 | ❌ 없음 | ❌ 없음 |

#### 코드 위치별 문제점

| 문제 | 위치 | 심각도 | 설명 |
|-----|-----|------|-----|
| Grid 고정 너비 | Line 22 | 🔴 Critical | `gridTemplateColumns`에서 `220px` 하드코딩, 모바일에선 공간 부족 |
| 패널 우측 여백 | Line 14 | 🔴 Critical | `calc(max(40%, 400px))` — 모바일 375px에서 150px 이상 차지 |
| 헤더-사이드바 span | Line 12 | 🟡 Medium | `col-span-2` 고정, 태블릿에선 재배치 필요 |

### Header.tsx — 고정 높이 및 반응형 요소 부재
**파일**: `src/components/layout/Header.tsx:11-62`

```typescript
<header style={{ height: 'var(--header-height)' }}> {/* 48px 고정 */}
  <div className="col-span-2 flex items-center justify-between px-4">
    {/* 문제 1: 큰 화면에선 충분하지만, 모바일에선 컨텐츠가 겹침 */}
    <div className="flex items-center gap-3">
      <button className="p-1.5 rounded-button">...</button>
      <span className="text-node-title-lg">DevFlow</span>
      <ProjectSelector />
    </div>

    <nav className="flex items-center gap-1">
      {/* 2개 탭 이름을 모두 표시 */}
    </nav>

    <div className="flex items-center gap-2">
      {/* 검색 + 설정 버튼 */}
    </div>
  </div>
</header>
```

#### 문제점

| 범주 | 구체적 위치 | 문제 | 심각도 |
|------|----------|------|------|
| **높이** | Line 13 | `height: 48px` — 모바일에서 과함. 40px 이하 권장 | 🟡 Medium |
| **컨텐츠 레이아웃** | Line 12 | `justify-between` 3열 레이아웃, 모바일에선 겹침 | 🔴 Critical |
| **네비게이션** | Line 28-44 | 2개 탭 풀네임 표시. 모바일(375px)에선 줄바꿈 필수 | 🔴 Critical |
| **검색 버튼** | Line 48-55 | `px-3 py-1.5 + 텍스트 + kbd` = 최소 120px 이상 필요. 모바일에선 불가능 | 🔴 Critical |
| **터치 타겟** | Line 16-20 (Menu 버튼) | `p-1.5 (12px)` — 터치 타겟 44px 미달 | 🟠 High |

#### 모바일에서의 실제 오버플로우 계산
```
375px - 좌측 사이드 패딩(4px) - 우측 패딩(4px) = 367px
필요 너비: 24px (menu) + 70px (logo) + 80px (selector) + 120px (search) + 40px (settings) = 334px ✓ 겨우 맞음

하지만 gap과 border 고려하면 >360px → 줄바꿈 발생
```

### Sidebar.tsx — 고정 너비 콜렉션
**파일**: `src/components/layout/Sidebar.tsx:34-86`

```typescript
<aside style={{ width: sidebarOpen ? '220px' : '48px' }}>
  {/* 220px 또는 48px만 가능 — 중간 크기 없음 */}
</aside>
```

#### 문제점

| 항목 | 너비 | 모바일 (320px) | 모바일 (375px) | 태블릿 (768px) |
|------|-----|---------|---------|---------|
| **열린 상태** | 220px | ❌ 68% (비효율) | ❌ 59% (비효율) | ✓ 28% |
| **닫힌 상태** | 48px | ✓ 15% | ✓ 13% | ✓ 6% |
| **반응형 전환** | — | ❌ 없음 | ❌ 없음 | ❌ 없음 |

**권장 개선**
```
모바일 (< 640px):
- 열림: 80% (최대 모바일 콘텐츠)
- 닫힘: 48px (그대로)

태블릿 (640px - 1024px):
- 열림: 200px
- 닫힘: 48px

데스크톱 (> 1024px):
- 열림: 220px (현재)
- 닫힘: 48px (현재)
```

---

## 4️⃣ 사이드 패널 (SidePanel.tsx) — 최악의 반응형 문제

**파일**: `src/components/panel/SidePanel.tsx:46-55`

```typescript
<aside
  className={[
    panelMode === 'peek'
      ? 'w-[40%] min-w-[400px] max-w-[50%]'  {/* 🔴 400px 최소 너비 */}
      : '',
    panelMode === 'full'
      ? 'w-[80%] max-w-[900px] shadow-elevation-3 z-50'  {/* 80% = 모바일에서도 80% */}
      : '',
  ]}
>
```

### 🔴 Critical 문제점 분석

#### 문제 1: `min-w-[400px]` 모바일 킬러
```
모바일 375px 화면:
- peek 모드: 40% = 150px, 하지만 min-w-[400px]로 인해 400px 강제 적용
- 결과: 오른쪽으로 overflow, 스크롤바 생성 또는 화면 레이아웃 깨짐
```

**발생 위치**: Line 52
**심각도**: 🔴 Critical (모바일 사용 불가)

#### 문제 2: `w-[40%]`는 모바일에서 의미 없음
```
모바일 375px: 40% = 150px < 400px min-width → 무시됨
결과: 콘텐츠 강제 선택 없음, 레이아웃 예측 불가능
```

#### 문제 3: full 모드에서 `w-[80%]`
```
모바일 375px: 80% = 300px (대부분 화면 차지)
데스크톱 1280px: 80% = 1024px (max-w-[900px]로 제약, 단 216px 여백 남음)

문제: 모바일에서 데이터를 보기 어려움
```

#### 문제 4: 헤더 높이 `h-14` (56px)
```typescript
/* Line 57 */
<div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
```
모바일에선 48px 이하 권장 → 4px 과하

### 구체적 모바일 렌더링 결과

| 시나리오 | 패널 너비 | 결과 | 문제 |
|--------|---------|------|-----|
| **Peek mode (320px)** | `max(40%, 400px)` = 400px | ❌ 오버플로우 | 화면 밖으로 나감 |
| **Peek mode (375px)** | `max(150px, 400px)` = 400px | ❌ 오버플로우 | 25px 넘어감 |
| **Peek mode (480px)** | `max(192px, 400px)` = 400px | ⚠️ 겨우 맞음 | 80px만 남음 |
| **Full mode (375px)** | 80% = 300px | ✓ 물론 가능 | 75px만 남음 (AppShell 고려 시) |

---

## 5️⃣ 터미널 패널 (TerminalPanel.tsx) — 고정 높이 범위

**파일**: `src/app/page.tsx:26-103`

```typescript
const handleDragStart = useCallback((e) => {
  const newHeight = Math.max(150, Math.min(600, dragRef.current.startHeight + delta))
  // 150px (최소) ~ 600px (최대) 고정
}, [])
```

### 문제점

| 항목 | 값 | 모바일 적용 | 심각도 |
|------|-----|---------|------|
| **최소 높이** | 150px | 모바일 320px 화면의 47%! | 🔴 Critical |
| **최대 높이** | 600px | 모바일에선 관계없음, 데스크톱에서만 의미 있음 | 🟡 Medium |
| **header** | 48px (`h-10`) | 모바일에서 과함 (32px 권장) | 🟡 Medium |
| **미디어 쿼리** | 없음 | 모든 화면 동일 규칙 적용 | 🔴 Critical |

**권장 개선**
```typescript
// 반응형 최소/최대 높이
const minHeight = isMobile ? 100 : 150;
const maxHeight = isMobile ? 300 : 600;  // 모바일: 전체 높이의 50%까지
```

---

## 6️⃣ 캔버스 노드 (BaseNode.tsx) — 고정 크기

**파일**: `src/components/canvas/BaseNode.tsx:25-54`

```typescript
// 컴팩트 노드
<div className="w-[200px] h-[52px]">

// 확장된 노드
<div className="w-[280px] h-[140px]">
```

### 문제점

| 노드 타입 | 너비 | 높이 | 문제 | 심각도 |
|--------|-----|-----|------|------|
| **Compact** | 200px | 52px | 고정 크기, 줌 레벨에 맞춰야 함 | 🟡 Medium |
| **Expanded** | 280px | 140px | 고정 크기, 큰 화면에선 낭비 | 🟡 Medium |
| **@xyflow** | — | — | 터치 드래그 최적화 부족 | 🟠 High |
| **핸들 크기** | 8x8px | — | 모바일 터치 타겟 미달 | 🟠 High |

---

## 7️⃣ 다이얼로그 & 드롭다운 — 고정 너비

### CreateProjectDialog
**파일**: `src/components/layout/CreateProjectDialog.tsx:?`

```
w-[420px]  → 모바일 375px 초과
```

### ProjectSelector
**파일**: `src/components/layout/ProjectSelector.tsx:?`

```
w-[240px]  → 모바일에서 가능하지만 버튼의 부모 너비에 따라 조정 필요
```

### PromoteDialog
**파일**: `src/components/decisions/PromoteDialog.tsx:?`

```
w-[420px] max-w-[90vw]  → ✓ vw 사용으로 일부 대응했지만, 420px가 기본값
```

### CommandPalette
**파일**: `src/components/command/CommandPalette.tsx:?`

```
max-w-[640px]  → 모바일 375px에서 안전
```

---

## 8️⃣ Tailwind 반응형 클래스 사용 현황

### 📊 통계

```bash
$ grep -r "sm:\|md:\|lg:\|xl:" src/components/ | wc -l
0  {/* 0개 */}
```

### ❌ 반응형 클래스 전무

검색 결과: `sm:`, `md:`, `lg:`, `xl:` 클래스 사용 **0건**

### 대신 사용된 고정 너비 클래스

```
w-[200px]    : BaseNode (compact)
w-[280px]    : BaseNode (expanded)
w-[420px]    : CreateProjectDialog, PromoteDialog
w-[240px]    : ProjectSelector dropdown
w-[640px]    : CommandPalette
min-w-[400px]: SidePanel (페널 최소 너비) 🔴 최악
max-w-[900px]: SidePanel full mode
max-w-[640px]: CommandPalette
```

---

## 9️⃣ Hover 상태 — 데스크톱 우선

```bash
$ grep -r "hover:" src/components/ | wc -l
24  {/* 24개 */}
```

### 🔴 문제

모든 hover 상태는 데스크톱 마우스 전용입니다.

**예시**:
```typescript
/* SidePanel.tsx:62 */
className="p-1 rounded-button hover:bg-surface-hover text-text-secondary"

/* 모바일에서:
   - 터치 시 :active가 아닌 :hover 스타일 적용 (대부분 데스크톱 브라우저에서는 무시)
   - 터치 끝난 후 hover 상태가 "고착" (주변 밝아짐)
   - UX 혼란 → active 상태 필요
*/
```

### 터치 친화적 상태 부재

```css
/* 모바일 권장 */
@media (hover: none) {
  button:active { /* 터치 피드백 */ }
}

/* 현재: 없음 */
```

---

## 🔟 Canvas 터치 지원 분석

**파일**: `src/components/canvas/CanvasView.tsx`

### @xyflow/react 기본 터치 지원

`@xyflow/react`는 기본적으로 터치를 지원하지만:

1. **멀티터치 제스처** 부족
   - 2손가락 줌: 기본 지원
   - 1손가락 드래그: 지원
   - 다만 모바일 인터페이스에 최적화되지 않음

2. **컨텍스트 메뉴**
```typescript
/* CanvasContextMenu.tsx */
const [contextPos, setContextPos] = useState()

// right-click (마우스) 기반
```
모바일에선 long-press 필요 → 현재 없음

---

## 1️⃣1️⃣ 종합 문제 정리 (파일별)

### 🔴 Critical Issues

| 파일 | 줄 | 문제 | 영향 |
|-----|-----|------|------|
| `globals.css` | 23-26 | 고정 치수: 220px sidebar, 400px panel min | 모바일 320-480px 화면 붕괴 |
| `SidePanel.tsx` | 52 | `min-w-[400px]` + `w-[40%]` 조합 | 375px 모바일 오버플로우 확정 |
| `AppShell.tsx` | 14 | `max(40%, 400px)` 패드 계산 | 40% = 150px일 때 400px 강제 |
| `Header.tsx` | 28-55 | 3열 레이아웃 + 풀 텍스트 표시 | 모바일 320px에서 텍스트 겹침 |
| `page.tsx` | 45 | 터미널 최소 높이 150px | 모바일 320px의 47% 차지 |

### 🟠 High Issues

| 파일 | 줄 | 문제 | 영향 |
|------|-----|------|------|
| `Header.tsx` | 16-20 | 터치 타겟 12px (44px 미달) | 모바일 탭 정확도 낮음 |
| `BaseNode.tsx` | 57 | 핸들 크기 8x8px | 모바일 터치 정확도 낮음 |
| `TerminalPanel.tsx` | 49-51 | 폰트 13px, 고정 줄높이 | 모바일 가독성 낮음 |
| 전체 | — | hover: 상태만 존재 | 터치 피드백 없음 |

### 🟡 Medium Issues

| 파일 | 줄 | 문제 | 영향 |
|------|-----|------|------|
| `globals.css` | 60 | 기본 본문 14px | 모바일 권장: 16px |
| `SidePanel.tsx` | 57 | 헤더 높이 56px (h-14) | 모바일 과도 |
| `CanvasView.tsx` | — | long-press 컨텍스트 메뉴 없음 | 모바일 우클릭 불가 |
| `tailwind.config.ts` | — | 브레이크포인트 정의 없음 | 반응형 클래스 불가능 |

---

## 1️⃣2️⃣ 즉시 조치 권장 사항 (우선순위)

### Phase 1: 긴급 (Critical) — 모바일 320px 살리기

**소요시간**: 4-6시간

1. **globals.css 반응형 변수 추가**
```css
:root {
  /* 데스크톱 (기본) */
  --sidebar-width: 220px;
  --panel-min-width: 400px;

  /* 모바일 추가 */
}

@media (max-width: 640px) {
  :root {
    --sidebar-width: 80%;
    --panel-min-width: 320px;  /* 400px → 320px */
    --header-height: 44px;      /* 48px → 44px */
  }
}

@media (max-width: 480px) {
  :root {
    --sidebar-width: 100%;      /* 풀 너비 */
    --panel-min-width: 100vw;   /* 풀 너비 */
  }
}
```

2. **SidePanel 최소 너비 수정**
```typescript
// 현재:
w-[40%] min-w-[400px] max-w-[50%]

// 변경:
panelMode === 'peek'
  ? 'w-[40%] md:min-w-[400px] min-w-[320px] max-w-[50%] sm:max-w-[100vw]'
  : ''
```

3. **tailwind.config.ts 브레이크포인트 추가**
```typescript
screens: {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
  '2xl': '1536px',
}
```

### Phase 2: 높음 (High) — 터치 UX — 2-3시간

1. **터치 타겟 최소 44px 보장**
```typescript
/* Header.tsx */
<button className="p-2.5 sm:p-1.5">  {/* 40px(모바일) → 32px(데스크톱) */}
```

2. **터치 상태 추가**
```css
@media (hover: none) {
  button:active { background: var(--color-surface-active); }
}
```

3. **Canvas long-press 메뉴**
```typescript
// CanvasView.tsx에 long-press 감지기 추가
```

### Phase 3: 중간 (Medium) — 폰트/레이아웃 — 1-2시간

1. **기본 폰트 크기 조정**
```css
@media (max-width: 640px) {
  body { font-size: 16px; }  /* 14px → 16px */
}
```

2. **Header 네비게이션 재배치**
```typescript
// 탭을 아이콘으로만 표시 (모바일)
// 텍스트 표시 (데스크톱)
```

---

## 1️⃣3️⃣ 모바일 브레이크포인트 제안

```
           Desktop    Tablet     Mobile     Mobile
           ↓          ↓          ↓          ↓
├─ 1280px ─┤
│  Header: 48px
│  Sidebar: 220px (열림), 48px (닫힘)
│
├─ 1024px ─┤ (lg:)
│
├─ 768px ──┤ (md:)
│  Header: 48px
│  Sidebar: 200px, 48px
│  Terminal min-height: 150px
│
├─ 640px ──┤ (sm:)  ← CRITICAL BREAK
│  Header: 44px
│  Sidebar: 80% (열림), 48px (닫힘)
│  Terminal min-height: 100px
│  Font: 16px
│  Touch target: 44px
│
├─ 480px ──┤ (xs:)  ← CRITICAL BREAK
│  Header: 40px
│  Sidebar: 100% (풀 오버레이)
│  Panel: 100vw (풀 오버레이)
│  Terminal min-height: 80px
│
└─ 320px ──┘
   iPhone SE
```

---

## 1️⃣4️⃣ 기술 부채 요약

| 범주 | 문제 | 영향 | 비용 |
|-----|------|------|-----|
| **레이아웃** | 고정 픽셀 (220px, 48px, 400px) | 모바일 320-480px 사용 불가 | 중간 |
| **반응형** | 미디어 쿼리 0개, 브레이크포인트 미정의 | 모든 화면 크기 고정 레이아웃 | 높음 |
| **터치** | hover 상태만, active/long-press 부재 | 모바일 UX 최악 | 중간 |
| **타이포** | 14px 본문, 고정 줄높이 | 모바일 가독성 낮음 | 낮음 |
| **타겟** | 8-12px 요소들 | 모바일 정확도 낮음 | 낮음 |
| **Canvas** | 컨텍스트 메뉴는 right-click만 | 모바일에서 메뉴 불가 | 낮음 |

---

## 최종 권고

### 🚨 현재 상태
- **모바일 대응도**: ~20%
- **사용 가능성**: 320-480px 모바일에서 **불가능**
- **위험도**: 🔴 **Critical**

### ✅ 실천 방안

1. **즉시** (1주): Phase 1 (Critical) 수정 → 모바일 기본 사용 가능 상태
2. **단기** (2-3주): Phase 2 (High) + Phase 3 (Medium) → 모바일 UX 개선
3. **장기** (1개월): 전체 테스트 + 모바일 최적화 완성

---

**작성일**: 2026-03-02
**분석 대상**: thinkToRealization v2
**분석자**: Layout & Responsive CSS Analyzer
