# TTR MCP 연동 가이드

> 이 파일을 작업 중인 프로젝트의 CLAUDE.md에 복사하거나 참조하면,
> Claude CLI가 TTR(thinkToRealization) 대시보드의 노드를 자동으로 관리할 수 있습니다.

---

## 활성화 방법

### 새 CLI 세션
`~/.claude/.mcp.json`에 이미 등록되어 있으므로, 새 세션을 열면 자동으로 `ttr_*` 도구가 사용 가능합니다.

### 이미 실행 중인 CLI 세션
CLI 프롬프트에서 `/mcp` 입력 → ttr 서버가 보이면 이미 활성화됨.
안 보이면 CLI를 재시작하거나, 해당 프로젝트 루트에 `.mcp.json`을 추가:

```json
{
  "mcpServers": {
    "ttr": {
      "command": "npx",
      "args": ["tsx", "/Users/choeseung-won/personal-project/thinkToRealization/mcp-server/src/index.ts"],
      "cwd": "/Users/choeseung-won/personal-project/thinkToRealization/mcp-server"
    }
  }
}
```

---

## 사용 가능한 도구 8개

| 도구 | 용도 | 예시 |
|------|------|------|
| `ttr_list_projects` | 프로젝트 목록 | "TTR 프로젝트 목록 보여줘" |
| `ttr_get_dashboard` | 대시보드 요약 (진행률) | "Commerce Intel 진행 상황은?" |
| `ttr_list_nodes` | 노드 목록 (상태 필터) | "진행중인 노드만 보여줘" |
| `ttr_get_node` | 노드 상세 (설명, 결정, 엣지) | "Step 3 상세 내용 보여줘" |
| `ttr_update_status` | 상태 변경 | "Step 1 done으로 바꿔" |
| `ttr_update_node` | 제목/설명/우선순위 수정 | "Step 2 설명 업데이트해줘" |
| `ttr_add_comment` | 진행 코멘트 추가 | "Step 1에 완료 코멘트 남겨" |
| `ttr_add_decision` | 결정 사항 기록 | "Haiku 대신 Sonnet 쓰기로 결정 기록" |

---

## CLAUDE.md에 넣을 내용 (복사해서 사용)

아래를 작업 중인 프로젝트의 CLAUDE.md에 추가하세요:

```markdown
## TTR 연동 (작업 관리)

이 프로젝트의 작업은 TTR(thinkToRealization)에서 관리됩니다.
TTR MCP 도구(`ttr_*`)를 사용하여 작업 상태를 업데이트하세요.

### 프로젝트 정보
- **TTR 프로젝트 ID**: {PROJECT_ID}
- **TTR URL**: https://think-to-realization.vercel.app

### 작업 흐름
1. 작업 시작 시: `ttr_update_status(nodeId, "in_progress")` 호출
2. 작업 완료 시: `ttr_update_status(nodeId, "done")` + `ttr_add_comment`로 완료 내용 기록
3. 중요한 결정 시: `ttr_add_decision`으로 기록
4. 진행 상황 확인: `ttr_get_dashboard`로 전체 현황 파악

### 노드 ID 매핑
| 순서 | 제목 | Node ID |
|------|------|---------|
| ... | ... | ... |
```

---

## 주의사항

- **인증**: `~/.ttr-mcp/.env`에 TTR 로그인 정보가 있어야 합니다
- **자동 재인증**: 쿠키 만료 시 자동으로 재로그인합니다
- **assignee**: `in_progress`/`done` 상태 변경 시 담당자가 없으면 자동으로 현재 유저를 할당합니다
- **에러**: API 에러 시 명확한 메시지가 반환됩니다 (노드 없음, 인증 실패 등)
