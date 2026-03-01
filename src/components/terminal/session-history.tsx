"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronDown, User, Bot, Monitor } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { TerminalLog } from "@/types";

interface SessionHistoryProps {
  sessionId: string;
}

interface PaginatedLogs {
  logs: TerminalLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const roleConfig = {
  user: { icon: User, label: "User", color: "text-blue-400 bg-blue-500/10" },
  assistant: { icon: Bot, label: "Claude", color: "text-green-400 bg-green-500/10" },
  system: { icon: Monitor, label: "System", color: "text-gray-400 bg-gray-500/10" },
};

export function SessionHistory({ sessionId }: SessionHistoryProps) {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(
    async (pageNum: number) => {
      setIsLoading(true);
      const result = await api<PaginatedLogs>(
        `/api/sessions/${sessionId}/history?page=${pageNum}&limit=50`
      );
      if (result.ok) {
        if (pageNum === 1) {
          setLogs(result.data.logs);
        } else {
          setLogs((prev) => [...prev, ...result.data.logs]);
        }
        setTotalPages(result.data.pagination.totalPages);
        setPage(pageNum);
      }
      setIsLoading(false);
    },
    [sessionId]
  );

  useEffect(() => {
    setLogs([]);
    setPage(1);
    fetchLogs(1);
  }, [sessionId, fetchLogs]);

  const loadMore = () => {
    if (page < totalPages && !isLoading) {
      fetchLogs(page + 1);
    }
  };

  if (logs.length === 0 && !isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: "#030712" }}
      >
        <p className="text-gray-500 text-sm">이 세션의 기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "#030712" }}>
      <div className="px-3 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-500">읽기 전용 — 세션 기록</span>
      </div>
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-2">
          {logs.map((log) => {
            const config =
              roleConfig[log.role as keyof typeof roleConfig] ?? roleConfig.system;
            const Icon = config.icon;

            return (
              <div key={log.id} className="flex gap-2">
                <div
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded",
                    config.color
                  )}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <pre
                  className="flex-1 whitespace-pre-wrap break-words text-xs text-gray-300"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {log.content}
                </pre>
              </div>
            );
          })}

          {page < totalPages && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500"
                onClick={loadMore}
                disabled={isLoading}
              >
                <ChevronDown className="mr-1 h-3 w-3" />
                {isLoading ? "로딩 중..." : "더 보기"}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
