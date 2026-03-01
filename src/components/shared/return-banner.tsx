"use client";

import { ArrowRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReturnBannerProps {
  fromStageName: string;
  onReturn: () => void;
}

export function ReturnBanner({ fromStageName, onReturn }: ReturnBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-amber-300 text-xs">
      <span className="flex items-center gap-1.5">
        <Undo2 className="h-3.5 w-3.5" />
        &quot;{fromStageName}&quot; 단계에서 이동함
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onReturn}
        className="h-6 gap-1 text-xs text-amber-300 hover:text-amber-200"
      >
        돌아가기 <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
