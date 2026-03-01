import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, errorResponse } from "@/lib/api-response";
import { handlePrismaError } from "@/lib/prisma-error";
import type { SessionMessage } from "@/lib/types/api";

type Params = { params: Promise<{ id: string }> };

function parseSessionLog(raw: string): SessionMessage[] {
  const messages: SessionMessage[] = [];
  const sections = raw.split(/^## (Human|Assistant):/m);
  let index = 0;
  for (let i = 1; i < sections.length; i += 2) {
    const role = sections[i].toLowerCase() === "human" ? "user" : "assistant";
    const content = (sections[i + 1] || "").trim();
    if (content) {
      messages.push({
        role: role as "user" | "assistant",
        content,
        index,
        highlightId: null,
      });
      index++;
    }
  }
  return messages;
}

// GET /api/sessions/:id/log — return raw log + parsed messages
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return notFound("Session", id);

    if (!session.logFilePath) {
      return successResponse({ raw: "", messages: [] });
    }

    try {
      const raw = await fs.readFile(session.logFilePath, "utf-8");
      const messages = parseSessionLog(raw);
      return successResponse({ raw, messages });
    } catch {
      return errorResponse(
        "LOG_NOT_FOUND",
        `Log file not found at ${session.logFilePath}`,
        404
      );
    }
  } catch (error) {
    return handlePrismaError(error);
  }
}
