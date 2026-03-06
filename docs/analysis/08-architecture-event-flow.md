# DevFlow v2 - 내부 아키텍처 & 이벤트 흐름 해설서

> 화면(UI)이 아닌 **내부 로직과 데이터가 어떻게 흘러가는지**에 집중한 문서.
> 코드를 직접 읽지 않아도 시스템의 동작 원리를 이해할 수 있도록 작성.

---

## 목차
1. [시스템 전체 구조](#1-시스템-전체-구조)
2. [서버 내부 컴포넌트 관계도](#2-서버-내부-컴포넌트-관계도)
3. [EventBus - 서버의 신경망](#3-eventbus---서버의-신경망)
4. [세션 라이프사이클 (핵심 플로우)](#4-세션-라이프사이클-핵심-플로우)
5. [상태 머신 (State Machine)](#5-상태-머신-state-machine)
6. [PTY 데이터 경로 (터미널 I/O)](#6-pty-데이터-경로-터미널-io)
7. [파일 감시 & 변경 추적](#7-파일-감시--변경-추적)
8. [캔버스 Undo/Redo & API 동기화](#8-캔버스-undoredo--api-동기화)
9. [클라이언트 상태 관리 (4 Stores)](#9-클라이언트-상태-관리-4-stores)
10. [WebSocket 통신 프로토콜](#10-websocket-통신-프로토콜)
11. [서버 시작 & 종료 시퀀스](#11-서버-시작--종료-시퀀스)
12. [주요 데이터 모델 관계](#12-주요-데이터-모델-관계)

---

## 1. 시스템 전체 구조

```
                         사용자의 브라우저
                    ┌─────────────────────────┐
                    │     React App (SPA)      │
                    │  ┌─────────┐ ┌────────┐  │
                    │  │ Zustand │ │ xterm  │  │
                    │  │ Stores  │ │.js     │  │
                    │  └────┬────┘ └───┬────┘  │
                    └───────┼──────────┼───────┘
                            │          │
              REST API      │          │  WebSocket
             (HTTP)         │          │  (WS)
                            ▼          ▼
           ┌────────────────────┐  ┌────────────────────┐
           │   Next.js 서버     │  │   WebSocket 서버    │
           │   (port 3000)      │  │   (port 3001)       │
           │                    │  │                     │
           │   /api/* 라우트    │  │   ws-server.ts      │
           │   Prisma ORM      │  │   EventBus          │
           │                   │  │   SessionManager    │
           │                   │  │   PtyManager        │
           │                   │  │   StateMachine      │
           │                   │  │   FileWatcher       │
           │                   │  │   CaptureManager    │
           │                   │  │   RecoveryManager   │
           └────────┬──────────┘  └─────────┬───────────┘
                    │                       │
                    │     동일한 DB 파일      │
                    └────────┬──────────────┘
                             ▼
                    ┌─────────────────┐
                    │  SQLite (WAL)   │
                    │  prisma/dev.db  │
                    └─────────────────┘
```

### 핵심 포인트
- **2개의 독립 프로세스**가 하나의 SQLite DB를 공유
- Next.js = REST API + 페이지 렌더링 (CRUD 담당)
- WebSocket = 실시간 이벤트 + PTY 터미널 (세션/터미널 담당)
- 두 서버는 DB를 통해서만 간접적으로 데이터를 공유 (직접 통신 없음)

---

## 2. 서버 내부 컴포넌트 관계도

```
ws-server.ts (진입점, WS 연결 관리)
│
├── 구독: EventBus ──────────────────────────────────────┐
│         (모든 컴포넌트의 이벤트를 수신하여 WS로 전파)    │
│                                                        │
├── 사용: SessionManager ─── 호출 ──→ StateMachine       │
│         (세션 생성/종료/재개)        (노드 상태 전이)     │
│              │                          │               │
│              │                          ├─ DB 트랜잭션   │
│              │                          └─ emit ────────┤
│              └── emit ──────────────────────────────────┤
│                                                        │
├── 사용: PtyManager ──── emit ──────────────────────────┤
│         (PTY 프로세스 생성/종료)                         │
│                                                        │
├── 사용: CaptureManager                                 │
│         (PTY 출력을 로그 파일로 저장)                    │
│              │                                         │
│              └── 쓰기 ──→ .devflow-logs/{sessionId}.log │
│                                                        │
├── 사용: FileWatcher ─── emit ──────────────────────────┤
│         (프로젝트 디렉토리 파일 변경 감시)               │
│                                                        │
└── 시작 시: RecoveryManager                              │
          (비정상 종료된 세션 복구)                         │
                                                         │
              EventBus ◄─────────────────────────────────┘
                 │
                 └──→ ws-server가 수신하여 WS 클라이언트에 전파
```

### 컴포넌트별 역할 한 줄 요약

| 컴포넌트 | 역할 | 상태 저장 |
|---------|------|----------|
| **ws-server** | WS 연결 관리 + EventBus→WS 브릿지 | nodeClients, globalClients (메모리) |
| **EventBus** | 타입 안전한 이벤트 발행/구독 허브 | 없음 (순수 전달자) |
| **SessionManager** | 세션 생성·종료·재개 라이프사이클 | DB (Session 테이블) |
| **StateMachine** | 노드 상태 전이 규칙 적용 | DB (Node.status + NodeStateLog) |
| **PtyManager** | node-pty 프로세스 생성·관리 | Map<nodeId, PtySession> (메모리) |
| **CaptureManager** | PTY 출력 버퍼링 + 로그 파일 저장 | Map<sessionId, buffer> + 파일 |
| **FileWatcher** | chokidar로 파일 변경 감시 | Map<sessionId, WatcherEntry> (메모리) |
| **RecoveryManager** | 서버 재시작 시 고아 세션 정리 | DB (Session, Node) |

---

## 3. EventBus - 서버의 신경망

EventBus는 서버 내 모든 컴포넌트를 연결하는 **중앙 이벤트 허브**이다.
컴포넌트들이 서로 직접 호출하지 않고, 이벤트를 발행(emit)하면 관심 있는 쪽이 구독(on)하는 구조.

### 이벤트 목록과 흐름

```
이벤트 이름              발행자              구독자(ws-server)의 동작
──────────────────────────────────────────────────────────────────────
pty:data               PtyManager         → 해당 nodeId의 WS 클라이언트 + 글로벌 클라이언트에 전파
                                          → CaptureManager에도 전달 (로그 저장용)

pty:exit               PtyManager         → CaptureManager.stop() + FileWatcher.unwatch()
                                          → SessionManager.endSession() (자동 종료)
                                          → 클라이언트에 session:ended 전파

session:started        SessionManager     → 클라이언트에 session:started 전파

session:ended          SessionManager     → 클라이언트에 session:ended 전파

session:resumed        SessionManager     → 클라이언트에 session:resumed 전파

node:stateChanged      StateMachine       → 모든 WS 클라이언트에 전파 (캔버스 동기화)

file:changed           FileWatcher        → 해당 nodeId의 WS 클라이언트에 파일 변경 수 전파

plan:generating        ContextAssembler   → 모든 클라이언트에 전파
plan:created           ContextAssembler   → 모든 클라이언트에 전파
plan:error             ContextAssembler   → 모든 클라이언트에 전파
```

### 왜 EventBus를 쓰는가?

```
[EventBus 없이 - 직접 호출]              [EventBus 있을 때 - 느슨한 결합]

PtyManager                               PtyManager
  ├→ ws-server에 직접 접근                   └→ emit("pty:data")
  ├→ CaptureManager 직접 호출
  └→ 다른 컴포넌트도 직접 호출              ws-server: on("pty:data") → WS 전파
                                          CaptureManager: on("pty:data") 가능
모든 곳이 서로 의존 (결합도 높음)           각자 독립적으로 동작 (결합도 낮음)
```

---

## 4. 세션 라이프사이클 (핵심 플로우)

DevFlow의 가장 중요한 플로우. 사용자가 노드에서 "세션 시작"을 누르면 일어나는 일 전체.

### 4.1 세션 시작 (session:start)

```
[사용자가 "세션 시작" 클릭]
            │
            ▼
[브라우저] WS로 메시지 전송
   { type: "session:start", payload: { nodeId, cols, rows } }
            │
            ▼
[ws-server] 메시지 수신
            │
            ├─ 1) SessionManager.startSession(nodeId)
            │      │
            │      ├─ DB: 이미 active 세션 있는지 확인 (있으면 에러)
            │      ├─ DB: Session 레코드 생성 (status: "active")
            │      ├─ StateMachine.transition(nodeId, "session_start")
            │      │      │
            │      │      ├─ DB 트랜잭션 시작
            │      │      ├─ Node.status 읽기 (예: "backlog")
            │      │      ├─ 전이 규칙 조회: backlog + session_start → in_progress
            │      │      ├─ Node.status = "in_progress"로 업데이트
            │      │      ├─ NodeStateLog 생성 (backlog → in_progress)
            │      │      ├─ DB 트랜잭션 커밋
            │      │      └─ eventBus.emit("node:stateChanged")
            │      │              └→ ws-server가 수신 → 모든 클라이언트에 전파
            │      │
            │      └─ eventBus.emit("session:started")
            │              └→ ws-server가 수신 → 클라이언트에 전파
            │
            ├─ 2) PtyManager.create(nodeId, sessionId, cols, rows)
            │      │
            │      ├─ node-pty로 쉘 프로세스 생성 (/bin/zsh)
            │      ├─ 30분 idle timeout 타이머 설정
            │      ├─ onData 리스너: eventBus.emit("pty:data")
            │      └─ onExit 리스너: eventBus.emit("pty:exit")
            │
            ├─ 3) CaptureManager.start(sessionId)
            │      └─ 2초 간격 flush 타이머 시작
            │
            └─ 4) FileWatcher.watch(projectDir, sessionId)
                   └─ chokidar로 프로젝트 디렉토리 감시 시작
```

### 4.2 세션 진행 중 (PTY I/O 루프)

```
[사용자 키보드 입력]
      │
      ▼
[xterm.js] → WS: { type: "pty:input", payload: { nodeId, data: "ls\r" } }
      │
      ▼
[ws-server] → PtyManager.write(nodeId, "ls\r")
      │
      ▼
[node-pty 프로세스] 명령 실행
      │
      ▼ (출력 발생)
[node-pty onData] → eventBus.emit("pty:data", { sessionId, data: "file1.txt\nfile2.txt" })
      │
      ├→ [ws-server] 수신 → WS로 전파: { type: "pty:data", payload: { nodeId, data } }
      │       │
      │       ▼
      │   [브라우저 WebSocketProvider] 수신
      │       │
      │       └→ ptyDataEmitter.emit(nodeId, data)  ← Zustand 우회! (성능 최적화)
      │              │
      │              └→ [xterm.js] terminal.write(data)  ← 화면에 출력
      │
      └→ [CaptureManager] .append(sessionId, data)
              │
              └→ 버퍼에 누적, 2초마다 또는 1MB 초과 시 파일로 flush
                    │
                    └→ .devflow-logs/{sessionId}.log 에 저장
```

### 4.3 세션 종료 (session:end)

```
[사용자가 "세션 종료" 클릭, markDone=true 선택]
            │
            ▼
[브라우저] WS 전송: { type: "session:end", payload: { nodeId, markDone: true } }
            │
            ▼
[ws-server]
            │
            ├─ 1) PtyManager.kill(nodeId)
            │      ├─ killed 플래그 설정 (이중 cleanup 방지)
            │      ├─ pty.kill() → 쉘 프로세스 종료
            │      └─ Map에서 제거
            │
            ├─ 2) FileWatcher.unwatch(sessionId)
            │      ├─ 남은 변경사항 flush
            │      └─ chokidar 워처 닫기
            │
            └─ 3) SessionManager.endSession(sessionId, markDone=true)
                   │
                   ├─ DB: Session.status = "completed"
                   ├─ DB: durationSeconds 계산 (누적)
                   │
                   ├─ StateMachine.transition(nodeId, "session_end_done")
                   │      │
                   │      ├─ 전이 규칙: in_progress + session_end_done → done
                   │      ├─ Node.status = "done"
                   │      ├─ NodeStateLog 생성
                   │      └─ emit("node:stateChanged")
                   │              └→ 캔버스에서 노드 색상이 초록색(done)으로 변경
                   │
                   └─ emit("session:ended")
                          └→ 클라이언트에서 터미널 패널 정리
```

### 4.4 세션 재개 (session:resume)

```
[사용자가 일시정지된 세션의 "재개" 클릭]
            │
            ▼
[브라우저] WS: { type: "session:resume", payload: { nodeId, sessionId } }
            │
            ▼
[ws-server]
            │
            ├─ 1) SessionManager.resumeSession(sessionId)
            │      ├─ 검증: 현재 status가 "paused"인지 확인
            │      ├─ DB: status = "active", resumeCount++, startedAt 리셋
            │      ├─ StateMachine.transition(nodeId, "session_resume")
            │      │      └→ todo → in_progress (또는 done → in_progress)
            │      └─ emit("session:resumed")
            │
            ├─ 2) PtyManager.create(nodeId, sessionId, cols, rows)
            │      └─ 새 PTY 프로세스 생성 (이전 터미널 내용은 유지 안 됨)
            │
            ├─ 3) CaptureManager.start(sessionId)
            │
            └─ 4) FileWatcher.watch(projectDir, sessionId)
```

### 4.5 PTY 비정상 종료 (pty:exit)

```
[PTY 프로세스가 자체적으로 종료] (exit, Ctrl+D, crash 등)
            │
            ▼
[PtyManager onExit] → eventBus.emit("pty:exit", { sessionId, exitCode })
            │
            ▼
[ws-server의 pty:exit 핸들러]
            │
            ├─ CaptureManager.stop(sessionId)     ← 남은 버퍼 flush
            ├─ FileWatcher.unwatch(sessionId)      ← 파일 감시 중단
            ├─ 클라이언트에 전파 (needsPrompt: true) ← "완료/일시정지?" 프롬프트 표시
            └─ SessionManager.endSession(sessionId, false)  ← 일단 "일시정지"로 처리
                   └─ 사용자가 프롬프트에서 "완료"를 선택하면 REST API로 done 처리
```

---

## 5. 상태 머신 (State Machine)

### 5.1 이원 트랙 (Dual-Track) 설계

```
┌──────────────────────────────────────────────┐
│                 State Machine                │
│                                              │
│  ┌──────────┐              ┌──────────────┐  │
│  │ Track A  │              │   Track B    │  │
│  │ (자동)    │              │   (수동)     │  │
│  │          │              │              │  │
│  │ 세션 이벤 │              │ 사용자가 UI  │  │
│  │ 트에 의해 │              │ 에서 직접    │  │
│  │ 자동 전이 │              │ 상태를 변경  │  │
│  │          │              │              │  │
│  │ 규칙 기반 │              │ 제한 없음    │  │
│  │ (정해진   │              │ (아무 상태로 │  │
│  │  전이만)  │              │  든 변경 OK) │  │
│  └──────────┘              └──────────────┘  │
└──────────────────────────────────────────────┘
```

### 5.2 Track A 전이 규칙 (자동)

```
                    session_start
         ┌──────── backlog ────────────┐
         │                             │
         │         session_start       ▼
         │  ┌───── todo ──────────► in_progress
         │  │      ▲  ▲                │  │
         │  │      │  │                │  │
         │  │      │  │ session_resume │  │ session_end_done
         │  │      │  │                │  │
         │  │      │  └──── done ◄─────┘  │
         │  │      │                      │
         │  │      │   session_end_pause  │
         │  │      └──────────────────────┘
         │  │
         │  │  session_resume
         │  └──────────────────────────────
         │
         │      (archived는 Track A에서 전이 없음)
```

**읽는 법**: 화살표 방향이 전이 방향. 예) `todo` 상태에서 `session_start` 이벤트가 발생하면 → `in_progress`로 전이.

### 5.3 트랜잭션 보장

StateMachine은 **Prisma 인터랙티브 트랜잭션**으로 동작:

```
prisma.$transaction(async (tx) => {
  1. tx.node.findUnique()       ← 현재 상태 읽기
  2. 전이 규칙 검증              ← 전이 가능한지 확인
  3. tx.node.update()           ← 상태 업데이트
  4. tx.nodeStateLog.create()   ← 이력 기록
})
// 트랜잭션 밖에서:
5. eventBus.emit()              ← 이벤트 발행
```

**왜 트랜잭션이 중요한가?**
- 1~4가 원자적으로 실행되므로, 동시에 두 세션이 같은 노드를 변경하려 해도 하나만 성공
- 이벤트 발행은 트랜잭션 밖에서 → DB가 롤백되면 이벤트가 발행되지 않음

---

## 6. PTY 데이터 경로 (터미널 I/O)

터미널 데이터는 **초당 수백~수천 번** 전달될 수 있으므로, 성능이 가장 중요한 경로.

### 6.1 서버 측 경로

```
[node-pty 프로세스]
       │ onData (문자열)
       ▼
[PtyManager]
       │ eventBus.emit("pty:data", { sessionId, data })
       ▼
[ws-server의 pty:data 리스너]
       │
       ├─ broadcastToNodeAndGlobal(nodeId, { type: "pty:data", ... })
       │       └→ JSON.stringify → ws.send()
       │
       └─ captureManager.append(sessionId, data)
               └→ 메모리 버퍼에 누적 (즉시 디스크에 쓰지 않음)
```

### 6.2 클라이언트 측 경로 (핵심!)

```
[WebSocket onmessage]
       │ msg.type === "pty:data"
       ▼
[WebSocketProvider]
       │ ptyDataEmitter.emit(nodeId, data)    ← ★ Zustand를 거치지 않음!
       ▼
[PTYDataEmitter] (커스텀 EventEmitter)
       │ listeners.get(nodeId) → forEach(fn => fn(data))
       ▼
[TerminalPanel의 useEffect 리스너]
       │ ptyDataEmitter.on(nodeId, handler)
       ▼
[xterm.js] terminal.write(data)              ← 화면에 바로 출력
```

**왜 Zustand를 우회하는가?**

```
[Zustand를 사용한다면]
WS 수신 → set({ ptyData }) → React 리렌더 → xterm.write()
   문제: set()마다 React 상태 업데이트 → 초당 수백 번 리렌더 → 성능 재앙

[현재 방식: ptyDataEmitter 직접 전달]
WS 수신 → ptyDataEmitter.emit() → xterm.write()
   장점: React 렌더 사이클을 완전히 우회 → 네이티브 수준의 터미널 성능
```

### 6.3 PTYDataEmitter 내부 구조

```typescript
// 매우 단순한 구조 — nodeId별로 리스너를 관리
class PTYDataEmitter {
  listeners: Map<string, Set<Listener>>    // nodeId → 리스너 집합

  on(nodeId, listener)     // TerminalPanel 마운트 시 등록
  off(nodeId, listener)    // TerminalPanel 언마운트 시 해제
  emit(nodeId, data)       // WebSocketProvider에서 호출 → 리스너 직접 실행
}
```

---

## 7. 파일 감시 & 변경 추적

세션 진행 중 프로젝트 디렉토리의 파일 변경을 감지하여 DB에 기록하는 플로우.

```
[사용자가 코드 편집 → 파일 저장]
            │
            ▼
[chokidar (OS 레벨 파일 시스템 이벤트)]
            │ add / change / unlink 이벤트
            ▼
[FileWatcher.handleChange()]
            │
            ├─ 상대 경로 계산 (projectDir 기준)
            ├─ changeBuffer에 추가
            └─ debounce 타이머 리셋 (300ms)
                   │
                   │ 300ms 동안 추가 변경 없으면
                   ▼
            [FileWatcher.flushChanges()]
                   │
                   ├─ DB: SessionFile 벌크 인서트 (변경 파일 목록 저장)
                   ├─ DB: Session.fileChangeCount += N (변경 횟수 누적)
                   │
                   └─ 각 변경에 대해 eventBus.emit("file:changed")
                          │
                          ▼
                   [ws-server의 file:changed 리스너]
                          │
                          ├─ DB에서 최신 fileChangeCount 조회
                          └─ WS 전파: { type: "node:fileCountUpdated", count }
                                 │
                                 ▼
                          [클라이언트 canvas-store]
                            updateNodeData(nodeId, { fileChangeCount })
                            └→ 캔버스 노드에 파일 변경 수 표시 업데이트
```

### 감시 제외 패턴
```
node_modules/  .git/  dist/  build/  .next/
.devflow-logs/  *.db  *.db-shm  *.db-wal  .DS_Store
```

### debounce 동작
```
파일A 변경 ──┐
             │ 300ms 이내
파일B 변경 ──┼──┐
             │  │ 300ms 이내
파일C 변경 ──┼──┼──┐
             │  │  │ 300ms 경과 (더 이상 변경 없음)
             │  │  │
             ▼  ▼  ▼
         flushChanges() ← A, B, C 3개를 한꺼번에 처리
```

---

## 8. 캔버스 Undo/Redo & API 동기화

캔버스에서 노드/엣지를 조작할 때의 데이터 동기화 방식.

### 8.1 스냅샷 기반 Undo/Redo

```
[조작 전]                [조작 시]                 [Undo 시]
                        pushSnapshot()
undoStack: []           undoStack: [S0]            undoStack: []
redoStack: []           redoStack: []   (클리어)   redoStack: [S1]
현재: S0                현재: S1 (변경됨)          현재: S0 (복원)
```

### 8.2 reconcileWithAPI - Undo/Redo 후 DB 동기화

Undo/Redo로 캔버스 상태를 복원한 후, **이전 상태와 복원 상태의 diff를 계산**하여 API 호출:

```
[Undo 실행]
      │
      ├─ 1) 로컬 상태 즉시 복원 (React 리렌더 → 사용자에게 바로 보임)
      │
      └─ 2) reconcileWithAPI(이전상태, 복원상태) 비동기 실행
              │
              ├─ 이전에 있었는데 복원 후 없는 노드들 → DELETE /api/nodes/:id
              ├─ 이전에 없었는데 복원 후 나타난 노드들 → PUT /api/nodes/:id (unarchive)
              ├─ 이전에 있었는데 복원 후 없는 엣지들 → DELETE /api/edges/:id
              ├─ 이전에 없었는데 복원 후 나타난 엣지들 → POST /api/edges
              └─ 위치가 변경된 노드들 → PUT /api/nodes/positions

              모든 API 호출은 Promise.allSettled()로 병렬 처리
              (일부 실패해도 나머지는 계속 진행)
```

### 8.3 Optimistic Update 패턴 (엣지 연결 예시)

```
[사용자가 노드 A에서 노드 B로 드래그하여 연결]
      │
      ├─ 1) pushSnapshot()           ← Undo를 위해 현재 상태 저장
      ├─ 2) 로컬에 엣지 즉시 추가     ← 사용자에게 바로 보임 (낙관적 업데이트)
      ├─ 3) POST /api/edges 호출      ← 서버에 저장 요청 (비동기)
      │       │
      │       ├─ 성공: 서버에서 받은 ID로 엣지 업데이트
      │       └─ 실패: console.error (현재는 롤백 안 함)
      └─ (완료)

 ※ "낙관적 업데이트"란: 서버 응답을 기다리지 않고 먼저 UI에 반영하는 패턴.
    네트워크 지연에도 즉각적인 반응을 보여줌.
```

---

## 9. 클라이언트 상태 관리 (4 Stores)

### 9.1 Store 간 관계와 데이터 흐름

```
                         ┌─────────────────┐
                         │   ui-store      │
                         │                 │
                         │ - sidebarOpen   │
                         │ - activeTab     │     독립적. 다른 store 참조 없음.
                         │ - panelMode     │     순수 UI 레이아웃 상태.
                         │ - terminalHeight│
                         └─────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ┌─────────────────┐        getState()         ┌──────────────┐ │
│  │  node-store     │ ─────────────────────────→ │ canvas-store │ │
│  │                 │                            │              │ │
│  │ - selectedNode  │  updateNodeData()          │ - nodes[]    │ │
│  │ - sessions[]    │ ─────────────────────────→ │ - edges[]    │ │
│  │ - decisions[]   │  addNode(), setEdges()     │ - undo/redo  │ │
│  │                 │ ─────────────────────────→ │              │ │
│  └────────┬────────┘                            └──────────────┘ │
│           │                                            ▲         │
│           │                                            │         │
│           │                                  WS에서 직접 호출:   │
│           │                                  updateNodeData()    │
│           │                                            │         │
│  ┌────────┴────────┐                         ┌─────────┴───────┐│
│  │  REST API       │                         │ WebSocket       ││
│  │  (fetch)        │                         │ Provider        ││
│  └─────────────────┘                         └─────────────────┘│
│                                                                  │
│  ┌─────────────────┐                                             │
│  │ session-store   │     독립적이지만 WebSocketProvider가        │
│  │                 │     handleSessionStarted/Ended를 직접 호출  │
│  │ - activeSession │                                             │
│  │ - sessionLog    │                                             │
│  └─────────────────┘                                             │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 Store별 업데이트 트리거

```
canvas-store 업데이트 경로:
  ① 사용자 조작 → onNodesChange/onEdgesChange (ReactFlow 내부)
  ② WS 수신 → node:stateChanged → updateNodeData()
  ③ WS 수신 → node:fileCountUpdated → updateNodeData()
  ④ node-store → promoteDecision(), addSubIssue() → addNode(), setEdges()
  ⑤ 사용자 → Undo/Redo → 스냅샷 복원

node-store 업데이트 경로:
  ① 사용자가 노드 클릭 → selectNode() → 3개 API 병렬 호출
  ② 사용자가 상태 변경 → updateNodeStatus() → REST API + canvas-store 동기화
  ③ 사용자가 결정 추가/삭제/프로모트 → REST API + 로컬 상태 업데이트

session-store 업데이트 경로:
  ① 사용자가 세션 시작/종료/재개 → REST API
  ② WS 수신 → handleSessionStarted() / handleSessionEnded()

ui-store 업데이트 경로:
  ① 사용자 상호작용만 (클릭, 키보드 단축키)
```

---

## 10. WebSocket 통신 프로토콜

### 10.1 연결 유형

```
브라우저 ──WS 연결──→ ws://localhost:3001/ws
                      (nodeId 파라미터 없음 = "글로벌 클라이언트")

브라우저 ──WS 연결──→ ws://localhost:3001/ws?nodeId=xxx
                      (nodeId 파라미터 있음 = "노드 전용 클라이언트")
```

현재 구현에서는 **글로벌 클라이언트**만 사용 (WebSocketProvider가 nodeId 없이 연결).

### 10.2 메시지 프로토콜

```
[클라이언트 → 서버]                   [서버 → 클라이언트]
─────────────────────                ─────────────────────
pty:input     키보드 입력             pty:data      터미널 출력
pty:resize    터미널 크기 변경         pty:exit      PTY 종료
session:start 세션 시작 요청          session:started  세션 시작됨
session:end   세션 종료 요청          session:ended    세션 종료됨
session:resume 세션 재개 요청         session:resumed  세션 재개됨
ping          연결 확인               node:stateChanged  노드 상태 변경
                                     node:fileCountUpdated 파일 변경 수
                                     heartbeat     30초 간격 생존 신호
                                     error         에러 응답
```

### 10.3 메시지 구조

```json
// 클라이언트 → 서버 (모든 메시지)
{
  "type": "session:start",
  "payload": {
    "nodeId": "clxx...",
    "cols": 120,
    "rows": 30,
    "title": "버그 수정",
    "cwd": "/path/to/project"
  }
}

// 서버 → 클라이언트 (모든 메시지)
{
  "type": "node:stateChanged",
  "payload": {
    "nodeId": "clxx...",
    "fromStatus": "backlog",
    "toStatus": "in_progress",
    "triggerType": "session_start"
  },
  "timestamp": "2026-03-06T12:00:00.000Z"
}
```

### 10.4 재연결 메커니즘

```
[연결 끊김 감지]
      │
      ▼
[onclose 핸들러]
      │ intentionalClose 인가? → Yes → 재연결 안 함
      │                        → No  ↓
      ▼
[지수 백오프 재연결]
      │
      │  1차 시도: 1초 후     (1000 * 2^0)
      │  2차 시도: 2초 후     (1000 * 2^1)
      │  3차 시도: 4초 후     (1000 * 2^2)
      │  ...
      │  최대: 30초 후        (cap)
      │
      ▼
[연결 성공]
      │
      ├─ reconnectAttempts = 0 (리셋)
      │
      └─ 재연결인 경우 → canvas 데이터 다시 로드
            (loadCanvas로 서버와 동기화)
```

---

## 11. 서버 시작 & 종료 시퀀스

### 11.1 시작 시퀀스

```
[npm run dev 실행]
      │
      ├─ Next.js dev server 시작 (port 3000)
      │
      └─ tsx watch server/ws-server.ts 시작 (port 3001)
              │
              ├─ 1) initDevflowDir()
              │      └→ ~/.devflow/ 디렉토리 생성
              │
              ├─ 2) checkCLIAvailable()
              │      └→ Claude CLI 설치 여부 확인 (비동기)
              │
              ├─ 3) RecoveryManager.recoverStaleSessions()
              │      │
              │      ├─ DB에서 status="active"인 세션 조회
              │      ├─ 각 세션: status → "paused"로 변경
              │      ├─ 해당 노드: "in_progress" → "todo"로 되돌림
              │      └─ NodeStateLog에 "recovery" 기록
              │
              ├─ 4) EventBus 리스너 등록
              │      └→ pty:data, pty:exit, session:*, node:*, file:*, plan:*
              │
              ├─ 5) WebSocketServer 생성 (0.0.0.0:3001)
              │
              └─ 6) 30초 간격 heartbeat 시작
```

### 11.2 종료 시퀀스 (Graceful Shutdown)

```
[SIGINT 또는 SIGTERM 수신] (Ctrl+C)
      │
      ▼
[shutdown()]
      │
      ├─ 1) heartbeat 타이머 정리
      │
      ├─ 2) 활성 세션 정리 (for each)
      │      ├─ PtyManager.kill(nodeId)      ← PTY 프로세스 종료
      │      ├─ FileWatcher.unwatch(sessionId) ← 파일 감시 중단
      │      └─ SessionManager.endSession(sessionId, false)
      │             └→ DB: status="paused", 다음 시작 시 복구 가능
      │
      ├─ 3) CaptureManager.dispose()   ← 모든 버퍼 flush + 타이머 정리
      ├─ 4) FileWatcher.dispose()      ← 모든 워처 닫기
      ├─ 5) PtyManager.dispose()       ← 남은 PTY 종료
      ├─ 6) EventBus.removeAllListeners()
      │
      ├─ 7) wss.close()               ← WS 서버 닫기
      │
      └─ 8) 500ms 후 process.exit(0)  ← 진행 중 I/O 완료 대기
```

---

## 12. 주요 데이터 모델 관계

### 12.1 엔티티 관계

```
Project (프로젝트)
│
│  1:N
├──→ Node (노드 = 캔버스의 카드 하나)
│       │
│       │  1:N
│       ├──→ Session (작업 세션)
│       │       │
│       │       │  1:N
│       │       ├──→ SessionFile (세션 중 변경된 파일)
│       │       │
│       │       │  1:N
│       │       └──→ Decision (세션 중 내린 결정)
│       │
│       │  1:N
│       ├──→ Decision (노드에 직접 연결된 결정)
│       │
│       │  1:N
│       ├──→ NodeStateLog (상태 변경 이력)
│       │       ex) backlog → in_progress (session_start)
│       │
│       │  1:N
│       ├──→ Plan (AI 생성 계획서)
│       │
│       │  self-reference
│       └──→ Node (하위 이슈: parentNodeId)
│
│  N:M (Edge 테이블로 표현)
└──→ Edge (노드 간 연결선)
        from: Node ──→ to: Node
        type: sequence | dependency | related | regression | branch
```

### 12.2 세션 로그 저장 방식

```
[DB에 저장되는 것]                    [파일로 저장되는 것]
─────────────────────                ──────────────────────
Session 테이블:                      .devflow-logs/{sessionId}.log:
 - id, nodeId, status               - PTY 출력 전체 텍스트
 - startedAt, endedAt               - ANSI 이스케이프 제거됨
 - durationSeconds                  - [timestamp] [role] content 형식
 - fileChangeCount                  - role: user|assistant|system
 - resumeCount                        (휴리스틱 분류)

SessionFile 테이블:
 - filePath (상대경로)
 - changeType (created|modified|deleted)
 - detectedAt
```

---

## 부록: 자주 묻는 질문

### Q: Next.js API와 WebSocket은 왜 분리되어 있나?
- **Next.js**는 HTTP 요청-응답 패턴에 최적화. 양방향 실시간 통신(WS) 지원이 제한적
- **PTY(터미널)**는 지속적인 양방향 스트리밍 필요 → WebSocket이 필수
- 두 서버가 같은 DB를 공유하므로 데이터는 항상 일관됨

### Q: 두 서버가 같은 SQLite를 쓰면 충돌 안 나나?
- SQLite **WAL(Write-Ahead Logging)** 모드 사용 → 읽기는 동시, 쓰기는 순차
- `busy_timeout=5000` 설정 → 쓰기 잠금 대기 최대 5초
- 로컬 개발 환경에서는 충분하지만, **Supabase(PostgreSQL)로 이관하면 이 제약이 사라짐**

### Q: PTY 데이터가 왜 Zustand를 안 거치나?
- PTY 출력은 초당 수백~수천 번 발생 가능 (빌드 로그, 대량 출력 등)
- Zustand `set()` → React 리렌더 트리거 → 초당 수백 번 리렌더는 성능 재앙
- `ptyDataEmitter`로 React를 완전히 우회하여 xterm.js에 직접 전달

### Q: Undo/Redo가 어떻게 서버와 동기화되나?
- **즉시**: 로컬 스냅샷 복원 (사용자에게 바로 보임)
- **비동기**: diff 계산 → API 호출로 DB 동기화 (노드 삭제/복원, 엣지 재생성, 위치 업데이트)
- 실패해도 로컬 상태는 유지됨 (다음 새로고침 시 DB 기준으로 복원)

### Q: 서버가 죽으면 세션 데이터는 어떻게 되나?
- PTY 프로세스와 메모리 데이터는 소실
- DB에 저장된 세션은 "active" 상태로 남음
- **다음 서버 시작 시** RecoveryManager가 자동으로 → "paused" 처리 + 노드 → "todo" 복구
- 사용자가 나중에 "재개"하면 새 PTY로 이어서 작업 가능
