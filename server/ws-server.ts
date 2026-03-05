import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import { PtyManager } from "./terminal/pty-manager";
import { CaptureManager } from "./terminal/capture-manager";
import { sessionManager } from "./session/session-manager";
import { fileWatcher } from "./file-watcher/file-watcher";
import { eventBus } from "./events/event-bus";
import { recoveryManager } from "./recovery/recovery-manager";
import { initDevflowDir } from "./db/devflow-config";
import { checkCLIAvailable } from "./cli/cli-manager";
import { prisma } from "../src/lib/prisma";

const WS_PORT = 3001;
const HEARTBEAT_INTERVAL_MS = 30_000;

const ptyManager = new PtyManager();
const captureManager = new CaptureManager();

// Initialize ~/.devflow/ directory structure
initDevflowDir();

// Check Claude CLI availability
checkCLIAvailable().then(({ available, path, error }) => {
  if (available) {
    console.log(`[ws-server] Claude CLI found at ${path}`);
  } else {
    console.warn(`[ws-server] Claude CLI not available: ${error}`);
  }
});

// Recover stale sessions on startup
recoveryManager.recoverStaleSessions().catch((err) => {
  console.error("[ws-server] Recovery failed:", err);
});

// Track WebSocket clients by nodeId
const nodeClients = new Map<string, Set<WebSocket>>();

// Track global clients (no nodeId — receive broadcasts only)
const globalClients = new Set<WebSocket>();

// --- Helper: send JSON to a WebSocket client ---
function sendJson(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...msg, timestamp: new Date().toISOString() }));
  }
}

// --- Helper: broadcast to all clients watching a nodeId ---
function broadcastToNode(
  nodeId: string,
  msg: Record<string, unknown>
): void {
  const clients = nodeClients.get(nodeId);
  if (!clients) return;
  const payload = JSON.stringify({
    ...msg,
    timestamp: new Date().toISOString(),
  });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// --- Helper: broadcast to ALL connected clients (global + node-specific) ---
function broadcastToAll(msg: Record<string, unknown>): void {
  const payload = JSON.stringify({
    ...msg,
    timestamp: new Date().toISOString(),
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// --- Helper: broadcast to node clients AND global clients ---
function broadcastToNodeAndGlobal(
  nodeId: string,
  msg: Record<string, unknown>
): void {
  const payload = JSON.stringify({
    ...msg,
    timestamp: new Date().toISOString(),
  });
  // Send to node-specific clients
  const clients = nodeClients.get(nodeId);
  if (clients) {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
  // Also send to global clients so WebSocketProvider receives events
  for (const client of globalClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// --- WebSocket Server ---
const wss = new WebSocketServer({ host: "0.0.0.0", port: WS_PORT });
console.log(`[ws-server] WebSocket server listening on port ${WS_PORT}`);

// --- EventBus listeners ---

// PTY data -> broadcast to node clients
eventBus.on("pty:data", ({ sessionId, data }) => {
  const nodeId = ptyManager.getNodeIdBySession(sessionId);
  if (nodeId) {
    broadcastToNodeAndGlobal(nodeId, { type: "pty:data", payload: { nodeId, data } });
  }
  // Also feed capture manager
  captureManager.append(sessionId, data);
});

// PTY exit -> end session + stop file watcher + broadcast
eventBus.on("pty:exit", async ({ sessionId, exitCode }) => {
  try {
    const nodeId = ptyManager.getNodeIdBySession(sessionId);
    await captureManager.stop(sessionId);
    await fileWatcher.unwatch(sessionId);

    if (nodeId) {
      broadcastToNodeAndGlobal(nodeId, {
        type: "session:ended",
        payload: { nodeId, sessionId, needsPrompt: true, exitCode },
      });
    }

    // Auto-end session as paused (user can choose "done" via prompt)
    await sessionManager.endSession(sessionId, false);
  } catch (err) {
    console.error("[ws-server] Error in pty:exit handler:", err);
  }
});

// Session started
eventBus.on("session:started", ({ sessionId, nodeId }) => {
  broadcastToNodeAndGlobal(nodeId, {
    type: "session:started",
    payload: { nodeId, sessionId },
  });
});

// Session ended (from session manager)
eventBus.on("session:ended", ({ sessionId, nodeId, status }) => {
  broadcastToNodeAndGlobal(nodeId, {
    type: "session:ended",
    payload: { nodeId, sessionId, status },
  });
});

// Session resumed
eventBus.on("session:resumed", ({ sessionId, nodeId }) => {
  broadcastToNodeAndGlobal(nodeId, {
    type: "session:resumed",
    payload: { nodeId, sessionId },
  });
});

// Node state changed -> broadcast to all (canvas needs this)
eventBus.on(
  "node:stateChanged",
  ({ nodeId, fromStatus, toStatus, triggerType }) => {
    broadcastToAll({
      type: "node:stateChanged",
      payload: { nodeId, fromStatus, toStatus, triggerType },
    });
  }
);

// File changed -> broadcast file count update with actual count
eventBus.on("file:changed", async ({ sessionId, filePath, changeType }) => {
  try {
    const nodeId = ptyManager.getNodeIdBySession(sessionId);
    if (nodeId) {
      // Get actual file change count from DB
      let count = 0;
      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          select: { fileChangeCount: true },
        });
        count = session?.fileChangeCount ?? 0;
      } catch { /* ignore */ }

      broadcastToNodeAndGlobal(nodeId, {
        type: "node:fileCountUpdated",
        payload: { nodeId, sessionId, filePath, changeType, count },
      });
    }
  } catch (err) {
    console.error("[ws-server] Error in file:changed handler:", err);
  }
});

// Plan events -> broadcast to all clients
eventBus.on("plan:generating", ({ nodeId, planId }) => {
  broadcastToAll({
    type: "plan:generating",
    payload: { nodeId, planId },
  });
});

eventBus.on("plan:created", ({ nodeId, planId, version }) => {
  broadcastToAll({
    type: "plan:created",
    payload: { nodeId, planId, version },
  });
});

eventBus.on("plan:error", ({ nodeId, error }) => {
  broadcastToAll({
    type: "plan:error",
    payload: { nodeId, error },
  });
});

// --- Heartbeat ---
const heartbeatInterval = setInterval(() => {
  broadcastToAll({ type: "heartbeat" });
}, HEARTBEAT_INTERVAL_MS);

// --- Helper: get current session state for reconnection ---
async function getSessionState(nodeId: string): Promise<Record<string, unknown> | null> {
  try {
    const session = await prisma.session.findFirst({
      where: { nodeId, status: "active" },
      select: {
        id: true,
        title: true,
        status: true,
        fileChangeCount: true,
        startedAt: true,
      },
    });
    if (!session) return null;
    return {
      sessionId: session.id,
      title: session.title,
      status: session.status,
      fileChangeCount: session.fileChangeCount,
      startedAt: session.startedAt.toISOString(),
      hasPty: ptyManager.has(nodeId),
    };
  } catch {
    return null;
  }
}

// --- Helper: start file watcher for a session ---
async function startFileWatcherForSession(sessionId: string, nodeId: string): Promise<void> {
  try {
    const node = await prisma.node.findUnique({
      where: { id: nodeId },
      select: { projectId: true },
    });
    if (!node) return;

    const project = await prisma.project.findUnique({
      where: { id: node.projectId },
      select: { projectDir: true },
    });
    if (!project?.projectDir) return;

    fileWatcher.watch(project.projectDir, sessionId, nodeId);
  } catch (err) {
    console.error("[ws-server] Failed to start file watcher:", err);
  }
}

// --- Connection handler ---
wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || "/", `http://localhost:${WS_PORT}`);
  const nodeId = url.searchParams.get("nodeId");

  if (!nodeId) {
    // Global client — receives broadcasts but no node-specific events
    console.log(`[ws-server] Global client connected`);
    globalClients.add(ws);

    ws.on("close", () => {
      globalClients.delete(ws);
      console.log(`[ws-server] Global client disconnected`);
    });

    ws.on("error", (err) => {
      console.error(`[ws-server] Global client error:`, err);
    });

    // Global clients can send messages (forwarded to node handlers)
    ws.on("message", async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Forward PTY input/resize to the correct node
        if (msg.type === "pty:input" && msg.payload?.nodeId) {
          ptyManager.write(msg.payload.nodeId, msg.payload.data ?? "");
        } else if (msg.type === "pty:resize" && msg.payload?.nodeId) {
          const { cols, rows } = msg.payload;
          if (typeof cols === "number" && typeof rows === "number") {
            ptyManager.resize(msg.payload.nodeId, cols, rows);
          }
        } else if (msg.type === "session:start" && msg.payload?.nodeId) {
          const targetNodeId = msg.payload.nodeId;
          try {
            const sessionId = await sessionManager.startSession(targetNodeId, msg.payload.title);
            const cols = msg.payload.cols ?? 80;
            const rows = msg.payload.rows ?? 24;
            const cwd = msg.payload.cwd;
            ptyManager.create(targetNodeId, sessionId, cols, rows, cwd);
            captureManager.start(sessionId);
            await startFileWatcherForSession(sessionId, targetNodeId);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to start session";
            sendJson(ws, { type: "error", payload: { code: "SESSION_START_FAILED", message } });
          }
        } else if (msg.type === "session:end" && msg.payload?.nodeId) {
          const targetNodeId = msg.payload.nodeId;
          const sessionInfo = ptyManager.getSessionInfo(targetNodeId);
          if (sessionInfo) {
            const markDone = msg.payload.markDone ?? false;
            ptyManager.kill(targetNodeId);
            await fileWatcher.unwatch(sessionInfo.sessionId);
            try {
              await sessionManager.endSession(sessionInfo.sessionId, markDone);
            } catch (err) {
              console.error("[ws-server] Failed to end session:", err);
            }
          }
        } else if (msg.type === "session:resume" && msg.payload?.sessionId && msg.payload?.nodeId) {
          const { sessionId, nodeId: targetNodeId } = msg.payload;
          try {
            await sessionManager.resumeSession(sessionId);
            const cols = msg.payload.cols ?? 80;
            const rows = msg.payload.rows ?? 24;
            const cwd = msg.payload.cwd;
            ptyManager.create(targetNodeId, sessionId, cols, rows, cwd);
            captureManager.start(sessionId);
            await startFileWatcherForSession(sessionId, targetNodeId);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to resume session";
            sendJson(ws, { type: "error", payload: { code: "SESSION_RESUME_FAILED", message } });
          }
        } else if (msg.type === "ping") {
          sendJson(ws, { type: "pong" });
        }
      } catch {
        sendJson(ws, { type: "error", payload: { code: "INVALID_JSON", message: "Invalid JSON message" } });
      }
    });
    return;
  }

  console.log(`[ws-server] Client connected for node ${nodeId}`);

  // Track client
  if (!nodeClients.has(nodeId)) {
    nodeClients.set(nodeId, new Set());
  }
  nodeClients.get(nodeId)!.add(ws);

  // Send current session state on reconnection
  const sessionState = await getSessionState(nodeId);
  if (sessionState) {
    sendJson(ws, {
      type: "session:started",
      payload: { nodeId, ...sessionState },
    });
  }

  // Handle client messages
  ws.on("message", async (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case "pty:input": {
          ptyManager.write(nodeId, msg.payload?.data ?? "");
          break;
        }

        case "pty:resize": {
          const { cols, rows } = msg.payload ?? {};
          if (typeof cols === "number" && typeof rows === "number") {
            ptyManager.resize(nodeId, cols, rows);
          }
          break;
        }

        case "session:start": {
          try {
            const sessionId = await sessionManager.startSession(
              nodeId,
              msg.payload?.title
            );
            // Create PTY for the new session
            const cols = msg.payload?.cols ?? 80;
            const rows = msg.payload?.rows ?? 24;
            const cwd = msg.payload?.cwd;
            ptyManager.create(nodeId, sessionId, cols, rows, cwd);
            captureManager.start(sessionId);

            // Start file watcher
            await startFileWatcherForSession(sessionId, nodeId);
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "Failed to start session";
            sendJson(ws, {
              type: "error",
              payload: { code: "SESSION_START_FAILED", message },
            });
          }
          break;
        }

        case "session:end": {
          const sessionInfo = ptyManager.getSessionInfo(nodeId);
          if (sessionInfo) {
            const markDone = msg.payload?.markDone ?? false;
            ptyManager.kill(nodeId);
            await fileWatcher.unwatch(sessionInfo.sessionId);
            try {
              await sessionManager.endSession(
                sessionInfo.sessionId,
                markDone
              );
            } catch (err) {
              console.error("[ws-server] Failed to end session:", err);
            }
          }
          break;
        }

        case "session:resume": {
          const { sessionId } = msg.payload ?? {};
          if (!sessionId) {
            sendJson(ws, {
              type: "error",
              payload: {
                code: "MISSING_SESSION_ID",
                message: "sessionId required for resume",
              },
            });
            break;
          }
          try {
            await sessionManager.resumeSession(sessionId);
            const cols = msg.payload?.cols ?? 80;
            const rows = msg.payload?.rows ?? 24;
            const cwd = msg.payload?.cwd;
            ptyManager.create(nodeId, sessionId, cols, rows, cwd);
            captureManager.start(sessionId);

            // Start file watcher
            await startFileWatcherForSession(sessionId, nodeId);
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "Failed to resume session";
            sendJson(ws, {
              type: "error",
              payload: { code: "SESSION_RESUME_FAILED", message },
            });
          }
          break;
        }

        case "ping": {
          sendJson(ws, { type: "pong" });
          break;
        }

        default: {
          sendJson(ws, {
            type: "error",
            payload: {
              code: "UNKNOWN_MESSAGE",
              message: `Unknown message type: ${msg.type}`,
            },
          });
        }
      }
    } catch {
      sendJson(ws, {
        type: "error",
        payload: { code: "INVALID_JSON", message: "Invalid JSON message" },
      });
    }
  });

  // Handle disconnect — keep PTY alive for reconnection
  ws.on("close", () => {
    console.log(`[ws-server] Client disconnected for node ${nodeId}`);
    const clients = nodeClients.get(nodeId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        nodeClients.delete(nodeId);
      }
    }
  });

  ws.on("error", (err) => {
    console.error(`[ws-server] WebSocket error for node ${nodeId}:`, err);
  });
});

// --- Graceful shutdown ---
async function shutdown() {
  console.log("[ws-server] Shutting down...");
  clearInterval(heartbeatInterval);

  // End all active sessions gracefully
  const activeSessions = ptyManager.getAllActive();
  for (const { nodeId, sessionId } of activeSessions) {
    try {
      ptyManager.kill(nodeId);
      await fileWatcher.unwatch(sessionId);
      await sessionManager.endSession(sessionId, false);
    } catch (err) {
      console.error(`[ws-server] Error cleaning up session ${sessionId}:`, err);
    }
  }

  captureManager.dispose();
  fileWatcher.dispose();
  ptyManager.dispose();
  eventBus.removeAllListeners();

  wss.close(() => {
    console.log("[ws-server] Server closed.");
  });

  // Allow pending I/O to complete before exiting
  setTimeout(() => {
    process.exit(0);
  }, 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
