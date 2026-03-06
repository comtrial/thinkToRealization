import { prisma } from "../../src/lib/prisma";

/**
 * RecoveryManager: On WebSocket server startup, finds sessions stuck in
 * "active" status (stale sessions from previous crashes) and marks them
 * as "paused" so users can resume later.
 */
class RecoveryManager {
  /**
   * Find all sessions with status "active" and mark them as "paused".
   * Creates NodeStateLog entries for the transitions.
   */
  async recoverStaleSessions(): Promise<number> {
    const staleSessions = await prisma.session.findMany({
      where: { status: "active" },
      include: {
        node: { select: { id: true, status: true } },
      },
    });

    if (staleSessions.length === 0) {
      console.log("[recovery] No stale sessions found.");
      return 0;
    }

    console.log(
      `[recovery] Found ${staleSessions.length} stale session(s). Recovering...`
    );

    // Batch all recoveries in a single transaction
    await prisma.$transaction(async (tx) => {
      for (const session of staleSessions) {
        const now = new Date();
        const durationDelta = Math.floor(
          (now.getTime() - session.startedAt.getTime()) / 1000
        );

        await tx.session.update({
          where: { id: session.id },
          data: {
            status: "paused",
            endedAt: now,
            durationSeconds: session.durationSeconds + durationDelta,
          },
        });

        await tx.nodeStateLog.create({
          data: {
            nodeId: session.nodeId,
            fromStatus: session.node.status,
            toStatus: session.node.status === "in_progress" ? "todo" : session.node.status,
            triggerType: "recovery",
            triggerSessionId: session.id,
          },
        });

        if (session.node.status === "in_progress") {
          await tx.node.update({
            where: { id: session.nodeId },
            data: { status: "todo" },
          });
        }

        console.log(
          `[recovery] Session ${session.id} (node: ${session.nodeId}) marked as paused.`
        );
      }
    });

    return staleSessions.length;
  }
}

export const recoveryManager = new RecoveryManager();
