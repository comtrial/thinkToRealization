import path from "path";

// WS server runs in a separate process from Next.js.
// Set DATABASE_URL only if not already provided (e.g., by test environment).
if (!process.env.DATABASE_URL) {
  const dbPath = path.resolve(__dirname, "../../prisma/dev.db");
  process.env.DATABASE_URL = `file:${dbPath}`;
}

// Delegate to the unified DB module — no duplicate PRAGMA logic.
// WS server is a separate tsx process, so globalThis singleton won't conflict.
//
// WARNING: tsx transpiles to CJS, so the env setup above runs before this import.
// If migrating to pure ESM, import hoisting will cause the import to evaluate
// before the env setup. In that case, use a preload module or dynamic import().
export { prisma as default } from "../../src/lib/db";
