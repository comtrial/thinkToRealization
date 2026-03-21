import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const CONFIG_DIR = join(homedir(), ".ttr-mcp")
const SESSION_FILE = join(CONFIG_DIR, "session.json")

interface SessionCache {
  cookie: string
  expiresAt: string
}

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function loadSession(): SessionCache | null {
  try {
    if (!existsSync(SESSION_FILE)) return null
    const data = JSON.parse(readFileSync(SESSION_FILE, "utf-8")) as SessionCache
    if (new Date(data.expiresAt) < new Date()) return null
    return data
  } catch {
    return null
  }
}

function saveSession(cookie: string) {
  ensureConfigDir()
  const expiresAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString() // 6 days
  writeFileSync(SESSION_FILE, JSON.stringify({ cookie, expiresAt }, null, 2))
}

export async function getValidCookie(baseUrl: string, email: string, password: string): Promise<string> {
  // Try cached session first
  const cached = loadSession()
  if (cached) return cached.cookie

  // Login
  return login(baseUrl, email, password)
}

export async function login(baseUrl: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Login failed (${res.status}): ${body}`)
  }

  // Extract cookie from Set-Cookie header
  const setCookie = res.headers.get("set-cookie")
  if (!setCookie) throw new Error("Login succeeded but no cookie returned")

  const match = setCookie.match(/ttr-session=[^;]+/)
  if (!match) throw new Error("Login succeeded but ttr-session cookie not found")

  const cookie = match[0]
  saveSession(cookie)
  return cookie
}

export function clearSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      writeFileSync(SESSION_FILE, "{}")
    }
  } catch { /* ignore */ }
}
