"use client";

import Link from "next/link";
import { Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  projectName?: string;
  showBack?: boolean;
}

export function AppHeader({ projectName, showBack }: AppHeaderProps) {
  return (
    <header className="flex h-12 md:h-14 items-center justify-between border-b border-border bg-background px-3 md:px-4">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {showBack && (
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline">대시보드</span>
            </Button>
          </Link>
        )}
        {!showBack && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              D
            </div>
            <span className="text-sm font-semibold">DevFlow</span>
          </Link>
        )}
        {projectName && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate max-w-[160px] md:max-w-none text-sm font-medium">{projectName}</span>
          </>
        )}
      </div>
      <Button variant="ghost" size="icon" className="text-muted-foreground flex-shrink-0">
        <Settings className="h-4 w-4" />
      </Button>
    </header>
  );
}
