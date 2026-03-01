"use client"

import { WebSocketProvider } from "./WebSocketProvider"
import { ProjectProvider } from "./ProjectProvider"
import { ToastProvider } from "@/components/shared/Toast"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <WebSocketProvider>
        <ToastProvider>{children}</ToastProvider>
      </WebSocketProvider>
    </ProjectProvider>
  )
}
