"use client"

import { WebSocketProvider } from "./WebSocketProvider"
import { ProjectProvider } from "./ProjectProvider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <WebSocketProvider>{children}</WebSocketProvider>
    </ProjectProvider>
  )
}
