# TTR MCP Server — 팀원 셋업 가이드

Think-to-Realization(TTR) 프로젝트를 Claude Code / Claude Desktop CLI에서 직접 조작하기 위한 MCP 서버입니다.
**배포된 서비스**(`https://think-to-realization.vercel.app`)의 API를 호출하기 때문에, 이 MCP 서버를 각자 로컬에 붙이기만 하면 같은 프로젝트에 여러 사람이 CLI로 협업할 수 있습니다.

---

## 동작 구조 한눈에

```
[팀원 A의 Claude Code] ─┐
[팀원 B의 Claude Code] ─┼─► 로컬 stdio MCP 서버 (이 디렉토리)
[팀원 C의 Claude Code] ─┘        │
                                  ▼
                   https://think-to-realization.vercel.app
                                  │
                                  ▼
                         Postgres (source=cli, sourceSession=...)
```

- MCP 서버는 **각자 자기 머신에서 실행**됩니다 (별도 서버 불필요).
- 인증은 TTR 웹 로그인 계정 (이메일/비밀번호) 을 그대로 사용합니다.
- 쿠키는 `~/.ttr-mcp/session.json` 에 캐시되고 6일 후 자동 재로그인합니다.

---

## 사전 요구사항

| 항목 | 최소 버전 |
|---|---|
| Node.js | 20+ |
| npm | 10+ |
| Claude Code **또는** Claude Desktop | 최신 |
| TTR 계정 | 프로젝트에 초대된 이메일/비밀번호 |

> TTR 계정이 없다면 관리자에게 `think-to-realization.vercel.app` 에서 초대를 요청하세요.

---

## 셋업 (5분)

### 1. 레포 클론 & 의존성 설치

```bash
git clone https://github.com/comtrial/thinktorealization.git
cd thinktorealization/mcp-server
npm install
```

> 루트의 Next.js 앱은 설치하지 않아도 됩니다. MCP 서버는 `mcp-server/` 디렉토리만으로 동작합니다.

### 2. 자격 증명 파일 생성

`~/.ttr-mcp/.env` 파일을 만들고 본인 TTR 계정 정보를 넣습니다.

```bash
mkdir -p ~/.ttr-mcp
cat > ~/.ttr-mcp/.env <<'EOF'
TTR_BASE_URL=https://think-to-realization.vercel.app
TTR_EMAIL=your-email@example.com
TTR_PASSWORD=your-password
EOF
chmod 600 ~/.ttr-mcp/.env
```

> ⚠️ 이 파일은 절대 커밋하지 마세요. `~/.ttr-mcp/` 는 홈 디렉토리 바깥 경로입니다.

### 3. 동작 확인

```bash
npm start
```

"Login failed" 없이 그냥 대기 상태로 멈춰 있으면 정상입니다 (stdio 서버라 입력을 기다리는 중). `Ctrl+C`로 종료하세요.

### 4. Claude Code / Desktop 에 등록

레포의 **절대 경로**를 확인해두세요. 예: `/Users/alice/work/thinktorealization/mcp-server`

#### Claude Code (CLI) 사용 시

```bash
claude mcp add ttr \
  --scope user \
  -- npx tsx /ABSOLUTE/PATH/TO/thinktorealization/mcp-server/src/index.ts
```

등록 확인:

```bash
claude mcp list
# ttr  ✓ connected
```

#### Claude Desktop 사용 시

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) 또는
`%APPDATA%\Claude\claude_desktop_config.json` (Windows) 에 추가:

```json
{
  "mcpServers": {
    "ttr": {
      "command": "npx",
      "args": [
        "tsx",
        "/ABSOLUTE/PATH/TO/thinktorealization/mcp-server/src/index.ts"
      ]
    }
  }
}
```

저장 후 Claude Desktop을 **완전히 종료 후 재실행**해야 적용됩니다.

### 5. 첫 호출 해보기

Claude Code에서 아무 프로젝트나 열고:

```
TTR 프로젝트 목록 보여줘
```

Claude가 `ttr_list_projects` 도구를 호출하면 성공입니다.

---

## 사용 패턴 (권장)

### 세션 시작 시 한 줄

```
ttr 세션 이름을 "Frontend Dev CLI"로 설정해줘
```

→ 이후 모든 상태 변경·코멘트에 `sourceSession=Frontend Dev CLI` 로 기록되어,
  **웹에서 누가/어떤 CLI로 한 작업인지 필터링** 할 수 있습니다.

### 일반적인 흐름

```
"상위/하위 이슈 영향도 확인해" → ttr_get_node 자동 호출
"Step 1 끝났어"              → ttr_update_status(nodeId, "done")
"진행 상황 요약"              → ttr_get_dashboard
"새 기능 노드 만들어줘"         → ttr_create_node (+ 엣지)
```

전체 도구 목록은 레포 루트 `README.md` 또는 `mcp-server/src/server.ts` 참고.

---

## 다중 계정 / 계정 전환

기본은 `~/.ttr-mcp/.env` 의 계정이지만 한 세션 내에서 전환 가능:

```
ttr_login 으로 bob@example.com 계정으로 바꿔줘
```

→ 이후 호출은 Bob 계정 권한/담당자로 처리됩니다.

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Login failed (401)` | `.env` 의 이메일/비밀번호 재확인. 웹에서 로그인 가능한지 먼저 확인. |
| `TTR_EMAIL and TTR_PASSWORD must be set` | `~/.ttr-mcp/.env` 경로 / 파일명 오타 확인. |
| Claude Code 에서 `ttr` 가 `connected` 안 됨 | 1) `tsx` 글로벌 설치 불필요, `npx tsx` 로 충분. 2) 경로가 **절대 경로** 인지 확인. 3) `cd mcp-server && npm install` 했는지 확인. |
| 쿠키가 계속 만료됨 | `rm ~/.ttr-mcp/session.json` 후 재시도. |
| Claude Desktop 등록 후 아무 반응 없음 | Desktop을 **완전히** quit → 재실행. `~/Library/Logs/Claude/mcp*.log` 확인. |

---

## 업데이트

```bash
cd thinktorealization
git pull
cd mcp-server && npm install
```

Claude Code/Desktop 재시작이면 적용 완료. 등록 경로가 바뀐 게 아니면 재등록 불필요합니다.

---

## 보안 메모

- `.env` 는 `chmod 600`, `~/.ttr-mcp/` 권장 위치 외에 두지 않기.
- 로그아웃하려면 `~/.ttr-mcp/session.json` 삭제.
- 레포를 자기 포크로 clone 해도 무관 — API URL만 `TTR_BASE_URL` 로 맞으면 됩니다.
