"use client";

import { useEffect, useState } from "react";
import { Pin } from "lucide-react";

interface PinToastProps {
  show: boolean;
  onHide: () => void;
}

export function PinToast({ show, onHide }: PinToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onHide();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  if (!visible) return null;

  return (
    <div className="absolute left-1/2 top-12 z-50 -translate-x-1/2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 flex items-center gap-1.5">
      <Pin className="h-3 w-3" />
      결정사항 저장됨
    </div>
  );
}
