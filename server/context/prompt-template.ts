export interface ContextChainItem {
  nodeId: string;
  title: string;
  type: string;
  description: string | null;
  depth: number; // 0 = current node, 1 = parent, 2 = grandparent, etc.
}

export interface SessionSummary {
  sessionId: string;
  title: string | null;
  status: string;
  startedAt: string;
  fileChangeCount: number;
  durationSeconds: number;
}

export interface AssembledContext {
  prompt: string;
  contextChain: ContextChainItem[];
  metadata: {
    claudeMdLength: number;
    chainDepth: number;
    sessionCount: number;
  };
}

const MAX_CLAUDE_MD_CHARS = 8000;

export function buildPrompt(opts: {
  claudeMdContent: string | null;
  contextChain: ContextChainItem[];
  currentNode: ContextChainItem;
  sessions: SessionSummary[];
}): string {
  const sections: string[] = [];

  // 1. Project context (CLAUDE.md)
  if (opts.claudeMdContent) {
    const truncated =
      opts.claudeMdContent.length > MAX_CLAUDE_MD_CHARS
        ? opts.claudeMdContent.slice(0, MAX_CLAUDE_MD_CHARS) + "\n\n... (truncated)"
        : opts.claudeMdContent;
    sections.push(`## 프로젝트 컨텍스트\n${truncated}`);
  }

  // 2. Parent issue chain (grandparent -> parent order)
  const ancestors = opts.contextChain
    .filter((item) => item.depth > 0)
    .sort((a, b) => b.depth - a.depth); // deepest ancestor first

  if (ancestors.length > 0) {
    const chainText = ancestors
      .map((item) => {
        const desc = item.description ? `\n  ${item.description}` : "";
        return `- **[${item.type}] ${item.title}**${desc}`;
      })
      .join("\n");
    sections.push(`## 작업 배경\n${chainText}`);
  }

  // 3. Current task
  const currentDesc = opts.currentNode.description || "(설명 없음)";
  sections.push(`## 이번 작업\n**${opts.currentNode.title}**\n${currentDesc}`);

  // 4. Session history
  if (opts.sessions.length > 0) {
    const sessionText = opts.sessions
      .map((s) => {
        const title = s.title || "Untitled session";
        const duration = Math.round(s.durationSeconds / 60);
        return `- **${title}** (${s.status}, ${duration}min, ${s.fileChangeCount} files changed)`;
      })
      .join("\n");
    sections.push(`## 이전 세션 히스토리\n${sessionText}`);
  }

  // 5. Output format instruction
  sections.push(`## 출력 형식
아래 JSON 형식으로 실행 계획서를 작성해주세요:
\`\`\`json
{
  "summary": "변경 사항 한줄 요약",
  "affectedFiles": [{ "path": "...", "action": "create|modify|delete", "description": "..." }],
  "changes": [{ "title": "...", "description": "...", "risk": "low|medium|high" }],
  "testPlan": [{ "description": "...", "type": "unit|integration|e2e" }],
  "risks": [{ "description": "...", "severity": "low|medium|high", "mitigation": "..." }]
}
\`\`\``);

  return sections.join("\n\n");
}
