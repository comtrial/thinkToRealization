import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { TTRClient } from "./client.js"
import type { TTRProject, TTRNode, TTRDashboard, TTRComment, TTRDecision } from "./types.js"

export function createServer(client: TTRClient): McpServer {
  const server = new McpServer({
    name: "ttr",
    version: "1.0.0",
  })

  // ── ttr_list_projects ────────────────────────────────────
  server.tool(
    "ttr_list_projects",
    "TTR 프로젝트 목록 조회",
    {},
    async () => {
      const projects = await client.get<TTRProject[]>("/api/projects")
      const text = projects.length === 0
        ? "프로젝트가 없습니다."
        : projects.map((p) => `• ${p.title} (${p.slug}) — ID: ${p.id}${p.memberCount ? `, 멤버 ${p.memberCount}명` : ""}`).join("\n")
      return { content: [{ type: "text", text }] }
    }
  )

  // ── ttr_get_dashboard ────────────────────────────────────
  server.tool(
    "ttr_get_dashboard",
    "프로젝트 대시보드 요약 (진행중/할일/백로그/완료 노드 목록)",
    { projectId: z.string().describe("프로젝트 ID") },
    async ({ projectId }) => {
      const d = await client.get<TTRDashboard>(`/api/projects/${projectId}/dashboard`)
      const fmt = (label: string, nodes: TTRNode[]) =>
        nodes.length > 0 ? `${label} (${nodes.length}):\n${nodes.map((n) => `  • [${n.priority}] ${n.title}`).join("\n")}` : ""

      const sections = [
        fmt("🔄 진행중", d.inProgress),
        fmt("📋 할일", d.todo),
        fmt("📦 백로그", d.backlog),
        fmt("✅ 최근 완료", d.recentDone),
      ].filter(Boolean)

      const total = d.inProgress.length + d.todo.length + d.backlog.length + d.recentDone.length
      const done = d.recentDone.length
      const header = `전체 ${total}개 노드, 완료 ${done}개 (${total > 0 ? Math.round((done / total) * 100) : 0}%)`

      return { content: [{ type: "text", text: `${header}\n\n${sections.join("\n\n")}` }] }
    }
  )

  // ── ttr_list_nodes ───────────────────────────────────────
  server.tool(
    "ttr_list_nodes",
    "프로젝트 노드 목록 (상태 필터 가능)",
    {
      projectId: z.string().describe("프로젝트 ID"),
      status: z.string().optional().describe("상태 필터: backlog, todo, in_progress, done, archived"),
    },
    async ({ projectId, status }) => {
      const query = status ? `?status=${status}` : ""
      const nodes = await client.get<TTRNode[]>(`/api/projects/${projectId}/nodes${query}`)
      if (nodes.length === 0) return { content: [{ type: "text", text: "노드가 없습니다." }] }

      const text = nodes.map((n) => {
        const statusIcon = { backlog: "📦", todo: "📋", in_progress: "🔄", done: "✅", archived: "🗄️" }[n.status] || "•"
        return `${statusIcon} [${n.status}] ${n.title} — ID: ${n.id}`
      }).join("\n")

      return { content: [{ type: "text", text: `${nodes.length}개 노드:\n${text}` }] }
    }
  )

  // ── ttr_get_node ─────────────────────────────────────────
  server.tool(
    "ttr_get_node",
    "노드 상세 조회 (설명, 세션, 결정, 엣지 포함)",
    { nodeId: z.string().describe("노드 ID") },
    async ({ nodeId }) => {
      const node = await client.get<TTRNode & {
        sessions?: { id: string; title: string; status: string }[]
        decisions?: { id: string; content: string }[]
        outEdges?: { id: string; toNodeId: string; type: string; label?: string }[]
        inEdges?: { id: string; fromNodeId: string; type: string; label?: string }[]
      }>(`/api/nodes/${nodeId}`)

      const lines = [
        `# ${node.title}`,
        `상태: ${node.status} | 우선순위: ${node.priority} | 타입: ${node.type}`,
        `ID: ${node.id}`,
        node.assigneeName ? `담당: ${node.assigneeName}` : null,
        node.parentNodeId ? `상위: ${node.parentNodeId}` : null,
        "",
        node.description || "(설명 없음)",
      ].filter((l) => l !== null)

      if (node.decisions && node.decisions.length > 0) {
        lines.push("", `결정 사항 (${node.decisions.length}):`)
        node.decisions.forEach((d) => lines.push(`  • ${d.content}`))
      }

      if (node.outEdges && node.outEdges.length > 0) {
        lines.push("", `하위/연결 (${node.outEdges.length}):`)
        node.outEdges.forEach((e) => lines.push(`  → ${e.toNodeId} [${e.type}] ${e.label || ""}`))
      }

      return { content: [{ type: "text", text: lines.join("\n") }] }
    }
  )

  // ── ttr_update_status ────────────────────────────────────
  server.tool(
    "ttr_update_status",
    "노드 상태 변경 (backlog/todo/in_progress/done/archived). via에 현재 작업 세션 이름을 넣으면 출처가 코멘트로 기록됨.",
    {
      nodeId: z.string().describe("노드 ID"),
      status: z.enum(["backlog", "todo", "in_progress", "done", "archived"]).describe("변경할 상태"),
      via: z.string().optional().describe("출처 세션 이름 (예: 'Commerce Intel Agent CLI')"),
      note: z.string().optional().describe("상태 변경 사유 (코멘트로 기록됨)"),
    },
    async ({ nodeId, status, via, note }) => {
      // Check if assignee is needed (in_progress, done)
      if (status === "in_progress" || status === "done") {
        const node = await client.get<TTRNode>(`/api/nodes/${nodeId}`)
        if (!node.assigneeId) {
          const userId = await client.getCurrentUserId()
          await client.put(`/api/nodes/${nodeId}`, { assigneeId: userId })
        }
      }

      const result = await client.put<TTRNode>(`/api/nodes/${nodeId}/status`, {
        status,
        triggerType: "user_manual",
      })

      // Auto-comment with source info
      const parts: string[] = []
      if (via) parts.push(`[via ${via}]`)
      parts.push(`상태 변경: → ${status}`)
      if (note) parts.push(note)
      await client.post(`/api/nodes/${nodeId}/comments`, { content: parts.join(" ") }).catch(() => {})

      return { content: [{ type: "text", text: `✓ "${result.title}" → ${status}${via ? ` (via ${via})` : ""}` }] }
    }
  )

  // ── ttr_update_node ──────────────────────────────────────
  server.tool(
    "ttr_update_node",
    "노드 정보 수정 (제목, 설명, 우선순위 등)",
    {
      nodeId: z.string().describe("노드 ID"),
      title: z.string().optional().describe("새 제목"),
      description: z.string().optional().describe("새 설명 (Markdown)"),
      priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional().describe("우선순위"),
    },
    async ({ nodeId, ...updates }) => {
      const body: Record<string, unknown> = {}
      if (updates.title !== undefined) body.title = updates.title
      if (updates.description !== undefined) body.description = updates.description
      if (updates.priority !== undefined) body.priority = updates.priority

      const result = await client.put<TTRNode>(`/api/nodes/${nodeId}`, body)
      return { content: [{ type: "text", text: `✓ "${result.title}" 수정 완료.` }] }
    }
  )

  // ── ttr_add_comment ──────────────────────────────────────
  server.tool(
    "ttr_add_comment",
    "노드에 진행 상황 코멘트 추가. via에 세션 이름을 넣으면 출처가 접두어로 붙음.",
    {
      nodeId: z.string().describe("노드 ID"),
      content: z.string().describe("코멘트 내용"),
      via: z.string().optional().describe("출처 세션 이름 (예: 'Commerce Intel Agent CLI')"),
    },
    async ({ nodeId, content, via }) => {
      const body = via ? `[via ${via}] ${content}` : content
      const comment = await client.post<TTRComment>(`/api/nodes/${nodeId}/comments`, { content: body })
      return { content: [{ type: "text", text: `✓ 코멘트 추가됨${via ? ` (via ${via})` : ""}` }] }
    }
  )

  // ── ttr_add_decision ─────────────────────────────────────
  server.tool(
    "ttr_add_decision",
    "노드에 결정 사항 기록. via에 세션 이름을 넣으면 출처가 접두어로 붙음.",
    {
      nodeId: z.string().describe("노드 ID"),
      content: z.string().describe("결정 내용"),
      via: z.string().optional().describe("출처 세션 이름 (예: 'Commerce Intel Agent CLI')"),
    },
    async ({ nodeId, content, via }) => {
      const body = via ? `[via ${via}] ${content}` : content
      const decision = await client.post<TTRDecision>("/api/decisions", { nodeId, content: body })
      return { content: [{ type: "text", text: `✓ 결정 기록됨${via ? ` (via ${via})` : ""}: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"` }] }
    }
  )

  return server
}
