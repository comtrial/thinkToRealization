import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import { PtyManager } from "./terminal/pty-manager";
import { CaptureManager } from "./terminal/capture-manager";
import { sessionManager } from "./session/session-manager";
import { eventBus } from "./events/event-bus";

const WS_PORT = 3001;
const HEARTBEAT_INTERVAL_MS = 30_000;

const ptyManager = new PtyManager();
const captureManager = new CaptureManager();

// Track WebSocket clients by nodeId
const nodeClients = new Map<string, Set<WebSocket>>();

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

// --- Helper: broadcast to ALL connected clients ---
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

// --- WebSocket Server ---
const wss = new WebSocketServer({ host: "0.0.0.0", port: WS_PORT });
console.log(`[ws-server] WebSocket server listening on port ${WS_PORT}`);

// --- EventBus listeners ---

// PTY data -> broadcast to node clients
eventBus.on("pty:data", ({ sessionId, data }) => {
  const nodeId = ptyManager.getNodeIdBySession(sessionId);
  if (nodeId) {
    broadcastToNode(nodeId, { type: "pty:data", payload: { nodeId, data } });
  }
  // Also feed capture manager
  captureManager.append(sessionId, data);
});

// PTY exit -> end session + broadcast
eventBus.on("pty:exit", async ({ sessionId, exitCode }) => {
  const nodeId = ptyManager.getNodeIdBySession(sessionId);
  captureManager.stop(sessionId);

  if (nodeId) {
    broadcastToNode(nodeId, {
      type: "session:ended",
      payload: { nodeId, sessionId, needsPrompt: true, exitCode },
    });
  }

  // Auto-end session as paused (user can choose "done" via prompt)
  try {
    await sessionManager.endSession(sessionId, false);
  } catch (err) {
    console.error("[ws-server] Failed to end session on pty exit:", err);
  }
});

// Session started
eventBus.on("session:started", ({ sessionId, nodeId }) => {
  broadcastToNode(nodeId, {
    type: "session:started",
    payload: { nodeId, sessionId },
  });
});

// Session ended (from session manager)
eventBus.on("session:ended", ({ sessionId, nodeId, status }) => {
  broadcastToNode(nodeId, {
    type: "session:ended",
    payload: { nodeId, sessionId, status },
  });
});

// Session resumed
eventBus.on("session:resumed", ({ sessionId, nodeId }) => {
  broadcastToNode(nodeId, {
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

// File changed
eventBus.on("file:changed", ({ sessionId, filePath, changeType }) => {
  const nodeId = ptyManager.getNodeIdBySession(sessionId);
  if (nodeId) {
    broadcastToNode(nodeId, {
      type: "node:fileCountUpdated",
      payload: { nodeId, sessionId, filePath, changeType },
    });
  }
});

// --- Heartbeat ---
const heartbeatInterval = setInterval(() => {
  broadcastToAll({ type: "heartbeat" });
}, HEARTBEAT_INTERVAL_MS);

// --- Connection handler ---
wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url || "/", `http://localhost:${WS_PORT}`);
  const nodeId = url.searchParams.get("nodeId");

  if (!nodeId) {
    sendJson(ws, {
      type: "error",
      payload: { code: "MISSING_NODE_ID", message: "Missing nodeId query parameter" },
    });
    ws.close();
    return;
  }

  console.log(`[ws-server] Client connected for node ${nodeId}`);

  // Track client
  if (!nodeClients.has(nodeId)) {
    nodeClients.set(nodeId, new Set());
  }
  nodeClients.get(nodeId)!.add(ws);

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
  captureManager.dispose();
  ptyManager.dispose();
  eventBus.removeAllListeners();
  wss.close(() => {
    console.log("[ws-server] Server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
