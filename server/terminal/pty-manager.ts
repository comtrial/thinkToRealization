// node-pty is a native addon — use require() for compatibility
const pty = require("node-pty") as typeof import("node-pty");
import type { IPty } from "node-pty";
import { eventBus } from "../events/event-bus";

interface PtySession {
  pty: IPty;
  sessionId: string;
  nodeId: string;
  lastActivity: number;
  timeout: NodeJS.Timeout;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class PtyManager {
  // Key: nodeId (one active PTY per node)
  private sessions = new Map<string, PtySession>();
  // Reverse lookup: sessionId -> nodeId
  private sessionToNode = new Map<string, string>();

  create(
    nodeId: string,
    sessionId: string,
    cols: number,
    rows: number,
    cwd?: string
  ): IPty {
    // If this node already has an active PTY, return it
    const existing = this.sessions.get(nodeId);
    if (existing) {
      this.refreshTimeout(nodeId, existing);
      return existing.pty;
    }

    const shell = process.env.SHELL || "/bin/zsh";

    // Filter out undefined values and Claude Code session markers from process.env
    const cleanEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (
        val !== undefined &&
        !key.startsWith("CLAUDE") &&
        key !== "CLAUDE_CODE_ENTRYPOINT"
      ) {
        cleanEnv[key] = val;
      }
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: cwd || process.env.HOME || "/",
      env: {
        ...cleanEnv,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        LANG: "ko_KR.UTF-8",
        FORCE_COLOR: "3",
      },
    });

    const timeout = setTimeout(() => {
      console.log(`[pty-manager] Idle timeout for node ${nodeId}`);
      this.kill(nodeId);
    }, IDLE_TIMEOUT_MS);

    this.sessions.set(nodeId, {
      pty: ptyProcess,
      sessionId,
      nodeId,
      lastActivity: Date.now(),
      timeout,
    });
    this.sessionToNode.set(sessionId, nodeId);

    // Emit pty:data events via EventBus
    ptyProcess.onData((data: string) => {
      eventBus.emit("pty:data", { sessionId, data });
    });

    // Emit pty:exit events via EventBus
    ptyProcess.onExit(
      ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        console.log(
          `[pty-manager] PTY exited for node ${nodeId} (code: ${exitCode}, signal: ${signal})`
        );
        eventBus.emit("pty:exit", { sessionId, exitCode, signal: signal ?? 0 });
        // Clean up maps
        this.sessions.delete(nodeId);
        this.sessionToNode.delete(sessionId);
      }
    );

    console.log(
      `[pty-manager] Created pty for node ${nodeId}, session ${sessionId} (pid: ${ptyProcess.pid})`
    );
    return ptyProcess;
  }

  write(nodeId: string, data: string): void {
    const session = this.sessions.get(nodeId);
    if (!session) {
      console.warn(`[pty-manager] No pty for node ${nodeId}`);
      return;
    }
    this.refreshTimeout(nodeId, session);
    session.pty.write(data);
  }

  resize(nodeId: string, cols: number, rows: number): void {
    const session = this.sessions.get(nodeId);
    if (!session) return;
    this.refreshTimeout(nodeId, session);
    session.pty.resize(cols, rows);
  }

  kill(nodeId: string): void {
    const session = this.sessions.get(nodeId);
    if (!session) return;

    clearTimeout(session.timeout);
    try {
      session.pty.kill();
    } catch {
      // pty may already be dead
    }
    this.sessionToNode.delete(session.sessionId);
    this.sessions.delete(nodeId);
    console.log(`[pty-manager] Killed pty for node ${nodeId}`);
  }

  get(nodeId: string): IPty | undefined {
    return this.sessions.get(nodeId)?.pty;
  }

  has(nodeId: string): boolean {
    return this.sessions.has(nodeId);
  }

  /** Get session info by nodeId */
  getSessionInfo(
    nodeId: string
  ): { sessionId: string; nodeId: string } | undefined {
    const session = this.sessions.get(nodeId);
    if (!session) return undefined;
    return { sessionId: session.sessionId, nodeId: session.nodeId };
  }

  /** Get nodeId from sessionId */
  getNodeIdBySession(sessionId: string): string | undefined {
    return this.sessionToNode.get(sessionId);
  }

  /** Get all active sessions */
  getAllActive(): Array<{ nodeId: string; sessionId: string }> {
    return Array.from(this.sessions.values()).map((s) => ({
      nodeId: s.nodeId,
      sessionId: s.sessionId,
    }));
  }

  dispose(): void {
    console.log(
      `[pty-manager] Disposing all ptys (${this.sessions.size} sessions)`
    );
    for (const [nodeId] of Array.from(this.sessions)) {
      this.kill(nodeId);
    }
  }

  private refreshTimeout(nodeId: string, session: PtySession): void {
    session.lastActivity = Date.now();
    clearTimeout(session.timeout);
    session.timeout = setTimeout(() => {
      console.log(`[pty-manager] Idle timeout for node ${nodeId}`);
      this.kill(nodeId);
    }, IDLE_TIMEOUT_MS);
  }
}
