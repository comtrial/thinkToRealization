# TTR 연동 — Commerce Intel Agent 작업 관리

> 이 섹션을 Commerce Intel Agent 프로젝트의 CLAUDE.md에 붙여넣으세요.
> Claude CLI가 작업 완료/진행 상태를 TTR 대시보드에 자동 반영합니다.

---

## TTR 연동 (작업 관리 — CRITICAL)

이 프로젝트의 작업은 TTR(thinkToRealization)에서 관리됩니다.
MCP 도구 `ttr_*`를 사용하여 작업 상태를 관리하세요.

- **TTR 프로젝트 ID**: `cmmzoycyr0008czjq0w0xzu3j`
- **TTR URL**: https://think-to-realization.vercel.app

### 작업 상태 관리 규칙

1. **작업 시작 시**: `ttr_update_status(nodeId, "in_progress")` 호출
2. **작업 완료 시**: `ttr_update_status(nodeId, "done")` + `ttr_add_comment`로 완료 내용 기록
3. **중요한 기술 결정 시**: `ttr_add_decision`으로 기록 (예: "Haiku 대신 Sonnet 사용 결정")
4. **진행 상황 확인**: `ttr_get_dashboard("cmmzoycyr0008czjq0w0xzu3j")`

### 노드 ID 매핑

#### Phase 1 — E2E 한 줄 완성
| 순서 | 제목 | Node ID |
|------|------|---------|
| P1 | E2E 한 줄 완성 (Phase 마일스톤) | `cmmzp73jy000cczjqunhdyey7` |
| P1.D1 | Day 1: 인프라 + 데이터 + 정규화 | `cmmzp74gz000iczjq05dtnyx2` |
| #01 | 프로젝트 초기화 + DB 스키마 | `cmmzp76ij000wczjqjr1o48vx` |
| #02 | 더미 데이터 생성 + 시딩 | `cmmzp76r7000yczjqwhlcb2xo` |
| #03 | Claude API 래퍼 + 비용 추적 | `cmmzp76zs0010czjqklzmasw8` |
| #04 | Normalizer Agent + /normalize API | `cmmzp77870012czjqm57p98ly` |
| #05 | 대시보드 골격 (빈 프레임) | `cmmzp77j90014czjqcolhorat` |
| P1.D2 | Day 2: 분류 체인 + 첫 Eval | `cmmzp74rs000kczjqg3jumbar` |
| #06 | ChromaDB + Dense 인덱스 빌드 | `cmmzp77ul0016czjqrvkv6v5z` |
| #07 | Classifier Agent (Dense-only) + 순차 체인 | `cmmzp78600018czjqq31opk36` |
| #08 | Eval v1 (Code-based) + 첫 대시보드 데이터 | `cmmzp78i8001aczjqq52ucrap` |
| P1.D3 | Day 3: Analyst Tool Use + 마켓 펄스 E2E | `cmmzp750g000mczjqlq20gql4` |
| #09 | 시계열 엔진 v1 (기본 변동률) | `cmmzp78sq001cczjqtv5745bi` |
| #10 | Tool 3개 구현 + Registry | `cmmzp7913001eczjq4iigs7ld` |
| #11 | Analyst Agent (Sonnet + Tool Use 멀티턴) | `cmmzp79cj001gczjq4vpogmj2` |
| #12 | /api/v1/signal (마켓 펄스) E2E 엔드포인트 | `cmmzp79o9001iczjqvpa46ha4` |
| #13 | 대시보드: 비용 추적 섹션 추가 | `cmmzp79zb001kczjq27dfku8f` |

#### Phase 2 — 고도화 대입
| 순서 | 제목 | Node ID |
|------|------|---------|
| P2 | 고도화 대입 (Phase 마일스톤) | `cmmzp73yc000eczjqcsrqfqsj` |
| P2.D4 | Day 4: Hybrid RAG + Supply-Demand Matrix | `cmmzp75bu000oczjqk3e8fzbh` |
| #14 | BM25 + RRF 추가 → Classifier v2 | `cmmzp7acy001mczjqgdwftl5e` |
| #15 | Eval v1 vs v2 비교 → 대시보드 두 번째 포인트 | `cmmzp7alc001oczjqlfw9mizy` |
| #16 | Z-score 이상 탐지 + Supply-Demand Matrix | `cmmzp7atu001qczjqovr1dzj9` |
| #17 | detect_anomalies 도구 추가 → Analyst v2 | `cmmzp7b38001sczjqog932d1a` |
| P2.D5 | Day 5: Eval-Optimize Loop | `cmmzp75kc000qczjqnw18bkc7` |
| #18 | Model-graded Eval + Feature Impact Score | `cmmzp7bf4001uczjq2ebuirdj` |
| #19 | Evaluator + Optimizer + 자동 최적화 1사이클 | `cmmzp7bpy001wczjq5a7bhrh8` |
| #20 | 대시보드: 변경 이력 + 카테고리 히트맵 | `cmmzp7c41001yczjqhyriz8p9` |
| P2.D6 | Day 6: (선택) 추가 기능 또는 Layer 2 Eval | `cmmzp75vs000sczjqb3pgrdx6` |
| #21 | (선택A) 경쟁 포지셔닝 기능 | `cmmzp7cfl0020czjq7hywcql2` |
| #22 | (선택B) Layer 2 Eval (마켓 펄스 품질 채점) | `cmmzp7cr60022czjq9fsf0iiq` |

#### Phase 3 — 폴리싱
| 순서 | 제목 | Node ID |
|------|------|---------|
| P3 | 폴리싱 (Phase 마일스톤) | `cmmzp747f000gczjq3k410tzw` |
| P3.D7 | Day 7-8: Docker + 테스트 + README + ADR | `cmmzp768x000uczjquz00ra6t` |
| #23 | Docker Compose + 클린 환경 구동 테스트 | `cmmzp7d280024czjqxgsjxciz` |
| #24 | pytest 핵심 테스트 | `cmmzp7dd90026czjqssb2pz4v` |
| #25 | README + ADR + 대시보드 스크린샷 + GitHub push | `cmmzp7dm30028czjqbij4azla` |

### TTR MCP 도구 요약

```
ttr_list_projects()                          — 프로젝트 목록
ttr_get_dashboard(projectId)                 — 대시보드 (진행률)
ttr_list_nodes(projectId, status?)           — 노드 목록
ttr_get_node(nodeId)                         — 노드 상세
ttr_update_status(nodeId, status)            — 상태 변경
ttr_update_node(nodeId, title?, description?, priority?) — 수정
ttr_add_comment(nodeId, content)             — 코멘트 추가
ttr_add_decision(nodeId, content)            — 결정 기록
```

### MCP 활성화 확인

CLI에서 `/mcp` 입력 → `ttr` 서버가 보이면 사용 가능.
안 보이면 프로젝트 루트에 `.mcp.json` 추가:
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
