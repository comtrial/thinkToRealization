import { prisma } from "@/lib/prisma";
import { successResponse } from "@/lib/api-response";

const E2E_SLUG_PREFIXES = ["__e2e__", "e2e-test-"];

// POST /api/test/cleanup — delete only E2E test data (projects with test slug prefixes)
// User's real projects are never touched.
export async function POST() {
  try {
    // Find all test projects by slug prefix
    const testProjects = await prisma.project.findMany({
      where: {
        OR: E2E_SLUG_PREFIXES.map((prefix) => ({
          slug: { startsWith: prefix },
        })),
      },
      select: { id: true },
    });

    if (testProjects.length === 0) {
      return successResponse({ cleaned: true, count: 0 });
    }

    const projectIds = testProjects.map((p) => p.id);

    // Cascade delete handles Node, Edge, Session, SessionFile, Decision, NodeStateLog
    // because all relations have onDelete: Cascade from Project → Node → ...
    await prisma.project.deleteMany({
      where: { id: { in: projectIds } },
    });

    // Force SQLite WAL checkpoint to ensure all changes are visible
    await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");

    return successResponse({ cleaned: true, count: projectIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
