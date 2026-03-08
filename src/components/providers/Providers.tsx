"use client"

import { useEffect } from "react"
import { WebSocketProvider } from "./WebSocketProvider"
import { ProjectProvider } from "./ProjectProvider"
import { ToastProvider } from "@/components/shared/Toast"
import { useAuthStore } from "@/stores/auth-store"

// Global 401 interceptor — redirect to /login on expired session
if (typeof window !== "undefined") {
  const originalFetch = window.fetch
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await originalFetch.apply(this, args)
    if (res.status === 401) {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url
      // Skip redirect for auth endpoints (login/register/me)
      if (url.includes("/api/auth/")) return res
      // Skip redirect if already on public pages (prevents infinite reload loop)
      const path = window.location.pathname
      if (path === "/login" || path === "/register") return res
      window.location.href = "/login"
    }
    return res
  }
}

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
