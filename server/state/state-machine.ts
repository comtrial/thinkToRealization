import { prisma } from "../../src/lib/prisma";
import { eventBus } from "../events/event-bus";

// Valid node statuses
type NodeStatus = "backlog" | "todo" | "in_progress" | "done" | "archived";

// Track A trigger types (auto, from session events)
type TrackATrigger =
  | "session_start"
  | "session_end_done"
  | "session_end_pause"
  | "session_resume";

// Track B trigger type (manual, from user clicks)
type TrackBTrigger = "user_manual";

type TriggerType = TrackATrigger | TrackBTrigger;

// Track A transition rules: { [currentStatus]: { [trigger]: targetStatus } }
const TRACK_A_TRANSITIONS: Partial<
  Record<NodeStatus, Partial<Record<TrackATrigger, NodeStatus>>>
> = {
  backlog: {
    session_start: "in_progress",
  },
  todo: {
    session_start: "in_progress",
    session_resume: "in_progress",
  },
  in_progress: {
    session_end_done: "done",
    session_end_pause: "todo",
  },
  done: {
    session_resume: "in_progress",
  },
};

export interface TransitionResult {
  fromStatus: string;
  toStatus: string;
}

class StateMachine {
  /**
   * Apply a state transition to a node.
   * - Track A triggers follow defined rules.
   * - Track B (user_manual) allows any -> any transition.
   * Returns the transition result or null if no transition occurred (idempotent).
   */
  async transition(
    nodeId: string,
    triggerType: TriggerType,
    targetStatus?: NodeStatus,
    triggerSessionId?: string
  ): Promise<TransitionResult | null> {
    // Use interactive transaction to prevent race conditions
    // (read + validate + write atomically)
    const result = await prisma.$transaction(async (tx) => {
      const node = await tx.node.findUnique({
        where: { id: nodeId },
        select: { status: true },
      });

      if (!node) {
        console.error(`[state-machine] Node not found: ${nodeId}`);
        return null;
      }

      const currentStatus = node.status as NodeStatus;
      let newStatus: NodeStatus;

      if (triggerType === "user_manual") {
        // Track B: manual transitions are unrestricted
        if (!targetStatus) {
          console.error(
            "[state-machine] user_manual trigger requires targetStatus"
          );
          return null;
        }
        newStatus = targetStatus;
      } else {
        // Track A: use transition rules
        const transitions = TRACK_A_TRANSITIONS[currentStatus];
        const resolved = transitions?.[triggerType as TrackATrigger];
        if (!resolved) {
          console.warn(
            `[state-machine] No transition for ${currentStatus} + ${triggerType}`
          );
          return null;
        }
        newStatus = resolved;
      }

      // Idempotent: skip if same status
      if (currentStatus === newStatus) {
        return null;
      }

      // Execute DB update + log atomically within the transaction
      await tx.node.update({
        where: { id: nodeId },
        data: { status: newStatus, updatedAt: new Date() },
      });

      await tx.nodeStateLog.create({
        data: {
          nodeId,
          fromStatus: currentStatus,
          toStatus: newStatus,
          triggerType,
          triggerSessionId: triggerSessionId ?? null,
        },
      });

      return { fromStatus: currentStatus, toStatus: newStatus } as TransitionResult;
    });

    if (!result) return null;

    // Emit state change event (outside transaction)
    eventBus.emit("node:stateChanged", {
      nodeId,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      triggerType,
    });

    console.log(
      `[state-machine] ${nodeId}: ${result.fromStatus} -> ${result.toStatus} (${triggerType})`
    );

    return result;
  }
}

// Singleton export
export const stateMachine = new StateMachine();
