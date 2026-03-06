/**
 * DB environment configuration — Single Source of Truth
 *
 * Detection priority:
 *   1. DB_PROVIDER env var (explicit)
 *   2. DATABASE_URL pattern matching (implicit)
 *   3. Default: sqlite
 */

export type DBProvider = "sqlite" | "postgresql";

export function getDBProvider(): DBProvider {
  // 1. Explicit env var
  const explicit = process.env.DB_PROVIDER;
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";
  if (explicit === "sqlite") return "sqlite";

  // 2. DATABASE_URL pattern
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }

  // 3. Default
  return "sqlite";
}

export function isSQLite(): boolean {
  return getDBProvider() === "sqlite";
}

export function isPostgres(): boolean {
  return getDBProvider() === "postgresql";
}
