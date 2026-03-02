import stripAnsi from "strip-ansi";
import { saveLog } from "../db/capture-store";

const FLUSH_INTERVAL_MS = 2000; // 2 seconds
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

interface CaptureSession {
  buffer: string;
  interval: NodeJS.Timeout;
}

export class CaptureManager {
  private sessions = new Map<string, CaptureSession>();

  start(sessionId: string): void {
    if (this.sessions.has(sessionId)) return;

    const interval = setInterval(() => {
      this.flush(sessionId);
    }, FLUSH_INTERVAL_MS);

    this.sessions.set(sessionId, { buffer: "", interval });
  }

  append(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.buffer += data;

    // Flush immediately if buffer exceeds max size
    if (session.buffer.length > MAX_BUFFER_SIZE) {
      this.flush(sessionId);
    }
  }

  async stop(sessionId: string): Promise<void> {
    // Flush remaining buffer before stopping
    await this.flush(sessionId);

    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearInterval(session.interval);
    this.sessions.delete(sessionId);
  }

  dispose(): void {
    for (const [sessionId] of Array.from(this.sessions)) {
      this.stop(sessionId);
    }
  }

  private async flush(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.buffer.length === 0) return;

    const raw = session.buffer;
    session.buffer = "";

    const rawLength = raw.length;
    const stripped = stripAnsi(raw);

    if (stripped.trim().length === 0) return;

    // Split into lines and classify by role
    const lines = stripped.split("\n");
    let currentRole = "system";
    let currentChunk: string[] = [];

    const chunks: { role: string; content: string }[] = [];

    for (const line of lines) {
      const role = classifyRole(line);
      if (role !== currentRole && currentChunk.length > 0) {
        chunks.push({ role: currentRole, content: currentChunk.join("\n") });
        currentChunk = [];
      }
      currentRole = role;
      currentChunk.push(line);
    }

    if (currentChunk.length > 0) {
      chunks.push({ role: currentRole, content: currentChunk.join("\n") });
    }

    // Save each chunk
    for (const chunk of chunks) {
      if (chunk.content.trim().length === 0) continue;
      await saveLog(sessionId, chunk.role, chunk.content, rawLength);
    }
  }
}

function classifyRole(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith(">")) return "user";
  if (trimmed.includes("Claude") || trimmed.includes("│")) return "assistant";
  return "system";
}
