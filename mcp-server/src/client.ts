import { getValidCookie, login, clearSession } from "./auth.js"
import type { TTRApiResponse, TTRApiError } from "./types.js"

export class TTRClient {
  private baseUrl: string
  private email: string
  private password: string
  private cookie: string | null = null

  constructor(baseUrl: string, email: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "")
    this.email = email
    this.password = password
  }

  private async ensureCookie(): Promise<string> {
    if (!this.cookie) {
      this.cookie = await getValidCookie(this.baseUrl, this.email, this.password)
    }
    return this.cookie
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const cookie = await this.ensureCookie()
    const url = `${this.baseUrl}${path}`
    const opts: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
    }
    if (body) opts.body = JSON.stringify(body)

    let res = await fetch(url, opts)

    // Auto re-login on 401
    if (res.status === 401) {
      clearSession()
      this.cookie = await login(this.baseUrl, this.email, this.password)
      opts.headers = { ...opts.headers as Record<string, string>, Cookie: this.cookie }
      res = await fetch(url, opts)
    }

    const json = await res.json() as TTRApiResponse<T> | TTRApiError

    if (!res.ok || "error" in json) {
      const err = (json as TTRApiError).error
      throw new Error(`TTR API Error [${err.code}]: ${err.message}`)
    }

    return (json as TTRApiResponse<T>).data
  }

  // Convenience methods
  get<T>(path: string) { return this.request<T>("GET", path) }
  post<T>(path: string, body: unknown) { return this.request<T>("POST", path, body) }
  put<T>(path: string, body: unknown) { return this.request<T>("PUT", path, body) }
  del<T>(path: string) { return this.request<T>("DELETE", path) }

  // Get current user (for assignee auto-assignment)
  async getCurrentUserId(): Promise<string> {
    const user = await this.get<{ id: string }>("/api/auth/me")
    return user.id
  }
}
