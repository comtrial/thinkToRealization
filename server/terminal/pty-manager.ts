// node-pty is a native addon — use require() for compatibility
const pty = require("node-pty") as typeof import("node-pty");
import type { IPty } from "node-pty";

interface PtySession {
  pty: IPty;
  lastActivity: number;
  timeout: NodeJS.Timeout;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class PtyManager {
  private sessions = new Map<string, PtySession>();

  create(sessionId: string, cols: number, rows: number): IPty {
    // If session already exists, return existing pty
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.refreshTimeout(sessionId, existing);
      return existing.pty;
    }

    const shell = process.env.SHELL || "/bin/zsh";

    // Filter out undefined values and Claude Code session markers from process.env
    // (node-pty requires string values; Claude markers cause "nested session" errors)
    const cleanEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined && !key.startsWith("CLAUDE") && key !== "CLAUDE_CODE_ENTRYPOINT") {
        cleanEnv[key] = val;
      }
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: process.env.HOME || "/",
      env: {
        ...cleanEnv,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        LANG: "ko_KR.UTF-8",
        FORCE_COLOR: "3",
      },
    });

    const timeout = setTimeout(() => {
      console.log(`[pty-manager] Idle timeout for session ${sessionId}`);
      this.kill(sessionId);
    }, IDLE_TIMEOUT_MS);

    this.sessions.set(sessionId, {
      pty: ptyProcess,
      lastActivity: Date.now(),
      timeout,
    });

    console.log(`[pty-manager] Created pty for session ${sessionId} (pid: ${ptyProcess.pid})`);
    return ptyProcess;
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[pty-manager] No pty for session ${sessionId}`);
      return;
    }
    this.refreshTimeout(sessionId, session);
    session.pty.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.refreshTimeout(sessionId, session);
    session.pty.resize(cols, rows);
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearTimeout(session.timeout);
    try {
      session.pty.kill();
    } catch {
      // pty may already be dead
    }
    this.sessions.delete(sessionId);
    console.log(`[pty-manager] Killed pty for session ${sessionId}`);
  }

  get(sessionId: string): IPty | undefined {
    return this.sessions.get(sessionId)?.pty;
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  dispose(): void {
    console.log(`[pty-manager] Disposing all ptys (${this.sessions.size} sessions)`);
    for (const [sessionId] of Array.from(this.sessions)) {
      this.kill(sessionId);
    }
  }

  private refreshTimeout(sessionId: string, session: PtySession): void {
    session.lastActivity = Date.now();
    clearTimeout(session.timeout);
    session.timeout = setTimeout(() => {
      console.log(`[pty-manager] Idle timeout for session ${sessionId}`);
      this.kill(sessionId);
    }, IDLE_TIMEOUT_MS);
  }
}
