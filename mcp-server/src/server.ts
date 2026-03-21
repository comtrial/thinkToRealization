import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { TTRClient } from "./client.js"
import type { TTRProject, TTRNode, TTRDashboard, TTRComment, TTRDecision } from "./types.js"

export function createServer(client: TTRClient): McpServer {
  const server = new McpServer({
    name: "ttr",
    version: "1.0.0",
  })

  // Session identity — auto-prepended to all comments/decisions
  let sessionName: string | null = null

  function withVia(content: string, explicitVia?: string): string {
    const via = explicitVia || sessionName
    return via ? `[via ${via}] ${content}` : content
  }

  function viaLabel(explicitVia?: string): string | undefined {
    return explicitVia || sessionName || undefined
  }

  // ── ttr_set_session ──────────────────────────────────────
  server.tool(
    "ttr_set_session",
    "현재 CLI 세션의 이름을 설정. 이후 모든 상태 변경/코멘트에 자동으로 [via 세션이름]이 붙음. 세션 시작 시 1회 호출 권장.",
    { name: z.string().describe("세션 이름 (예: 'Commerce Intel CLI', 'Frontend Dev')") },
    async ({ name }) => {
      sessionName = name
      return { content: [{ type: "text", text: `✓ 세션 이름 설정됨: "${name}". 이후 모든 변경에 [via ${name}] 자동 적용.` }] }
    }
  )

  // ── ttr_login ────────────────────────────────────────────
  server.tool(
    "ttr_login",
    "다른 TTR 계정으로 로그인. 이후 해당 유저로 API 호출됨. 기본값은 ~/.ttr-mcp/.env의 계정.",
    {
      email: z.string().email().describe("TTR 이메일"),
      password: z.string().describe("비밀번호"),
    },
    async ({ email, password }) => {
      try {
        await client.loginAs(email, password)
        return { content: [{ type: "text", text: `✓ ${email}(으)로 로그인됨. 이후 이 계정으로 API 호출.` }] }
      } catch (err) {
        return { content: [{ type: "text", text: `✗ 로그인 실패: ${err instanceof Error ? err.message : String(err)}` }], isError: true }
      }
    }
  )

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
      // Use both dashboard (for grouped view) and full node list (for accurate counts)
      const [d, allNodes] = await Promise.all([
        client.get<TTRDashboard>(`/api/projects/${projectId}/dashboard`),
        client.get<TTRNode[]>(`/api/projects/${projectId}/nodes`),
      ])

      const counts = { backlog: 0, todo: 0, in_progress: 0, done: 0, archived: 0 }
      allNodes.forEach((n) => { if (n.status in counts) counts[n.status as keyof typeof counts]++ })
      const total = allNodes.filter((n) => n.status !== "archived").length
      const done = counts.done

      const fmt = (label: string, nodes: TTRNode[]) =>
        nodes.length > 0 ? `${label} (${nodes.length}):\n${nodes.map((n) => `  • [${n.priority}] ${n.title}`).join("\n")}` : ""

      const sections = [
        fmt("🔄 진행중", d.inProgress),
        fmt("📋 할일", d.todo),
        fmt("📦 백로그", d.backlog),
        fmt("✅ 완료", allNodes.filter((n) => n.status === "done")),
      ].filter(Boolean)

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

      // Auto-comment with source info (uses sessionName if via not provided)
      const effectiveVia = viaLabel(via)
      const parts: string[] = []
      if (effectiveVia) parts.push(`[via ${effectiveVia}]`)
      parts.push(`상태 변경: → ${status}`)
      if (note) parts.push(note)
      await client.post(`/api/nodes/${nodeId}/comments`, { content: parts.join(" ") }).catch(() => {})

      return { content: [{ type: "text", text: `✓ "${result.title}" → ${status}${effectiveVia ? ` (via ${effectiveVia})` : ""}` }] }
    }
  )

  // ── ttr_update_node ──────────────────────────────────────
  server.tool(
    "ttr_update_node",
    "노드 정보 수정 (제목, 설명, 우선순위, 담당자 등)",
    {
      nodeId: z.string().describe("노드 ID"),
      title: z.string().optional().describe("새 제목"),
      description: z.string().optional().describe("새 설명 (Markdown)"),
      priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional().describe("우선순위"),
      assignToMe: z.boolean().optional().describe("true면 현재 로그인 유저를 담당자로 할당"),
    },
    async ({ nodeId, assignToMe, ...updates }) => {
      const body: Record<string, unknown> = {}
      if (updates.title !== undefined) body.title = updates.title
      if (updates.description !== undefined) body.description = updates.description
      if (updates.priority !== undefined) body.priority = updates.priority
      if (assignToMe) body.assigneeId = await client.getCurrentUserId()

      const result = await client.put<TTRNode>(`/api/nodes/${nodeId}`, body)
      return { content: [{ type: "text", text: `✓ "${result.title}" 수정 완료.${assignToMe ? " (담당자 할당됨)" : ""}` }] }
    }
  )

  // ── ttr_add_comment ──────────────────────────────────────
  server.tool(
    "ttr_add_comment",
    "노드에 진행 상황 코멘트 추가. ttr_set_session으로 세션 이름을 설정했으면 자동으로 출처가 붙음.",
    {
      nodeId: z.string().describe("노드 ID"),
      content: z.string().describe("코멘트 내용"),
      via: z.string().optional().describe("출처 세션 이름 (미입력 시 ttr_set_session 값 사용)"),
    },
    async ({ nodeId, content, via }) => {
      const body = withVia(content, via)
      const effectiveVia = viaLabel(via)
      const comment = await client.post<TTRComment>(`/api/nodes/${nodeId}/comments`, { content: body })
      return { content: [{ type: "text", text: `✓ 코멘트 추가됨${effectiveVia ? ` (via ${effectiveVia})` : ""}` }] }
    }
  )

  // ── ttr_add_decision ─────────────────────────────────────
  server.tool(
    "ttr_add_decision",
    "노드에 결정 사항 기록. ttr_set_session으로 세션 이름을 설정했으면 자동으로 출처가 붙음.",
    {
      nodeId: z.string().describe("노드 ID"),
      content: z.string().describe("결정 내용"),
      via: z.string().optional().describe("출처 세션 이름 (미입력 시 ttr_set_session 값 사용)"),
    },
    async ({ nodeId, content, via }) => {
      const body = withVia(content, via)
      const effectiveVia = viaLabel(via)
      const decision = await client.post<TTRDecision>("/api/decisions", { nodeId, content: body })
      return { content: [{ type: "text", text: `✓ 결정 기록됨${effectiveVia ? ` (via ${effectiveVia})` : ""}: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"` }] }
    }
  )

  // ── ttr_create_node ────────────────────────────────────────
  server.tool(
    "ttr_create_node",
    "새 노드 생성. 부모 노드를 지정하면 그 아래에 배치되고, 선행/후행 노드와 엣지도 함께 생성 가능.",
    {
      projectId: z.string().describe("프로젝트 ID"),
      title: z.string().describe("노드 제목"),
      type: z.enum(["planning", "feature", "issue"]).optional().describe("노드 타입 (기본: feature)"),
      description: z.string().optional().describe("노드 설명 (Markdown)"),
      status: z.enum(["backlog", "todo", "in_progress"]).optional().describe("초기 상태 (기본: backlog)"),
      priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional().describe("우선순위 (기본: none)"),
      parentNodeId: z.string().optional().describe("상위 노드 ID (하위 노드로 생성, 부모 근처에 자동 배치)"),
      afterNodeId: z.string().optional().describe("선행 노드 ID (이 노드 뒤에 sequence 엣지 생성)"),
      dependsOn: z.array(z.string()).optional().describe("의존 노드 ID 목록 (dependency 엣지 생성)"),
      relatedTo: z.array(z.string()).optional().describe("연관 노드 ID 목록 (related 엣지 생성)"),
    },
    async ({ projectId, title, type, description, status, priority, parentNodeId, afterNodeId, dependsOn, relatedTo }) => {
      // 1. Determine canvas position
      let canvasX = 200
      let canvasY = 200

      if (parentNodeId) {
        // Place near parent
        try {
          const parent = await client.get<TTRNode>(`/api/nodes/${parentNodeId}`)
          canvasX = (parent as unknown as { canvasX: number }).canvasX + 50
          canvasY = (parent as unknown as { canvasY: number }).canvasY + 200
        } catch { /* fallback to default */ }
      } else if (afterNodeId) {
        // Place to the right of the preceding node
        try {
          const prev = await client.get<TTRNode>(`/api/nodes/${afterNodeId}`)
          canvasX = (prev as unknown as { canvasX: number }).canvasX + 350
          canvasY = (prev as unknown as { canvasY: number }).canvasY
        } catch { /* fallback to default */ }
      }

      // 2. Create the node
      const node = await client.post<TTRNode>(`/api/projects/${projectId}/nodes`, {
        title,
        type: type || "feature",
        description: description || undefined,
        status: status || "backlog",
        priority: priority || "none",
        canvasX,
        canvasY,
        parentNodeId: parentNodeId || undefined,
      })

      const createdEdges: string[] = []

      // 3. Create sequence edge from afterNode
      if (afterNodeId) {
        try {
          await client.post("/api/edges", { fromNodeId: afterNodeId, toNodeId: node.id, type: "sequence" })
          createdEdges.push(`${afterNodeId} →[sequence]→ ${node.id}`)
        } catch { /* ignore */ }
      }

      // 4. Create dependency edges
      if (dependsOn?.length) {
        for (const depId of dependsOn) {
          try {
            await client.post("/api/edges", { fromNodeId: depId, toNodeId: node.id, type: "dependency" })
            createdEdges.push(`${depId} →[dependency]→ ${node.id}`)
          } catch { /* ignore */ }
        }
      }

      // 5. Create related edges
      if (relatedTo?.length) {
        for (const relId of relatedTo) {
          try {
            await client.post("/api/edges", { fromNodeId: node.id, toNodeId: relId, type: "related" })
            createdEdges.push(`${node.id} →[related]→ ${relId}`)
          } catch { /* ignore */ }
        }
      }

      // 6. Auto-comment if session is set
      const effectiveVia = viaLabel()
      if (effectiveVia) {
        await client.post(`/api/nodes/${node.id}/comments`, {
          content: `[via ${effectiveVia}] 노드 생성됨`
        }).catch(() => {})
      }

      const lines = [
        `✓ 노드 생성: "${title}" (${node.id})`,
        `  타입: ${type || "feature"}, 상태: ${status || "backlog"}`,
      ]
      if (parentNodeId) lines.push(`  상위: ${parentNodeId}`)
      if (createdEdges.length > 0) lines.push(`  엣지 ${createdEdges.length}개 생성`)

      return { content: [{ type: "text", text: lines.join("\n") }] }
    }
  )

  return server
}
