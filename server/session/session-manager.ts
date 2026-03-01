import { prisma } from "../../src/lib/prisma";
import { eventBus } from "../events/event-bus";
import { stateMachine } from "../state/state-machine";

class SessionManager {
  /**
   * Start a new session for a node.
   * - Creates DB record
   * - Triggers state machine transition (backlog/todo -> in_progress)
   * - Emits session:started event
   * Returns the new session ID.
   */
  async startSession(
    nodeId: string,
    title?: string
  ): Promise<string> {
    // Check for existing active session on this node
    const existing = await prisma.session.findFirst({
      where: { nodeId, status: "active" },
    });

    if (existing) {
      throw new Error(
        `Node ${nodeId} already has an active session: ${existing.id}`
      );
    }

    // Create session record
    const session = await prisma.session.create({
      data: {
        nodeId,
        title: title ?? null,
        status: "active",
        startedAt: new Date(),
      },
    });

    // Trigger state transition: -> in_progress
    await stateMachine.transition(
      nodeId,
      "session_start",
      undefined,
      session.id
    );

    // Emit event
    eventBus.emit("session:started", {
      sessionId: session.id,
      nodeId,
    });

    console.log(
      `[session-manager] Started session ${session.id} for node ${nodeId}`
    );

    return session.id;
  }

  /**
   * End a session.
   * - markDone=true: session completed, node -> done
   * - markDone=false: session paused, node -> todo (resumable)
   */
  async endSession(
    sessionId: string,
    markDone: boolean = false
  ): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== "active") {
      console.warn(
        `[session-manager] Session ${sessionId} is not active (status: ${session.status})`
      );
      return;
    }

    const now = new Date();
    const durationDelta = Math.floor(
      (now.getTime() - session.startedAt.getTime()) / 1000
    );

    // Update session record
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: markDone ? "completed" : "paused",
        endedAt: now,
        durationSeconds: session.durationSeconds + durationDelta,
      },
    });

    // Trigger state transition
    const triggerType = markDone ? "session_end_done" : "session_end_pause";
    await stateMachine.transition(
      session.nodeId,
      triggerType,
      undefined,
      sessionId
    );

    // Emit event
    eventBus.emit("session:ended", {
      sessionId,
      nodeId: session.nodeId,
      status: markDone ? "completed" : "paused",
    });

    console.log(
      `[session-manager] Ended session ${sessionId} (${markDone ? "completed" : "paused"})`
    );
  }

  /**
   * Resume a paused session.
   * - Reactivates the session
   * - Increments resumeCount
   * - Triggers state transition: todo/done -> in_progress
   */
  async resumeSession(sessionId: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== "paused") {
      throw new Error(
        `Cannot resume session ${sessionId} with status: ${session.status}`
      );
    }

    // Reactivate session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "active",
        resumeCount: session.resumeCount + 1,
        startedAt: new Date(), // Reset start time for duration tracking
        endedAt: null,
      },
    });

    // Trigger state transition: -> in_progress
    await stateMachine.transition(
      session.nodeId,
      "session_resume",
      undefined,
      sessionId
    );

    // Emit event
    eventBus.emit("session:resumed", {
      sessionId,
      nodeId: session.nodeId,
    });

    console.log(
      `[session-manager] Resumed session ${sessionId} for node ${session.nodeId}`
    );
  }

  /**
   * Get the active session for a node, if any.
   */
  async getActiveSession(nodeId: string): Promise<string | null> {
    const session = await prisma.session.findFirst({
      where: { nodeId, status: "active" },
      select: { id: true },
    });

    return session?.id ?? null;
  }
}

// Singleton export
export const sessionManager = new SessionManager();
