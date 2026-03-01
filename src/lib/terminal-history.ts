import type { TerminalLog } from "@/types";

export type LogRole = "user" | "assistant" | "system";

export const ROLE_STYLES: Record<LogRole, { label: string; color: string; bgClass: string }> = {
  user: { label: "You", color: "#3b82f6", bgClass: "bg-blue-500/10" },
  assistant: { label: "Claude", color: "#22c55e", bgClass: "bg-green-500/10" },
  system: { label: "System", color: "#9ca3af", bgClass: "bg-gray-500/10" },
};

function getRoleStyle(role: string) {
  if (role in ROLE_STYLES) return ROLE_STYLES[role as LogRole];
  return ROLE_STYLES.system;
}

export function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export type RenderedLog = {
  id: string;
  role: LogRole;
  content: string;
  timestamp: string;
  relativeTime: string;
  style: { label: string; color: string; bgClass: string };
};

export function renderLogs(logs: TerminalLog[]): RenderedLog[] {
  return logs.map((log) => ({
    id: log.id,
    role: (log.role as LogRole) || "system",
    content: log.content,
    timestamp: formatTimestamp(log.createdAt),
    relativeTime: formatRelativeTime(log.createdAt),
    style: getRoleStyle(log.role),
  }));
}

export function logsToMarkdown(logs: TerminalLog[]): string {
  return logs
    .map((log) => {
      const style = getRoleStyle(log.role);
      const time = formatTimestamp(log.createdAt);
      return `### ${style.label} (${time})\n\n${log.content}\n`;
    })
    .join("\n---\n\n");
}

export function logsToHtml(logs: TerminalLog[]): string {
  return logs
    .map((log) => {
      const style = getRoleStyle(log.role);
      const time = formatTimestamp(log.createdAt);
      return `<div class="${style.bgClass}" style="border-left: 3px solid ${style.color}; padding: 8px 12px; margin: 4px 0;">
  <div style="color: ${style.color}; font-size: 12px; margin-bottom: 4px;">
    <strong>${style.label}</strong> <span style="opacity: 0.6">${time}</span>
  </div>
  <pre style="white-space: pre-wrap; margin: 0;">${escapeHtml(log.content)}</pre>
</div>`;
    })
    .join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
