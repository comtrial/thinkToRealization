import fs from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), ".devflow-logs");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export async function saveLog(
  sessionId: string,
  role: string,
  content: string,
  _rawLength: number
): Promise<void> {
  try {
    const logFile = path.join(LOG_DIR, `${sessionId}.log`);
    const entry = `[${new Date().toISOString()}] [${role}] ${content}\n`;
    fs.appendFileSync(logFile, entry, "utf-8");
  } catch (err) {
    console.error("[capture-store] Failed to save log:", err);
  }
}

export function getLogFilePath(sessionId: string): string {
  return path.join(LOG_DIR, `${sessionId}.log`);
}
