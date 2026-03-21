import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { config } from "dotenv"
import { join } from "path"
import { homedir } from "os"
import { existsSync } from "fs"
import { createServer } from "./server.js"
import { TTRClient } from "./client.js"

// Load config from ~/.ttr-mcp/.env
const envPath = join(homedir(), ".ttr-mcp", ".env")
if (existsSync(envPath)) {
  config({ path: envPath })
}

const baseUrl = process.env.TTR_BASE_URL || "https://think-to-realization.vercel.app"
const email = process.env.TTR_EMAIL
const password = process.env.TTR_PASSWORD

if (!email || !password) {
  console.error("TTR MCP Server: TTR_EMAIL and TTR_PASSWORD must be set in ~/.ttr-mcp/.env")
  console.error(`Expected env file at: ${envPath}`)
  console.error("Example:")
  console.error("  TTR_BASE_URL=https://think-to-realization.vercel.app")
  console.error("  TTR_EMAIL=admin@ttr.local")
  console.error("  TTR_PASSWORD=devflow123")
  process.exit(1)
}

const client = new TTRClient(baseUrl, email, password)
const server = createServer(client)
const transport = new StdioServerTransport()

await server.connect(transport)
