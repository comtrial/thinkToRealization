import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import { PtyManager } from "./terminal/pty-manager";
import { CaptureManager } from "./terminal/capture-manager";
import { IDisposable } from "node-pty";

const WS_PORT = 3001;
const HEARTBEAT_INTERVAL_MS = 30_000;

const ptyManager = new PtyManager();
const captureManager = new CaptureManager();

// Track which WebSocket clients are connected to which sessions
const sessionClients = new Map<string, Set<WebSocket>>();

// Track per-session PTY handlers so we register only once
const sessionHandlers = new Map<string, { data: IDisposable; exit: IDisposable }>();

const wss = new WebSocketServer({ host: "0.0.0.0", port: WS_PORT });

console.log(`[ws-server] WebSocket server listening on port ${WS_PORT}`);

// Heartbeat
const heartbeatInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "heartbeat" }));
    }
  }
}, HEARTBEAT_INTERVAL_MS);

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  // Parse sessionId from query string
  const url = new URL(req.url || "/", `http://localhost:${WS_PORT}`);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    ws.send(JSON.stringify({ type: "error", message: "Missing sessionId query parameter" }));
    ws.close();
    return;
  }

  console.log(`[ws-server] Client connected for session ${sessionId}`);

  // Track this client
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set());
  }
  sessionClients.get(sessionId)!.add(ws);

  // Create or reconnect pty
  const defaultCols = 80;
  const defaultRows = 24;
  let ptyProcess;
  try {
    ptyProcess = ptyManager.create(sessionId, defaultCols, defaultRows);
  } catch (err) {
    console.error(`[ws-server] Failed to create pty for session ${sessionId}:`, err);
    ws.send(JSON.stringify({ type: "error", message: "Failed to create terminal session" }));
    ws.close();
    return;
  }

  // Start capture
  captureManager.start(sessionId);

  // Register PTY handlers ONLY ONCE per session
  if (!sessionHandlers.has(sessionId)) {
    const dataHandler = ptyProcess.onData((data: string) => {
      const clients = sessionClients.get(sessionId);
      if (clients) {
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "output", data }));
          }
        }
      }
      captureManager.append(sessionId, data);
    });

    const exitHandler = ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[ws-server] pty exited for session ${sessionId} (code: ${exitCode}, signal: ${signal})`);
      captureManager.stop(sessionId);
      sessionHandlers.delete(sessionId);

      const clients = sessionClients.get(sessionId);
      if (clients) {
        for (const client of clients) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "exit" }));
          }
        }
      }
    });

    sessionHandlers.set(sessionId, { data: dataHandler, exit: exitHandler });
  }

  // Handle client messages
  ws.on("message", (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case "input":
          ptyManager.write(sessionId, msg.data);
          break;

        case "resize":
          if (typeof msg.cols === "number" && typeof msg.rows === "number") {
            ptyManager.resize(sessionId, msg.cols, msg.rows);
          }
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON message" }));
    }
  });

  // Handle client disconnect — keep pty alive for reconnection
  ws.on("close", () => {
    console.log(`[ws-server] Client disconnected for session ${sessionId}`);
    const clients = sessionClients.get(sessionId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        sessionClients.delete(sessionId);
        // Keep pty alive for reconnection, but clean up handlers
        const handlers = sessionHandlers.get(sessionId);
        if (handlers) {
          handlers.data.dispose();
          handlers.exit.dispose();
          sessionHandlers.delete(sessionId);
        }
      }
    }
  });

  ws.on("error", (err) => {
    console.error(`[ws-server] WebSocket error for session ${sessionId}:`, err);
  });
});

// Graceful shutdown
function shutdown() {
  console.log("[ws-server] Shutting down...");
  clearInterval(heartbeatInterval);
  captureManager.dispose();
  ptyManager.dispose();
  // Clean up all session handlers
  for (const [, handlers] of Array.from(sessionHandlers)) {
    handlers.data.dispose();
    handlers.exit.dispose();
  }
  sessionHandlers.clear();
  wss.close(() => {
    console.log("[ws-server] Server closed.");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
