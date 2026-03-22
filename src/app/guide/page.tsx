'use client'

import { useState } from 'react'
import { Check, Copy, Terminal, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function CopyBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#F5F5F3] border-b border-border">
        <span className="text-xs font-medium text-text-secondary">{label}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-white border border-border hover:bg-surface-hover transition-colors"
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <pre className="p-4 text-xs leading-relaxed overflow-x-auto bg-white text-text-primary whitespace-pre-wrap break-words">{content}</pre>
    </div>
  )
}

const MCP_JSON = `{
  "mcpServers": {
    "ttr": {
      "command": "npx",
      "args": ["tsx", "/Users/choeseung-won/personal-project/thinkToRealization/mcp-server/src/index.ts"],
      "cwd": "/Users/choeseung-won/personal-project/thinkToRealization/mcp-server"
    }
  }
}`

const ENV_EXAMPLE = `TTR_BASE_URL=https://think-to-realization.vercel.app
TTR_EMAIL=admin@ttr.local
TTR_PASSWORD=devflow123`

const CLAUDE_MD_SECTION = `## TTR 연동 (작업 관리 — CRITICAL)

이 프로젝트의 작업은 TTR(thinkToRealization)에서 관리됩니다.
MCP 도구 \`ttr_*\`를 사용하여 작업 상태를 관리하세요.

- **TTR 프로젝트 ID**: \`{PROJECT_ID}\`
- **TTR URL**: https://think-to-realization.vercel.app

### 작업 상태 관리 규칙

1. **작업 시작 시**: \`ttr_update_status(nodeId, "in_progress", via="세션이름")\` 호출
2. **작업 완료 시**: \`ttr_update_status(nodeId, "done", via="세션이름", note="완료 내용")\`
3. **중요한 기술 결정 시**: \`ttr_add_decision(nodeId, content, via="세션이름")\`
4. **진행 상황 확인**: \`ttr_get_dashboard("{PROJECT_ID}")\`

### TTR MCP 도구 요약

\`\`\`
ttr_list_projects()                          — 프로젝트 목록
ttr_get_dashboard(projectId)                 — 대시보드 (진행률)
ttr_list_nodes(projectId, status?)           — 노드 목록
ttr_get_node(nodeId)                         — 노드 상세 (상위/하위/선행/후행 포함)
ttr_update_status(nodeId, status, via?, note?) — 상태 변경 + 출처 기록
ttr_update_node(nodeId, title?, description?, priority?) — 수정
ttr_add_comment(nodeId, content, via?)       — 코멘트 추가
ttr_add_decision(nodeId, content, via?)      — 결정 기록
\`\`\`

### 노드 ID 매핑

| 순서 | 제목 | Node ID |
|------|------|---------|
| #01 | ... | \`{NODE_ID}\` |

> ttr_list_nodes로 전체 매핑을 조회하거나, TTR 대시보드에서 확인하세요.
`

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/" className="text-text-tertiary hover:text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <Terminal size={18} className="text-accent" />
          <h1 className="text-sm font-semibold text-text-primary">TTR MCP 연동 가이드</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Intro */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">다른 CLI 세션에서 TTR 노드 관리하기</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            MCP 서버를 통해 어떤 프로젝트의 Claude Code CLI 세션에서든
            TTR 대시보드의 노드 상태를 업데이트하고, 코멘트를 추가하고, 결정을 기록할 수 있습니다.
          </p>
        </section>

        {/* Step 1 */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs">1</span>
            credentials 설정
          </h3>
          <p className="text-xs text-text-secondary mb-3 pl-8">
            <code className="bg-surface-hover px-1 py-0.5 rounded">~/.ttr-mcp/.env</code> 파일을 생성하세요.
          </p>
          <CopyBlock label="~/.ttr-mcp/.env" content={ENV_EXAMPLE} />
        </section>

        {/* Step 2 */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs">2</span>
            MCP 서버 등록
          </h3>
          <p className="text-xs text-text-secondary mb-3 pl-8">
            작업할 프로젝트 루트에 <code className="bg-surface-hover px-1 py-0.5 rounded">.mcp.json</code>을 추가하세요.
            또는 <code className="bg-surface-hover px-1 py-0.5 rounded">~/.claude/.mcp.json</code>에 넣으면 모든 세션에서 사용 가능합니다.
          </p>
          <CopyBlock label=".mcp.json (프로젝트 루트 또는 ~/.claude/)" content={MCP_JSON} />
        </section>

        {/* Step 3 */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs">3</span>
            CLAUDE.md에 연동 섹션 추가
          </h3>
          <p className="text-xs text-text-secondary mb-3 pl-8">
            아래 내용을 작업 중인 프로젝트의 CLAUDE.md에 붙여넣으세요.
            <code className="bg-surface-hover px-1 py-0.5 rounded">{'{PROJECT_ID}'}</code>와 노드 매핑은 실제 값으로 교체하세요.
          </p>
          <CopyBlock label="CLAUDE.md에 추가할 내용" content={CLAUDE_MD_SECTION} />
        </section>

        {/* Step 4 */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-1 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs">4</span>
            CLI 세션에서 확인
          </h3>
          <div className="pl-8 space-y-3">
            <CopyBlock label="MCP 서버 확인" content="/mcp" />
            <p className="text-xs text-text-secondary">
              <code className="bg-surface-hover px-1 py-0.5 rounded">ttr</code> 서버가 목록에 보이면 사용 가능합니다.
              안 보이면 CLI를 재시작하세요.
            </p>
          </div>
        </section>

        {/* Tools reference */}
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-3">도구 레퍼런스</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F5F3]">
                  <th className="text-left px-3 py-2 border border-border font-medium">도구</th>
                  <th className="text-left px-3 py-2 border border-border font-medium">용도</th>
                  <th className="text-left px-3 py-2 border border-border font-medium">파라미터</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {[
                  ['ttr_list_projects', '프로젝트 목록', '(없음)'],
                  ['ttr_get_dashboard', '대시보드 요약', 'projectId'],
                  ['ttr_list_nodes', '노드 목록', 'projectId, status?'],
                  ['ttr_get_node', '노드 상세 (상위/하위/선행/후행 포함)', 'nodeId'],
                  ['ttr_update_status', '상태 변경 + 출처 기록', 'nodeId, status, via?, note?'],
                  ['ttr_update_node', '제목/설명/우선순위 수정', 'nodeId, title?, description?, priority?'],
                  ['ttr_add_comment', '코멘트 추가', 'nodeId, content, via?'],
                  ['ttr_add_decision', '결정 기록', 'nodeId, content, via?'],
                ].map(([tool, desc, params]) => (
                  <tr key={tool} className="hover:bg-surface-hover">
                    <td className="px-3 py-2 border border-border font-mono text-accent">{tool}</td>
                    <td className="px-3 py-2 border border-border">{desc}</td>
                    <td className="px-3 py-2 border border-border font-mono text-text-tertiary">{params}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tips */}
        <section className="bg-[#F5F5F3] rounded-lg p-4 text-xs text-text-secondary space-y-2">
          <p className="font-medium text-text-primary">참고</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code className="bg-white px-1 py-0.5 rounded">via</code> 파라미터에 세션 이름을 넣으면 TTR 대시보드에서 어떤 세션이 변경했는지 추적 가능</li>
            <li>인증은 MCP 서버가 자동 처리 (쿠키 캐시 + 만료 시 재로그인)</li>
            <li><code className="bg-white px-1 py-0.5 rounded">in_progress</code>/<code className="bg-white px-1 py-0.5 rounded">done</code> 상태 변경 시 담당자 미할당이면 자동 할당</li>
            <li>MCP 서버 코드 변경 후에는 CLI 세션 재시작 필요</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
