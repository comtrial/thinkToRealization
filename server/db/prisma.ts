import { PrismaClient } from "@prisma/client";
import path from "path";

// WS server runs in a separate process from Next.js,
// so it needs its own PrismaClient instance.
// Adjust DATABASE_URL to resolve relative path from project root.
const dbPath = path.resolve(__dirname, "../../prisma/dev.db");
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

// SQLite WAL mode + performance pragmas (must match Next.js instance)
prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {});
prisma.$executeRawUnsafe("PRAGMA busy_timeout=5000;").catch(() => {});
prisma.$executeRawUnsafe("PRAGMA synchronous=NORMAL;").catch(() => {});
prisma.$executeRawUnsafe("PRAGMA cache_size=-20000;").catch(() => {});

export default prisma;
