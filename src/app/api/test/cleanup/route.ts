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

    // Find all nodes belonging to test projects
    const testNodes = await prisma.node.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true },
    });
    const nodeIds = testNodes.map((n) => n.id);

    if (nodeIds.length > 0) {
      // Find all sessions belonging to test nodes
      const testSessions = await prisma.session.findMany({
        where: { nodeId: { in: nodeIds } },
        select: { id: true },
      });
      const sessionIds = testSessions.map((s) => s.id);

      // Delete bottom-up to avoid FK constraint issues
      if (sessionIds.length > 0) {
        await prisma.sessionFile.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });
      }
      await prisma.decision.deleteMany({
        where: { nodeId: { in: nodeIds } },
      });
      if (sessionIds.length > 0) {
        await prisma.session.deleteMany({
          where: { id: { in: sessionIds } },
        });
      }
      await prisma.plan.deleteMany({
        where: { nodeId: { in: nodeIds } },
      });
      await prisma.nodeStateLog.deleteMany({
        where: { nodeId: { in: nodeIds } },
      });
      await prisma.edge.deleteMany({
        where: {
          OR: [
            { fromNodeId: { in: nodeIds } },
            { toNodeId: { in: nodeIds } },
          ],
        },
      });
      // Clear parentNodeId references before deleting nodes
      await prisma.node.updateMany({
        where: { parentNodeId: { in: nodeIds } },
        data: { parentNodeId: null },
      });
      await prisma.node.deleteMany({
        where: { id: { in: nodeIds } },
      });
    }

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
