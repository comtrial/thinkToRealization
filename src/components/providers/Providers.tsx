"use client"

import { useEffect } from "react"
import { WebSocketProvider } from "./WebSocketProvider"
import { ProjectProvider } from "./ProjectProvider"
import { ToastProvider } from "@/components/shared/Toast"
import { useAuthStore } from "@/stores/auth-store"

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const fetchUser = useAuthStore((s) => s.fetchUser)

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthInitializer>
      <ProjectProvider>
        <WebSocketProvider>
          <ToastProvider>{children}</ToastProvider>
        </WebSocketProvider>
      </ProjectProvider>
    </AuthInitializer>
  )
}
