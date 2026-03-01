import stripAnsi from "strip-ansi";
import type { SessionMessage } from "./types/api";

/**
 * Parse a .devflow-logs/{sessionId}.log file into structured messages.
 *
 * The log format from capture-store.ts is:
 *   [ISO_TIMESTAMP] [role] content
 *
 * We detect role markers [user], [assistant], [system] and merge
 * consecutive lines of the same role into a single message.
 * System lines are skipped (UI noise, prompts, etc.).
 */
export function parseSessionLog(logContent: string): SessionMessage[] {
  const stripped = stripAnsi(logContent);
  const lines = stripped.split("\n");

  const messages: SessionMessage[] = [];
  let currentRole: "user" | "assistant" | "system" | null = null;
  let currentContent: string[] = [];
  let messageIndex = 0;

  for (const line of lines) {
    const match = line.match(/^\[.*?\]\s+\[(user|assistant|system)\]\s*(.*)/);

    if (match) {
      // Flush previous block
      if (currentRole && currentRole !== "system" && currentContent.length > 0) {
        const content = currentContent.join("\n").trim();
        if (content) {
          messages.push({
            role: currentRole,
            content,
            index: messageIndex++,
            highlightId: null,
          });
        }
      }

      const role = match[1] as "user" | "assistant" | "system";
      currentRole = role;
      currentContent = match[2] ? [match[2]] : [];
    } else {
      // Continuation line (no role marker) — append to current block
      if (currentRole) {
        currentContent.push(line);
      }
    }
  }

  // Flush final block
  if (currentRole && currentRole !== "system" && currentContent.length > 0) {
    const content = currentContent.join("\n").trim();
    if (content) {
      messages.push({
        role: currentRole,
        content,
        index: messageIndex++,
        highlightId: null,
      });
    }
  }

  return messages;
}
