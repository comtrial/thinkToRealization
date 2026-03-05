import fs from "fs";
import type { PrismaClient } from "@prisma/client";
import {
  buildPrompt,
  type AssembledContext,
  type ContextChainItem,
  type SessionSummary,
} from "./prompt-template";

const MAX_CHAIN_DEPTH = 10; // prevent infinite loops on circular refs
const MAX_SESSIONS = 3;

/**
 * Assemble context for a node by collecting its parent chain,
 * project CLAUDE.md, and recent session history.
 *
 * Accepts a PrismaClient so it can be used from both
 * the WebSocket server and Next.js API routes.
 */
export async function assembleContext(
  db: PrismaClient,
  nodeId: string
): Promise<AssembledContext> {
  // 1. Fetch the node with its project
  const node = await db.node.findUnique({
    where: { id: nodeId },
    include: {
      project: {
        select: {
          id: true,
          claudeMdPath: true,
          projectDir: true,
        },
      },
    },
  });

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // 2. Build parent chain (recursive)
  const contextChain: ContextChainItem[] = [];

  // Add current node at depth 0
  contextChain.push({
    nodeId: node.id,
    title: node.title,
    type: node.type,
    description: node.description,
    depth: 0,
  });

  // Walk up the parent chain
  let currentParentId = node.parentNodeId;
  let depth = 1;

  while (currentParentId && depth <= MAX_CHAIN_DEPTH) {
    const parent = await db.node.findUnique({
      where: { id: currentParentId },
      select: {
        id: true,
        title: true,
        type: true,
        description: true,
        parentNodeId: true,
      },
    });

    if (!parent) break;

    contextChain.push({
      nodeId: parent.id,
      title: parent.title,
      type: parent.type,
      description: parent.description,
      depth,
    });

    currentParentId = parent.parentNodeId;
    depth++;
  }

  // 3. Read CLAUDE.md content
  let claudeMdContent: string | null = null;
  const claudeMdPath = node.project.claudeMdPath;

  if (claudeMdPath) {
    try {
      claudeMdContent = fs.readFileSync(claudeMdPath, "utf-8");
    } catch {
      // File might not exist or be unreadable
      console.warn(`Could not read CLAUDE.md at ${claudeMdPath}`);
    }
  }

  // 4. Collect recent session history for this node
  const sessions = await db.session.findMany({
    where: { nodeId },
    orderBy: { startedAt: "desc" },
    take: MAX_SESSIONS,
    select: {
      id: true,
      title: true,
      status: true,
      startedAt: true,
      fileChangeCount: true,
      durationSeconds: true,
    },
  });

  const sessionSummaries: SessionSummary[] = sessions.map((s) => ({
    sessionId: s.id,
    title: s.title,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    fileChangeCount: s.fileChangeCount,
    durationSeconds: s.durationSeconds,
  }));

  // 5. Build prompt
  const currentNode = contextChain[0];
  const prompt = buildPrompt({
    claudeMdContent,
    contextChain,
    currentNode,
    sessions: sessionSummaries,
  });

  return {
    prompt,
    contextChain,
    metadata: {
      claudeMdLength: claudeMdContent?.length ?? 0,
      chainDepth: contextChain.length,
      sessionCount: sessionSummaries.length,
    },
  };
}
