"use client";

import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileInputBarProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function MobileInputBar({ onSubmit, disabled }: MobileInputBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value;
    if (!trimmed) return;
    onSubmit(trimmed + "\n");
    setValue("");
    inputRef.current?.focus();
  }, [value, onSubmit]);

  return (
    <div className="flex items-center gap-2 border-t border-border bg-gray-900 px-3 py-2 md:hidden">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !(e.nativeEvent as KeyboardEvent).isComposing) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="명령어 입력..."
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        lang="ko"
        className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[44px]"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSubmit}
        disabled={disabled || !value}
        className="h-[44px] w-[44px] text-blue-400"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
