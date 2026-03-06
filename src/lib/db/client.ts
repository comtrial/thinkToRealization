import { PrismaClient } from "@prisma/client";
import { isSQLite } from "./config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient();

  // SQLite-only performance pragmas (skip for PostgreSQL)
  if (isSQLite()) {
    client.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});
    client.$executeRawUnsafe("PRAGMA busy_timeout=5000;").catch(() => {});
    client.$executeRawUnsafe("PRAGMA synchronous=NORMAL;").catch(() => {});
    client.$executeRawUnsafe("PRAGMA cache_size=-20000;").catch(() => {});
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * SQLite WAL checkpoint — use after test cleanup
 */
export async function walCheckpoint(): Promise<void> {
  if (!isSQLite()) return;
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)").catch(() => {});
}
