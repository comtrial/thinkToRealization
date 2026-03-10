import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  validationError,
  notFound,
  errorResponse,
} from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import { updateNodeStatusSchema } from "@/lib/schemas/node";
import { nodeWithCounts, toNodeResponse } from "@/lib/node-helpers";

// Manual transitions allow any status change (user intent respected)
const ALL_STATUSES = ["backlog", "todo", "in_progress", "done", "archived"];
const VALID_TRANSITIONS: Record<string, string[]> = {
  backlog: ALL_STATUSES.filter((s) => s !== "backlog"),
  todo: ALL_STATUSES.filter((s) => s !== "todo"),
  in_progress: ALL_STATUSES.filter((s) => s !== "in_progress"),
  done: ALL_STATUSES.filter((s) => s !== "done"),
  archived: ALL_STATUSES.filter((s) => s !== "archived"),
};

type Params = { params: Promise<{ id: string }> };

// PUT /api/nodes/:id/status — change status with state log
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Invalid JSON body", status: 400 } },
        { status: 400 }
      );
    }

    const parsed = updateNodeStatusSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await prisma.node.findUnique({ where: { id } });
    if (!existing) return notFound("Node", id);

    const targetStatus = parsed.data.status;

    // Same status transition check
    if (existing.status === targetStatus) {
      return errorResponse(
        "SAME_STATUS",
        `Node is already in '${targetStatus}' status`,
        400
      );
    }

    // Valid transition check
    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      return errorResponse(
        "INVALID_TRANSITION",
        `Cannot transition from '${existing.status}' to '${targetStatus}'. Allowed transitions: ${allowed.join(", ")}`,
        400
      );
    }

    // Assignee required for in_progress and done statuses
    if (
      (targetStatus === "in_progress" || targetStatus === "done") &&
      !existing.assigneeId
    ) {
      return errorResponse(
        "ASSIGNEE_REQUIRED",
        `'${targetStatus}' 상태로 변경하려면 담당자를 먼저 배정해야 합니다`,
        400
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.node.update({
        where: { id },
        data: { status: targetStatus },
        include: nodeWithCounts,
      }),
      prisma.nodeStateLog.create({
        data: {
          nodeId: id,
          fromStatus: existing.status,
          toStatus: targetStatus,
          triggerType: parsed.data.triggerType,
        },
      }),
    ]);

    return successResponse(toNodeResponse(updated));
  } catch (error) {
    return handlePrismaError(error);
  }
}
