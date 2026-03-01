import stripAnsi from "strip-ansi";

export interface ParsedMessage {
  role: "user" | "assistant";
  content: string;
  index: number;
}

/**
 * Parse a .devflow-logs/{sessionId}.log file into structured messages.
 *
 * The log format from capture-store.ts is:
 *   [ISO_TIMESTAMP] [role] content
 *
 * We detect role markers [user], [assistant], [system] and merge
 * consecutive lines of the same role into a single message.
 * System lines are skipped.
 */
export function parseSessionLog(logContent: string): ParsedMessage[] {
  const stripped = stripAnsi(logContent);
  const lines = stripped.split("\n");

  const messages: ParsedMessage[] = [];
  let currentRole: "user" | "assistant" | "system" | null = null;
  let currentContent: string[] = [];
  let messageIndex = 0;

  for (const line of lines) {
    const match = line.match(/^\[.*?\]\s+\[(user|assistant|system)\]\s*(.*)/);

    if (match) {
      if (currentRole && currentRole !== "system" && currentContent.length > 0) {
        const content = currentContent.join("\n").trim();
        if (content) {
          messages.push({
            role: currentRole,
            content,
            index: messageIndex++,
          });
        }
      }

      const role = match[1] as "user" | "assistant" | "system";
      currentRole = role;
      currentContent = match[2] ? [match[2]] : [];
    } else {
      if (currentRole) {
        currentContent.push(line);
      }
    }
  }

  if (currentRole && currentRole !== "system" && currentContent.length > 0) {
    const content = currentContent.join("\n").trim();
    if (content) {
      messages.push({
        role: currentRole,
        content,
        index: messageIndex++,
      });
    }
  }

  return messages;
}
