import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/api-response";

// POST /api/test/cleanup — hard-delete all test data (only for E2E tests)
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not allowed in production", { status: 403 });
  }

  try {
    // Use raw SQL for reliable cleanup with SQLite
    await prisma.$executeRawUnsafe("DELETE FROM NodeStateLog");
    await prisma.$executeRawUnsafe("DELETE FROM Decision");
    await prisma.$executeRawUnsafe("DELETE FROM SessionFile");
    await prisma.$executeRawUnsafe("DELETE FROM Session");
    await prisma.$executeRawUnsafe("DELETE FROM Edge");
    await prisma.$executeRawUnsafe("DELETE FROM Node");
    await prisma.$executeRawUnsafe("DELETE FROM Project");

    // Force SQLite WAL checkpoint to ensure all changes are visible to other connections
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");

    return successResponse({ cleaned: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
