import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient();

  // SQLite WAL mode + performance pragmas
  client.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});
  client.$executeRawUnsafe("PRAGMA busy_timeout=5000;").catch(() => {});
  client.$executeRawUnsafe("PRAGMA synchronous=NORMAL;").catch(() => {});
  client.$executeRawUnsafe("PRAGMA cache_size=-20000;").catch(() => {});

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
