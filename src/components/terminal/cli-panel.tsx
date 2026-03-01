"use client";

import { Pin, Maximize2, RefreshCw, WifiOff, Wifi, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTerminal } from "@/hooks/use-terminal";
import { MobileInputBar } from "./mobile-input-bar";
import { cn } from "@/lib/utils";

interface CLIPanelProps {
  sessionId: string | null;
  sessionName: string;
  onPin?: () => void;
  onExpand?: () => void;
}

const statusConfig = {
  disconnected: { icon: WifiOff, label: "연결 끊김", color: "text-gray-500" },
  connecting: { icon: Loader2, label: "연결 중...", color: "text-yellow-400" },
  connected: { icon: Wifi, label: "연결됨", color: "text-green-400" },
  error: { icon: WifiOff, label: "연결 실패", color: "text-red-400" },
};

export function CLIPanel({ sessionId, sessionName, onPin, onExpand }: CLIPanelProps) {
  const { terminalRef, status, reconnect, sendInput } = useTerminal({
    sessionId,
    disabled: !sessionId,
  });

  const StatusIcon = statusConfig[status].icon;

  return (
    <div className="relative flex h-full flex-col" data-testid="cli-panel">
      {/* Terminal header */}
      <div className="flex h-9 md:h-10 items-center justify-between border-b border-border px-2 md:px-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {sessionName}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("flex items-center", statusConfig[status].color)}>
                  <StatusIcon
                    className={cn(
                      "h-3 w-3",
                      status === "connecting" && "animate-spin"
                    )}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{statusConfig[status].label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-1">
          {(status === "disconnected" || status === "error") && sessionId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={reconnect}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onPin}
          >
            <Pin className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onExpand}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={terminalRef as React.RefObject<HTMLDivElement>}
        className="flex-1 min-h-0"
        style={{
          background: "#030712",
        }}
      />

      {/* Mobile input bar for Korean IME support (iOS Safari) */}
      <MobileInputBar
        onSubmit={sendInput}
        disabled={!sessionId || status !== "connected"}
      />

      {/* Fallback when no session */}
      {!sessionId && (
        <div
          className="absolute inset-0 top-10 flex items-center justify-center pointer-events-none"
          style={{ background: "#030712" }}
        >
          <p className="text-gray-500 text-sm">
            새 세션을 시작해주세요
          </p>
        </div>
      )}
    </div>
  );
}
